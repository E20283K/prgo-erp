"""Work order passport: page 1 is the order card (also sent to the Telegram
orders group as a PNG), page 2 the production sheet (order_card_production.py).

The card puts the product visual first: every printed side is drawn to scale
with its real cut shape, bleed and hole, and the print spec sits beside it.
The page is composed directly in PyMuPDF so PDF artwork stays vector until the
final rasterisation to PNG.
"""

import io
import math
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import pymupdf as fitz
import base64

from fastapi.responses import JSONResponse, Response

from app.generators.artwork_utils import get_raw_artwork
from app.schemas.documents import OrderCardRequest

MM = 72.0 / 25.4

# ── Palette (neutral, one accent) ──────────────────────────────────────────
def _hex(h: str) -> Tuple[float, float, float]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    try:
        return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
    except Exception:
        return (0.5, 0.5, 0.5)

INK = _hex("#0f172a")
TEXT = _hex("#334155")
MUTED = _hex("#64748b")
FAINT = _hex("#94a3b8")
LINE = _hex("#e2e8f0")
PANEL = _hex("#f8fafc")
WHITE = (1.0, 1.0, 1.0)
ACCENT = _hex("#1e3a8a")
DANGER = _hex("#dc2626")
DIM = _hex("#0369a1")
CUT = _hex("#475569")
BLEED = _hex("#ef4444")

# ── Fonts ──────────────────────────────────────────────────────────────────
_FONT_CANDIDATES = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
]

_FONTS: Optional[Dict[str, Any]] = None


def _fonts() -> Dict[str, Any]:
    global _FONTS
    if _FONTS is not None:
        return _FONTS
    for reg, bold in _FONT_CANDIDATES:
        if os.path.exists(reg) and os.path.exists(bold):
            _FONTS = {
                "reg_file": reg,
                "bold_file": bold,
                "reg": fitz.Font(fontfile=reg),
                "bold": fitz.Font(fontfile=bold),
            }
            return _FONTS
    _FONTS = {"reg_file": None, "bold_file": None, "reg": fitz.Font("helv"), "bold": fitz.Font("hebo")}
    return _FONTS


# ── Labels ─────────────────────────────────────────────────────────────────
SHAPE_LABELS = {
    "rectangle": "To'rtburchak",
    "circle": "Doira",
    "oval": "Oval",
    "folded": "Buklama",
    "carton_box": "Quti",
    "custom_die": "Maxsus shtans",
}
HOLE_LABELS = {
    "top-center": "tepada markazda",
    "top-left": "tepada chapda",
    "top-right": "tepada o'ngda",
    "left-center": "chapda markazda",
    "right-center": "o'ngda markazda",
    "both-sides-fold": "buklamada",
}
KASH_LABELS = {"duplex": "Dupleks", "triplex": "Tripleks"}


def _fmt_int(n: Any) -> str:
    try:
        return f"{int(round(float(n))):,}".replace(",", " ")
    except Exception:
        return str(n or "")


def _fmt_num(n: Any) -> str:
    try:
        f = float(n)
    except Exception:
        return str(n or "")
    return str(int(f)) if abs(f - round(f)) < 1e-6 else f"{f:.1f}".rstrip("0").rstrip(".")


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except Exception:
            pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _fmt_date(s: Optional[str]) -> str:
    d = _parse_date(s)
    return d.strftime("%d.%m.%Y") if d else (str(s) if s else "")


def _corner_radius_mm(req: OrderCardRequest) -> float:
    if req.cornerRadius and req.cornerRadius > 0:
        return float(req.cornerRadius)
    ct = (req.cornerType or "").lower()
    if "round" in ct or "radius" in ct:
        import re
        m = re.search(r"r\s*(\d+(?:\.\d+)?)", ct)
        return float(m.group(1)) if m else 3.0
    return 0.0


def _process_letters(cfg: Optional[Dict[str, Any]]) -> str:
    if not cfg:
        return ""
    letters = [k.upper() for k in ("c", "m", "y", "k") if cfg.get(k)]
    return "CMYK" if len(letters) == 4 else " ".join(letters)


def _back_printed(req: OrderCardRequest) -> bool:
    formula = (req.colorsConfig or "").replace(" ", "")
    if "+" in formula:
        tail = formula.split("+", 1)[1]
        if tail and tail[0].isdigit() and tail[0] != "0":
            return True
    if _process_letters(req.backColors):
        return True
    if any((s.side or "") == "back" for s in req.spotColorItems):
        return True
    return False


