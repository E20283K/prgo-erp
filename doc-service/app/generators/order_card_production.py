"""Page 2 of the work order passport: the production sheet.

Press run figures, the plate split, the full route with blank columns the
operators fill in by hand, and the materials to issue. Everything is scaled to
fit one A4 page, so the passport is always exactly two pages.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.generators.order_card import (
    ACCENT, FAINT, INK, LINE, MUTED, PANEL, TEXT, DANGER,
    Pen, _deadline_color, _fmt_date, _fmt_int, _fmt_num, _section_title,
)
from app.schemas.documents import OrderCardRequest

PAGE_W, PAGE_H = 210.0, 297.0
M = 10.0
CONTENT_W = PAGE_W - 2 * M
BODY_BOTTOM = 284.0
FOOTER_Y = 290.0
GRID = FAINT
HEAD_H = 6.0
SECTION_GAP = 3.0

OP_COLS: List[Tuple[str, float]] = [
    ("№", 8), ("OPERATSIYA / USKUNA", 54), ("OPERATOR", 26), ("REJA", 22),
    ("KIRISH", 14), ("PRILADKA", 15), ("BRAK", 12), ("CHIQISH", 15), ("IMZO", 24),
]
MAT_COLS: List[Tuple[str, float]] = [
    ("MATERIAL", 72), ("REJA", 26), ("BERILDI", 23), ("SARFLANDI", 23), ("QAYTARILDI", 23), ("IMZO", 23),
]
PLATE_COLS: List[Tuple[str, float]] = [
    ("№", 8), ("MODEL", 56), ("O'LCHAM", 34), ("JOY", 18), ("BUYURTMA", 26), ("REJA CHIQISH", 26), ("FARQ", 22),
]
MAT_BLANK_ROWS = 2
EMPTY_ROUTE_ROWS = 6


def _edges(cols: List[Tuple[str, float]], x: float) -> List[float]:
    out = [x]
    for _, w in cols:
        out.append(out[-1] + w)
    return out


def _grid(pen: Pen, cols, x: float, y: float, row_h: float, n_rows: int) -> List[float]:
    """Column header plus ruled rows; returns the column edges."""
    xs = _edges(cols, x)
    total_w = xs[-1] - x
    pen.rect(x, y, x + total_w, y + HEAD_H, fill=PANEL)
    for ci, (label, w) in enumerate(cols):
        pen.text(xs[ci] + w / 2, y + 4.1, label, size=5.8, bold=True, color=MUTED, align="center", max_w=w - 1.5)
    bottom = y + HEAD_H + n_rows * row_h
    pen.rect(x, y, x + total_w, bottom, color=GRID, width=0.4)
    for xe in xs[1:-1]:
        pen.line(xe, y, xe, bottom, color=GRID, width=0.4)
    for ri in range(n_rows + 1):
        ly = y + HEAD_H + ri * row_h
        pen.line(x, ly, x + total_w, ly, color=GRID, width=0.4)
    return xs


def _kpis(req: OrderCardRequest) -> List[Tuple[str, str]]:
    cells: List[Tuple[str, str]] = []
    if req.forms:
        cells.append(("Forma", _fmt_int(req.forms)))
    if req.itemsPerSheet:
        cells.append(("Listda", f"{_fmt_int(req.itemsPerSheet)} dona"))
    if req.pressSheets:
        cells.append(("Bosma list", _fmt_int(req.pressSheets)))
    if req.makeReadySheets:
        cells.append(("Priladka", f"{_fmt_int(req.makeReadySheets)} list"))
    if req.parentSheets:
        cells.append(("Xom list", _fmt_int(req.parentSheets)))
    if req.pressMachine:
        cells.append(("Uskuna", req.pressMachine))
    return cells


def _kash_line(req: OrderCardRequest) -> str:
    layers = [l for l in req.kashirovkaLayers if l.grammage]
    if (req.kashirovkaMode or "none").lower() == "none" or not layers:
        return ""
    parts = [f"{(l.paperStock or l.label or '').strip()} {_fmt_num(l.grammage)}".strip() for l in layers]
    total = f" = {_fmt_num(req.kashirovkaTotalGsm)} g/m²" if req.kashirovkaTotalGsm else ""
    return " + ".join(parts) + total


def _plate_rows(req: OrderCardRequest) -> List[Dict[str, Any]]:
    """Flattens the plate split into banner rows and SKU rows."""
    eff = int(req.effectivePieces or req.itemsPerSheet or 1)
    rows: List[Dict[str, Any]] = []
    for p_idx, plate in enumerate(req.plateCalculations or []):
        sheets = int(plate.get("requiredSheets") or 0)
        assignments = plate.get("assignments") or []
        used = eff - int(plate.get("unassignedSlots") or 0)
        rows.append({
            "kind": "plate",
            "name": str(plate.get("name") or f"Forma {p_idx + 1}"),
            "sheets": sheets,
            "slots": f"{used}/{eff} joy",
            "yield": int(plate.get("totalYield") or 0),
            "over": int(plate.get("totalOverproduction") or 0),
        })
        for a_idx, a in enumerate(assignments):
            slots = int(a.get("slots") or 1)
            target = int(a.get("targetQuantity") or 0)
            yld = int(a.get("yieldQuantity") or slots * sheets)
            diff = a.get("overproduction")
            rows.append({
                "kind": "sku",
                "n": a_idx + 1,
                "model": str(a.get("model") or "—"),
                "code": str(a.get("sizeCode") or a.get("sizeLabel") or a.get("size") or "—"),
                "slots": slots,
                "target": target,
                "yield": yld,
                "diff": int(diff) if diff is not None else yld - target,
            })
    return rows


class _Layout:
    def __init__(self, op_h: float, mat_h: float, pl_h: float, size: float, blank: int):
        self.op_h, self.mat_h, self.pl_h, self.size, self.blank = op_h, mat_h, pl_h, size, blank


def _section_h(rows: int, row_h: float) -> float:
    return 8.6 + HEAD_H + rows * row_h


def _press_h(req: OrderCardRequest, plate_rows: int, pl_h: float) -> float:
    if not (_kpis(req) or _kash_line(req) or plate_rows):
        return 0.0
    h = 8.6
    if _kpis(req):
        h += 11.0
    if _kash_line(req):
        h += 5.0
    if plate_rows:
        h += 1.5 + HEAD_H + plate_rows * pl_h
    return h + SECTION_GAP


def _plan(req: OrderCardRequest, avail: float, plate_rows: List[Dict[str, Any]], n_ops: int, n_mats: int):
    """Largest rows that fit. When even the smallest rows overflow, gives up in
    this order: blank material rows, the SKU split under each plate, materials,
    and only then route steps. Returns (layout, plate rows, ops shown, mats shown)."""
    def total(lay: _Layout, plates: int, ops: int, mats: int) -> float:
        h = _press_h(req, plates, lay.pl_h)
        h += _section_h(ops or EMPTY_ROUTE_ROWS, lay.op_h) + SECTION_GAP
        if mats or lay.blank:
            h += _section_h(mats + lay.blank, lay.mat_h)
        return h

    n_plate = len(plate_rows)
    for s in (1.0, 0.9, 0.8, 0.7, 0.62, 0.55, 0.5):
        lay = _Layout(max(4.5, 9.0 * s), max(4.5, 7.0 * s), max(4.0, 4.8 * s), max(6.0, 8.0 * s), MAT_BLANK_ROWS)
        if total(lay, n_plate, n_ops, n_mats) <= avail:
            return lay, plate_rows, n_ops, n_mats
    lay.blank = 0
    if total(lay, n_plate, n_ops, n_mats) <= avail:
        return lay, plate_rows, n_ops, n_mats
    banners = [r for r in plate_rows if r["kind"] == "plate"]
    mats = n_mats
    while mats > 0 and total(lay, len(banners), n_ops, mats) > avail:
        mats -= 1
    ops = n_ops
    while ops > 1 and total(lay, len(banners), ops, mats) > avail:
        ops -= 1
    return lay, banners, ops, mats


def _draw_header(pen: Pen, req: OrderCardRequest) -> float:
    y = M
    pen.text(M, y + 6, req.docNo or "", size=15, bold=True, color=ACCENT, max_w=70)
    client = (req.clientName or "").strip().upper()
    meta = "  ·  ".join(p for p in [client, req.productName or ""] if p)
    pen.text(M, y + 11.5, meta, size=8.5, bold=True, color=INK, max_w=CONTENT_W - 62)
    right = PAGE_W - M
    if req.deadline:
        pen.text(right - 30, y + 3.2, "MUDDAT", size=5.8, bold=True, color=MUTED, align="right")
        pen.text(right - 30, y + 9.4, _fmt_date(req.deadline), size=11, bold=True, color=_deadline_color(req), align="right")
    pen.text(right, y + 3.2, "TIRAJ", size=5.8, bold=True, color=MUTED, align="right")
    pen.text(right, y + 9.4, f"{_fmt_int(req.quantity)} {req.unit or 'dona'}", size=11, bold=True, color=INK,
             align="right", max_w=28)
    if req.department:
        pen.text(right, y + 13.5, req.department, size=6.5, color=MUTED, align="right", max_w=60)
    bottom = y + 16
    pen.line(M, bottom, PAGE_W - M, bottom, color=INK, width=0.8)
    return bottom + 3


def _draw_press(pen: Pen, req: OrderCardRequest, y: float, rows: List[Dict[str, Any]], pl_h: float) -> float:
    kpis = _kpis(req)
    kash = _kash_line(req)
    if not (kpis or kash or rows):
        return y
    y = _section_title(pen, M, y, CONTENT_W, "Bosma va tiraj")
    if kpis:
        cw = CONTENT_W / len(kpis)
        for i, (label, value) in enumerate(kpis):
            cx = M + i * cw
            if i:
                pen.line(cx, y - 2.4, cx, y + 6.4, color=LINE, width=0.5)
            pen.text(cx + (2 if i else 0), y, label.upper(), size=5.8, bold=True, color=MUTED, max_w=cw - 3)
            pen.text(cx + (2 if i else 0), y + 5.6, value, size=10.5, bold=True, color=INK, max_w=cw - 3)
        y += 11.0
    if kash:
        pen.text(M, y, "KASHIROVKA", size=5.8, bold=True, color=MUTED)
        pen.text(M + 22, y, kash, size=7.8, bold=True, color=INK, max_w=CONTENT_W - 22)
        y += 5.0
    if rows:
        y += 1.5
        xs = _grid(pen, PLATE_COLS, M, y, pl_h, len(rows))
        size = min(7.2, pl_h * 1.45)
        for ri, r in enumerate(rows):
            ry = y + HEAD_H + ri * pl_h
            base = ry + pl_h / 2 + size * 0.13
            if r["kind"] == "plate":
                pen.rect(M, ry, xs[-1], ry + pl_h, fill=PANEL, color=GRID, width=0.4)
                pen.text(xs[0] + 1.5, base, f"{r['name']}  ·  {_fmt_int(r['sheets'])} list  ·  {r['slots']}",
                         size=size, bold=True, color=INK, max_w=xs[4] - xs[0] - 3)
                pen.text(xs[6] - 1.5, base, _fmt_int(r["yield"]), size=size, bold=True, color=INK, align="right")
                over = r["over"]
                pen.text(xs[7] - 1.5, base, f"+{_fmt_int(over)}" if over > 0 else _fmt_int(over), size=size,
                         bold=True, color=DANGER if over < 0 else INK, align="right")
                continue
            pen.text(xs[0] + 1.5, base, str(r["n"]), size=size, color=MUTED)
            pen.text(xs[1] + 1.5, base, r["model"], size=size, color=TEXT, max_w=xs[2] - xs[1] - 3)
            pen.text(xs[2] + 1.5, base, r["code"], size=size, bold=True, color=INK, max_w=xs[3] - xs[2] - 3)
            pen.text(xs[4] - 1.5, base, f"{r['slots']}x", size=size, color=TEXT, align="right")
            pen.text(xs[5] - 1.5, base, _fmt_int(r["target"]), size=size, color=TEXT, align="right")
            pen.text(xs[6] - 1.5, base, _fmt_int(r["yield"]), size=size, bold=True, color=INK, align="right")
            d = r["diff"]
            pen.text(xs[7] - 1.5, base, f"+{_fmt_int(d)}" if d > 0 else _fmt_int(d), size=size,
                     color=DANGER if d < 0 else TEXT, align="right")
        y += HEAD_H + len(rows) * pl_h
    return y + SECTION_GAP


def _draw_route(pen: Pen, req: OrderCardRequest, y: float, lay: _Layout, shown: int) -> float:
    ops = req.operations
    hidden = len(ops) - shown
    title = "Mashrut" + (f"  ·  +{hidden} operatsiya" if hidden > 0 else "")
    y = _section_title(pen, M, y, CONTENT_W, title)
    n_rows = shown or EMPTY_ROUTE_ROWS
    xs = _grid(pen, OP_COLS, M, y, lay.op_h, n_rows)
    size = lay.size
    two_lines = lay.op_h >= 7.5
    for ri, op in enumerate(ops[:shown]):
        ry = y + HEAD_H + ri * lay.op_h
        mid = ry + lay.op_h / 2 + size * 0.13
        name_w = xs[2] - xs[1] - 3
        pen.text(xs[0] + 1.5, mid, str(op.stepNumber or ri + 1), size=size, bold=True, color=MUTED)
        machine = (op.machine or "").strip()
        if machine in ("—", "-"):
            machine = ""
        if two_lines and machine:
            pen.text(xs[1] + 1.5, ry + lay.op_h * 0.45, op.name, size=size, bold=True, color=INK, max_w=name_w)
            pen.text(xs[1] + 1.5, ry + lay.op_h * 0.45 + size * 0.42, machine, size=size * 0.8, color=MUTED, max_w=name_w)
        else:
            label = f"{op.name} · {machine}" if machine else op.name
            pen.text(xs[1] + 1.5, mid, label, size=size, bold=True, color=INK, max_w=name_w)
        operator = (op.operator or "").strip()
        if operator and operator not in ("—", "-"):
            pen.text(xs[2] + 1.5, mid, operator, size=size * 0.9, color=TEXT, max_w=xs[3] - xs[2] - 3)
        if op.plannedQty:
            plan = f"{_fmt_int(op.plannedQty)} {op.planUnit or ''}".strip()
            pen.text(xs[4] - 1.5, mid, plan, size=size, bold=True, color=INK, align="right", max_w=xs[4] - xs[3] - 3)
    return y + HEAD_H + n_rows * lay.op_h + SECTION_GAP


def _draw_materials(pen: Pen, req: OrderCardRequest, y: float, lay: _Layout, shown: int) -> float:
    mats = req.materials[:shown]
    n_rows = len(mats) + lay.blank
    if not n_rows:
        return y
    hidden = len(req.materials) - shown
    y = _section_title(pen, M, y, CONTENT_W, "Material" + (f"  ·  +{hidden}" if hidden > 0 else ""))
    xs = _grid(pen, MAT_COLS, M, y, lay.mat_h, n_rows)
    size = lay.size
    for ri, m in enumerate(mats):
        mid = y + HEAD_H + ri * lay.mat_h + lay.mat_h / 2 + size * 0.13
        name = f"{m.name} · {m.spec}" if m.spec and m.spec not in m.name else m.name
        pen.text(xs[0] + 1.5, mid, name, size=size, bold=True, color=INK, max_w=xs[1] - xs[0] - 3)
        if m.planQty:
            pen.text(xs[2] - 1.5, mid, f"{_fmt_num(round(m.planQty, 2))} {m.unit or ''}".strip(), size=size,
                     color=INK, align="right", max_w=xs[2] - xs[1] - 3)
    return y + HEAD_H + n_rows * lay.mat_h


def draw_production_page(pen: Pen, req: OrderCardRequest):
    top = _draw_header(pen, req)
    plate_rows = _plate_rows(req)
    lay, plates, n_ops, n_mats = _plan(req, BODY_BOTTOM - top, plate_rows, len(req.operations), len(req.materials))

    y = _draw_press(pen, req, top, plates, lay.pl_h)
    y = _draw_route(pen, req, y, lay, n_ops)
    _draw_materials(pen, req, y, lay, n_mats)

    pen.line(M, FOOTER_Y - 3.5, PAGE_W - M, FOOTER_Y - 3.5, color=LINE, width=0.5)
    pen.text(M, FOOTER_Y, f"{req.docNo}  ·  Ish pasporti", size=6, color=MUTED)
    pen.text(PAGE_W - M, FOOTER_Y, f"{datetime.now().strftime('%d.%m.%Y %H:%M')}  ·  2 / 2", size=6, color=MUTED,
             align="right")
