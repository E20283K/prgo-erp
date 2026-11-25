import io
import os
import math
import base64
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import code128, qr
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
import pymupdf as fitz


from fastapi.responses import JSONResponse, Response

from app.core.fonts import FONT_REGULAR, FONT_BOLD
from app.core.s3 import upload_buffer_to_s3
from app.schemas.documents import JobTicketPdfRequest
from app.core.constants import DEFAULT_JOB_TICKET_LABELS, trunc
from app.generators.artwork_utils import get_raw_artwork, probe_artwork_url

_CORE_DIR = os.path.join(os.path.dirname(__file__), "..", "core")
# Header logos the Telegram send dialog offers; "none" leaves the header without one
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


def logo_pdf(key: Optional[str]) -> Optional[Tuple[bytes, Tuple[float, float, float, float]]]:
    """The header logo as a one-page vector PDF plus the box of its visible content
    (the artboard's empty margin is trimmed so the logo sizes by what is drawn)."""
    key = key or DEFAULT_LOGO
    if key not in LOGO_FILES:
        return None
    if key not in _LOGO_CACHE:
        try:
            with open(os.path.join(_CORE_DIR, LOGO_FILES[key]), encoding="utf-8") as f:
                svg = _inline_svg_classes(f.read())
            pdf = fitz.open(stream=svg.encode("utf-8"), filetype="svg").convert_to_pdf()
            page = fitz.open("pdf", pdf)[0]
            pix = page.get_pixmap(dpi=72, alpha=False)
            from PIL import ImageOps
            img = PILImage.frombytes("RGB", (pix.width, pix.height), pix.samples)
            bbox = ImageOps.invert(img).getbbox() or (0, 0, pix.width, pix.height)
            sx, sy = page.rect.width / pix.width, page.rect.height / pix.height
            _LOGO_CACHE[key] = (pdf, (bbox[0] * sx, bbox[1] * sy, bbox[2] * sx, bbox[3] * sy))
        except Exception as e:
            print(f"[job_ticket] logo {key} unavailable: {e}", flush=True)
            _LOGO_CACHE[key] = None
    return _LOGO_CACHE[key]


def draw_raster_or_svg(c, raw_art: Dict[str, Any], card_x_mm: float, card_top_mm: float, card_w_mm: float, card_h_mm: float, y_mm_func):
    try:
        if raw_art["kind"] == "image":
            pil_img = PILImage.open(io.BytesIO(raw_art["bytes"]))
            buf = io.BytesIO()
            pil_img.convert("RGB").save(buf, format="JPEG", quality=92)
            buf.seek(0)
            c.drawImage(
                ImageReader(buf),
                card_x_mm * mm,
                y_mm_func(card_top_mm + card_h_mm),
                card_w_mm * mm,
                card_h_mm * mm,
                preserveAspectRatio=True,
            )
        elif raw_art["kind"] == "svg":
            from svglib.svglib import svg2rlg
            from reportlab.graphics import renderPDF
            svg_d = svg2rlg(io.BytesIO(raw_art["bytes"]))
            if svg_d:
                sx = (card_w_mm * mm) / max(1.0, svg_d.width)
                sy = (card_h_mm * mm) / max(1.0, svg_d.height)
                scale = min(sx, sy)
                svg_d.scale(scale, scale)
                svg_d.width = svg_d.width * scale
                svg_d.height = svg_d.height * scale
                ox = card_x_mm * mm + ((card_w_mm * mm) - svg_d.width) / 2
                oy = y_mm_func(card_top_mm + card_h_mm) + ((card_h_mm * mm) - svg_d.height) / 2
                renderPDF.draw(svg_d, c, ox, oy)
    except Exception as e:
        print(f"Failed to draw raster/svg artwork: {e}", flush=True)

def draw_fitted_text(
    c,
    text: Any,
    x_mm: float,
    y_pos_pt: float,
    max_w_mm: float,
    font_name=FONT_REGULAR,
    base_font_size=6.2,
    min_font_size=4.8,
    color="#0f172a",
    max_lines=2,
    line_spacing_pt=7.0,
    align="left",
):
    if text is None:
        return
    text = str(text).strip()
    if not text:
        return
    max_w_pt = max_w_mm * mm
    curr_size = base_font_size

    # Check if single line fits
    w = c.stringWidth(text, font_name, curr_size)
    if w <= max_w_pt:
        c.setFillColor(colors.HexColor(color))
        c.setFont(font_name, curr_size)
        if align == "center":
            c.drawCentredString(x_mm * mm, y_pos_pt, text)
        elif align == "right":
            c.drawRightString(x_mm * mm, y_pos_pt, text)
        else:
            c.drawString(x_mm * mm, y_pos_pt, text)
        return

    # Check 2 lines if max_lines >= 2
    words = text.split(" ")
    if len(words) > 1 and max_lines >= 2:
        line1 = ""
        line2 = ""
        for word in words:
            cand = f"{line1} {word}".strip() if line1 else word
            if c.stringWidth(cand, font_name, curr_size) <= max_w_pt:
                line1 = cand
            else:
                line2 = f"{line2} {word}".strip() if line2 else word

        if line1 and line2:
            while curr_size > min_font_size and (
                c.stringWidth(line1, font_name, curr_size) > max_w_pt
                or c.stringWidth(line2, font_name, curr_size) > max_w_pt
            ):
                curr_size -= 0.5

            while len(line2) > 3 and c.stringWidth(line2 + "…", font_name, curr_size) > max_w_pt:
                line2 = line2[:-1]
            if c.stringWidth(line2, font_name, curr_size) > max_w_pt:
                line2 = line2[:-1] + "…"

            c.setFillColor(colors.HexColor(color))
            c.setFont(font_name, curr_size)
            if align == "center":
                c.drawCentredString(x_mm * mm, y_pos_pt + line_spacing_pt * 0.45, line1)
                c.drawCentredString(x_mm * mm, y_pos_pt - line_spacing_pt * 0.55, line2)
            elif align == "right":
                c.drawRightString(x_mm * mm, y_pos_pt + line_spacing_pt * 0.45, line1)
                c.drawRightString(x_mm * mm, y_pos_pt - line_spacing_pt * 0.55, line2)
            else:
                c.drawString(x_mm * mm, y_pos_pt + line_spacing_pt * 0.45, line1)
                c.drawString(x_mm * mm, y_pos_pt - line_spacing_pt * 0.55, line2)
            return

    # Single word or max_lines == 1: downscale
    while curr_size > min_font_size and c.stringWidth(text, font_name, curr_size) > max_w_pt:
        curr_size -= 0.4

    # Cut only text that still does not fit at the smallest size
    if c.stringWidth(text, font_name, curr_size) > max_w_pt:
        while len(text) > 4 and c.stringWidth(text + "…", font_name, curr_size) > max_w_pt:
            text = text[:-1]
        text = text.rstrip() + "…"

    c.setFillColor(colors.HexColor(color))
    c.setFont(font_name, curr_size)
    if align == "center":
        c.drawCentredString(x_mm * mm, y_pos_pt, text)
    elif align == "right":
        c.drawRightString(x_mm * mm, y_pos_pt, text)
    else:
        c.drawString(x_mm * mm, y_pos_pt, text)

# ─── PAGE 2: PRODUCTION SHEET ─────────────────────────────────────────────────
# Blank grid the operators fill in by hand on the shop floor: one row per route step,
# the plate split, material usage and hand-over signatures. Row heights shrink to keep
# it on one page.
REPORT_TOP_MM = 25.0
REPORT_BOTTOM_MM = 284.0
REPORT_GAP_MM = 3.0
REPORT_PANEL_H = 7.0  # panel title bar + spacing
REPORT_HEAD_H = 6.0  # column header row
REPORT_OP_ROW_H = 9.0
REPORT_MAT_ROW_H = 7.0
REPORT_MAT_BLANK_ROWS = 2
REPORT_SIGN_H = 27.0
EMPTY_ROUTE_ROWS = 6

REPORT_OP_COLS = [
    ("№", 7), ("OPERATSIYA / DASTGOH", 43), ("REJA", 17), ("KIRISH", 15), ("PRILADKA", 15),
    ("BRAK", 14), ("CHIQISH", 15), ("BOSHLASH", 14), ("TUGASH", 14), ("OPERATOR", 23), ("IMZO", 15),
]
REPORT_PLATE_COLS = [
    ("№", 8), ("MODEL", 58), ("O'LCHAM", 36), ("JOY", 18), ("BUYURTMA", 24), ("REJA CHIQISH", 26), ("FARQ", 22),
]
REPORT_MAT_COLS = [
    ("MATERIAL", 62), ("REJA", 26), ("BERILDI", 26), ("SARFLANDI", 26), ("QAYTARILDI", 26), ("IMZO", 26),
]


