"""评测执行器：载入任务集 → 跑 adapter → 断言 + 打分 → 汇总。"""
import json
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List

from .adapters import AgentAdapter
from .asserts import check_all
from .judge import has_conflict
from .models import CaseResult, Task, Trajectory


def load_suite(path: str | Path) -> List[Task]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    tasks = []
    for item in data["tasks"]:
        tasks.append(Task(
            id=item["id"],
            prompt=item["prompt"],
            assertions=item.get("assertions", []),
            rubric=item.get("rubric", []),
            max_steps=item.get("max_steps", 12),
            weight=item.get("weight", 1.0),
            repo=item.get("repo", ""),
            tags=item.get("tags", []),
        ))
    return tasks


def evaluate_one(task: Task, adapter: AgentAdapter, judge,
                 judge_threshold: float = 70.0) -> CaseResult:
    t0 = time.time()
    try:
        traj = adapter.run(task)
    except Exception:
        traj = Trajectory(steps=[], final_answer="", stopped_reason="error",
                          meta={"error": traceback.format_exc()[-400:]})

    assertions = check_all(task, traj)
    hard_pass = all(a.passed for a in assertions)
    score, detail = judge.score(task, traj)
    judge_pass = score >= judge_threshold

    bucket, reason = "", ""
    if traj.stopped_reason == "error":
        bucket, reason = "runtime", "适配器执行异常"
    elif traj.stopped_reason == "max_steps":
        bucket, reason = "step_overflow", f"达到步数上限（{traj.steps_count} 步）"
    elif not hard_pass:
        failed = [a for a in assertions if not a.passed]
        bucket = "assertion"
        reason = "；".join(f"{a.name}: {a.detail}" for a in failed[:3])
    elif not judge_pass:
        bucket = "judge"
        reason = f"judge 得分 {score} < {judge_threshold}"

    if hard_pass and judge_pass and has_conflict(hard_pass, score, judge_threshold):
        reason = (reason + " [冲突待人工复核]").strip()

    passed = hard_pass and judge_pass and traj.stopped_reason == "finish"
    return CaseResult(
        task_id=task.id, passed=passed, assertion_results=assertions,
        judge_score=score, judge_detail=detail, trajectory=traj,
        failure_bucket=bucket if not passed else "", reason=reason,
    )


def run_suite(tasks: List[Task], adapter: AgentAdapter, judge,
              repeats: int = 1, workers: int = 4,
              judge_threshold: float = 70.0) -> List[CaseResult]:
    jobs = [t for t in tasks for _ in range(max(1, repeats))]
    results: List[CaseResult] = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(evaluate_one, t, adapter, judge, judge_threshold)
                   for t in jobs]
        for f in futures:
            results.append(f.result())
    order = {t.id: i for i, t in enumerate(tasks)}
    results.sort(key=lambda r: order.get(r.task_id, 999))
    return results
