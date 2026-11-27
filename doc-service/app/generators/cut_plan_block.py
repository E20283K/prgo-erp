"""Compact guillotine cutting plan for the passport's production page.

The plan comes from the layout tab (impositionState.cutPlans, one per form) and is drawn as
it is there: the sheet with its knife lines numbered, which edge goes against the back gauge
and which faces the knife, and the back gauge settings in cut order.
"""

import math
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.units import mm

from app.core.fonts import FONT_BOLD, FONT_REGULAR

CUT_BODY_H = 46.0
CUT_BODY_MIN_H = 34.0
DRAW_MAX_W = 96.0
LIST_COL_W = 36.0
LIST_HEAD_H = 4.6


def pick_cut_plans(od: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The order's saved cutting plans, when the job is cut on a guillotine."""
    imp = od.get("impositionState") or {}
    if imp.get("category") != "guillotine":
        return []
    plans = imp.get("cutPlans")
    return [p for p in plans if isinstance(p, dict) and p.get("steps")] if isinstance(plans, list) else []


def cut_block_body_h(scale: float) -> float:
    return max(CUT_BODY_MIN_H, CUT_BODY_H * scale)


def cut_plan_badge(plan: Dict[str, Any], forms: int) -> str:
    cells = plan.get("cells") or []
    piece = f"{_n(cells[0].get('w'))}×{_n(cells[0].get('h'))}" if cells else ""
    parts = [
        f"F{plan.get('formIndex', 1)}/{forms}" if forms > 1 else "",
        f"LIST {_n(plan.get('sheetW'))}×{_n(plan.get('sheetH'))}",
        f"DONA {piece}" if piece else "",
        f"{plan.get('pieces', len(cells))} DONA",
        f"{plan.get('strokes', len(plan.get('steps') or []))} KESISH",
    ]
    return " • ".join(p for p in parts if p)


def _n(v: Any) -> str:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return "—"
    return f"{f:g}"


def _edge_labels(first_axis: str, printed: bool = True) -> Dict[str, str]:
    """A printed sheet has its gripper and side lay edges; a stock sheet only gauge edges."""
    y_stage = 1 if first_axis == "y" else 2
    x_stage = 2 if first_axis == "y" else 1
    return {
        "top": f"PICHOQ {y_stage}",
        "bottom": f"KLAPAN • TIRGAK {y_stage}" if printed else f"TIRGAK {y_stage}",
        "right": f"PICHOQ {x_stage}",
        "left": f"YON TIRGAK • TIRGAK {x_stage}" if printed else f"TIRGAK {x_stage}",
    }


def draw_cut_plan_block(c, top_mm: float, x0_mm: float, w_mm: float, body_h: float,
                        plan: Dict[str, Any], y_mm) -> None:
    """Draws the plan body (below its panel header) into the box at top_mm, body_h tall."""
    if not (plan.get("steps") and float(plan.get("sheetW") or 0) > 0 and float(plan.get("sheetH") or 0) > 0):
        return
    draw_w = _draw_plan_sheet(c, top_mm, x0_mm, DRAW_MAX_W, body_h, plan, y_mm, _edge_labels(str(plan.get("firstAxis") or "y")))
    lx0 = x0_mm + draw_w + 2.0
    _draw_gauge_list(c, top_mm, lx0, x0_mm + w_mm - lx0, body_h, plan.get("steps") or [], y_mm)


def _draw_plan_sheet(c, top_mm: float, x0_mm: float, max_w: float, body_h: float, plan: Dict[str, Any], y_mm,
                     labels: Dict[str, str]) -> float:
    """The sheet with its pieces and numbered knife lines; returns the width it took."""
    W = float(plan.get("sheetW") or 0)
    H = float(plan.get("sheetH") or 0)
    steps: List[Dict[str, Any]] = plan.get("steps") or []
    groups: List[Dict[str, Any]] = plan.get("groups") or []

    # Padding holds the edge labels and stage 1 numbers
    pad_l, pad_r, pad_t, pad_b = 4.0, 8.0, 4.0, 4.0
    avail_w = max_w - pad_l - pad_r
    avail_h = body_h - pad_t - pad_b - 1.0
    k = min(avail_w / W, avail_h / H)
    sw, sh = W * k, H * k
    ox = x0_mm + pad_l
    oy = top_mm + pad_t + (avail_h - sh) / 2.0 + 0.5
    draw_w = pad_l + sw + pad_r

    def X(v: float) -> float:
        return (ox + v * k) * mm

    def Y(v: float) -> float:
        return y_mm(oy + v * k)

    c.setStrokeColor(colors.HexColor("#94a3b8"))
    c.setFillColor(colors.white)
    c.setLineWidth(0.3)
    c.rect(X(0), Y(H), sw * mm, sh * mm, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#e2e8f0"))
    for cell in plan.get("cells") or []:
        cx, cy, cw, ch = (float(cell.get(key) or 0) for key in ("x", "y", "w", "h"))
        c.rect(X(cx), Y(cy + ch), cw * k * mm, ch * k * mm, fill=1, stroke=0)

    # Reference edges stay untouched until their stage
    c.setStrokeColor(colors.HexColor("#0f172a"))
    c.setLineWidth(1.4)
    c.line(X(0), Y(H), X(W), Y(H))
    c.line(X(0), Y(0), X(0), Y(H))

    mid_x = ox + sw / 2.0
    mid_y = oy + sh / 2.0
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont(FONT_BOLD, 4.6)
    c.drawCentredString(mid_x * mm, y_mm(oy - 1.2), labels["top"])
    c.saveState()
    c.translate((ox + sw + pad_r - 1.4) * mm, y_mm(mid_y))
    c.rotate(-90)
    c.drawCentredString(0, 0, labels["right"])
    c.restoreState()
    c.setFont(FONT_REGULAR, 4.6)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawCentredString(mid_x * mm, y_mm(oy + sh + 3.0), labels["bottom"])
    c.saveState()
    c.translate((ox - 1.6) * mm, y_mm(mid_y))
    c.rotate(90)
    c.drawCentredString(0, 0, labels["left"])
    c.restoreState()

    # Knife lines; a stage 2 cut goes through the stacked strips, so it is numbered once per group
    r = 1.35
    for st in steps:
        axis, pos, stage = st.get("axis"), float(st.get("pos") or 0), int(st.get("stage") or 1)
        product = st.get("drop") == "product"
        if stage == 1:
            spans = [{"from": 0.0, "to": W if axis == "y" else H}]
        else:
            g = int(st.get("group") or 0)
            spans = (groups[g].get("spans") if g < len(groups) else None) or []
        c.setStrokeColor(colors.HexColor("#0f172a" if product else "#94a3b8"))
        c.setLineWidth(0.45)
        c.setDash(1.6, 0.9) if stage == 2 else c.setDash()
        for sp in spans:
            a, b = float(sp.get("from") or 0), float(sp.get("to") or 0)
            if axis == "y":
                c.line(X(a), Y(pos), X(b), Y(pos))
            else:
                c.line(X(pos), Y(a), X(pos), Y(b))
        c.setDash()
        if not spans:
            continue
        sp = spans[0]
        a = float(sp.get("from") or 0)
        shift = 2 * r + 0.3 if not product else 0.0
        if axis == "y":
            lx = (ox + sw + r + 0.6 + shift) if stage == 1 else (ox + a * k + r + 0.4 + shift)
            ly = oy + pos * k
        else:
            lx = ox + pos * k
            ly = (oy - r - 0.6 - shift) if stage == 1 else (oy + a * k + r + 0.4 + shift)
        c.setStrokeColor(colors.HexColor("#0f172a"))
        c.setFillColor(colors.white)
        c.setLineWidth(0.3)
        c.circle(lx * mm, y_mm(ly), r * mm, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 4.2)
        c.drawCentredString(lx * mm, y_mm(ly + 0.55), str(st.get("n")))
    return draw_w


def _draw_gauge_list(c, top_mm: float, lx0: float, list_w: float, body_h: float, steps: List[Dict[str, Any]],
                     y_mm) -> None:
    """Back gauge settings in cut order, wrapped into columns."""
    if not steps or list_w < 20:
        return
    n_cols = max(1, min(int(list_w // LIST_COL_W), len(steps)))
    col_w = list_w / n_cols
    per_col = math.ceil(len(steps) / n_cols)
    row_h = min(4.4, max(2.9, (body_h - LIST_HEAD_H - 0.5) / max(1, per_col)))
    fits = int((body_h - LIST_HEAD_H - 0.5) // row_h)
    shown = min(len(steps), fits * n_cols)
    font = 6.4 if row_h >= 4.0 else 5.4

    for ci in range(n_cols):
        cx = lx0 + ci * col_w
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.rect(cx * mm, y_mm(top_mm + LIST_HEAD_H), (col_w - 1.0) * mm, LIST_HEAD_H * mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawString((cx + 1.2) * mm, y_mm(top_mm + 3.2), "№")
        c.drawRightString((cx + col_w * 0.58) * mm, y_mm(top_mm + 3.2), "TIRGAK")
        c.drawRightString((cx + col_w - 2.2) * mm, y_mm(top_mm + 3.2), "TUSHADI")

    for i, st in enumerate(steps[:shown]):
        ci, ri = i // per_col, i % per_col
        if ri >= fits:
            continue
        cx = lx0 + ci * col_w
        ry = top_mm + LIST_HEAD_H + ri * row_h
        base = ry + row_h * 0.72
        product = st.get("drop") == "product"
        # Each stage starts with a turn of the pile; mark it where the operator turns
        if st.get("turn"):
            c.setStrokeColor(colors.HexColor("#0f172a"))
            c.setLineWidth(0.5)
            c.line(cx * mm, y_mm(ry), (cx + col_w - 1.0) * mm, y_mm(ry))
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD if st.get("turn") else FONT_REGULAR, font)
        num = f"{st.get('n')}" + (" • 90°" if st.get("turn") else "")
        c.drawString((cx + 1.2) * mm, y_mm(base), num)
        c.setFont(FONT_BOLD, font)
        c.drawRightString((cx + col_w * 0.58) * mm, y_mm(base), f"{float(st.get('gauge') or 0):.1f}")
        c.setFont(FONT_REGULAR, font)
        c.setFillColor(colors.HexColor("#0f172a" if product else "#94a3b8"))
        c.drawRightString((cx + col_w - 2.2) * mm, y_mm(base), "Mahsulot" if product else "Chiqindi")
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.2)
        c.line(cx * mm, y_mm(ry + row_h), (cx + col_w - 1.0) * mm, y_mm(ry + row_h))

    if shown < len(steps):
        c.setFillColor(colors.HexColor("#dc2626"))
        c.setFont(FONT_BOLD, 5.4)
        c.drawRightString((lx0 + list_w - 1.0) * mm, y_mm(top_mm + body_h - 0.6), f"+{len(steps) - shown} SIG'MADI")


def first_plan(plans: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return plans[0] if plans else None


# ── Stock sheet cut down to the press sheet ──────────────────────────────────

PAPER_BODY_H = 32.0
PAPER_BODY_MIN_H = 27.0
PAPER_DRAW_MAX_W = 54.0
PAPER_INFO_W = 78.0


def pick_parent_cut(od: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The stock sheet cut, when the stock sheet really is cut before printing."""
    pc = (od.get("impositionState") or {}).get("parentCut")
    if not isinstance(pc, dict):
        return None
    plan = pc.get("plan") or {}
    if not plan.get("steps") and int(pc.get("fit") or 0) > 0:
        return None  # the stock sheet goes to press as it is
    return pc


def paper_block_body_h(scale: float) -> float:
    return max(PAPER_BODY_MIN_H, PAPER_BODY_H * scale)


def _fmt(v: Any) -> str:
    try:
        return f"{int(round(float(v))):,}".replace(",", " ")
    except (TypeError, ValueError):
        return "—"


def paper_cut_badge(pc: Dict[str, Any]) -> str:
    fit = int(pc.get("fit") or 0)
    plan = pc.get("plan") or {}
    parts = [
        f"{_n(pc.get('parentW'))}×{_n(pc.get('parentH'))} → {_n(pc.get('pressW'))}×{_n(pc.get('pressH'))}",
        f"1/{fit}" if fit else "",
        f"{plan.get('strokes')} KESISH" if plan.get("strokes") else "",
    ]
    return " • ".join(p for p in parts if p)


def draw_paper_cut_block(c, top_mm: float, x0_mm: float, w_mm: float, body_h: float, pc: Dict[str, Any],
                         y_mm, order_sheets: Optional[int] = None) -> None:
    """Stock sheet with its press sheets and knife order, the sheet counts, offcuts and gauges."""
    plan = pc.get("plan") or {}
    fit = int(pc.get("fit") or 0)
    divisor = int(pc.get("divisor") or 0)
    x = x0_mm
    if plan.get("steps"):
        x += _draw_plan_sheet(c, top_mm, x0_mm, PAPER_DRAW_MAX_W, body_h, plan, y_mm,
                              _edge_labels(str(plan.get("firstAxis") or "y"), printed=False)) + 2.0

    # Key figures
    rows: List[tuple] = []
    rows.append(("QOG'OZ", str(pc.get("paperName") or "—"), "#0f172a"))
    turn = " • 90°" if pc.get("rotated") else ""
    rows.append(("KESIM", f"{fit} ta press-list ({pc.get('cols')}×{pc.get('rows')}{turn})" if fit else "Sig'maydi",
                 "#0f172a" if fit else "#dc2626"))
    press, run, waste = int(pc.get("pressSheets") or 0), int(pc.get("runSheets") or 0), int(pc.get("wasteSheets") or 0)
    rows.append(("PRESS-LIST", f"{_fmt(press)} = {_fmt(run)} tiraj + {_fmt(waste)} zaxira" if waste else _fmt(press),
                 "#0f172a"))
    parent = int(pc.get("parentSheets") or 0)
    parent_txt = f"{_fmt(parent)} list"
    parent_color = "#0f172a"
    # The order keeps its own planned sheet count once the layout is applied: show a stale one
    if order_sheets and order_sheets != parent:
        parent_txt += f" • buyurtmada {_fmt(order_sheets)}"
        parent_color = "#dc2626"
    rows.append(("OTA-LIST", parent_txt, parent_color))
    if fit and divisor and divisor != fit:
        rows.append(("BO'LUVCHI", f"{divisor}, sig'adi {fit}", "#dc2626"))
    rows.append(("TO'LISH", f"{float(pc.get('usedPct') or 0):g}%", "#0f172a"))
    for off in (pc.get("offcuts") or [])[:2]:
        per = int(off.get("perSheet") or 0)
        kind = "omborga" if off.get("kind") == "offcut" else "chiqindi"
        rows.append(("QOLDIQ" if off.get("kind") == "offcut" else "CHIQINDI",
                     f"{_n(off.get('w'))}×{_n(off.get('h'))} × {per} → {_fmt(per * parent)} ta {kind}",
                     "#0f172a" if off.get("kind") == "offcut" else "#64748b"))

    info_w = min(PAPER_INFO_W, x0_mm + w_mm - x)
    row_h = min(4.4, (body_h - 0.5) / max(1, len(rows)))
    font = 6.4 if row_h >= 4.0 else 5.6
    for i, (label, value, color) in enumerate(rows):
        ry = top_mm + i * row_h
        base = ry + row_h * 0.72
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawString((x + 1.0) * mm, y_mm(base), label)
        c.setFillColor(colors.HexColor(color))
        c.setFont(FONT_BOLD if label in ("OTA-LIST", "KESIM") else FONT_REGULAR, font)
        text = value
        max_w = (info_w - 22.0) * mm
        while text and c.stringWidth(text, FONT_REGULAR, font) > max_w:
            text = text[:-2]
        c.drawString((x + 21.0) * mm, y_mm(base), text if text == value else text + "…")
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.2)
        c.line(x * mm, y_mm(ry + row_h), (x + info_w - 1.0) * mm, y_mm(ry + row_h))

    gx = x + info_w + 2.0
    _draw_gauge_list(c, top_mm, gx, x0_mm + w_mm - gx, body_h, plan.get("steps") or [], y_mm)
