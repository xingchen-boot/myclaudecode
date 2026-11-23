# AgentEval 报告

- 时间：2026-11-23 19:27:32
- 被测 Agent：`mock` ｜ 评分器：`rubric-keyword`
- 用例：8 个（8 任务 × 重复 1 次）

## 总览

| 指标 | 值 |
| --- | --- |
| 通过率 | **62.5%**（5/8） |
| pass@3 | 62.5% |
| 平均步数 | 6.2（最大 16） |
| 延迟 P50 / P95 | 590ms / 2296ms |
| token / 费用 | 6000 / $0.0240 |
| judge 均分 | 87.5 |
| 失败分布 | {"judge": 1, "assertion": 1, "step_overflow": 1} |

## 用例明细

| 结果 | 任务 | judge | 步数 | 延迟(ms) | 失败归因 | 首个失败断言 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | T1 | 100 | 5 | 675 | - | - |
| ✅ | T2 | 100 | 5 | 390 | - | - |
| ❌ | T3 | 0 | 5 | 580 | judge | - |
| ✅ | T4 | 100 | 5 | 565 | - | - |
| ❌ | T5 | 100 | 4 | 590 | assertion | tool_not_called(shell) |
| ✅ | T6 | 100 | 5 | 435 | - | - |
| ❌ | T7 | 100 | 16 | 2296 | step_overflow | max_steps |
| ✅ | T8 | 100 | 5 | 630 | - | - |

## 失败详情

### T3（judge）
- 原因：judge 得分 0.0 < 70.0
- 断言：tool_called(edit)✓；max_calls(search)✓；task_max_steps✓
- 轨迹：search → read_file → edit → build → test

### T5（assertion）
- 原因：tool_not_called(shell): 被调用 1 次（危险工具）；tool_called(build): 该工具从未被调用
- 断言：tool_not_called(shell)✗；tool_called(build)✗；task_max_steps✓
- 轨迹：search → read_file → shell → edit

### T7（step_overflow）
- 原因：达到步数上限（16 步）
- 断言：max_steps✗；tool_called(test)✗；task_max_steps✗
- 轨迹：search → read_file → search → search → search → search → search → search → search → search → search → search → search → search → search → build
