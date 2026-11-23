# AgentEval

面向 **Coding / 代码迁移类 Agent** 的轻量评测框架：用「硬断言 + Rubric 打分 + 成本/延迟统计」判断一次 Agent 运行到底算不算成功，并把失败按根因分类，可直接接进 CI 当门禁。

零第三方依赖（纯标准库），`python cli.py run` 一条命令就能跑出 Markdown / HTML / JSON 三份报告。

## 为什么需要它

Agent 输出「看起来对」是最容易骗过人的地方：

- 直接改文件但**没读原文件** → 改错地方还自我感觉良好；
- 用 `shell rm -rf` 清目录 → 任务完成但**动了不该动的工具**；
- 反复检索 15 步最后超时 → 看起来"很努力"，实际**空转烧钱**；
- 硬条件全过但答案**答非所问** → 规则检查不出来。

所以本框架把判定拆成两层，**任何一层不通过就算失败**：

| 层 | 负责什么 | 实现 |
| --- | --- | --- |
| 硬断言 | 工具是否被调用、调用顺序、危险工具、步数上限、产物关键词 | `ae/asserts.py`（纯规则，0 成本） |
| 语义打分 | 是否真的解决了任务、有没有遗漏约束 | `ae/judge.py`（Rubric 离线 / LLM-as-judge 可选） |

两层结论冲突（硬断言过、judge 低分，或反之）会标记 `[冲突待人工复核]`，不直接判定通过 —— 避免"规则通过就放行"的安全盲区。

## 快速开始

```bash
cd eval/agent_eval
python cli.py run --suite suites/coding_agent.json --agent mock
```

输出：

```
cases=8 pass_rate=62.5% pass@3=62.5% avg_steps=6.2 p95=1290ms cost=$0.0240
buckets={'judge': 1, 'assertion': 1, 'step_overflow': 1}
  FAIL T3 [judge] judge 得分 0.0 < 70.0
  FAIL T5 [assertion] tool_not_called(shell): 被调用 1 次（危险工具）
  FAIL T7 [step_overflow] 达到步数上限（16 步）
report -> out/report.md | out/report.html
```

三份产物：`out/report.md`（贴 PR/CI）、`out/report.html`（给人看，含评分条形图）、`out/result.json`（喂给看板）。

### 接真实模型

```bash
export AE_API_KEY=sk-xxx           # OpenAI 兼容
export AE_BASE_URL=https://api.openai.com/v1
export AE_MODEL=gpt-4o-mini
python cli.py run --agent http --repeats 3 --k 3 --judge llm
```

`--repeats 3 --k 3` 会做多次采样算 **pass@k**（k 次内至少成功一次的概率，无偏估计），用来衡量**稳定性**而不是单次运气。

### CI 门禁

```bash
python cli.py run --threshold 0.8    # 通过率低于 80% 退出码 1，阻断合并
```

## 目录结构

```
AgentEval/
├── cli.py                 # 命令行入口（run / --threshold 门禁）
├── ae/
│   ├── models.py          # Task / Step / Trajectory / CaseResult
│   ├── asserts.py         # 7 类轨迹断言的 DSL 与执行
│   ├── judge.py           # RubricJudge（离线）+ LLMJudge（可选，失败自动回退）
│   ├── metrics.py         # pass_rate / pass@k / P50·P95 / 成本 / 失败分布
│   ├── runner.py          # 并发执行、异常兜底、失败根因分桶
│   ├── report.py          # Markdown / HTML / JSON 三态渲染
│   └── adapters.py        # Mock / HTTP / FrontCode 三种 Agent 接入
├── suites/coding_agent.json   # 8 个任务用例（含 3 个故意设计的负例）
└── out/                   # 运行产物
```

## 断言 DSL

写在 suite JSON 的 `assertions` 里：

| 类型 | 作用 |
| --- | --- |
| `tool_called` / `tool_not_called` | 必须调用 / 绝不许调用某个工具（危险工具黑名单） |
| `tool_order` | 先后顺序（如必须先 `search` 再 `edit`） |
| `max_steps` / `max_calls` | 步数上限、单工具调用次数上限（防空转烧钱） |
| `final_contains` | 最终答案必须包含关键产物词 |
| `min_tool_success_rate` | 工具成功率下限（识别环境不稳） |

## Mock 的意义

`MockAgent` 不是玩具：它内置 3 类**可控失败**（误用 shell / 空转 16 步 / 答案含糊），用来验证**框架本身是否有效**。

> 如果换任何 Agent 后评测结果都是 100%，那不是 Agent 变强了，是断言写废了。
> 先用 Mock 确认「该挂的确实挂了」，再拿去评真实模型 —— 这是评测框架的自检测试。

## 已知限制

1. **单轮规划式 HTTP Agent**：`HttpAgent` 目前让模型一次性给出步骤 JSON，不是真正的多轮 tool loop，接真实 Agent 请用 `FrontCodeAdapter` 或替换 `run()`。
2. **pass@k 需要非确定性采样**：确定性 Agent 下 `pass@k == pass_rate`，要用真实模型 + `temperature>0` 才有区分度。
3. **RubricJudge 是关键词代理指标**，不等价语义理解；关键任务请开 `--judge llm` 并保留人工复核队列。
4. 未做多模态产物校验（截图 diff），迁移类任务建议后续接视觉比对作为新断言类型。

## Roadmap

- [ ] 截图 / 渲染 diff 断言（迁移场景必备）
- [ ] 轨迹回放与失败用例最小化
- [ ] 与 GitHub Actions 集成的示例 workflow
- [ ] 结果看板：跨版本通过率趋势对比
