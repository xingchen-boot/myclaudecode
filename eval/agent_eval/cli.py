"""AgentEval 命令行入口。

用法：
  python cli.py run --suite suites/coding_agent.json --agent mock
  python cli.py run --suite suites/coding_agent.json --agent http --repeats 2
  python cli.py run --suite suites/coding_agent.json --threshold 0.8   # CI 门禁
"""
import argparse
import json
import sys
from pathlib import Path

from ae.adapters import get_adapter
from ae.judge import LLMJudge, RubricJudge
from ae.metrics import summarize
from ae.report import to_html, to_json, to_markdown
from ae.runner import load_suite, run_suite


def cmd_run(args) -> int:
    tasks = load_suite(args.suite)
    adapter = get_adapter(args.agent)
    judge = LLMJudge() if args.judge == "llm" else RubricJudge()

    results = run_suite(tasks, adapter, judge, repeats=args.repeats,
                        workers=args.workers, judge_threshold=args.judge_threshold)
    m = summarize(results, k=args.k)
    meta = {"adapter": adapter.name, "judge": judge.name,
            "suite": Path(args.suite).name}

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(to_markdown(results, m, meta), encoding="utf-8")
    (out / "report.html").write_text(to_html(results, m, meta), encoding="utf-8")
    (out / "result.json").write_text(
        json.dumps(to_json(results, m, meta), ensure_ascii=False, indent=2),
        encoding="utf-8")

    print(f"cases={m['cases']} pass_rate={m['pass_rate']:.1%} "
          f"pass@{m['k']}={m['pass_at_k']:.1%} avg_steps={m['avg_steps']} "
          f"p95={m['p95_latency_ms']:.0f}ms cost=${m['total_cost_usd']:.4f}")
    print(f"buckets={m['failure_buckets']}")
    for r in results:
        if not r.passed:
            print(f"  FAIL {r.task_id} [{r.failure_bucket}] {r.reason[:90]}")
    print(f"report -> {out / 'report.md'} | {out / 'report.html'}")

    if m["pass_rate"] < args.threshold:
        print(f"GATE FAILED: {m['pass_rate']:.1%} < threshold {args.threshold:.0%}")
        return 1
    print(f"GATE PASSED: {m['pass_rate']:.1%} >= threshold {args.threshold:.0%}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="agent-eval")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="执行一次评测")
    r.add_argument("--suite", default="suites/coding_agent.json")
    r.add_argument("--agent", default="mock", choices=["mock", "http", "frontcode"])
    r.add_argument("--judge", default="rubric", choices=["rubric", "llm"])
    r.add_argument("--repeats", type=int, default=1)
    r.add_argument("--k", type=int, default=3, help="pass@k 的 k")
    r.add_argument("--workers", type=int, default=4)
    r.add_argument("--judge-threshold", type=float, default=70.0)
    r.add_argument("--threshold", type=float, default=0.6, help="CI 门禁通过率")
    r.add_argument("--out", default="out")
    r.set_defaults(func=cmd_run)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
