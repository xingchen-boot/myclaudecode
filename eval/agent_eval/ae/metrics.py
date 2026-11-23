"""指标聚合：通过率、pass@k、成本、延迟分位、失败根因分布。"""
import math
import statistics
from collections import Counter
from typing import Dict, List

from .models import CaseResult


def pass_at_k(n: int, c: int, k: int) -> float:
    """无偏估计：n 次采样里 c 次成功，k 次采样内至少成功一次的概率。"""
    if n <= 0 or k <= 0 or n - c < k:
        return 1.0 if c > 0 else 0.0
    if c <= 0:
        return 0.0
    return round(1.0 - math.comb(n - c, k) / math.comb(n, k), 4)


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    idx = max(0, min(len(values) - 1, int(round((p / 100) * (len(values) - 1)))))
    return round(values[idx], 1)


def summarize(results: List[CaseResult], k: int = 3) -> Dict:
    """按 task_id 聚合（同一任务可重复采样，用于 pass@k）。"""
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    by_task: Dict[str, List[CaseResult]] = {}
    for r in results:
        by_task.setdefault(r.task_id, []).append(r)

    pass_at_k_by_task = {}
    for tid, rs in by_task.items():
        n = len(rs)
        c = sum(1 for r in rs if r.passed)
        pass_at_k_by_task[tid] = pass_at_k(n, c, min(k, n))

    steps = [r.trajectory.steps_count for r in results]
    latencies = [r.trajectory.total_latency_ms for r in results]
    costs = [r.trajectory.total_cost for r in results]
    tokens = [r.trajectory.total_tokens for r in results]
    buckets = Counter(r.failure_bucket for r in results if not r.passed)
    judge_scores = [r.judge_score for r in results]

    return {
        "cases": total,
        "tasks": len(by_task),
        "passed": passed,
        "pass_rate": round(passed / total, 4) if total else 0.0,
        "pass_at_k": round(sum(pass_at_k_by_task.values()) / len(pass_at_k_by_task), 4)
        if pass_at_k_by_task else 0.0,
        "k": k,
        "avg_steps": round(statistics.mean(steps), 1) if steps else 0.0,
        "max_steps": max(steps) if steps else 0,
        "p50_latency_ms": percentile(latencies, 50),
        "p95_latency_ms": percentile(latencies, 95),
        "total_cost_usd": round(sum(costs), 4),
        "avg_cost_usd": round(statistics.mean(costs), 4) if costs else 0.0,
        "total_tokens": sum(tokens),
        "avg_judge": round(statistics.mean(judge_scores), 1) if judge_scores else 0.0,
        "failure_buckets": dict(buckets),
    }