# ── Drawing primitives (mm coordinates, top-left origin) ───────────────────
class Pen:
    def __init__(self, page: fitz.Page):
        self.page = page
        f = _fonts()
        self.fonts = f
        if f["reg_file"]:
            page.insert_font(fontname="oc-reg", fontfile=f["reg_file"])
            page.insert_font(fontname="oc-bold", fontfile=f["bold_file"])
            self.names = {"reg": "oc-reg", "bold": "oc-bold"}
        else:
            self.names = {"reg": "helv", "bold": "hebo"}

    def width(self, text: str, size: float, bold: bool = False) -> float:
        return self.fonts["bold" if bold else "reg"].text_length(text, fontsize=size) / MM

    def fit(self, text: str, max_w: float, size: float, bold: bool = False, min_size: float = 5.5) -> Tuple[str, float]:
        text = str(text or "")
        s = size
        while s > min_size and self.width(text, s, bold) > max_w:
            s -= 0.25
        if self.width(text, s, bold) <= max_w:
            return text, s
        while text and self.width(text + "…", s, bold) > max_w:
            text = text[:-1]
        return (text.rstrip() + "…") if text else "", s

    def text(self, x: float, y: float, text: str, size: float = 7.5, bold: bool = False, color=INK,
             align: str = "left", max_w: Optional[float] = None, rotate: int = 0) -> float:
        """Draws text with its baseline at y (mm). Returns the rendered width in mm."""
        text = str(text or "")
        if not text:
            return 0.0
        if max_w is not None:
            text, size = self.fit(text, max_w, size, bold)
        w = self.width(text, size, bold)
        if rotate == 0:
            if align == "center":
                x -= w / 2
            elif align == "right":
                x -= w
        self.page.insert_text(
            fitz.Point(x * MM, y * MM), text, fontsize=size, fontname=self.names["bold" if bold else "reg"],
            color=color, rotate=rotate,
        )
        return w

    def wrap(self, text: str, max_w: float, size: float, max_lines: int, bold: bool = False) -> List[str]:
        words = str(text or "").split()
        lines: List[str] = []
        cur = ""
        for wd in words:
            cand = f"{cur} {wd}".strip()
            if self.width(cand, size, bold) <= max_w:
                cur = cand
            else:
                if cur:
                    lines.append(cur)
                cur = wd
            if len(lines) == max_lines:
                break
        if cur and len(lines) < max_lines:
            lines.append(cur)
        consumed = " ".join(lines)
        if len(consumed) < len(" ".join(words)) and lines:
            last, _ = self.fit(lines[-1] + " …", max_w, size, bold, min_size=size)
            lines[-1] = last
        return lines

    def rect(self, x0, y0, x1, y1, fill=None, color=None, width=0.5, radius_mm: float = 0.0, dashes=None):
        r = fitz.Rect(x0 * MM, y0 * MM, x1 * MM, y1 * MM)
        rel = None
        if radius_mm > 0 and r.width > 0 and r.height > 0:
            rel = min(0.5, (radius_mm * MM) / min(r.width, r.height))
        sh = self.page.new_shape()
        sh.draw_rect(r, radius=rel) if rel else sh.draw_rect(r)
        sh.finish(fill=fill, color=color, width=width, dashes=dashes)
        sh.commit()

    def line(self, x0, y0, x1, y1, color=LINE, width=0.5, dashes=None):
        sh = self.page.new_shape()
        sh.draw_line(fitz.Point(x0 * MM, y0 * MM), fitz.Point(x1 * MM, y1 * MM))
        sh.finish(color=color, width=width, dashes=dashes)
        sh.commit()

    def circle(self, cx, cy, r, fill=None, color=None, width=0.5):
        sh = self.page.new_shape()
        sh.draw_circle(fitz.Point(cx * MM, cy * MM), r * MM)
        sh.finish(fill=fill, color=color, width=width)
        sh.commit()

    def arrow_head(self, x, y, direction: str, color=DIM, size=1.1):
        pts = {
            "left": [(x, y), (x + size, y - size * 0.45), (x + size, y + size * 0.45)],
            "right": [(x, y), (x - size, y - size * 0.45), (x - size, y + size * 0.45)],
            "up": [(x, y), (x - size * 0.45, y + size), (x + size * 0.45, y + size)],
            "down": [(x, y), (x - size * 0.45, y - size), (x + size * 0.45, y - size)],
        }[direction]
        sh = self.page.new_shape()
        sh.draw_polyline([fitz.Point(px * MM, py * MM) for px, py in pts] + [fitz.Point(pts[0][0] * MM, pts[0][1] * MM)])
        sh.finish(fill=color, color=color, width=0.2, closePath=True)
        sh.commit()


# ── Card model ─────────────────────────────────────────────────────────────
class CardSpec:
    def __init__(self, side: str, src: Optional[str], pno: int, title: str, sub: str, blank: bool = False):
        self.side = side  # "front" | "back"
        self.src = src
        self.pno = pno
        self.title = title
        self.sub = sub
        self.blank = blank


def _sku_rows(req: OrderCardRequest) -> List[Dict[str, Any]]:
    by_id = {str(a.get("skuId")): a for a in req.skuArtworks if a.get("skuId")}
    rows: List[Dict[str, Any]] = []
    for s in req.sizes:
        art = by_id.get(str(s.id), {})
        code = s.sizeCode or s.size or ""
        rows.append({
            "code": code,
            "model": s.model or "",
            "qty": s.quantity,
            "front": art.get("frontArtworkUrl") or art.get("frontArtworkThumb"),
            "back": art.get("backArtworkUrl") or art.get("backArtworkThumb"),
        })
    if not rows and req.skuArtworks:
        for a in req.skuArtworks:
            rows.append({
                "code": a.get("sizeCode") or "",
                "model": a.get("model") or "",
                "qty": None,
                "front": a.get("frontArtworkUrl") or a.get("frontArtworkThumb"),
                "back": a.get("backArtworkUrl") or a.get("backArtworkThumb"),
            })
    for r in rows:
        r["front"] = r["front"] or req.artworkFront or None
        r["back"] = r["back"] or req.artworkBack or None
    return rows


def _is_plain_code(code: str) -> bool:
    return (code or "").strip().upper() in ("", "STD", "ALL", "STANDART")


def _pdf_page_count(src: Optional[str], cache: Dict[str, Any]) -> int:
    raw = _load(src, cache)
    if not raw or raw["kind"] != "pdf":
        return 0
    doc = raw.get("doc")
    return doc.page_count if doc else 0


