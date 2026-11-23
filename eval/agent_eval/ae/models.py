"""AgentEval — 数据类型定义。"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Step:
    tool: str
    args: Dict[str, Any] = field(default_factory=dict)
    ok: bool = True
    output: str = ""
    tokens: int = 0
    cost: float = 0.0
    latency_ms: float = 0.0
    error: Optional[str] = None


@dataclass
class Trajectory:
    steps: List[Step] = field(default_factory=list)
    final_answer: str = ""
    stopped_reason: str = "finish"      # finish | max_steps | error
    meta: Dict[str, Any] = field(default_factory=dict)

    @property
    def steps_count(self) -> int:
        return len(self.steps)

    @property
    def total_tokens(self) -> int:
        return sum(s.tokens for s in self.steps)

    @property
    def total_cost(self) -> float:
        return round(sum(s.cost for s in self.steps), 6)

    @property
    def total_latency_ms(self) -> float:
        return round(sum(s.latency_ms for s in self.steps), 1)

    def tool_names(self) -> List[str]:
        return [s.tool for s in self.steps]

    def first_index(self, tool: str) -> int:
        names = self.tool_names()
        return names.index(tool) if tool in names else -1

    def calls(self, tool: str) -> int:
        return sum(1 for s in self.steps if s.tool == tool)


@dataclass
class AssertionResult:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class Task:
    id: str
    prompt: str
    assertions: List[Dict[str, Any]]
    rubric: List[str] = field(default_factory=list)
    max_steps: int = 12
    weight: float = 1.0
    repo: str = ""
    tags: List[str] = field(default_factory=list)


@dataclass
class CaseResult:
    task_id: str
    passed: bool
    assertion_results: List[AssertionResult]
    judge_score: float
    judge_detail: str
    trajectory: Trajectory
    failure_bucket: str = ""     # assertion | judge | step_overflow | runtime | ""
    reason: str = ""

    @property
    def failed_assertions(self) -> List[AssertionResult]:
        return [a for a in self.assertion_results if not a.passed]
