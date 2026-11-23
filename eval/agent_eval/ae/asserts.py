"""轨迹断言：不依赖模型打分的硬性规则校验。

断言 DSL（写在 suite JSON 的 assertions 数组里）：
  {"type": "tool_called", "tool": "edit"}
  {"type": "tool_not_called", "tool": "shell"}
  {"type": "tool_order", "before": "search", "after": "edit"}
  {"type": "max_steps", "n": 8}
  {"type": "final_contains", "text": "cssMap"}
  {"type": "min_tool_success_rate", "rate": 0.8}
  {"type": "max_calls", "tool": "search", "n": 2}
"""
from typing import Any, Dict, List

from .models import AssertionResult, Task, Trajectory


def _check(rule: Dict[str, Any], task: Task, traj: Trajectory) -> AssertionResult:
    kind = rule.get("type")

    if kind == "tool_called":
        tool = rule["tool"]
        n = traj.calls(tool)
        return AssertionResult(
            f"tool_called({tool})", n > 0,
            f"调用 {n} 次" if n else "该工具从未被调用",
        )

    if kind == "tool_not_called":
        tool = rule["tool"]
        n = traj.calls(tool)
        return AssertionResult(
            f"tool_not_called({tool})", n == 0,
            "未调用，符合预期" if n == 0 else f"被调用 {n} 次（危险工具）",
        )

    if kind == "tool_order":
        before, after = rule["before"], rule["after"]
        i, j = traj.first_index(before), traj.first_index(after)
        ok = i != -1 and j != -1 and i < j
        return AssertionResult(
            f"tool_order({before}<{after})", ok,
            f"{before}@{i} / {after}@{j}" if ok else f"顺序不满足：{before}@{i} / {after}@{j}",
        )

    if kind == "max_steps":
        n = int(rule["n"])
        ok = traj.steps_count <= n
        return AssertionResult("max_steps", ok, f"{traj.steps_count} 步（上限 {n}）")

    if kind == "final_contains":
        text = rule["text"]
        ok = text in (traj.final_answer or "")
        return AssertionResult(
            f"final_contains({text})", ok,
            "命中" if ok else f"最终答案未包含「{text}」",
        )

    if kind == "min_tool_success_rate":
        rate = float(rule["rate"])
        total = traj.steps_count
        if total == 0:
            return AssertionResult("min_tool_success_rate", False, "没有工具调用")
        ok_n = sum(1 for s in traj.steps if s.ok)
        actual = ok_n / total
        return AssertionResult(
            "min_tool_success_rate", actual >= rate,
            f"{actual:.0%}（要求 ≥{rate:.0%}）",
        )

    if kind == "max_calls":
        tool, n = rule["tool"], int(rule["n"])
        actual = traj.calls(tool)
        return AssertionResult(
            f"max_calls({tool})", actual <= n, f"{actual} 次（上限 {n}）",
        )

    return AssertionResult(f"unknown({kind})", False, "未知断言类型")


def check_all(task: Task, traj: Trajectory) -> List[AssertionResult]:
    results = [_check(rule, task, traj) for rule in task.assertions]
    # 任务自带的 max_steps 作为兜底断言
    results.append(
        AssertionResult("task_max_steps", traj.steps_count <= task.max_steps,
                        f"{traj.steps_count} 步（任务上限 {task.max_steps}）")
    )
    return results
