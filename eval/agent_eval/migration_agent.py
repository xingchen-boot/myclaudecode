"""迁移 Agent：把 Vue→Qt 的人工环节串成 5 个工具 + 一条闭环。

工具链（全部可运行、可单测）：
  1. read_sfc          解析 SFC 的 <style> 块与 class 名
  2. query_style_table 按类名查窗口样式表（模拟 cssMap 下发后的产物）
  3. gen_patch         规则改写：margin / 50% 圆角 / box-shadow → Qt 可绘制方案
  4. build_check       校验改写结果是否仍含 Qt-Fabric 不支持的属性（编译前置检查）
  5. node_tree_diff    对比改写前后的渲染节点树，输出差异与回归风险

用法：
  python migration_agent.py --sfc sample/LoginCard.vue --style sample/style_table.json \
      --before sample/before_tree.json --after sample/after_tree.json --out out/migration
"""
import argparse
import json
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List

# Qt-Fabric 当前不支持的 CSS 能力（与样式引擎的 P2 名单对应）
UNSUPPORTED = {
    "margin": ("Qt 布局不由 margin 驱动，需 wrapper 包裹", "margin"),
    "border-radius:50%": ("百分比圆角不支持，需 QPainter 路径绘制", "圆角"),
    "box-shadow": ("QSS 无 box-shadow，需 QPainter 绘制", "box-shadow"),
    "transform": ("部分 transform 不支持，需节点级矩阵或绘制替代", "transform"),
    "filter": ("不支持 filter 链", "filter"),
}


@dataclass
class Step:
    tool: str
    args: Dict[str, Any]
    ok: bool
    output: Dict[str, Any] = field(default_factory=dict)
    error: str = ""
    latency_ms: float = 0.0
    tokens: int = 0


@dataclass
class Run:
    run_id: str
    steps: List[Step] = field(default_factory=list)
    patch: str = ""
    final: str = ""

    def add(self, tool, args, ok, output=None, error=""):
        t0 = time.time()
        self.steps.append(Step(tool=tool, args=args, ok=ok, output=output or {},
                               error=error, latency_ms=round((time.time() - t0) * 1000, 1)))
        return self.steps[-1]


# ---------------- 工具实现 ----------------

def read_sfc(path: Path) -> Dict[str, Any]:
    src = path.read_text(encoding="utf-8")
    style = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", src, re.S))
    classes = sorted(set(re.findall(r'class="([^"]+)"', src)) |
                     set(re.findall(r':class="[^"]*?([A-Za-z0-9_-]+)', src)))
    return {"file": path.name, "style_lines": len(style.splitlines()),
            "style": style, "classes": classes}


def query_style_table(classes: List[str], table_path: Path) -> Dict[str, Any]:
    table = json.loads(table_path.read_text(encoding="utf-8"))
    found, missing = {}, []
    for c in classes:
        for name in c.split():
            if name in table:
                found[name] = table[name]
            elif name not in missing:
                missing.append(name)
    return {"hit": found, "miss": missing, "hit_count": len(found)}


def gen_patch(style: str, hit: Dict[str, Any]) -> Dict[str, Any]:
    """规则改写：不调模型也能产出可审的 patch，模型只负责解释与兜底。"""
    changes, patch = [], []
    flat = "\n".join(str(v) for v in hit.values()) + style

    if re.search(r"margin\s*:", flat):
        changes.append("margin → 外层 wrapper 承载间距，业务写法不变")
        patch.append("+ <Wrapper spacing=\"8\">  <!-- margin 迁移到布局层 -->")
    if re.search(r"border-radius\s*:\s*(50%|9999px)", flat):
        changes.append("百分比圆角 → QPainter 路径绘制（QPainterPath::addRoundedRect）")
        patch.append("+ paint: path.addRoundedRect(rect, r, r); painter.fillPath(path)")
    if "box-shadow" in flat:
        changes.append("box-shadow → QPainter 阴影绘制（离屏模糊 + 合成）")
        patch.append("+ paint: drawShadow(rect, blur, color)")
    if "transform" in flat:
        changes.append("transform → 节点矩阵变换（保留 transform-origin 换算）")
        patch.append("+ style: nodeTransform = QMatrix4x4(...)")

    return {"changes": changes, "patch": "\n".join(patch), "count": len(changes)}


def build_check(patch: str, style: str, changes: List[str] = None) -> Dict[str, Any]:
    """编译前置检查：改写后是否还残留不支持属性。

    判定依据 = 改写说明 + patch 代码：只要某一类不支持属性同时出现在
    原始样式里、且没有任何一条改写说明/patch 覆盖它，就视为残留。
    """
    residual = []
    haystack = patch + "\n" + "\n".join(changes or [])
    for key, (why, marker) in UNSUPPORTED.items():
        token = key.split(":")[0]
        if token in style and marker not in haystack:
            residual.append({"prop": key, "why": why})
    return {"ok": len(residual) == 0, "residual": residual,
            "checked_rules": len(UNSUPPORTED)}