def _load(src: Optional[str], cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not src:
        return None
    if src in cache:
        return cache[src]
    raw = get_raw_artwork(src)
    if raw:
        try:
            if raw["kind"] == "pdf":
                raw["doc"] = fitz.open(stream=raw["bytes"], filetype="pdf")
            elif raw["kind"] == "svg":
                svg_doc = fitz.open(stream=raw["bytes"], filetype="svg")
                raw["doc"] = fitz.open("pdf", svg_doc.convert_to_pdf())
                raw["kind"] = "pdf"
        except Exception as e:
            print(f"[order_card] cannot open artwork {src[:80]}: {e}", flush=True)
            raw = None
    cache[src] = raw
    return raw


def _build_cards(req: OrderCardRequest, cache: Dict[str, Any]) -> List[CardSpec]:
    rows = _sku_rows(req)
    single = not rows
    if single:
        rows = [{"code": "", "model": "", "qty": req.quantity, "front": req.artworkFront or None, "back": req.artworkBack or None}]
    multi = len(rows) > 1
    unit = req.unit or "dona"

    def size_title(r):
        code = r["code"] if not _is_plain_code(r["code"]) else ""
        return code or r["model"] or "Standart"

    def qty_sub(r):
        return f"{_fmt_int(r['qty'])} {unit}" if r.get("qty") not in (None, "") else ""

    cards: List[CardSpec] = []

    # Front side
    fronts = [r["front"] for r in rows]
    unique_fronts = {f for f in fronts if f}
    if len(unique_fronts) <= 1:
        src = next(iter(unique_fronts), None)
        sub = "Barcha razmerlar" if multi else ("" if src else "Maket yo'q")
        cards.append(CardSpec("front", src, 0, "Oldi tarafi", sub, blank=not src))
    else:
        for r in rows:
            cards.append(CardSpec("front", r["front"], 0, size_title(r), qty_sub(r), blank=not r["front"]))

    # Back side: explicit files, else page 2 of a two-page front PDF
    for r in rows:
        if not r["back"] and r["front"] and _pdf_page_count(r["front"], cache) >= 2:
            r["back"] = r["front"]
            r["back_pno"] = 1
    backs = [(r["back"], r.get("back_pno", 0)) for r in rows]
    unique_backs = {b for b in backs if b[0]}
    printed = _back_printed(req)

    if not unique_backs:
        cards.append(CardSpec("back", None, 0, "Orqa tarafi", "Bosmasiz" if not printed else "Maket yo'q", blank=True))
    elif len(unique_backs) == 1 and (not multi or all(b[0] for b in backs)):
        src, pno = next(iter(unique_backs))
        cards.append(CardSpec("back", src, pno, "Orqa tarafi", "Barcha razmerlar" if multi else ""))
    else:
        for r in rows:
            cards.append(CardSpec("back", r["back"], r.get("back_pno", 0), size_title(r), qty_sub(r) or "", blank=not r["back"]))
    return cards


# ── Card rendering ─────────────────────────────────────────────────────────
def _shape_kind(req: OrderCardRequest) -> str:
    s = (req.shapeType or "rectangle").lower()
    return s if s in ("circle", "oval") else "rect"


def _hole_center(req: OrderCardRequest, x: float, y: float, w: float, h: float, scale: float, mirror: bool) -> Optional[Tuple[float, float, float]]:
    pos = req.holePosition or "none"
    d_mm = float(req.holeSize or 0)
    if pos == "none" or d_mm <= 0:
        return None
    if mirror:
        pos = {"top-left": "top-right", "top-right": "top-left", "left-center": "right-center", "right-center": "left-center"}.get(pos, pos)
    r = max(0.55, d_mm * scale / 2)
    off = float(req.holeOffset or 0) * scale + r  # offset is edge -> hole edge
    if pos == "top-left":
        return (x + off, y + off, r)
    if pos == "top-right":
        return (x + w - off, y + off, r)
    if pos == "left-center":
        return (x + off, y + h / 2, r)
    if pos == "right-center":
        return (x + w - off, y + h / 2, r)
    return (x + w / 2, y + off, r)


def _place_artwork(page: fitz.Page, raw: Dict[str, Any], pno: int, trim: fitz.Rect, bleed_pt: float, W: float, H: float, B: float):
    if raw["kind"] == "pdf":
        doc = raw["doc"]
        pno = min(pno, doc.page_count - 1)
        src_rect = doc[pno].rect
        sw, sh = src_rect.width / MM, src_rect.height / MM
    else:
        try:
            pix = fitz.Pixmap(raw["bytes"])
            sw, sh = float(pix.width), float(pix.height)
        except Exception:
            sw, sh = W, H

    # Rotate when the artwork is laid out the other way round
    rotate = 0
    card_land = W > H * 1.05
    src_land = sw > sh * 1.05
    if card_land != src_land and abs(W - H) > 2:
        rotate = 90
        sw, sh = sh, sw

    target = trim
    if raw["kind"] == "pdf" and B > 0 and abs(sw - (W + 2 * B)) < 1.5 and abs(sh - (H + 2 * B)) < 1.5:
        target = fitz.Rect(trim.x0 - bleed_pt, trim.y0 - bleed_pt, trim.x1 + bleed_pt, trim.y1 + bleed_pt)

    try:
        if raw["kind"] == "pdf":
            page.show_pdf_page(target, raw["doc"], pno, keep_proportion=True, rotate=rotate)
        else:
            page.insert_image(target, stream=raw["bytes"], keep_proportion=True, rotate=rotate)
    except Exception as e:
        print(f"[order_card] artwork placement failed: {e}", flush=True)


def _draw_card(pen: Pen, req: OrderCardRequest, card: CardSpec, x: float, y: float, w: float, h: float,
               scale: float, cache: Dict[str, Any]):
    page = pen.page
    trim = fitz.Rect(x * MM, y * MM, (x + w) * MM, (y + h) * MM)
    kind = _shape_kind(req)
    radius_mm = _corner_radius_mm(req) * scale if kind == "rect" else 0.0
    rel = min(0.5, (radius_mm * MM) / max(1e-6, min(trim.width, trim.height))) if radius_mm > 0 else None
    B = float(req.bleed or 0)
    bleed_pt = B * scale * MM

    def outline(sh):
        if kind == "circle" or kind == "oval":
            sh.draw_oval(trim)
        elif rel:
            sh.draw_rect(trim, radius=rel)
        else:
            sh.draw_rect(trim)

    # Paper
    sh = page.new_shape()
    outline(sh)
    sh.finish(fill=WHITE, color=None)
    sh.commit()

    raw = _load(card.src, cache) if not card.blank else None
    if raw:
        _place_artwork(page, raw, card.pno, trim, bleed_pt, float(req.width or 0), float(req.height or 0), B)
        # Mask everything outside the cut line so the card shows its finished shape
        pad = bleed_pt + 2 * MM
        outer = fitz.Rect(trim.x0 - pad, trim.y0 - pad, trim.x1 + pad, trim.y1 + pad)
        sh = page.new_shape()
        sh.draw_rect(outer)
        outline(sh)
        sh.finish(fill=WHITE, color=None, even_odd=True)
        sh.commit()
    elif card.blank and card.sub:
        pen.text(x + w / 2, y + h / 2 + 1, card.sub, size=6.5, color=FAINT, align="center", max_w=w - 4)

    # Cut line
    sh = page.new_shape()
    outline(sh)
    sh.finish(color=CUT, width=0.6)
    sh.commit()

    # Hole (mirrored on the back, as seen through the sheet)
    hc = _hole_center(req, x, y, w, h, scale, mirror=(card.side == "back"))
    if hc:
        pen.circle(hc[0], hc[1], hc[2], fill=WHITE, color=CUT, width=0.6)


def _dim_horizontal(pen: Pen, x0: float, x1: float, y: float, label: str):
    pen.line(x0, y - 1.2, x0, y + 1.2, color=DIM, width=0.4)
    pen.line(x1, y - 1.2, x1, y + 1.2, color=DIM, width=0.4)
    pen.line(x0, y, x1, y, color=DIM, width=0.4)
    pen.arrow_head(x0, y, "left")
    pen.arrow_head(x1, y, "right")
    tw = pen.width(label, 6.5)
    cx = (x0 + x1) / 2
    pen.rect(cx - tw / 2 - 1, y - 1.6, cx + tw / 2 + 1, y + 1.6, fill=WHITE)
    pen.text(cx, y + 0.85, label, size=6.5, color=DIM, align="center")


def _dim_vertical(pen: Pen, x: float, y0: float, y1: float, label: str):
    pen.line(x - 1.2, y0, x + 1.2, y0, color=DIM, width=0.4)
    pen.line(x - 1.2, y1, x + 1.2, y1, color=DIM, width=0.4)
    pen.line(x, y0, x, y1, color=DIM, width=0.4)
    pen.arrow_head(x, y0, "up")
    pen.arrow_head(x, y1, "down")
    tw = pen.width(label, 6.5)
    cy = (y0 + y1) / 2
    pen.rect(x - 1.6, cy - tw / 2 - 1, x + 1.6, cy + tw / 2 + 1, fill=WHITE)
    # rotate=90 runs the text upwards; glyphs sit left of the baseline
    pen.text(x + 0.85, cy + tw / 2, label, size=6.5, color=DIM, rotate=90)


def _layout_cards(n: int, W: float, H: float, aw: float, ah: float, group_break: int) -> Tuple[float, int]:
    """Best scale and row count for n cards in the available box."""
    gap, group_gap = 5.0, 9.0
    top_res, bottom_res, left_res = 8.0, 9.5, 7.0
    best = (0.0, 1)
    for rows in range(1, 4):
        cols = math.ceil(n / rows)
        extra = group_gap - gap if rows == 1 and 0 < group_break < n else 0.0
        sw = (aw - left_res - gap * (cols - 1) - extra) / (cols * W)
        row_h = (ah - (rows - 1) * 3.0) / rows
        shh = (row_h - top_res - bottom_res) / H
        s = min(sw, shh)
        if s > best[0] * 1.08:
            best = (s, rows)
    return best


def _draw_visual(pen: Pen, req: OrderCardRequest, cards: List[CardSpec], x: float, y: float, aw: float, ah: float, cache):
    W = max(5.0, float(req.width or 50))
    H = max(5.0, float(req.height or 90))
    n = len(cards)
    group_break = sum(1 for c in cards if c.side == "front")
    scale, rows = _layout_cards(n, W, H, aw, ah, group_break)
    scale = max(0.05, min(scale, 3.0))
    cols = math.ceil(n / rows)
    cw, ch = W * scale, H * scale
    gap, group_gap = 5.0, 9.0
    top_res, bottom_res, left_res = 8.0, 9.5, 7.0
    row_h = top_res + ch + bottom_res

    total_rows_h = rows * row_h + (rows - 1) * 3.0
    oy = y + max(0.0, (ah - total_rows_h) / 2)

    multi_groups = n > 2

    for ri in range(rows):
        row_cards = cards[ri * cols:(ri + 1) * cols]
        if not row_cards:
            break
        extra = (group_gap - gap) if rows == 1 and 0 < group_break < n else 0.0
        row_w = left_res + len(row_cards) * cw + (len(row_cards) - 1) * gap + extra
        ox = x + (aw - row_w) / 2 + left_res
        ry = oy + ri * (row_h + 3.0) + top_res
        cx = ox
        group_spans: Dict[str, List[float]] = {}
        for ci, card in enumerate(row_cards):
            gi = ri * cols + ci
            if rows == 1 and gi == group_break and gi > 0:
                cx += group_gap - gap
            _draw_card(pen, req, card, cx, ry, cw, ch, scale, cache)
            if gi == 0:
                _dim_horizontal(pen, cx, cx + cw, ry - 3.6, f"{_fmt_num(W)} mm")
                _dim_vertical(pen, cx - 3.6, ry, ry + ch, f"{_fmt_num(H)} mm")
            # Caption
            pen.text(cx + cw / 2, ry + ch + 4.2, card.title, size=7.2, bold=True, color=INK, align="center", max_w=cw + gap - 1)
            if card.sub and not card.blank:
                pen.text(cx + cw / 2, ry + ch + 7.6, card.sub, size=6.2, color=MUTED, align="center", max_w=cw + gap - 1)
            span = group_spans.setdefault(card.side, [cx, cx + cw])
            span[1] = cx + cw
            cx += cw + gap

        if multi_groups:
            for side, (sx0, sx1) in group_spans.items():
                label = "OLDI TARAFI" if side == "front" else "ORQA TARAFI"
                # Group header sits above the dimension line of the first card
                pen.text((sx0 + sx1) / 2, ry - 6.4, label, size=6, bold=True, color=MUTED, align="center")


# ── Panels ─────────────────────────────────────────────────────────────────
def _deadline_color(req: OrderCardRequest):
    dl = _parse_date(req.deadline)
    return DANGER if dl and (dl - date.today()).days <= 2 else INK


def _spec_rows(req: OrderCardRequest) -> List[Tuple[str, str, Any]]:
    head: List[Tuple[str, str, Any]] = []
    if req.deadline:
        head.append(("Muddat", _fmt_date(req.deadline), _deadline_color(req)))
    status = " · ".join(p for p in [req.statusLabel, req.stageLabel] if p)
    if status:
        head.append(("Holati", status, INK))
    return head + [(l, v, INK) for l, v in _spec_rows_plain(req)]


def _spec_rows_plain(req: OrderCardRequest) -> List[Tuple[str, str]]:
    rows: List[Tuple[str, str]] = []
    W, H = req.width, req.height
    product = req.itemCategory or ""
    if product:
        rows.append(("Turi", product))
    if W and H:
        rows.append(("O'lcham", f"{_fmt_num(W)} × {_fmt_num(H)} mm"))
    shape = SHAPE_LABELS.get((req.shapeType or "rectangle").lower(), req.shapeType or "")
    r = _corner_radius_mm(req)
    corner = f"R{_fmt_num(r)} mm" if r > 0 else ("Shtansforma" if "die" in (req.cornerType or "").lower() else "to'g'ri burchak")
    rows.append(("Shakl", f"{shape} · {corner}" if _shape_kind(req) == "rect" else shape))
    rows.append(("Bleed", f"{_fmt_num(req.bleed)} mm" if req.bleed else "yo'q"))
    if req.holePosition and req.holePosition != "none" and (req.holeSize or 0) > 0:
        rows.append(("Teshik", f"Ø{_fmt_num(req.holeSize)} mm · {HOLE_LABELS.get(req.holePosition, req.holePosition)} · {_fmt_num(req.holeOffset or 0)} mm"))

    if req.paperStock:
        rows.append(("Qog'oz", req.paperStock))
    kash = (req.kashirovkaMode or "none").lower()
    layers = [l for l in req.kashirovkaLayers if l.grammage]
    if kash != "none" and layers:
        formula = "+".join(_fmt_num(l.grammage) for l in layers)
        total = f" = {_fmt_num(req.kashirovkaTotalGsm)} g/m²" if req.kashirovkaTotalGsm else ""
        rows.append(("Grammaj", f"{formula}{total}"))
        if req.targetGsm:
            rows.append(("Maqsadli GSM", f"{_fmt_num(req.targetGsm)} g/m²"))
        stocks = " + ".join((l.paperStock or l.label or "").strip() for l in layers if (l.paperStock or l.label))
        rows.append(("Kashirovka", f"{KASH_LABELS.get(kash, kash)}" + (f" · {stocks}" if stocks else "")))
    else:
        if req.grammage:
            rows.append(("Grammaj", f"{_fmt_num(req.grammage)} g/m²"))
        if req.targetGsm:
            rows.append(("Maqsadli GSM", f"{_fmt_num(req.targetGsm)} g/m²"))

    formula = (req.colorsConfig or "").strip()
    front_l = _process_letters(req.frontColors)
    back_l = _process_letters(req.backColors)
    sides = []
    if front_l:
        sides.append(f"Oldi {front_l}")
    if back_l:
        sides.append(f"Orqa {back_l}")
    bosma = " · ".join([p for p in [formula, ", ".join(sides)] if p])
    if bosma:
        rows.append(("Bosma", bosma))
    spots = [s for s in req.spotColorItems if s.name]
    if spots:
        rows.append(("Pantone", ", ".join(s.name + (f" ({'orqa' if s.side == 'back' else 'oldi'})" if s.side else "") for s in spots)))

    if req.lamination and req.lamination.lower() not in ("none", "yo'q", "-"):
        parts = [req.lamination]
        if req.laminationSides:
            parts.append("2 tomon" if req.laminationSides == "2s" else "1 tomon")
        if req.laminationMicron:
            parts.append(f"{_fmt_num(req.laminationMicron)} mkm")
        rows.append(("Laminatsiya", " · ".join(parts)))
    if req.coating and req.coating.lower() not in ("none", "yo'q", "-"):
        rows.append(("Lak", req.coating + (f" · {req.coatingZone}" if req.coatingZone else "")))
    if req.embellishment and req.embellishment.lower() not in ("none", "yo'q", "-"):
        rows.append(("Ishlov", req.embellishment))
    return rows


SPEC_LABEL = 7.8
SPEC_VALUE = 8.6
SPEC_ROW = 5.6
SPEC_WRAP = 4.0


def _section_title(pen: Pen, x: float, y: float, w: float, title: str) -> float:
    pen.text(x, y + 3, title.upper(), size=7, bold=True, color=MUTED)
    pen.line(x, y + 4.8, x + w, y + 4.8, color=LINE, width=0.5)
    return y + 8.6


def _draw_spec(pen: Pen, req: OrderCardRequest, x: float, y: float, w: float, max_y: float) -> float:
    y = _section_title(pen, x, y, w, "Spetsifikatsiya")
    label_w = 26.0
    for label, value, color in _spec_rows(req):
        if y + SPEC_ROW > max_y:
            break
        pen.text(x, y, label, size=SPEC_LABEL, color=MUTED)
        vx = x + label_w
        if label == "Pantone":
            for sp in [s for s in req.spotColorItems if s.name][:6]:
                pen.rect(vx, y - 2.9, vx + 3, y + 0.1, fill=_hex(sp.hex or "#888888"), color=LINE, width=0.3, radius_mm=0.4)
                vx += 3.8
            vx += 0.6
        lines = pen.wrap(value, x + w - vx, SPEC_VALUE, 2, bold=True)
        for i, ln in enumerate(lines):
            pen.text(vx, y + i * SPEC_WRAP, ln, size=SPEC_VALUE, bold=True, color=color)
        y += SPEC_ROW + (len(lines) - 1) * SPEC_WRAP
    return y


def _spec_height(req: OrderCardRequest) -> float:
    return 8.6 + len(_spec_rows(req)) * SPEC_ROW + 2


def _quantity_height(req: OrderCardRequest) -> float:
    sizes = [s for s in req.sizes if (s.quantity or 0) > 0]
    show_rows = len(sizes) > 1 or (len(sizes) == 1 and not _is_plain_code(sizes[0].sizeCode or sizes[0].size))
    h = 7.6 + 8
    if show_rows:
        cols = 2 if len(sizes) > 5 else 1
        h += math.ceil(len(sizes) / cols) * 3.9 + 3.2
    return h


def _draw_schematic(pen: Pen, req: OrderCardRequest, x: float, y: float, w: float, h: float):
    """Small CAD view: cut line, bleed, corner radius and hole with its offset."""
    W = max(5.0, float(req.width or 50))
    H = max(5.0, float(req.height or 90))
    s = min((w - 16) / W, (h - 6) / H)
    cw, ch = W * s, H * s
    cx = x + (w - cw) / 2
    cy = y + (h - ch) / 2
    B = float(req.bleed or 0)
    kind = _shape_kind(req)
    r = _corner_radius_mm(req) * s if kind == "rect" else 0.0
    if B > 0:
        pen.rect(cx - B * s, cy - B * s, cx + cw + B * s, cy + ch + B * s, color=BLEED, width=0.35,
                 radius_mm=(r + B * s) if r else 0, dashes="[1.2 1.2] 0")
    if kind in ("circle", "oval"):
        sh = pen.page.new_shape()
        sh.draw_oval(fitz.Rect(cx * MM, cy * MM, (cx + cw) * MM, (cy + ch) * MM))
        sh.finish(fill=PANEL, color=CUT, width=0.6)
        sh.commit()
    else:
        pen.rect(cx, cy, cx + cw, cy + ch, fill=PANEL, color=CUT, width=0.6, radius_mm=r)
    if r > 0:
        pen.text(cx + cw + 1.2, cy + ch - 0.6, f"R{_fmt_num(_corner_radius_mm(req))}", size=5.8, color=DIM)

    hc = _hole_center(req, cx, cy, cw, ch, s, mirror=False)
    if hc:
        hx, hy, hr = hc
        pen.circle(hx, hy, hr, fill=WHITE, color=CUT, width=0.5)
        off = float(req.holeOffset or 0)
        pos = req.holePosition or ""
        # Offset lines from each edge the position is measured from to the hole edge
        if off > 0:
            if pos.startswith("top"):
                pen.line(hx, cy, hx, hy - hr, color=DIM, width=0.35)
            if pos in ("top-left", "left-center"):
                pen.line(cx, hy, hx - hr, hy, color=DIM, width=0.35)
            if pos in ("top-right", "right-center"):
                pen.line(cx + cw, hy, hx + hr, hy, color=DIM, width=0.35)
        label = f"Ø{_fmt_num(req.holeSize)} · {_fmt_num(off)} mm"
        lx = cx + cw + 1.2 if hx >= cx + cw / 2 else cx - 1.2
        pen.text(lx, hy + 1, label, size=5.8, color=DIM, align="left" if hx >= cx + cw / 2 else "right")

    pen.text(cx + cw / 2, cy + ch + 3.4, f"{_fmt_num(W)}", size=5.8, color=DIM, align="center")
    pen.text(cx - 1.2, cy + ch / 2 + 1, f"{_fmt_num(H)}", size=5.8, color=DIM, align="right")


def _draw_quantity(pen: Pen, req: OrderCardRequest, x: float, y: float, w: float, max_y: float) -> float:
    y = _section_title(pen, x, y, w, "Tiraj")
    unit = req.unit or "dona"
    sizes = [s for s in req.sizes if (s.quantity or 0) > 0]
    show_rows = len(sizes) > 1 or (len(sizes) == 1 and not _is_plain_code(sizes[0].sizeCode or sizes[0].size))
    if show_rows:
        cols = 2 if len(sizes) > 5 else 1
        col_w = (w - (cols - 1) * 4) / cols
        per_col = math.ceil(len(sizes) / cols)
        avail = int(max(1, (max_y - y - 10) // 3.9))
        per_col = min(per_col, avail)
        shown = sizes[:per_col * cols]
        for i, s in enumerate(shown):
            c, rr = divmod(i, per_col)
            sx = x + c * (col_w + 4)
            sy = y + rr * 3.9
            code = s.sizeCode or s.size or "—"
            name = f"{s.model} · {code}" if s.model and len(sizes) > 1 and len({z.model for z in sizes}) > 1 else code
            pen.text(sx, sy, name, size=6.8, color=TEXT, max_w=col_w * 0.6)
            pen.text(sx + col_w, sy, _fmt_int(s.quantity), size=6.8, bold=True, color=INK, align="right")
        y += per_col * 3.9
        if len(sizes) > len(shown):
            pen.text(x, y, f"+{len(sizes) - len(shown)} razmer", size=6.2, color=MUTED)
            y += 3.6
        pen.line(x, y - 1.8, x + w, y - 1.8, color=LINE, width=0.5)
        y += 3.2
    pen.text(x, y + 1.4, "JAMI", size=7.5, bold=True, color=MUTED)
    pen.text(x + w, y + 1.8, f"{_fmt_int(req.quantity)} {unit}", size=13, bold=True, color=ACCENT, align="right")
    return y + 6


_CORE_DIR = os.path.join(os.path.dirname(__file__), "..", "core")
# Selectable header logos; "none" leaves the header without one
LOGO_FILES = {
    "printgoo": "printgoo_logo.svg",
    "label": "printgoo_label_logo.svg",
}
DEFAULT_LOGO = "printgoo"
_LOGO_CACHE: Dict[str, Optional[Tuple[bytes, Tuple[float, float, float, float]]]] = {}


def _inline_svg_classes(svg: str) -> str:
    """MuPDF ignores <style> class rules, so copy them onto each element as attributes.
    Handles grouped selectors (`.a, .b {}`) and several classes per element."""
    import re
    rules: Dict[str, List[Tuple[str, str]]] = {}
    style = "".join(re.findall(r"<style[^>]*>([\s\S]*?)</style>", svg))
    for m in re.finditer(r"([^{}]+)\{([^}]*)\}", style):
        decls = [tuple(x.strip() for x in d.split(":", 1)) for d in m.group(2).split(";") if ":" in d]
        for sel in m.group(1).split(","):
            sel = sel.strip()
            if sel.startswith("."):
                rules.setdefault(sel[1:], []).extend(decls)
    svg = re.sub(r"<style[\s\S]*?</style>", "", svg)

    def repl(m):
        props: Dict[str, str] = {}
        for cls in m.group(1).split():
            for k, v in rules.get(cls, []):
                props[k] = v
        return " ".join(f'{k}="{v}"' for k, v in props.items())

    return re.sub(r'class="([^"]*)"', repl, svg)


def _logo_doc(key: Optional[str]) -> Optional[Tuple[fitz.Document, fitz.Rect]]:
    """The logo as a one-page PDF plus the bounding box of its visible content."""
    key = key or DEFAULT_LOGO
    if key not in LOGO_FILES:
        return None
    if key not in _LOGO_CACHE:
        try:
            with open(os.path.join(_CORE_DIR, LOGO_FILES[key]), encoding="utf-8") as f:
                svg = _inline_svg_classes(f.read())
            pdf = fitz.open(stream=svg.encode("utf-8"), filetype="svg").convert_to_pdf()
            # Trim the artboard's empty margin so the logo sizes by what is drawn
            page = fitz.open("pdf", pdf)[0]
            pix = page.get_pixmap(dpi=72, alpha=False)
            from PIL import Image, ImageOps
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            bbox = ImageOps.invert(img).getbbox() or (0, 0, pix.width, pix.height)
            sx, sy = page.rect.width / pix.width, page.rect.height / pix.height
            _LOGO_CACHE[key] = (pdf, (bbox[0] * sx, bbox[1] * sy, bbox[2] * sx, bbox[3] * sy))
        except Exception as e:
            print(f"[order_card] logo {key} unavailable: {e}", flush=True)
            _LOGO_CACHE[key] = None
    cached = _LOGO_CACHE[key]
    if not cached:
        return None
    return fitz.open("pdf", cached[0]), fitz.Rect(*cached[1])


def _draw_header(pen: Pen, req: OrderCardRequest, x: float, y: float, w: float) -> float:
    qr_size = 20.0
    right = right_edge = x + w
    # QR code to the order in the ERP
    if req.erpUrl:
        try:
            import qrcode
            img = qrcode.make(req.erpUrl, border=1, box_size=6)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            pen.page.insert_image(
                fitz.Rect((right - qr_size) * MM, y * MM, right * MM, (y + qr_size) * MM), stream=buf.getvalue()
            )
            right -= qr_size + 3
        except Exception as e:
            print(f"[order_card] qr failed: {e}", flush=True)

    # Company logo, then a divider; the order text starts after it
    logo = _logo_doc(req.logo)
    if logo is not None:
        logo_doc, clip = logo
        lh = 19.0
        lw = min(62.0, lh * clip.width / max(1.0, clip.height))
        lh = lw * clip.height / max(1.0, clip.width)
        top = y + (qr_size - lh) / 2
        pen.page.show_pdf_page(fitz.Rect(x * MM, top * MM, (x + lw) * MM, (top + lh) * MM), logo_doc, 0, clip=clip)
        pen.line(x + lw + 5, y + 1, x + lw + 5, y + qr_size - 1, color=LINE, width=0.6)
        x += lw + 10

    client = (req.clientName or "Mijoz").strip().upper()
    pen.text(x, y + 8.5, client, size=19, bold=True, color=ACCENT, max_w=right - x - 2)
    meta = [req.docNo]
    if req.productName:
        meta.append(req.productName)
    pen.text(x, y + 15, "  ·  ".join(m for m in meta if m), size=9, bold=True, color=INK, max_w=right - x - 2)
    dates = []
    if req.orderDate:
        dates.append(f"Sana: {_fmt_date(req.orderDate)}")
    if req.quantity:
        dates.append(f"Tiraj: {_fmt_int(req.quantity)} {req.unit or 'dona'}")
    if dates:
        pen.text(x, y + 20, "   ".join(dates), size=7, color=MUTED, max_w=right - x - 2)
    bottom = y + qr_size + 2
    pen.line(right_edge - w, bottom, right_edge, bottom, color=INK, width=0.8)
    return bottom


def _note_text(req: OrderCardRequest) -> str:
    return "  ·  ".join(p.strip() for p in [req.customNote or "", req.notes or ""] if p and p.strip())


def _draw_footer(pen: Pen, req: OrderCardRequest, x: float, y: float, w: float, h: float):
    pen.rect(x, y, x + w, y + h, fill=PANEL, color=LINE, width=0.5, radius_mm=1.2)
    pen.text(x + 3, y + 4.4, "IZOH", size=6.4, bold=True, color=MUTED)
    lines = pen.wrap(_note_text(req), w - 6, 8.0, max(1, int((h - 6) // 3.8)))
    for li, ln in enumerate(lines):
        pen.text(x + 3, y + 9 + li * 3.8, ln, size=8.0, color=TEXT)


# ── Entry point ────────────────────────────────────────────────────────────
def render_order_card(req: OrderCardRequest) -> Tuple[bytes, bytes, str]:
    """Returns (png, pdf, orientation). The page is a vector PDF; the PNG is its raster."""
    cache: Dict[str, Any] = {}
    cards = _build_cards(req, cache)
    landscape = len(cards) > 2
    pw, ph = (297.0, 210.0) if landscape else (210.0, 297.0)

    doc = fitz.open()
    page = doc.new_page(width=pw * MM, height=ph * MM)
    pen = Pen(page)
    pen.rect(0, 0, pw, ph, fill=WHITE)

    m = 10.0
    header_bottom = _draw_header(pen, req, m, m, pw - 2 * m)
    if _note_text(req):
        footer_h = 15.0
        footer_y = ph - m - footer_h
        _draw_footer(pen, req, m, footer_y, pw - 2 * m, footer_h)
        body_bottom = footer_y - 4
    else:
        body_bottom = ph - m

    body_top = header_bottom + 4

    if landscape:
        panel_w = 92.0
        vis_w = pw - 2 * m - panel_w - 6
        _draw_visual(pen, req, cards, m, body_top, vis_w, body_bottom - body_top, cache)
        px = m + vis_w + 6
        pen.line(px - 3, body_top, px - 3, body_bottom, color=LINE, width=0.5)
        sch_h = 28.0
        _draw_schematic(pen, req, px, body_top, panel_w, sch_h)
        qty_h = _quantity_height(req)
        y = _draw_spec(pen, req, px, body_top + sch_h + 2, panel_w, body_bottom - qty_h)
        _draw_quantity(pen, req, px, max(y + 1, body_bottom - qty_h), panel_w, body_bottom)
    else:
        sch_h = 44.0
        bottom_h = max(_spec_height(req), sch_h + 4 + _quantity_height(req), 52.0) + 3
        vis_h = max((body_bottom - body_top) * 0.5, body_bottom - body_top - bottom_h)
        _draw_visual(pen, req, cards, m, body_top, pw - 2 * m, vis_h, cache)
        y0 = body_top + vis_h + 3
        pen.line(m, y0 - 1.5, pw - m, y0 - 1.5, color=LINE, width=0.5)
        col_w = (pw - 2 * m - 8) / 2
        _draw_spec(pen, req, m, y0, col_w, body_bottom)
        rx = m + col_w + 8
        _draw_schematic(pen, req, rx, y0 + 1, col_w, sch_h)
        _draw_quantity(pen, req, rx, y0 + sch_h + 4, col_w, body_bottom)

    if (req.pages or 1) >= 2:
        from app.generators.order_card_production import PAGE_H, PAGE_W, draw_production_page

        sheet = doc.new_page(width=PAGE_W * MM, height=PAGE_H * MM)
        sheet_pen = Pen(sheet)
        sheet_pen.rect(0, 0, PAGE_W, PAGE_H, fill=WHITE)
        draw_production_page(sheet_pen, req)

    for raw in cache.values():
        if raw and raw.get("doc"):
            try:
                raw["doc"].close()
            except Exception:
                pass

    fmt = req.format or "png"
    pdf_bytes = doc.tobytes(garbage=3, deflate=True) if fmt in ("pdf", "both") else b""
    png = b""
    if fmt in ("png", "both"):
        png = page.get_pixmap(dpi=req.dpi or 200, alpha=False).tobytes("png")
    doc.close()
    return png, pdf_bytes, "landscape" if landscape else "portrait"


def generate_order_card(req: OrderCardRequest) -> Response:
    png, pdf_bytes, orientation = render_order_card(req)
    fmt = req.format or "png"
    if fmt == "both":
        return JSONResponse({
            "png": base64.b64encode(png).decode("ascii"),
            "pdf": base64.b64encode(pdf_bytes).decode("ascii"),
            "orientation": orientation,
        })
    data, mime, ext = (pdf_bytes, "application/pdf", "pdf") if fmt == "pdf" else (png, "image/png", "png")
    safe = str(req.docNo or "order").replace("/", "_")
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Content-Disposition": f'inline; filename="{safe}-card.{ext}"',
            "X-Card-Orientation": orientation,
        },
    )
