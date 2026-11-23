"""Agent 适配器：统一成 AgentAdapter.run(task) -> Trajectory。

内置三种：
  MockAgent   —— 确定性轨迹，用于验证评测框架本身（无需 API Key、可进 CI）
  HttpAgent   —— OpenAI 兼容的单轮规划式 Agent（真实模型，需 AE_API_KEY）
  FrontCodeAdapter —— 把 FrontCode 的命令行接入评测（示例占位）
"""
import hashlib
import json
import os
import time
import urllib.request
from typing import List

from .models import Step, Task, Trajectory


class AgentAdapter:
    name = "base"

    def run(self, task: Task) -> Trajectory:
        raise NotImplementedError


class MockAgent(AgentAdapter):
    """确定性假 Agent：按任务 id 生成不同轨迹，包含 3 类可控失败。

    用途：给评测框架做「自测」——如果被测用例全过或全挂，说明是框架坏了，
    而不是 Agent 变好了。这个设计本身也是一条可以讲的工程细节。
    """
    name = "mock"

    FAIL_SHELL_TASK = "T5"      # 误用 shell → 触发 tool_not_called 断言
    LOOP_TASK = "T7"            # 空转 15 步 → 触发 max_steps / 步数溢出
    VAGUE_TASK = "T3"           # 答案含糊 → judge 低分

    def _kw(self, task: Task) -> str:
        kws = []
        for item in task.rubric:
            kws.extend(x.strip() for x in item.split("|")[-1].split(",") if x.strip())
        return kws

    def run(self, task: Task) -> Trajectory:
        steps: List[Step] = []
        seed = int(hashlib.md5(task.id.encode()).hexdigest()[:6], 16)
        base_latency = 60 + seed % 80

        def add(tool, ok=True, output="", tokens=120, err=None):
            steps.append(Step(
                tool=tool, ok=ok, output=output,
                tokens=tokens, cost=round(tokens * 0.000004, 6),
                latency_ms=base_latency + len(steps) * 7, error=err))

        add("search", output=f"命中 3 个候选文件（{task.repo or 'repo'}/styles/*.css）")
        add("read_file", output="读取 SFC 样式块 412 行，包含 margin / border-radius / scoped")

        if task.id == self.FAIL_SHELL_TASK:
            add("shell", output="rm -rf build/ (误操作)")
            add("edit", output="生成 patch：margin 改为 wrapper 包裹")
        elif task.id == self.LOOP_TASK:
            for i in range(13):
                add("search", ok=(i % 5 != 4), output=f"第 {i + 1} 次重复检索，无新信息",
                    err=None if i % 5 != 4 else "timeout")
            add("build", ok=False, output="编译超时", err="timeout")
        else:
            add("edit", output="生成 patch：margin → wrapper；50% 圆角 → QPainter 绘制")
            add("build", output="编译通过，0 error")
            add("test", output="4 passed / 0 failed")

        kws = self._kw(task)
        if task.id == self.VAGUE_TASK:
            final = "已经优化过了，效果还可以。"
        else:
            final = ("已完成迁移改写。关键点："
                     + "；".join(dict.fromkeys(kws[:6])))

        return Trajectory(
            steps=steps, final_answer=final,
            stopped_reason="max_steps" if task.id == self.LOOP_TASK else "finish",
            meta={"adapter": self.name, "task_tags": task.tags},
        )


class HttpAgent(AgentAdapter):
    """真实模型接入（单轮规划式，够用且实现简单，便于替换成循环式 Agent）。

    环境变量：AE_API_KEY / AE_BASE_URL / AE_MODEL
    """
    name = "http"

    def __init__(self, base_url=None, model=None, timeout=60.0):
        self.base_url = (base_url or os.environ.get(
            "AE_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
        self.model = model or os.environ.get("AE_MODEL", "gpt-4o-mini")
        self.api_key = os.environ.get("AE_API_KEY", "")
        self.timeout = timeout

    def available(self) -> bool:
        return bool(self.api_key)

    def run(self, task: Task) -> Trajectory:
        if not self.available():
            return MockAgent().run(task)

        body = json.dumps({
            "model": self.model,
            "messages": [{
                "role": "user",
                "content": ("你是编码 Agent。请给出解决步骤（JSON 数组，元素形如 "
                            '{"tool":"read_file","args":{...}}），最后用 FINAL: 开头写结论。\n'
                            f"任务：{task.prompt}"),
            }],
            "temperature": 0,
        }).encode()
        req = urllib.request.Request(
            self.base_url + "/chat/completions", data=body,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {self.api_key}"})
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            payload = json.loads(resp.read().decode())
        text = payload["choices"][0]["message"]["content"]
        usage = payload.get("usage", {})
        tokens = int(usage.get("total_tokens", 0))

        steps = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    plan = json.loads(line)
                    steps.append(Step(tool=plan.get("tool", "unknown"),
                                      args=plan.get("args", {}),
                                      output="(model-planned)"))
                except json.JSONDecodeError:
                    continue
        if not steps:
            steps = [Step(tool="llm_plan", output=text[:400])]

        steps[-1].tokens = tokens
        steps[-1].cost = round(tokens * 0.000004, 6)
        steps[-1].latency_ms = round((time.time() - t0) * 1000, 1)

        final = text.split("FINAL:")[-1].strip() if "FINAL:" in text else text[-300:]
        return Trajectory(steps=steps, final_answer=final,
                          meta={"adapter": self.name, "model": self.model})


class FrontCodeAdapter(AgentAdapter):
    """把 FrontCode（本地 CLI Agent）接入评测的示例。

    约定：FrontCode 以 `--json` 输出轨迹到 stdout，这里解析成 Trajectory。
    没配 AE_FRONTCODE_CMD 时回退到 Mock，保证 CI 不依赖本机环境。
    """
    name = "frontcode"

    def __init__(self, cmd=None):
        self.cmd = cmd or os.environ.get("AE_FRONTCODE_CMD", "")

    def run(self, task: Task) -> Trajectory:
        if not self.cmd:
            return MockAgent().run(task)
        import subprocess
        proc = subprocess.run([self.cmd, "--json", task.prompt],
                              capture_output=True, text=True, timeout=300)
        try:
            data = json.loads(proc.stdout)
            steps = [Step(tool=s.get("tool", "?"), output=s.get("output", ""),
                          ok=s.get("ok", True)) for s in data.get("steps", [])]
            return Trajectory(steps=steps, final_answer=data.get("final", ""),
                              meta={"adapter": self.name})
        except Exception:
            return Trajectory(steps=[Step(tool="runner", ok=False,
                                         output=proc.stderr[:300], error="parse_failed")],
                              final_answer="", stopped_reason="error")


def get_adapter(name: str) -> AgentAdapter:
    if name == "mock":
        return MockAgent()
    if name == "http":
        return HttpAgent()
    if name == "frontcode":
        return FrontCodeAdapter()
    raise ValueError(f"未知 adapter: {name}")