def generate_job_ticket_pdf(req: JobTicketPdfRequest):
    """
    Work order passport (Ish pasporti), exactly two A4 pages.
    - Page 1: requisites, KPIs, front/back/dieline proofs, coatings & kashirovka, inks,
              size breakdown and the order note.
    - Page 2: production sheet — full route with blank actual columns, plate split,
              materials to issue, hand-over signatures.
    - PDF artwork stays vector (embedded as Form XObjects via PyMuPDF).
    Returns the PDF, page 1 as a PNG, or both (see req.format).
    """
    L = {**DEFAULT_JOB_TICKET_LABELS, **(req.labels or {})}
    od = req.orderData or {}
    doc_no = req.docNo or "WO-00772"

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    filename = f"Ish_pasporti_{doc_no}.pdf"
    c.setTitle(filename)
    c.setAuthor("PrintGoo ERP")
    c.setSubject(f"Order Passport {doc_no}")
    c.setCreator("PrintGoo Industrial Prepress Engine")
    page_w, page_h = A4  # 210mm x 297mm
    margin_x = 9.0 * mm
    full_w_mm = 192.0  # 210 - 2 * 9mm

    def y_mm(mm_from_top: float) -> float:
        return page_h - (mm_from_top * mm)

    def draw_box(x_mm: float, top_mm: float, w_mm: float, h_mm: float, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.6):
        c.setLineWidth(lw)
        if fill_hex:
            c.setFillColor(colors.HexColor(fill_hex))
        if stroke_hex:
            c.setStrokeColor(colors.HexColor(stroke_hex))
        c.rect(
            x_mm * mm,
            y_mm(top_mm + h_mm),
            w_mm * mm,
            h_mm * mm,
            fill=1 if fill_hex else 0,
            stroke=1 if stroke_hex else 0,
        )

    def draw_panel_header(x_mm: float, top_mm: float, w_mm: float, title: str, badge_right: str = ""):
        draw_box(x_mm, top_mm, w_mm, 5.5, fill_hex="#0f172a", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6.8)
        c.drawString((x_mm + 2.5) * mm, y_mm(top_mm + 4.0), title.upper())
        if badge_right:
            c.setFillColor(colors.HexColor("#93c5fd"))
            c.setFont(FONT_BOLD, 6.3)
            c.drawRightString((x_mm + w_mm - 2.5) * mm, y_mm(top_mm + 4.0), badge_right)

    def draw_grid(top: float, cols, row_h: float, n_rows: int, cell_text=None, x0: float = 9.0,
                  font: float = 6.2, shaded_rows=(), merge=(1, 4)):
        """Column header plus ruled rows. cell_text(row, col) -> (text, bold, color), a list of two
        such lines, or None. Shaded rows merge columns merge[0]..merge[1] into one cell."""
        x_edges = [x0]
        for _, w in cols:
            x_edges.append(x_edges[-1] + w)
        total_w = x_edges[-1] - x0
        table_h = REPORT_HEAD_H + n_rows * row_h
        shaded = set(shaded_rows)
        draw_box(x0, top, total_w, REPORT_HEAD_H, fill_hex="#f1f5f9", stroke_hex=None)
        for ri in shaded:
            draw_box(x0, top + REPORT_HEAD_H + ri * row_h, total_w, row_h, fill_hex="#f8fafc", stroke_hex=None)
        for ci, (lbl, w) in enumerate(cols):
            draw_fitted_text(c, lbl, x_edges[ci] + w / 2.0, y_mm(top + 4.0), w - 1.5, font_name=FONT_BOLD,
                             base_font_size=5.8, min_font_size=4.6, color="#334155", max_lines=1, align="center")
        c.setStrokeColor(colors.HexColor("#64748b"))
        c.setLineWidth(0.4)
        c.rect(x0 * mm, y_mm(top + table_h), total_w * mm, table_h * mm, fill=0, stroke=1)
        for ei, xe in enumerate(x_edges[1:-1], start=1):
            c.line(xe * mm, y_mm(top), xe * mm, y_mm(top + REPORT_HEAD_H))
            for ri in range(n_rows):
                if ri in shaded and merge[0] < ei <= merge[1]:
                    continue
                ry = top + REPORT_HEAD_H + ri * row_h
                c.line(xe * mm, y_mm(ry), xe * mm, y_mm(ry + row_h))
        for ri in range(n_rows + 1):
            ly = top + REPORT_HEAD_H + ri * row_h
            c.line(x0 * mm, y_mm(ly), (x0 + total_w) * mm, y_mm(ly))
        if not cell_text:
            return
        for ri in range(n_rows):
            ry = top + REPORT_HEAD_H + ri * row_h
            for ci, (_, w) in enumerate(cols):
                cell = cell_text(ri, ci)
                if not cell:
                    continue
                if ri in shaded and ci == merge[0]:
                    w = x_edges[merge[1] + 1] - x_edges[ci]
                lines = cell if isinstance(cell, list) else [cell]
                if len(lines) == 1:
                    text, bold, col_hex = lines[0]
                    draw_fitted_text(c, text, x_edges[ci] + 1.5, y_mm(ry + row_h / 2.0 + font * 0.125), w - 3.0,
                                     font_name=FONT_BOLD if bold else FONT_REGULAR, base_font_size=font,
                                     min_font_size=4.8, color=col_hex, max_lines=1)
                else:
                    sub = font * 0.82
                    gap = (font + sub) * 0.3528 * 0.62
                    base = ry + row_h / 2.0 - gap / 2.0 + font * 0.125
                    for li, (text, bold, col_hex) in enumerate(lines[:2]):
                        draw_fitted_text(c, text, x_edges[ci] + 1.5, y_mm(base + li * gap), w - 3.0,
                                         font_name=FONT_BOLD if bold else FONT_REGULAR,
                                         base_font_size=font if li == 0 else sub, min_font_size=4.6,
                                         color=col_hex, max_lines=1)

    # ─── Extract & Calculate Core Metrics ──────────────────────────────────────
    # Only values the order actually holds are printed; a missing value shows "—", never a guess.
    width = float(od.get("width") or 0)
    height = float(od.get("height") or 0)
    dim_unit = str(od.get("dimensionUnit") or "mm")
    bleed = float(od.get("bleed") if od.get("bleed") is not None else 0)
    net_qty = int(od.get("quantity") or 0)
    imp_summary = (od.get("impositionState") or {}).get("summary") or {}
    yield_per_sheet = int(imp_summary.get("itemsPerSheet") or 0)
    gross_sheets = int(imp_summary.get("pressSheets") or 0)
    make_ready = int(od.get("kashirovkaMakeReadySheets") or 0)

    priority = str(od.get("priority") or "Normal")
    status = str(od.get("status") or "—")
    customer = str(od.get("customer") or "—")
    product = str(od.get("product") or "—")
    department = str(od.get("department") or "—")
    site = str(od.get("site") or "")
    press_machine = str(od.get("pressMachine") or "—")
    recipe = str(od.get("recipe") or "—")
    unit = str(od.get("unit") or "dona")
    start_date = str(od.get("startDate") or "—")
    deadline = str(od.get("deadline") or "—")

    # The logo is placed as vector PDF in the PyMuPDF pass below; "none" leaves the header without one
    header_logo = logo_pdf(req.logo)

    # ─── UNIFIED HEADER (PAGES 1 & 2) WITH LOGO, BARCODE & QR ─────────────────
    def draw_unified_header(page_num: int):
        # 1. Top Left: text fallback only when a logo was asked for but cannot be loaded
        if (req.logo or DEFAULT_LOGO) in LOGO_FILES and not header_logo:
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 15)
            c.drawString(margin_x, y_mm(14.0), "PRINTGOO ERP")

        # 2. CENTER ZONE: PURE BLACK 1D KATTA BARCODE
        bc = code128.Code128(doc_no, barHeight=11.5 * mm, barWidth=0.75)
        center_x = 112.0 * mm
        bc_x = center_x - (bc.width / 2.0)
        c.setFillColor(colors.black)
        c.setStrokeColor(colors.black)
        bc.drawOn(c, bc_x, y_mm(15.5))

        # Human-readable document number centered under barcode bars
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 7.5)
        c.drawCentredString(center_x, y_mm(19.2), doc_no)

        # 3. RIGHT ZONE: DOC NO, DATE & PURE BLACK 2D QR CODE
        app_url = str(
            od.get("appUrl")
            or os.getenv("APP_URL")
            or os.getenv("NEXT_PUBLIC_APP_URL")
            or "http://localhost:3000"
        ).rstrip("/")
        qr_payload = f"{app_url}?wo={doc_no}"

        qr_widget = qr.QrCodeWidget(qr_payload)
        qr_widget.barFillColor = colors.black
        qr_bounds = qr_widget.getBounds()
        qr_w = qr_bounds[2] - qr_bounds[0]
        qr_h = qr_bounds[3] - qr_bounds[1]
        qr_pt = 14.5 * mm
        d_qr = Drawing(qr_pt, qr_pt, transform=[qr_pt / qr_w, 0, 0, qr_pt / qr_h, 0, 0])
        d_qr.add(qr_widget)
        draw_box(186.0, 3.5, 15.0, 15.0, fill_hex="#ffffff", stroke_hex=None)
        d_qr.drawOn(c, 186.5 * mm, y_mm(18.0))

        # Right-aligned Doc No & Generation Date
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 10.5)
        c.drawRightString(184.0 * mm, y_mm(10.5), doc_no)

        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawRightString(184.0 * mm, y_mm(15.2), datetime.now().strftime("%Y-%m-%d"))

        # Header Bottom Divider Line
        c.setStrokeColor(colors.HexColor("#0f172a"))
        c.setLineWidth(1.2)
        c.line(margin_x, y_mm(22.8), page_w - margin_x, y_mm(22.8))

    # Vector overlays collection for PyMuPDF post-processing
    vector_overlays: List[Dict[str, Any]] = []

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1: REQUISITES, KPIS, 3-CARD PHYSICAL PROOFS, COATINGS & SIGN-OFFS
    # ══════════════════════════════════════════════════════════════════════════
    draw_unified_header(1)

    # ─── 1. CORE REQUISITES & STATUS/PRIORITY STRIP ───────────────────────────
    req_top = 24.5
    req_h = 18.0
    draw_box(9, req_top, full_w_mm, req_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")

    status_label = str(L.get("status") or L.get("colStatus") or "HOLATI").upper()
    status_val = status.strip()

    prio_label = str(L.get("priority") or "MUHIMLIGI").upper()
    prio_raw = str(od.get("priority") or "Normal").strip()
    prio_lower = prio_raw.lower()

    if prio_lower in ("urgent", "shoshilinch", "срочный", "acil"):
        prio_display = L.get("priorityUrgent", prio_raw)
        prio_fill = "#fef2f2"
        prio_stroke = "#fca5a5"
        prio_text_col = "#dc2626"
    elif prio_lower in ("high", "yuqori", "высокий", "yüksek"):
        prio_display = L.get("priorityHigh", prio_raw)
        prio_fill = "#fffbeb"
        prio_stroke = "#fde68a"
        prio_text_col = "#b45309"
    else:
        prio_display = L.get("priorityNormal", prio_raw)
        prio_fill = "#eff6ff"
        prio_stroke = "#bfdbfe"
        prio_text_col = "#1d4ed8"

    req_cols_data = [
        (9, 38, L["customer"], customer, str(od.get("orderType") or "")),
        (47, 38, L["product"], product, str(od.get("itemCategory") or "")),
        (85, 30, L["departmentSite"], department, site),
        (115, 36, L["pressMachine"], press_machine, f"{L.get('recipe', 'Retsept')}: {recipe}"),
    ]

    for (cx, cw, lbl, val, sub) in req_cols_data:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString((cx + 2) * mm, y_mm(req_top + 4.0), lbl.upper())
        # Use max_lines=1 with downscale so main value never clashes with sub
        draw_fitted_text(c, val, cx + 2, y_mm(req_top + 9.6), cw - 4, font_name=FONT_BOLD, base_font_size=9.6, min_font_size=6.0, max_lines=1)
        draw_fitted_text(c, sub, cx + 2, y_mm(req_top + 15.0), cw - 4, font_name=FONT_REGULAR, base_font_size=7.0, min_font_size=5.2, color="#475569", max_lines=1)

    # Col 5: Status
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 6.2)
    c.drawString(153 * mm, y_mm(req_top + 4.0), status_label)
    status_text = status_val.upper()
    draw_box(152.5, req_top + 5.8, 22.0, 5.4, fill_hex="#f1f5f9", stroke_hex="#cbd5e1", lw=0.4)
    draw_fitted_text(c, status_text, 163.5, y_mm(req_top + 9.6), 20.0, font_name=FONT_BOLD, base_font_size=7.4, min_font_size=5.0, align="center")
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.6)
    c.drawString(153 * mm, y_mm(req_top + 15.0), datetime.now().strftime("%Y-%m-%d"))

    # Col 6: Priority
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 6.2)
    c.drawString(178 * mm, y_mm(req_top + 4.0), prio_label)
    p_text = str(prio_display).upper()
    draw_box(177.5, req_top + 5.8, 22.0, 5.4, fill_hex=prio_fill, stroke_hex=prio_stroke, lw=0.4)
    draw_fitted_text(c, p_text, 188.5, y_mm(req_top + 9.6), 20.0, font_name=FONT_BOLD, base_font_size=7.4, min_font_size=5.0, color=prio_text_col, align="center")
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.6)
    c.drawString(178 * mm, y_mm(req_top + 15.0), trunc(deadline, 16))

    # Vertical divider lines
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.5)
    for div_x in [47, 85, 115, 151, 176]:
        c.line(div_x * mm, y_mm(req_top), div_x * mm, y_mm(req_top + req_h))

    # ─── 2. KPI STRIP ─────────────────────────────────────────────────────────
    kpi_top = req_top + req_h + 1.5
    kpi_h = 14.0
    draw_box(9, kpi_top, full_w_mm, kpi_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
    kpis = [
        (L["netRun"], f"{net_qty:,} {unit}" if net_qty else "—", "#1d4ed8"),
        (L["grossSheets"], f"{gross_sheets:,} varaq" if gross_sheets else "—", "#0f172a"),
        (L["impositionYield"], f"{yield_per_sheet} dona / varaq" if yield_per_sheet else "—", "#047857"),
        (L["scheduleWindow"], f"{start_date} → {deadline}", "#0f172a"),
    ]
    for i, (lbl, val, col_hex) in enumerate(kpis):
        cx = 11 + i * 47.5
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(cx * mm, y_mm(kpi_top + 4.4), lbl.upper())
        draw_fitted_text(c, val, cx, y_mm(kpi_top + 11.0), 45.0, font_name=FONT_BOLD, base_font_size=11.5,
                         min_font_size=7.5, color=col_hex, max_lines=1)

    # ─── 3. PHYSICAL GEOMETRY (3 SIDE-BY-SIDE PROOFS: FRONT, BACK, DIELINE) ───
    sec3_top = kpi_top + kpi_h + 1.5
    sec3_h = 61.5
    draw_box(9, sec3_top, full_w_mm, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    panel3_badge = f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit})"
    if od.get("shapeType"):
        panel3_badge += f" • {str(od.get('shapeType')).upper()}"
    draw_panel_header(9.8, sec3_top + 0.8, full_w_mm - 1.6, L["physicalSpecs"], panel3_badge)

    hole_size = float(od.get("holeSize") if od.get("holeSize") is not None else (4 if od.get("itemCategory") == "Hangtag" else 0))
    hole_pos = str(od.get("holePosition") or ("top-center" if od.get("itemCategory") == "Hangtag" else "none"))
    hole_offset = float(od.get("holeOffset") if od.get("holeOffset") is not None else 6)

    # Extract artwork sources
    sku_artworks_raw = od.get("skuArtworks") or od.get("artworks") or []
    front_src = od.get("artworkFront")
    if not front_src:
        for a in sku_artworks_raw:
            if isinstance(a, dict):
                cand = a.get("frontArtworkUrl") or a.get("frontArtworkThumb")
                if cand:
                    front_src = cand
                    break
    if not front_src:
        for att in od.get("attachments") or []:
            if isinstance(att, dict) and (att.get("url") or att.get("storagePath")):
                u = att.get("url") or att.get("storagePath")
                cat = str(att.get("category", "")).lower()
                nm = str(att.get("name", "")).lower()
                if cat in ("artwork", "proofs") or att.get("isImage") or "front" in nm or "oldi" in nm or str(u).endswith(".pdf"):
                    front_src = u
                    break
    if not front_src:
        front_src = od.get("photoUrl") or ((od.get("photoUrls") or [None])[0])
    if not front_src or str(front_src).startswith("data:image"):
        probed_f = probe_artwork_url(doc_no, "ALL", "front")
        if probed_f:
            front_src = probed_f

    back_src = od.get("artworkBack")
    if not back_src:
        for a in sku_artworks_raw:
            if isinstance(a, dict):
                cand = a.get("backArtworkUrl") or a.get("backArtworkThumb")
                if cand:
                    back_src = cand
                    break
    if not back_src:
        for att in od.get("attachments") or []:
            if isinstance(att, dict) and (att.get("url") or att.get("storagePath")):
                u = att.get("url") or att.get("storagePath")
                nm = str(att.get("name", "")).lower()
                if "back" in nm or "orqa" in nm:
                    back_src = u
                    break
    if not back_src or str(back_src).startswith("data:image"):
        probed_b = probe_artwork_url(doc_no, "ALL", "back")
        if probed_b:
            back_src = probed_b

    front_raw_p1 = get_raw_artwork(front_src)
    back_raw_p1 = get_raw_artwork(back_src)

    # Dieline file probing from attachments or specific fields
    dieline_src = od.get("dielineUrl") or od.get("customSvgPath")
    if not dieline_src:
        for att in od.get("attachments") or []:
            if isinstance(att, dict) and (att.get("category") == "dieline" or "dieline" in str(att.get("name", "")).lower() or "shtamp" in str(att.get("name", "")).lower()):
                dieline_src = att.get("url") or att.get("storagePath")
                break
    dieline_raw = get_raw_artwork(dieline_src) if dieline_src else None

    # 3 Proof Cards Geometry
    p_card_top = sec3_top + 7.0
    p_card_h = 39.0
    gap_p = 3.0
    p_card_w = (full_w_mm - 4.0 - 2 * gap_p) / 3.0  # ~60.6 mm each
    aspect = width / height if width > 0 and height > 0 else 1.0

    # ── CARD 1: OLDI / FRONT PROOF ──
    c1_x = 11.0
    draw_box(c1_x, p_card_top, p_card_w, p_card_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1", lw=0.5)
    draw_box(c1_x, p_card_top, p_card_w, 4.2, fill_hex="#0f172a", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((c1_x + 2.0) * mm, y_mm(p_card_top + 3.0), "OLDI / FRONT PROOF")
    c.setFillColor(colors.HexColor("#93c5fd"))
    c.setFont(FONT_BOLD, 5.2)
    c.drawRightString((c1_x + p_card_w - 2.0) * mm, y_mm(p_card_top + 3.0), "1:1 PREPRESS")

    slot_w = p_card_w - 4.0
    slot_h = p_card_h - 10.0
    if aspect >= slot_w / slot_h:
        art_w = min(slot_w, 48.0)
        art_h = max(8.0, art_w / aspect)
    else:
        art_h = min(slot_h, 28.0)
        art_w = max(8.0, art_h * aspect)

    art1_x = c1_x + 2.0 + (slot_w - art_w) / 2.0
    art1_top = p_card_top + 5.0 + (slot_h - art_h) / 2.0

    if front_raw_p1 and front_raw_p1["kind"] == "pdf":
        vector_overlays.append({
            "page_idx": 0,
            "x_mm": art1_x,
            "y_mm": art1_top,
            "w_mm": art_w,
            "h_mm": art_h,
            "pdf_bytes": front_raw_p1["bytes"],
            "draw_contour": True,
            "draw_bleed_box": True,
            "bleed_mm": bleed,
            "hole_size": hole_size,
            "hole_pos": hole_pos,
        })
    elif front_raw_p1:
        draw_raster_or_svg(c, front_raw_p1, art1_x, art1_top, art_w, art_h, y_mm)
        c.setStrokeColor(colors.HexColor("#10b981"))
        c.setLineWidth(0.6)
        c.rect(art1_x * mm, y_mm(art1_top + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)
    else:
        draw_box(art1_x, art1_top, art_w, art_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 5.0)
        c.drawCentredString((art1_x + art_w / 2) * mm, y_mm(art1_top + art_h / 2 + 1.0), "FRONT ARTWORK")

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_BOLD, 4.8)
    c.drawCentredString((c1_x + p_card_w / 2) * mm, y_mm(p_card_top + p_card_h - 1.8), f"OLD YUZI • {width:g}×{height:g}{dim_unit}")

    # ── CARD 2: ORQA / BACK PROOF ──
    c2_x = c1_x + p_card_w + gap_p
    draw_box(c2_x, p_card_top, p_card_w, p_card_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1", lw=0.5)
    draw_box(c2_x, p_card_top, p_card_w, 4.2, fill_hex="#0f172a", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((c2_x + 2.0) * mm, y_mm(p_card_top + 3.0), "ORQA / BACK PROOF")
    back_printed = any(bool(v) for v in (od.get("backColors") or {}).values()) or bool(back_raw_p1)
    c.setFillColor(colors.HexColor("#93c5fd" if back_printed else "#cbd5e1"))
    c.setFont(FONT_BOLD, 5.2)
    c.drawRightString((c2_x + p_card_w - 2.0) * mm, y_mm(p_card_top + 3.0), "2 TOMON" if back_printed else "1 TOMON")

    art2_x = c2_x + 2.0 + (slot_w - art_w) / 2.0
    art2_top = art1_top

    if back_raw_p1 and back_raw_p1["kind"] == "pdf":
        vector_overlays.append({
            "page_idx": 0,
            "x_mm": art2_x,
            "y_mm": art2_top,
            "w_mm": art_w,
            "h_mm": art_h,
            "pdf_bytes": back_raw_p1["bytes"],
            "draw_contour": True,
            "draw_bleed_box": True,
            "bleed_mm": bleed,
            "hole_size": hole_size,
            "hole_pos": hole_pos,
        })
    elif back_raw_p1:
        draw_raster_or_svg(c, back_raw_p1, art2_x, art2_top, art_w, art_h, y_mm)
        c.setStrokeColor(colors.HexColor("#10b981"))
        c.setLineWidth(0.6)
        c.rect(art2_x * mm, y_mm(art2_top + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)
    else:
        draw_box(art2_x, art2_top, art_w, art_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 5.0)
        c.drawCentredString((art2_x + art_w / 2) * mm, y_mm(art2_top + art_h / 2 + 1.0), "ORQA MAKET YO'Q" if back_printed else "ORQASI BOSILMAYDI")

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_BOLD, 4.8)
    back_lbl = f"ORQA YUZI • {width:g}×{height:g}{dim_unit}" if back_printed else "ORQA BOSMA MAVJUD EMAS"
    c.drawCentredString((c2_x + p_card_w / 2) * mm, y_mm(p_card_top + p_card_h - 1.8), back_lbl)

    # ── CARD 3: DIELINE / SHTANS CAD KONTUR ──
    c3_x = c2_x + p_card_w + gap_p
    draw_box(c3_x, p_card_top, p_card_w, p_card_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1", lw=0.5)
    draw_box(c3_x, p_card_top, p_card_w, 4.2, fill_hex="#0f172a", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((c3_x + 2.0) * mm, y_mm(p_card_top + 3.0), "DIELINE / SHTANS KONTUR")
    c.setFillColor(colors.HexColor("#93c5fd"))
    c.setFont(FONT_BOLD, 5.2)
    c.drawRightString((c3_x + p_card_w - 2.0) * mm, y_mm(p_card_top + 3.0), "CAD 1:1")

    art3_x = c3_x + 2.0 + (slot_w - art_w) / 2.0
    art3_top = art1_top

    if dieline_raw and dieline_raw["kind"] == "pdf":
        vector_overlays.append({
            "page_idx": 0,
            "x_mm": art3_x,
            "y_mm": art3_top,
            "w_mm": art_w,
            "h_mm": art_h,
            "pdf_bytes": dieline_raw["bytes"],
            "draw_contour": True,
            "draw_bleed_box": True,
            "bleed_mm": bleed,
            "hole_size": hole_size,
            "hole_pos": hole_pos,
        })
    elif dieline_raw:
        draw_raster_or_svg(c, dieline_raw, art3_x, art3_top, art_w, art_h, y_mm)
    else:
        # High-Precision Parametric CAD Dieline
        # 1. Outer Bleed box (Red dashed)
        c.setStrokeColor(colors.HexColor("#ef4444"))
        c.setFillColor(colors.HexColor("#fef2f2"))
        c.setLineWidth(0.6)
        c.setDash(2, 1.5)
        c.rect((art3_x - 1.2) * mm, y_mm(art3_top + art_h + 1.2), (art_w + 2.4) * mm, (art_h + 2.4) * mm, fill=1, stroke=1)
        c.setDash()

        # 2. Main Cut rule (Blue solid)
        c.setStrokeColor(colors.HexColor("#1d4ed8"))
        c.setFillColor(colors.white)
        c.setLineWidth(0.9)
        c.rect(art3_x * mm, y_mm(art3_top + art_h), art_w * mm, art_h * mm, fill=1, stroke=1)

        # 3. Crease / Bigma fold line (Magenta dashed if folded / box)
        if od.get("shapeType") in ("folded", "carton_box") or od.get("foldType"):
            c.setStrokeColor(colors.HexColor("#d946ef"))
            c.setLineWidth(0.7)
            c.setDash(2.5, 1.5)
            c.line(art3_x * mm, y_mm(art3_top + art_h / 2), (art3_x + art_w) * mm, y_mm(art3_top + art_h / 2))
            c.setDash()

        # 4. Center crosshairs
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.3)
        c.setDash(1.5, 1.5)
        c.line((art3_x + 1.5) * mm, y_mm(art3_top + art_h / 2), (art3_x + art_w - 1.5) * mm, y_mm(art3_top + art_h / 2))
        c.line((art3_x + art_w / 2) * mm, y_mm(art3_top + 1.5), (art3_x + art_w / 2) * mm, y_mm(art3_top + art_h - 1.5))
        c.setDash()

        # 5. Punch Hole
        if hole_size > 0 and hole_pos != "none":
            c.setStrokeColor(colors.HexColor("#2563eb"))
            c.setFillColor(colors.HexColor("#eff6ff"))
            c.setLineWidth(0.8)
            c.circle((art3_x + art_w / 2) * mm, y_mm(art3_top + 2.5), 1.0 * mm, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_BOLD, 4.8)
    tooling_lbl = f"SHTAMP: {trunc(od.get('selectedToolingName') or '—', 18)} (+{bleed:g}mm)"
    c.drawCentredString((c3_x + p_card_w / 2) * mm, y_mm(p_card_top + p_card_h - 1.8), tooling_lbl)

    # Bottom Specs Bar inside Section 3
    s3_bar_top = sec3_top + 47.5
    s3_bar_h = 12.5
    draw_box(11.0, s3_bar_top, full_w_mm - 4.0, s3_bar_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    phys_cells = [
        (11.0, 46.0, L["trimDimensions"], f"{width:g} × {height:g} {dim_unit} (+{bleed:g}{dim_unit})"),
        (57.0, 44.0, L["cornerCut"], str(od.get("cornerType") or "—")),
        (101.0, 45.0, L["holeEyelet"], f"Ø{hole_size:g}mm • {hole_pos}" if hole_size > 0 and hole_pos != "none" else "—"),
        (146.0, 53.0, L["paperSubstrate"], str(od.get("paperStock") or "—")),
    ]
    for (cx, cw, clbl, cval) in phys_cells:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString((cx + 2.0) * mm, y_mm(s3_bar_top + 3.8), clbl.upper())
        draw_fitted_text(c, cval, cx + 2.0, y_mm(s3_bar_top + 9.6), cw - 4.0, font_name=FONT_BOLD, base_font_size=8.6, min_font_size=5.6, max_lines=1)

    # ─── 4. TECHNICAL COATINGS, LAK & KASHIROVKA SPECIFICATION ────────────────
    sec4_top = sec3_top + sec3_h + 2.0
    sec4_h = 84.0
    draw_box(9, sec4_top, full_w_mm, sec4_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec4_top + 0.8, full_w_mm - 1.6, "TEXNOLOGIK QOPLAMALAR, LAK VA KASHIROVKA SPECIFIKATSIYASI")

    col_left_w = 93.0
    col_right_w = full_w_mm - col_left_w - 6.0  # ~93.0mm
    col_right_x = 9.0 + col_left_w + 4.0

    # LEFT COLUMN: LAMINATION, VARNISH/COATING, INKS
    # 1. Lamination Box
    lam_top = sec4_top + 7.0
    lam_h = 21.0
    draw_box(11.0, lam_top, col_left_w, lam_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, lam_top, col_left_w, 4.6, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 6.4)
    c.drawString(13.0 * mm, y_mm(lam_top + 3.3), "LAMINATSIYA (LAMINATION FILM)")
    lam_name = str(od.get("lamination") or "None")
    c.setFillColor(colors.HexColor("#93c5fd" if lam_name != "None" else "#94a3b8"))
    c.drawRightString((11.0 + col_left_w - 2.0) * mm, y_mm(lam_top + 3.3), "MAVJUD" if lam_name != "None" else "YO'Q")

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.8)
    c.drawString(13.0 * mm, y_mm(lam_top + 9.4), "Turi:")
    draw_fitted_text(c, lam_name if lam_name != "None" else "—", 22.0, y_mm(lam_top + 9.4), col_left_w - 13.0, font_name=FONT_BOLD, base_font_size=8.2)

    if lam_name != "None":
        lam_sides = str(od.get("laminationSides") or "—").upper()
        lam_micron = od.get("laminationMicron")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString(13.0 * mm, y_mm(lam_top + 15.6), "Parametr:")
        draw_fitted_text(c, f"Tomoni: {lam_sides}  •  Qalinligi: {f'{lam_micron} μm' if lam_micron else '—'}", 25.0, y_mm(lam_top + 15.6), col_left_w - 16.0, font_name=FONT_REGULAR, base_font_size=7.2)

    # 2. Varnish & Surface Coatings Box
    coat_top = lam_top + lam_h + 2.5
    coat_h = 21.0
    draw_box(11.0, coat_top, col_left_w, coat_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, coat_top, col_left_w, 4.6, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 6.4)
    c.drawString(13.0 * mm, y_mm(coat_top + 3.3), "LAK VA PARDOZLASH (COATING & EMBELLISHMENT)")
    coat_val = str(od.get("coating") or "—")
    emb_val = str(od.get("embellishment") or "None")

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.8)
    c.drawString(13.0 * mm, y_mm(coat_top + 9.4), "Lak turi:")
    draw_fitted_text(c, coat_val, 25.0, y_mm(coat_top + 9.4), col_left_w - 16.0, font_name=FONT_BOLD, base_font_size=8.2)

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.8)
    c.drawString(13.0 * mm, y_mm(coat_top + 15.6), "Pardoz:")
    draw_fitted_text(c, emb_val if emb_val != "None" else "—", 25.0, y_mm(coat_top + 15.6), col_left_w - 16.0, font_name=FONT_REGULAR, base_font_size=7.2)

    # 3. Inks (CMYK + Spot/Pantone) Box
    ink_top = coat_top + coat_h + 2.5
    ink_h = 27.0
    draw_box(11.0, ink_top, col_left_w, ink_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, ink_top, col_left_w, 4.6, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 6.4)
    c.drawString(13.0 * mm, y_mm(ink_top + 3.3), "BO'YOQLAR (CMYK + SPOT STANSIYALARI)")
    c.setFillColor(colors.HexColor("#93c5fd"))
    c.drawRightString((11.0 + col_left_w - 2.0) * mm, y_mm(ink_top + 3.3), str(od.get("colorsConfig") or "—"))

    front_colors = od.get("frontColors") or {}
    back_colors = od.get("backColors") or {}

    def draw_cmyk_row_p1(top_y: float, side_label: str, ch_map: Dict[str, Any]):
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString(13.0 * mm, y_mm(top_y), f"{side_label}:")
        ch_colors = [("c", "#06b6d4"), ("m", "#ec4899"), ("y", "#eab308"), ("k", "#0f172a")]
        for idx, (ch_key, act_hex) in enumerate(ch_colors):
            active = bool(ch_map.get(ch_key))
            bx = (11.0 + col_left_w - 26) + idx * 6.0
            draw_box(bx, top_y - 3.8, 5.2, 4.8, fill_hex=act_hex if active else "#e2e8f0", stroke_hex=None)
            c.setFillColor(colors.white if active else colors.HexColor("#94a3b8"))
            c.setFont(FONT_BOLD, 5.5)
            c.drawCentredString((bx + 2.6) * mm, y_mm(top_y - 0.2), ch_key.upper())

    draw_cmyk_row_p1(ink_top + 9.6, L["frontSide"], front_colors)
    draw_cmyk_row_p1(ink_top + 16.2, L["backSide"], back_colors)

    # Spot Color Chips
    spot_items = od.get("spotColorItems") or []
    if not spot_items and od.get("spotColors"):
        spot_items = [{"name": s, "hex": "#fe5000", "side": "front"} for s in od.get("spotColors", [])]

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.8)
    c.drawString(13.0 * mm, y_mm(ink_top + 22.8), "Pantone:")
    if spot_items:
        for s_idx, sp in enumerate(spot_items[:2]):
            sx = 28.0 + s_idx * 36.0
            draw_box(sx, ink_top + 19.6, 3.2, 3.2, fill_hex=sp.get("hex") or "#fe5000", stroke_hex=None)
            draw_fitted_text(c, f"{sp.get('name')} ({sp.get('side', 'front').upper()})", sx + 4.5, y_mm(ink_top + 22.8), 31.0, font_name=FONT_BOLD, base_font_size=6.8)
    else:
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString(28.0 * mm, y_mm(ink_top + 22.8), "—")

    # RIGHT COLUMN: KASHIROVKA SPECIFICATION & SUBSTRATE LAYERS
    kash_mode = str(od.get("kashirovkaMode") or "none")
    kash_box_top = sec4_top + 7.0
    kash_box_h = 74.0
    draw_box(col_right_x, kash_box_top, col_right_w, kash_box_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(col_right_x, kash_box_top, col_right_w, 4.6, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.5)
    c.drawString((col_right_x + 2.0) * mm, y_mm(kash_box_top + 3.3), "KASHIROVKA VA QATLAMLAR MATRITSASI (SUBSTRATE)")
    c.setFillColor(colors.HexColor("#93c5fd" if kash_mode != "none" else "#cbd5e1"))
    c.drawRightString((col_right_x + col_right_w - 2.0) * mm, y_mm(kash_box_top + 3.3), kash_mode.upper())

    if kash_mode != "none":
        glue_gsm = float(od.get("kashirovkaGlueGsm") or 0)
        curing_hours = od.get("kashirovkaCuringHours")
        kash_strategy = str(od.get("kashirovkaStrategy") or "—")

        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString(
            (col_right_x + 2.0) * mm,
            y_mm(kash_box_top + 9.2),
            f"Yelim sarfi: {f'{glue_gsm:g} g/m²' if glue_gsm else '—'} • Quritish: {f'{curing_hours}h' if curing_hours else '—'} • Priladka: {f'{make_ready} varaq' if make_ready else '—'}",
        )
        c.drawString((col_right_x + 2.0) * mm, y_mm(kash_box_top + 13.8), f"Strategiya: {kash_strategy}")

        # Table Header
        l_th_top = kash_box_top + 16.5
        draw_box(col_right_x + 1.0, l_th_top, col_right_w - 2.0, 4.6, fill_hex="#e2e8f0", stroke_hex=None)
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.8)
        c.drawString((col_right_x + 2.5) * mm, y_mm(l_th_top + 3.3), "№")
        c.drawString((col_right_x + 8.0) * mm, y_mm(l_th_top + 3.3), "QATLAM NOMI (ROLE)")
        c.drawString((col_right_x + 40.0) * mm, y_mm(l_th_top + 3.3), "QOG'OZ MARKASI (STOCK)")
        c.drawRightString((col_right_x + 78.0) * mm, y_mm(l_th_top + 3.3), "GSM")
        c.drawRightString((col_right_x + col_right_w - 3.0) * mm, y_mm(l_th_top + 3.3), "BOSMA")

        layers = od.get("kashirovkaLayers") or []
        if not layers:
            c.setFillColor(colors.HexColor("#94a3b8"))
            c.setFont(FONT_REGULAR, 6.8)
            c.drawString((col_right_x + 2.5) * mm, y_mm(l_th_top + 8.4), "Qatlamlar kiritilmagan")

        total_net_gsm = 0
        for l_idx, layer in enumerate(layers[:3]):
            ly_top = l_th_top + 4.6 + l_idx * 7.4
            l_gsm = int(layer.get("grammage") or 0)
            total_net_gsm += l_gsm
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont(FONT_BOLD, 6.8)
            c.drawString((col_right_x + 2.5) * mm, y_mm(ly_top + 4.9), str(l_idx + 1))
            draw_fitted_text(c, layer.get("label") or f"Layer {l_idx+1}", col_right_x + 8.0, y_mm(ly_top + 4.9), 31.0, font_name=FONT_BOLD, base_font_size=6.8)
            draw_fitted_text(c, layer.get("paperStock") or "—", col_right_x + 40.0, y_mm(ly_top + 4.9), 36.0, font_name=FONT_REGULAR, base_font_size=6.8)
            c.drawRightString((col_right_x + 78.0) * mm, y_mm(ly_top + 4.9), f"{l_gsm}g" if l_gsm else "—")
            c.drawRightString((col_right_x + col_right_w - 3.0) * mm, y_mm(ly_top + 4.9), str(layer.get("colors") or "—"))
            c.setStrokeColor(colors.HexColor("#e2e8f0"))
            c.setLineWidth(0.3)
            c.line((col_right_x + 1.0) * mm, y_mm(ly_top + 7.0), (col_right_x + col_right_w - 1.0) * mm, y_mm(ly_top + 7.0))

        # Totals Strip
        if layers and total_net_gsm:
            total_mounted_gsm = round(total_net_gsm + max(0, len(layers) - 1) * glue_gsm)
            tot_top = kash_box_top + kash_box_h - 12.0
            draw_box(col_right_x + 1.0, tot_top, col_right_w - 2.0, 10.0, fill_hex="#eff6ff", stroke_hex="#bfdbfe")
            c.setFillColor(colors.HexColor("#1d4ed8"))
            c.setFont(FONT_BOLD, 7.6)
            c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 4.4), f"ZICHLIK: {total_mounted_gsm} g/m²")
            if curing_hours:
                c.setFillColor(colors.HexColor("#475569"))
                c.setFont(FONT_REGULAR, 6.0)
                c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 7.8), f"Presslangandan so'ng {curing_hours} soat quritish shart.")
    else:
        # Monotype (Standard single substrate)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 7.4)
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 10.0), "YAGONA ASOSIY QOG'OZ SPECIFIKATSIYASI")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 16.0), "Xomashyo markasi:")
        draw_fitted_text(c, str(od.get("paperStock") or "—"), col_right_x + 3.0, y_mm(kash_box_top + 22.0), col_right_w - 6.0, font_name=FONT_BOLD, base_font_size=8.4)

        imp_st = od.get("impositionState") or {}
        press_w = imp_st.get("sheetW") or od.get("pressSheetW")
        press_h = imp_st.get("sheetH") or od.get("pressSheetH")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.8)
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 29.0), f"Bosma varaq: {f'{press_w:g} × {press_h:g} mm' if press_w and press_h else '—'}")
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 35.0), f"Bitta varaqdan chiqish: {f'{yield_per_sheet} dona' if yield_per_sheet else '—'}")

        tot_top = kash_box_top + kash_box_h - 14.0
        draw_box(col_right_x + 1.0, tot_top, col_right_w - 2.0, 12.0, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 7.2)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 4.8), "STANDART MONOTIP QOG'OZ (KASHIROVKASIZ)")
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.0)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 8.5), "Qatlamlar yopishtirilmaydi. To'g'ridan-to'g'ri ofset bosmaga uzatiladi.")


    # ─── 5. SIZE BREAKDOWN (fills the rest of page 1) ─────────────────────────
    sizes_raw = od.get("sizes")
    if not sizes_raw and sku_artworks_raw:
        sizes_raw = []
        for idx, a in enumerate(sku_artworks_raw):
            if isinstance(a, dict):
                sizes_raw.append({
                    "size": a.get("size") or a.get("sizeCode") or a.get("skuId") or f"SKU-{idx+1}",
                    "model": a.get("model") or "STD",
                    "quantity": int(a.get("qty") or a.get("quantity") or 0),
                })
    if not sizes_raw:
        sizes_raw = [{"size": "ALL", "quantity": net_qty}]

    note_text = "  •  ".join(
        p.strip() for p in [req.customNote or "", str(od.get("notes") or "")] if p and p.strip()
    )
    note_h = 13.0 if note_text else 0.0
    p1_bottom = 284.0 - (note_h + 2.0 if note_text else 0.0)

    sec5_top = sec4_top + sec4_h + 2.0
    size_cols = [("№", 10), ("MODEL", 0), ("RAZMER", 0), ("MIQDOR", 30), ("ULUSH", 20)]
    n_sizes = len(sizes_raw)
    halves = 2 if n_sizes > 8 else 1
    block_w = (full_w_mm - 1.6 - (halves - 1) * 2.0) / halves
    flex_w = (block_w - sum(w for _, w in size_cols)) / 2.0
    size_cols = [(n, w or flex_w) for n, w in size_cols]
    per_half = math.ceil(n_sizes / halves)
    size_row_h = max(4.6, min(6.4, (p1_bottom - sec5_top - 7.0 - REPORT_HEAD_H - 1.0) / max(1, per_half)))
    per_half = min(per_half, int((p1_bottom - sec5_top - 7.0 - REPORT_HEAD_H - 1.0) // size_row_h))
    shown_sizes = sizes_raw[:per_half * halves]
    sec5_h = 7.0 + REPORT_HEAD_H + per_half * size_row_h + 1.0
    draw_box(9, sec5_top, full_w_mm, sec5_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    hidden_sizes = n_sizes - len(shown_sizes)
    draw_panel_header(9.8, sec5_top + 0.8, full_w_mm - 1.6, L["sizeBreakdown"],
                      f"{n_sizes} SKU" + (f" • +{hidden_sizes}" if hidden_sizes > 0 else ""))
    size_font = 8.0 if size_row_h >= 6.0 else 7.0
    for h_idx in range(halves):
        bx = 9.8 + h_idx * (block_w + 2.0)
        part = shown_sizes[h_idx * per_half:(h_idx + 1) * per_half]

        def size_cell(ri: int, ci: int, part=part, base=h_idx * per_half):
            if ri >= len(part):
                return None
            s_item = part[ri]
            s_str = str(s_item.get("size") or s_item.get("sizeCode") or "ALL")
            s_model = str(s_item.get("model") or (s_str.split(" - ")[0] if " - " in s_str else "STD"))
            s_code = s_str.split(" - ")[1] if " - " in s_str else s_str
            s_qty = int(s_item.get("quantity") or 0)
            if ci == 0:
                return (str(base + ri + 1), False, "#64748b")
            if ci == 1:
                return (s_model, False, "#334155")
            if ci == 2:
                return (s_code, True, "#0f172a")
            if ci == 3:
                return (f"{s_qty:,}".replace(",", " "), True, "#0f172a")
            return (f"{round((s_qty / net_qty) * 100) if net_qty > 0 else 100}%", False, "#64748b")

        draw_grid(sec5_top + 7.0, size_cols, size_row_h, per_half, size_cell, x0=bx, font=size_font)

    if note_text:
        note_top = p1_bottom + 2.0
        draw_box(9, note_top, full_w_mm, note_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(11.0 * mm, y_mm(note_top + 4.0), "IZOH")
        draw_fitted_text(c, note_text, 11.0, y_mm(note_top + 9.2), full_w_mm - 4.0, font_name=FONT_REGULAR,
                         base_font_size=8.0, min_font_size=6.0, max_lines=2, line_spacing_pt=9.0)

    def draw_footer(page_num: int, title: str):
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.5)
        c.line(margin_x, y_mm(287.0), page_w - margin_x, y_mm(287.0))
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.0)
        c.drawString(margin_x, y_mm(291.0), f"{L['footerSystem']} • DOC: {doc_no} • {title}")
        c.drawRightString(page_w - margin_x, y_mm(291.0),
                          f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Sahifa {page_num} / 2")

    draw_footer(1, "MAHSULOT PASPORTI VA SPETSIFIKATSIYASI")
    c.showPage()

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2: PRODUCTION SHEET — route with blank actuals, plates, materials, sign-off
    # Everything is scaled to one page; the passport never runs to a third page.
    # ══════════════════════════════════════════════════════════════════════════
    draw_unified_header(2)

    ops_all = req.operations or []
    mats_all = req.materials or []
    imp_state = od.get("impositionState") or {}
    plates_data = imp_state.get("plateCalculations") or od.get("plateCalculations") or []
    eff_pieces = int(imp_state.get("effectivePieces") or yield_per_sheet or 1)

    plate_rows: List[Dict[str, Any]] = []
    for p_idx, plate in enumerate(plates_data):
        p_sheets = int(plate.get("requiredSheets") or 0)
        used_s = eff_pieces - int(plate.get("unassignedSlots") or 0)
        assignments = plate.get("assignments") or []
        plate_rows.append({
            "kind": "plate", "name": str(plate.get("name") or f"Forma {p_idx + 1}"), "sheets": p_sheets,
            "slots": f"{used_s}/{eff_pieces} joy", "skus": len(assignments),
            "yield": int(plate.get("totalYield") or 0), "over": int(plate.get("totalOverproduction") or 0),
        })
        for a in assignments:
            s_slots = int(a.get("slots") or 1)
            s_target = int(a.get("targetQuantity") or 0)
            s_yield = int(a.get("yieldQuantity") or (s_slots * p_sheets))
            s_diff = a.get("overproduction")
            plate_rows.append({
                "kind": "sku", "model": str(a.get("model") or "STD"),
                "code": str(a.get("sizeCode") or a.get("sizeLabel") or a.get("size") or "STD"),
                "slots": s_slots, "target": s_target, "yield": s_yield,
                "diff": int(s_diff) if s_diff is not None else s_yield - s_target,
            })

    def page2_height(op_h: float, mat_h: float, pl_h: float, blank: int, plates: List[Dict[str, Any]],
                     n_ops: int, n_mats: int) -> float:
        h = REPORT_PANEL_H + REPORT_HEAD_H + (n_ops or EMPTY_ROUTE_ROWS) * op_h + REPORT_GAP_MM
        if plates:
            h += REPORT_PANEL_H + REPORT_HEAD_H + len(plates) * pl_h + REPORT_GAP_MM
        if n_mats or blank:
            h += REPORT_PANEL_H + REPORT_HEAD_H + (n_mats + blank) * mat_h + REPORT_GAP_MM
        return h + REPORT_SIGN_H

    avail2 = REPORT_BOTTOM_MM - REPORT_TOP_MM
    n_ops, n_mats, plates_shown = len(ops_all), len(mats_all), plate_rows
    for s in (1.0, 0.9, 0.8, 0.7, 0.62, 0.55):
        op_h, mat_h, pl_h = max(5.0, REPORT_OP_ROW_H * s), max(5.0, REPORT_MAT_ROW_H * s), max(4.2, 5.4 * s)
        blank = REPORT_MAT_BLANK_ROWS
        if page2_height(op_h, mat_h, pl_h, blank, plates_shown, n_ops, n_mats) <= avail2:
            break
    else:
        blank = 0
        if page2_height(op_h, mat_h, pl_h, blank, plates_shown, n_ops, n_mats) > avail2:
            # Plates keep their banner rows only; then materials, and last the route, are trimmed
            plates_shown = [r for r in plate_rows if r["kind"] == "plate"]
            while n_mats > 0 and page2_height(op_h, mat_h, pl_h, blank, plates_shown, n_ops, n_mats) > avail2:
                n_mats -= 1
            while n_ops > 1 and page2_height(op_h, mat_h, pl_h, blank, plates_shown, n_ops, n_mats) > avail2:
                n_ops -= 1
    row_font = 7.6 if op_h >= 8.0 else (6.8 if op_h >= 6.0 else 6.0)

    cur = REPORT_TOP_MM

    # 1. Route with blank actuals the operators fill in by hand
    hidden_ops = len(ops_all) - n_ops
    badge = f"{len(ops_all)} BOSQICH" + (f" • +{hidden_ops} SIG'MADI" if hidden_ops > 0 else "")
    draw_panel_header(9.0, cur, full_w_mm, L["techRoute"], badge)

    def op_cell(ri: int, ci: int):
        if ri >= n_ops:
            return None
        op = ops_all[ri]
        if ci == 0:
            return (str(op.stepNumber), True, "#475569")
        if ci == 1:
            machine = op.machine if op.machine and op.machine != "—" else ""
            if machine and op_h >= 7.0:
                return [(op.name, True, "#0f172a"), (machine, False, "#64748b")]
            return (f"{op.name} • {machine}" if machine else op.name, True, "#0f172a")
        if ci == 2 and op.plannedQty:
            return (f"{op.plannedQty:,.0f} {op.planUnit or ''}".replace(",", " ").strip(), True, "#0f172a")
        if ci == 9 and op.operator and op.operator != "—":
            return (op.operator, False, "#334155")
        return None

    draw_grid(cur + REPORT_PANEL_H, REPORT_OP_COLS, op_h, n_ops or EMPTY_ROUTE_ROWS, op_cell, font=row_font)
    cur += REPORT_PANEL_H + REPORT_HEAD_H + (n_ops or EMPTY_ROUTE_ROWS) * op_h + REPORT_GAP_MM

    # 2. Plates and the run split per SKU
    if plates_shown:
        total_sheets_run = sum(int(p.get("requiredSheets") or 0) for p in plates_data)
        draw_panel_header(9.0, cur, full_w_mm, "BOSMA FORMALAR VA TIRAJ TAQSIMOTI",
                          f"{len(plates_data)} FORMA • JAMI {total_sheets_run:,} VARAQ".replace(",", " "))

        def plate_cell(ri: int, ci: int):
            r = plates_shown[ri]
            if r["kind"] == "plate":
                if ci == 1:
                    return (f"{r['name']} • {r['sheets']:,} list • {r['slots']} • {r['skus']} SKU".replace(",", " "),
                            True, "#0f172a")
                if ci == 5:
                    return (f"{r['yield']:,}".replace(",", " "), True, "#0f172a")
                if ci == 6:
                    over = r["over"]
                    return (f"+{over:,}".replace(",", " ") if over > 0 else f"{over:,}".replace(",", " "), True,
                            "#dc2626" if over < 0 else "#15803d")
                return None
            if ci == 1:
                return (r["model"], False, "#334155")
            if ci == 2:
                return (r["code"], True, "#0f172a")
            if ci == 3:
                return (f"{r['slots']}x", False, "#1d4ed8")
            if ci == 4:
                return (f"{r['target']:,}".replace(",", " "), False, "#475569")
            if ci == 5:
                return (f"{r['yield']:,}".replace(",", " "), True, "#0f172a")
            if ci == 6:
                d = r["diff"]
                return (f"+{d:,}".replace(",", " ") if d > 0 else f"{d:,}".replace(",", " "), False,
                        "#dc2626" if d < 0 else "#15803d")
            return None

        banners = [i for i, r in enumerate(plates_shown) if r["kind"] == "plate"]
        draw_grid(cur + REPORT_PANEL_H, REPORT_PLATE_COLS, pl_h, len(plates_shown), plate_cell, font=row_font,
                  shaded_rows=banners)
        cur += REPORT_PANEL_H + REPORT_HEAD_H + len(plates_shown) * pl_h + REPORT_GAP_MM

    # 3. Materials to issue, with blank issued / used / returned columns
    if n_mats or blank:
        hidden_mats = len(mats_all) - n_mats
        draw_panel_header(9.0, cur, full_w_mm, "MATERIAL SARFI", f"+{hidden_mats} SIG'MADI" if hidden_mats > 0 else "")

        def mat_cell(ri: int, ci: int):
            if ri >= n_mats:
                return None
            m_item = mats_all[ri]
            if ci == 0:
                return (m_item.name, True, "#0f172a")
            if ci == 1 and m_item.req:
                return (f"{m_item.req:g} {m_item.unit}", False, "#334155")
            return None

        draw_grid(cur + REPORT_PANEL_H, REPORT_MAT_COLS, mat_h, n_mats + blank, mat_cell, font=row_font)
        cur += REPORT_PANEL_H + REPORT_HEAD_H + (n_mats + blank) * mat_h + REPORT_GAP_MM

    # 4. Hand-over signatures
    sign_top = max(cur, REPORT_BOTTOM_MM - REPORT_SIGN_H)
    draw_panel_header(9.0, sign_top, full_w_mm, "IMZOLAR")
    sign_roles = ["Smena ustasi", "OTK", "Omborga qabul"]
    sign_w = (full_w_mm - 2 * 4.0) / 3.0
    box_top = sign_top + REPORT_PANEL_H
    for si, role in enumerate(sign_roles):
        sx = 9.0 + si * (sign_w + 4.0)
        draw_box(sx, box_top, sign_w, REPORT_SIGN_H - REPORT_PANEL_H, fill_hex="#ffffff", stroke_hex="#64748b", lw=0.4)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.8)
        c.drawString((sx + 2.0) * mm, y_mm(box_top + 4.2), role.upper())
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.0)
        for li, lbl in enumerate(["F.I.Sh", "Imzo"]):
            ly = box_top + 9.5 + li * 5.0
            c.drawString((sx + 2.0) * mm, y_mm(ly), lbl)
            c.setStrokeColor(colors.HexColor("#94a3b8"))
            c.line((sx + 12.0) * mm, y_mm(ly + 0.3), (sx + sign_w - 2.0) * mm, y_mm(ly + 0.3))

    draw_footer(2, "ISHLAB CHIQARISH VARAG'I")
    c.showPage()

    c.save()
    buf.seek(0)
    base_pdf_bytes = buf.getvalue()

    # ─── 13. PYMUPDF MULTI-PAGE VECTOR OVERLAY & METADATA ──────────────────────
    try:
        pt_per_mm = 72.0 / 25.4
        doc = fitz.open(stream=base_pdf_bytes, filetype="pdf")

        if vector_overlays:
            for vo in vector_overlays:
                p_idx = vo["page_idx"]
                if p_idx >= len(doc):
                    continue
                target_page = doc[p_idx]
                x0 = vo["x_mm"] * pt_per_mm
                y0 = vo["y_mm"] * pt_per_mm
                x1 = (vo["x_mm"] + vo["w_mm"]) * pt_per_mm
                y1 = (vo["y_mm"] + vo["h_mm"]) * pt_per_mm
                rect = fitz.Rect(x0, y0, x1, y1)

                src_doc = fitz.open(stream=vo["pdf_bytes"], filetype="pdf")
                target_page.show_pdf_page(rect, src_doc, pno=0, keep_proportion=True)

                if vo.get("draw_bleed_box") and vo.get("bleed_mm", 0) > 0:
                    b_pt = 1.5 * pt_per_mm
                    bleed_rect = fitz.Rect(x0 - b_pt, y0 - b_pt, x1 + b_pt, y1 + b_pt)
                    target_page.draw_rect(bleed_rect, color=(0xef/255, 0x44/255, 0x44/255), dashes="[2 1.5]", width=0.5)

                if vo.get("draw_contour"):
                    target_page.draw_rect(rect, color=(0x10/255, 0xb9/255, 0x81/255), width=0.6)

                h_size = vo.get("hole_size", 0)
                if h_size > 0 and vo.get("hole_pos") != "none":
                    hx = (x0 + x1) / 2.0
                    hy = y0 + 2.5 * pt_per_mm
                    target_page.draw_circle(fitz.Point(hx, hy), 1.0 * pt_per_mm, color=(0xef/255, 0x44/255, 0x44/255), fill=(1, 1, 1), width=0.6)

        # Header logo on both pages: up to 16.5mm tall and 62mm wide, centred in the header band
        if header_logo:
            logo_bytes, logo_box = header_logo
            clip = fitz.Rect(*logo_box)
            scale = min(16.5 * pt_per_mm / max(1.0, clip.height), 62.0 * pt_per_mm / max(1.0, clip.width))
            lw, lh = clip.width * scale, clip.height * scale
            top = (3.5 + 16.5 / 2) * pt_per_mm - lh / 2
            with fitz.open("pdf", logo_bytes) as logo_doc:
                for target_page in doc:
                    target_page.show_pdf_page(fitz.Rect(margin_x, top, margin_x + lw, top + lh), logo_doc, 0, clip=clip)

        meta = doc.metadata or {}
        meta["title"] = filename
        meta["author"] = "PrintGoo ERP"
        meta["subject"] = f"Order Passport {doc_no}"
        meta["creator"] = "PrintGoo Industrial Prepress Engine"
        doc.set_metadata(meta)

        final_pdf_bytes = doc.tobytes(deflate=True)
        buf = io.BytesIO(final_pdf_bytes)
    except Exception as e:
        print(f"PyMuPDF vector overlay / metadata error: {e}", flush=True)
        buf.seek(0)

    if req.saveToS3:
        bucket = os.getenv("S3_BUCKET_DOCS", "printgoo-docs")
        key = req.s3Key or f"job-tickets/{filename}"
        upload_buffer_to_s3(buf, bucket, key, "application/pdf")
        return {"ok": True, "bucket": bucket, "s3Key": key, "filename": filename}

    fmt = (req.format or "pdf").lower()
    if fmt in ("png", "both"):
        pdf_bytes = buf.getvalue()
        # Page 1 as the Telegram card photo
        with fitz.open(stream=pdf_bytes, filetype="pdf") as rendered:
            png = rendered[0].get_pixmap(dpi=req.dpi or 200, alpha=False).tobytes("png")
        if fmt == "png":
            return Response(content=png, media_type="image/png")
        return JSONResponse({
            "png": base64.b64encode(png).decode("ascii"),
            "pdf": base64.b64encode(pdf_bytes).decode("ascii"),
        })

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Filename": filename,
        },
    )
