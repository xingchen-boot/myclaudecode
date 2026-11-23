"""报告渲染：Markdown（给 PR/CI 贴）、HTML（给人看）、JSON（给下游）。"""
import html
import json
from datetime import datetime
from typing import Dict, List

from .models import CaseResult


def _row(r: CaseResult) -> str:
    status = "✅" if r.passed else "❌"
    first_fail = next((a.name for a in r.assertion_results if not a.passed), "-")
    return (f"| {status} | {r.task_id} | {r.judge_score:.0f} | "
            f"{r.trajectory.steps_count} | {r.trajectory.total_latency_ms:.0f} | "
            f"{r.failure_bucket or '-'} | {first_fail} |")


def to_markdown(results: List[CaseResult], m: Dict, meta: Dict) -> str:
    lines = [
        "# AgentEval 报告", "",
        f"- 时间：{datetime.now():%Y-%m-%d %H:%M:%S}",
        f"- 被测 Agent：`{meta.get('adapter')}` ｜ 评分器：`{meta.get('judge')}`",
        f"- 用例：{m['cases']} 个（{m['tasks']} 任务 × 重复 {m['cases'] // max(1, m['tasks'])} 次）",
        "",
        "## 总览", "",
        "| 指标 | 值 |", "| --- | --- |",
        f"| 通过率 | **{m['pass_rate']:.1%}**（{m['passed']}/{m['cases']}） |",
        f"| pass@{m['k']} | {m['pass_at_k']:.1%} |",
        f"| 平均步数 | {m['avg_steps']}（最大 {m['max_steps']}） |",
        f"| 延迟 P50 / P95 | {m['p50_latency_ms']:.0f}ms / {m['p95_latency_ms']:.0f}ms |",
        f"| token / 费用 | {m['total_tokens']} / ${m['total_cost_usd']:.4f} |",
        f"| judge 均分 | {m['avg_judge']} |",
        f"| 失败分布 | {json.dumps(m['failure_buckets'], ensure_ascii=False)} |",
        "", "## 用例明细", "",
        "| 结果 | 任务 | judge | 步数 | 延迟(ms) | 失败归因 | 首个失败断言 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    lines += [_row(r) for r in results]

    failed = [r for r in results if not r.passed]
    if failed:
        lines += ["", "## 失败详情", ""]
        for r in failed:
            lines.append(f"### {r.task_id}（{r.failure_bucket}）")
            lines.append(f"- 原因：{r.reason}")
            lines.append(f"- 断言："
                         + "；".join(f"{a.name}{'✓' if a.passed else '✗'}"
                                    for a in r.assertion_results))
            lines.append(f"- 轨迹：{' → '.join(r.trajectory.tool_names())}")
            lines.append("")
    return "\n".join(lines)


def to_html(results: List[CaseResult], m: Dict, meta: Dict) -> str:
    rows = []
    for r in results:
        color = "#12a150" if r.passed else "#d64545"
        rows.append(
            f"<tr><td style='color:{color};font-weight:700'>"
            f"{'PASS' if r.passed else 'FAIL'}</td>"
            f"<td>{html.escape(r.task_id)}</td><td>{r.judge_score:.0f}</td>"
            f"<td>{r.trajectory.steps_count}</td><td>{r.trajectory.total_latency_ms:.0f}</td>"
            f"<td>{html.escape(r.failure_bucket or '-')}</td>"
            f"<td>{html.escape(r.reason[:120])}</td></tr>")

    bars = []
    for r in results:
        w = max(2, int(r.judge_score))
        c = "#12a150" if r.passed else "#d64545"
        bars.append(
            f"<div class='bar'><span>{html.escape(r.task_id)}</span>"
            f"<div class='track'><div class='fill' style='width:{w}%;background:{c}'></div></div>"
            f"<b>{r.judge_score:.0f}</b></div>")

    return f"""<!doctype html><html lang="zh"><meta charset="utf-8">
<title>AgentEval 报告</title>
<style>
 body{{font:14px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;margin:32px;color:#1a1a1a}}
 h1{{font-size:22px;margin:0 0 4px}} .sub{{color:#777;font-size:12px}}
 .cards{{display:flex;gap:12px;margin:18px 0 6px;flex-wrap:wrap}}
 .card{{border:1px solid #e6e6e6;border-radius:8px;padding:10px 14px;min-width:130px}}
 .card b{{display:block;font-size:20px;color:#1f3a5f}}
 table{{border-collapse:collapse;width:100%;margin-top:10px;font-size:13px}}
 th,td{{border-bottom:1px solid #eee;padding:7px 8px;text-align:left}}
 th{{background:#f7f9fc;color:#1f3a5f}}
 .bar{{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px}}
 .bar span{{width:52px;color:#555}} .track{{flex:1;background:#f1f3f6;height:10px;border-radius:5px}}
 .fill{{height:10px;border-radius:5px}} .bar b{{width:34px;text-align:right}}
</style>
<h1>AgentEval 报告</h1>
<div class="sub">{datetime.now():%Y-%m-%d %H:%M:%S} ｜ adapter: {meta.get('adapter')} ｜ judge: {meta.get('judge')}</div>
<div class="cards">
 <div class="card"><span>通过率</span><b>{m['pass_rate']:.1%}</b></div>
 <div class="card"><span>pass@{m['k']}</span><b>{m['pass_at_k']:.1%}</b></div>
 <div class="card"><span>平均步数</span><b>{m['avg_steps']}</b></div>
 <div class="card"><span>P95 延迟</span><b>{m['p95_latency_ms']:.0f}ms</b></div>
 <div class="card"><span>总费用</span><b>${m['total_cost_usd']:.3f}</b></div>
</div>
<h2 style="font-size:16px;margin:18px 0 4px">评分分布</h2>
{''.join(bars)}
<h2 style="font-size:16px;margin:18px 0 4px">用例明细</h2>
<table><tr><th>结果</th><th>任务</th><th>judge</th><th>步数</th><th>延迟(ms)</th><th>归因</th><th>原因</th></tr>
{''.join(rows)}</table>
</html>"""


def to_json(results: List[CaseResult], m: Dict, meta: Dict) -> Dict:
    return {
        "meta": {**meta, "generated_at": datetime.now().isoformat(timespec="seconds")},
        "metrics": m,
        "cases": [{
            "task_id": r.task_id, "passed": r.passed,
            "judge_score": r.judge_score, "judge_detail": r.judge_detail,
            "steps": r.trajectory.steps_count,
            "tools": r.trajectory.tool_names(),
            "tokens": r.trajectory.total_tokens,
            "cost": r.trajectory.total_cost,
            "latency_ms": r.trajectory.total_latency_ms,
            "failure_bucket": r.failure_bucket, "reason": r.reason,
            "assertions": [{"name": a.name, "passed": a.passed, "detail": a.detail}
                           for a in r.assertion_results],
        } for r in results],
    }