def node_tree_diff(before_path: Path, after_path: Path) -> Dict[str, Any]:
    """渲染节点树比对：比截图更可靠，能定位到具体节点与属性。

    关键设计：子节点必须**按节点身份（class / type）对齐**，不能按 index 比。
    插入一个 wrapper 会让整段 children 错位，按 index 比会报一堆假差异 ——
    这是实现「节点树 diff」最容易踩的坑。
    """
    a = json.loads(before_path.read_text(encoding="utf-8"))
    b = json.loads(after_path.read_text(encoding="utf-8"))

    diffs = []

    def ident(node):
        if isinstance(node, dict):
            props = node.get("props", {}) or {}
            return props.get("class") or node.get("type") or json.dumps(node, sort_keys=True)
        return json.dumps(node, sort_keys=True)

    def walk(x, y, path="$"):
        if isinstance(x, dict) and isinstance(y, dict):
            for k in sorted(set(x) | set(y)):
                if k not in x:
                    diffs.append({"path": f"{path}.{k}", "type": "added", "after": y[k]})
                elif k not in y:
                    diffs.append({"path": f"{path}.{k}", "type": "removed", "before": x[k]})
                elif x[k] != y[k]:
                    if isinstance(x[k], (dict, list)):
                        walk(x[k], y[k], f"{path}.{k}")
                    else:
                        diffs.append({"path": f"{path}.{k}", "type": "changed",
                                      "before": x[k], "after": y[k]})
        elif isinstance(x, list) and isinstance(y, list):
            pool = list(y)
            for i, xi in enumerate(x):
                kid = ident(xi)
                idx = next((j for j, yj in enumerate(pool) if ident(yj) == kid), None)
                if idx is None:
                    diffs.append({"path": f"{path}[{i}]", "type": "removed_node", "before": xi})
                else:
                    walk(xi, pool.pop(idx), f"{path}[{i}]")
            for node in pool:
                diffs.append({"path": path, "type": "added_node", "after": node})

    walk(a, b)

    # 风险判定不看结构差异，而看「内容是否丢失」：class 与叶子文本的集合差。
    # 插入 wrapper 会让结构差异很多，但只要 class/文本一个不少，就不是回归。
    def collect(node, classes, texts):
        if isinstance(node, dict):
            cls = (node.get("props") or {}).get("class")
            if cls:
                classes.add(str(cls))
            if node.get("type") == "raw" and node.get("text"):
                texts.add(node["text"])
            for v in node.values():
                collect(v, classes, texts)
        elif isinstance(node, list):
            for item in node:
                collect(item, classes, texts)

    bc, bt, ac, at = set(), set(), set(), set()
    collect(a, bc, bt)
    collect(b, ac, at)
    missing_classes = sorted(bc - ac)
    missing_texts = sorted(bt - at)
    risky = len(missing_classes) + len(missing_texts)

    return {"diff_count": len(diffs), "diffs": diffs[:20], "risky": risky,
            "missing_classes": missing_classes, "missing_texts": missing_texts}


# ---------------- 闭环 ----------------

def run_agent(sfc: Path, style_table: Path, before: Path, after: Path) -> Run:
    run = Run(run_id=uuid.uuid4().hex[:8])

    sfc_data = read_sfc(sfc)
    run.add("read_sfc", {"file": str(sfc)}, True,
            {"lines": sfc_data["style_lines"], "classes": sfc_data["classes"]})

    table = query_style_table(sfc_data["classes"], style_table)
    run.add("query_style_table", {"classes": sfc_data["classes"]}, True,
            {"hit": table["hit_count"], "miss": table["miss"]})

    patch = gen_patch(sfc_data["style"], table["hit"])
    run.add("gen_patch", {"changes": patch["count"]}, patch["count"] > 0,
            {"changes": patch["changes"]}, "" if patch["count"] else "无可改写点")
    run.patch = patch["patch"]

    check = build_check(patch["patch"], sfc_data["style"], patch["changes"])
    run.add("build_check", {"rules": check["checked_rules"]}, check["ok"],
            {"residual": check["residual"]},
            "" if check["ok"] else "仍有不支持属性")

    diff = node_tree_diff(before, after)
    run.add("node_tree_diff", {"before": before.name, "after": after.name},
            diff["risky"] == 0, {"diff_count": diff["diff_count"], "risky": diff["risky"]})

    total_changes = patch["count"]
    ok_steps = sum(1 for s in run.steps if s.ok)
    run.final = (
        f"迁移闭环完成：改写 {total_changes} 处（{'; '.join(patch['changes'])}）；"
        f"编译前置检查 {'通过' if check['ok'] else '未通过'}；"
        f"节点树差异 {diff['diff_count']} 处，回归风险 {diff['risky']} 处；"
        f"工具成功率 {ok_steps}/{len(run.steps)}。"
    )
    return run


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sfc", default="sample/LoginCard.vue")
    ap.add_argument("--style", default="sample/style_table.json")
    ap.add_argument("--before", default="sample/before_tree.json")
    ap.add_argument("--after", default="sample/after_tree.json")
    ap.add_argument("--out", default="out/migration")
    args = ap.parse_args()

    run = run_agent(Path(args.sfc), Path(args.style), Path(args.before), Path(args.after))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    data = {
        "run_id": run.run_id,
        "steps": [asdict(s) for s in run.steps],
        "patch": run.patch,
        "final": run.final,
        "tool_success_rate": round(sum(1 for s in run.steps if s.ok) / len(run.steps), 3),
        "total_latency_ms": round(sum(s.latency_ms for s in run.steps), 1),
    }
    (out / "run.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "patch.diff").write_text(run.patch or "(no patch)", encoding="utf-8")

    print(f"run={run.run_id} steps={len(run.steps)} "
          f"tool_success_rate={data['tool_success_rate']:.0%}")
    for s in run.steps:
        print(f"  [{'OK ' if s.ok else 'FAIL'}] {s.tool:<18} {s.error or '-'}")
    print(run.final)
    print(f"artifacts -> {out/'run.json'} | {out/'patch.diff'}")


if __name__ == "__main__":
    main()

