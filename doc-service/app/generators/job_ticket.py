import io
import os
import re
import math
import base64
from datetime import datetime
from types import SimpleNamespace
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
from app.generators import job_ticket_profiles as profiles
from app.generators.cut_plan_block import cut_block_body_h, cut_plan_badge, draw_cut_plan_block, pick_cut_plans

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
GEO_BODY_MIN_H = 75.5  # page-1 drawings + spec panel
GEO_BODY_MAX_H = 125.0
KASH_ROW_H = 6.4
GEO_INFO_MIN_W = 84.0  # the spec panel never gets narrower than this (two columns)
REPORT_TOP_MM = 25.0
REPORT_BOTTOM_MM = 284.0
REPORT_GAP_MM = 3.0
REPORT_PANEL_H = 7.0  # panel title bar + spacing
REPORT_HEAD_H = 6.0  # column header row
REPORT_OP_ROW_H = 9.0
REPORT_MAT_ROW_H = 7.0
REPORT_MAT_BLANK_ROWS = 2
REPORT_SIGN_H = 27.0
EMPTY_ROUTE_ROWS = 3

SAMPLE_PURPOSE_LABELS = {
    "color_proof": "Rang sinovi",
    "dieline_structure": "Konstruksiya sinovi",
    "full_finished": "To'liq namuna",
    "substrate_test": "Material sinovi",
}
DIE_TOOLING = {"die_cutting"}
CLICHE_TOOLING = {"foil_cliche", "emboss_cliche"}
PLATE_TOOLING = {"ctp_plates", "flexo_polymer", "varnish_plate"}
TOOLING_STATUS = {
    "Draft": "qoralama", "Ordered": "buyurtma qilingan", "In_Production": "tayyorlanmoqda",
    "Ready": "tayyor", "Delivered": "yetkazildi", "Mounted": "o'rnatilgan",
}
ORDER_TYPE_LABELS = {"Production": "Ishlab chiqarish", "Sample": "Namuna", "Reprint": "Qayta bosma"}
SAMPLE_STATUS = {
    "none": ("BOSILMAGAN", True, "#b45309"),
    "pending_production": ("BOSILMAGAN", True, "#b45309"),
    "awaiting_approval": ("MIJOZ KO'RIGIDA", True, "#b45309"),
    "approved": ("TASDIQLANDI", True, "#15803d"),
    "revision_requested": ("QAYTA ISHLASH", True, "#dc2626"),
}

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
    # Technology profile: which KPIs, spec rows and readiness rows page 1 prints
    tech = profiles.technology(od)
    is_roll = tech in profiles.ROLL_TECHS

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

    # Sample run ahead of the mass run: its own row in the readiness table, its own block on the route
    sample = od.get("sampleData") or {}
    sample_on = bool(sample.get("isRequired")) or str(od.get("orderType") or "") == "Sample"
    sample_status = str(sample.get("approvalStatus") or "pending_production")
    sample_qty = int(sample.get("sampleQty") or 0)
    sample_sheets = int(sample.get("paperSheets") or 0)
    sample_paper = str(sample.get("paperStock") or "").strip()

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
        if sample_on and sample_status != "approved":
            flag = f"NAMUNA {sample_qty} {unit} • KEYIN TIRAJ" if sample_qty else "NAMUNA • KEYIN TIRAJ"
            fw = c.stringWidth(flag, FONT_BOLD, 6.6) / mm + 4.0
            draw_box(184.0 - fw, 17.0, fw, 4.4, fill_hex="#fffbeb", stroke_hex="#f59e0b", lw=0.5)
            c.setFillColor(colors.HexColor("#b45309"))
            c.setFont(FONT_BOLD, 6.6)
            c.drawCentredString((184.0 - fw / 2.0) * mm, y_mm(20.2), flag)

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
        (9, 38, L["customer"], customer, "Namuna + tiraj" if sample_on else ORDER_TYPE_LABELS.get(
            str(od.get("orderType") or ""), str(od.get("orderType") or ""))),
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
    draw_fitted_text(c, str(od.get("stage") or "—"), 153.0, y_mm(req_top + 15.0), 22.0, font_name=FONT_REGULAR,
                     base_font_size=6.6, min_font_size=5.0, color="#64748b", max_lines=1)

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
    # Everything the technology profile reads; spec and readiness values are added below
    px = SimpleNamespace(
        od=od, L=L, net_qty=net_qty, unit=unit, sample_on=sample_on, sample_qty=sample_qty,
        gross_sheets=gross_sheets, yield_per_sheet=yield_per_sheet, start_date=start_date, deadline=deadline,
        width=width, height=height, dim_unit=dim_unit, bleed=bleed,
        roll=profiles.roll_metrics(od, net_qty, height),
    )
    for i, (lbl, val, col_hex) in enumerate(profiles.kpis(tech, px)):
        cx = 11 + i * 47.5
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(cx * mm, y_mm(kpi_top + 4.4), lbl.upper())
        draw_fitted_text(c, val, cx, y_mm(kpi_top + 11.0), 45.0, font_name=FONT_BOLD, base_font_size=11.5,
                         min_font_size=7.5, color=col_hex, max_lines=1)

    # ─── 3. GEOMETRY: FRONT, BACK AND DIELINE DRAWINGS + SPEC PANEL ──────────
    note_text = "  •  ".join(
        p.strip() for p in [req.customNote or "", str(od.get("notes") or "")] if p and p.strip()
    )
    note_h = 13.0 if note_text else 0.0
    p1_bottom = 284.0 - (note_h + 2.0 if note_text else 0.0)

    # Page-1 budget: the readiness table and the kashirovka block get their room first,
    # the drawings take the rest (capped so a light order does not get giant drawings).
    kash_mode = str(od.get("kashirovkaMode") or "none")
    kash_layers = [l for l in (od.get("kashirovkaLayers") or []) if isinstance(l, dict)]
    kash_on = kash_mode != "none"
    kash_h = 18.0 + REPORT_HEAD_H + max(1, len(kash_layers)) * KASH_ROW_H + 1.0
    ready_block_h = 7.0 + REPORT_HEAD_H + (6 if sample_on else 5) * 7.0 + 1.0
    sec3_top = kpi_top + kpi_h + 1.5
    geo_free = p1_bottom - sec3_top - 9.0 - (kash_h + 2.0 if kash_on else 0.0) - (ready_block_h + 2.0)
    geo_body_h = max(GEO_BODY_MIN_H, min(GEO_BODY_MAX_H, geo_free))
    sec3_h = 7.0 + geo_body_h + 2.0
    draw_box(9, sec3_top, full_w_mm, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    panel3_badge = f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit})"
    if od.get("shapeType"):
        panel3_badge += f" • {str(od.get('shapeType')).upper()}"
    draw_panel_header(9.8, sec3_top + 0.8, full_w_mm - 1.6, L["physicalSpecs"], panel3_badge)

    hole_size = float(od.get("holeSize") or 0)
    hole_pos = str(od.get("holePosition") or "none")
    hole_offset = float(od.get("holeOffset") or 0)

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
                if cat in ("artwork", "proofs") and "back" not in nm and "orqa" not in nm or "front" in nm or "oldi" in nm:
                    front_src = u
                    break
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
    # The order screen keeps the chosen die as `dieline` ({source: "file", fileUrl}); a die
    # file attached to a die-cutting tooling item counts too.
    dl = od.get("dieline") if isinstance(od.get("dieline"), dict) else {}
    dieline_src = (dl.get("fileUrl") if dl.get("source") == "file" else None) or od.get("dielineUrl")
    if not dieline_src and dl.get("source") != "none":
        for t in od.get("toolingItems") or []:
            if isinstance(t, dict) and t.get("category") == "die_cutting":
                tu = str(t.get("fileUrl") or "")
                if tu and not tu.startswith("data:") and re.search(r"\.(pdf|svg)(\?|&|$)", tu.lower()):
                    dieline_src = tu
                    break
    dieline_src = dieline_src or od.get("customSvgPath")
    if not dieline_src:
        for att in od.get("attachments") or []:
            if isinstance(att, dict) and (att.get("category") == "dieline" or "dieline" in str(att.get("name", "")).lower() or "shtamp" in str(att.get("name", "")).lower()):
                dieline_src = att.get("url") or att.get("storagePath")
                break
    dieline_raw = get_raw_artwork(dieline_src) if dieline_src else None

    # Drawings left, one spec panel right. Front, back and dieline sit side by side at the
    # same scale; the panel takes whatever width the drawings leave and lists every fact
    # about the cut piece once.
    aspect = width / height if width > 0 and height > 0 else 1.0
    geo_top = sec3_top + 7.0
    geo_x0, geo_x1 = 11.0, 9.0 + full_w_mm - 2.0
    dim_top = 7.5   # room for the width dimension above the drawings
    cap_h = 6.0     # caption under each drawing
    dim_gap = 7.0   # left margin for the height dimension
    sk_gap = 5.0
    max_zone_w = (geo_x1 - geo_x0) - GEO_INFO_MIN_W - 4.0
    avail_h = geo_body_h - dim_top

    def fit(cell_w: float, cell_h: float) -> Tuple[float, float]:
        if aspect >= cell_w / cell_h:
            return cell_w, max(6.0, cell_w / aspect)
        return max(6.0, cell_h * aspect), cell_h

    # One row (front | back | dieline) suits tall pieces; a wide piece gets two rows
    # (front | back, dieline under the front) so it is drawn larger.
    one_row = fit((max_zone_w - dim_gap - 2 * sk_gap) / 3.0, avail_h - cap_h)
    two_rows = fit((max_zone_w - dim_gap - sk_gap) / 2.0, (avail_h - 2 * cap_h - 2.0) / 2.0)
    stacked = two_rows[0] * two_rows[1] > one_row[0] * one_row[1] * 1.15
    art_w, art_h = two_rows if stacked else one_row
    if stacked:
        zone_w = dim_gap + 2 * art_w + sk_gap
        block_h = 2 * (art_h + cap_h) + 2.0
        row0 = geo_top + dim_top + (avail_h - block_h) / 2.0
        spots_xy = [
            (geo_x0 + dim_gap, row0),
            (geo_x0 + dim_gap + art_w + sk_gap, row0),
            (geo_x0 + dim_gap, row0 + art_h + cap_h + 2.0),
        ]
    else:
        zone_w = dim_gap + 3 * art_w + 2 * sk_gap
        row0 = geo_top + dim_top + (avail_h - art_h - cap_h) / 2.0
        spots_xy = [(geo_x0 + dim_gap + i * (art_w + sk_gap), row0) for i in range(3)]
    xs = [p[0] for p in spots_xy]
    art_y = row0  # top of the first row; the dimension lines hang off the front drawing

    back_printed = any(bool(v) for v in (od.get("backColors") or {}).values()) or bool(back_raw_p1)
    hole_on = hole_size > 0 and hole_pos != "none"

    def hole_mark(x0: float, y0: float):
        if not hole_on:
            return
        r = max(0.6, hole_size / 2.0 * (art_h / height if height else 0.4))
        off = (hole_offset * (art_h / height) if height else 2.0) + r
        hx = {"top-left": x0 + off, "top-right": x0 + art_w - off}.get(hole_pos, x0 + art_w / 2.0)
        hy = y0 + (art_h / 2.0 if "center" in hole_pos and not hole_pos.startswith("top") else off)
        c.setStrokeColor(colors.HexColor("#2563eb"))
        c.setFillColor(colors.white)
        c.setLineWidth(0.6)
        c.circle(hx * mm, y_mm(hy), r * mm, fill=1, stroke=1)

    def placeholder(x0: float, y0: float, text: str):
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.setLineWidth(0.5)
        c.setDash(2, 1.5)
        c.rect(x0 * mm, y_mm(y0 + art_h), art_w * mm, art_h * mm, fill=1, stroke=1)
        c.setDash()
        c.saveState()
        c.translate((x0 + art_w / 2.0 + 1.0) * mm, y_mm(y0 + art_h / 2.0))
        if art_w < 20:
            c.rotate(90)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_BOLD, 5.6)
        c.drawCentredString(0, 0, text)
        c.restoreState()

    def place(x0: float, y0: float, raw: Optional[Dict[str, Any]], bleed_box: bool, contour: bool = False):
        if raw and raw["kind"] == "pdf":
            vector_overlays.append({
                "page_idx": 0, "x_mm": x0, "y_mm": y0, "w_mm": art_w, "h_mm": art_h,
                "pdf_bytes": raw["bytes"], "draw_contour": contour, "draw_bleed_box": bleed_box, "bleed_mm": bleed,
            })
            return True
        if raw:
            draw_raster_or_svg(c, raw, x0, y0, art_w, art_h, y_mm)
            if contour:
                c.setStrokeColor(colors.HexColor("#10b981"))
                c.setLineWidth(0.6)
                c.rect(x0 * mm, y_mm(y0 + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)
            return True
        return False

    def winding_diagram(x0: float, y0: float, code: str):
        """Roll with the web coming off the top: labels on the outer face sit above the
        web, on the inner face below it (dashed); the letter's top shows which end of
        the label leaves the roll first."""
        s = min(art_w, art_h)
        ax, ay = x0 + (art_w - s) / 2.0, y0 + (art_h - s) / 2.0
        draw_box(x0, y0, art_w, art_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0", lw=0.4)
        R = s * 0.22
        cx, cy = ax + s * 0.28, ay + s * 0.48
        c.setStrokeColor(colors.HexColor("#334155"))
        c.setFillColor(colors.white)
        c.setLineWidth(0.6)
        c.circle(cx * mm, y_mm(cy), R * mm, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#cbd5e1"))
        c.circle(cx * mm, y_mm(cy), R * 0.38 * mm, fill=1, stroke=1)
        web_y = cy - R
        web_x1 = ax + s * 0.96
        c.setLineWidth(0.9)
        c.line(cx * mm, y_mm(web_y), web_x1 * mm, y_mm(web_y))
        # Unwind direction
        c.setFillColor(colors.HexColor("#334155"))
        tip = web_x1 + 0.2
        p = c.beginPath()
        p.moveTo(tip * mm, y_mm(web_y))
        p.lineTo((tip - 1.6) * mm, y_mm(web_y - 0.9))
        p.lineTo((tip - 1.6) * mm, y_mm(web_y + 0.9))
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        inside = code.startswith("in")
        head_first = code.endswith("top")
        lw_, lh_ = s * 0.2, s * 0.16
        for i in range(2):
            lx = cx + R * 0.35 + i * (lw_ + s * 0.05)
            ly = web_y + 0.4 if inside else web_y - 0.4 - lh_
            c.setStrokeColor(colors.HexColor("#1d4ed8"))
            c.setFillColor(colors.white if inside else colors.HexColor("#dbeafe"))
            c.setLineWidth(0.5)
            if inside:
                c.setDash(1.2, 0.9)
            c.rect(lx * mm, y_mm(ly + lh_), lw_ * mm, lh_ * mm, fill=1, stroke=1)
            c.setDash()
            c.saveState()
            c.translate((lx + lw_ / 2.0) * mm, y_mm(ly + lh_ / 2.0))
            c.rotate(-90 if head_first else 90)
            fs = max(4.0, min(lh_, lw_) * 2.0)
            c.setFillColor(colors.HexColor("#1d4ed8"))
            c.setFont(FONT_BOLD, fs)
            c.drawCentredString(0, -fs * 0.35, "A")
            c.restoreState()
        draw_fitted_text(c, profiles.WINDING_LABELS[code], x0 + art_w / 2.0, y_mm(ay + s * 0.9), art_w - 2.0,
                         font_name=FONT_BOLD, base_font_size=6.0, min_font_size=4.4, color="#334155",
                         max_lines=2, line_spacing_pt=6.2, align="center")

    (fx, fy), (bx, by), (dx3, dy3) = spots_xy
    # Front
    if not place(fx, fy, front_raw_p1, bleed > 0):
        placeholder(fx, fy, "MAKET YO'Q")
    hole_mark(fx, fy)
    # Back; a roll job printed on one side shows how it is wound instead
    show_winding = is_roll and not back_raw_p1 and not back_printed
    if show_winding:
        w_code = profiles.winding_code(od)
        if w_code:
            winding_diagram(bx, by, w_code)
        else:
            placeholder(bx, by, "O'RASH KIRITILMAGAN")
    elif not place(bx, by, back_raw_p1, bleed > 0):
        placeholder(bx, by, "ORQA MAKET YO'Q" if back_printed else "BOSILMAYDI")
    if back_raw_p1 or back_printed:
        hole_mark(bx, by)
    # Dieline: the uploaded file, else the parametric cut line
    if not place(dx3, dy3, dieline_raw, False):
        if bleed > 0:
            c.setStrokeColor(colors.HexColor("#ef4444"))
            c.setLineWidth(0.5)
            c.setDash(2, 1.5)
            b = max(0.8, bleed * (art_h / height if height else 0.4))
            c.rect((dx3 - b) * mm, y_mm(dy3 + art_h + b), (art_w + 2 * b) * mm, (art_h + 2 * b) * mm, fill=0, stroke=1)
            c.setDash()
        c.setStrokeColor(colors.HexColor("#1d4ed8"))
        c.setFillColor(colors.white)
        c.setLineWidth(0.9)
        c.rect(dx3 * mm, y_mm(dy3 + art_h), art_w * mm, art_h * mm, fill=1, stroke=1)
        if od.get("shapeType") in ("folded", "carton_box") or od.get("foldType"):
            c.setStrokeColor(colors.HexColor("#d946ef"))
            c.setLineWidth(0.7)
            c.setDash(2.5, 1.5)
            c.line(dx3 * mm, y_mm(dy3 + art_h / 2), (dx3 + art_w) * mm, y_mm(dy3 + art_h / 2))
            c.setDash()
        hole_mark(dx3, dy3)

    # Captions under each drawing
    cap_pad = 1.2 + (max(0.8, bleed * (art_h / height)) if bleed and height else 0.0)
    for (x0, y0), cap in zip(spots_xy, profiles.captions(show_winding, bool(dieline_raw))):
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawCentredString((x0 + art_w / 2.0) * mm, y_mm(y0 + art_h + cap_pad + 2.8), cap)

    # Dimension lines on the front drawing: width above, height to the left
    c.setStrokeColor(colors.HexColor("#0369a1"))
    c.setFillColor(colors.HexColor("#0369a1"))
    c.setLineWidth(0.4)
    dy = art_y - 3.0
    c.line(xs[0] * mm, y_mm(dy), (xs[0] + art_w) * mm, y_mm(dy))
    for tx in (xs[0], xs[0] + art_w):
        c.line(tx * mm, y_mm(dy - 1.2), tx * mm, y_mm(dy + 1.2))
    c.setFont(FONT_BOLD, 6.0)
    c.drawCentredString((xs[0] + art_w / 2.0) * mm, y_mm(dy + 0.9 - 2.4), f"{width:g}")
    dx = xs[0] - 3.0
    c.line(dx * mm, y_mm(art_y), dx * mm, y_mm(art_y + art_h))
    for ty in (art_y, art_y + art_h):
        c.line((dx - 1.2) * mm, y_mm(ty), (dx + 1.2) * mm, y_mm(ty))
    c.saveState()
    c.translate((dx - 1.0) * mm, y_mm(art_y + art_h / 2.0))
    c.rotate(90)
    c.drawCentredString(0, 0, f"{height:g}")
    c.restoreState()

    # Tooling from the order's tooling list, by kind: the die, foil / emboss clichés, plates
    tooling = [t for t in (od.get("toolingItems") or []) if isinstance(t, dict)]

    def tool_text(categories) -> str:
        return ", ".join(
            " • ".join(x for x in [str(t.get("name") or "").strip(), TOOLING_STATUS.get(str(t.get("status") or ""), "")] if x)
            for t in tooling if t.get("category") in categories and t.get("name")
        )

    # A straight rectangle without a hole is cut on the guillotine; anything else needs a die (or punch)
    # (sheet jobs only: a roll is always cut on the press by a rotary die)
    plain_cut = not is_roll and (str(od.get("shapeType") or "rectangle").lower() == "rectangle"
                 and str(od.get("cornerType") or "Square").lower() in ("square", "", "none")
                 and not hole_on)
    die_text = tool_text(DIE_TOOLING) or str(od.get("selectedToolingName") or "").strip() or (
        "kerak emas (gilotina)" if plain_cut and not dieline_raw else "biriktirilmagan")
    emb_lower = str(od.get("embellishment") or "").lower()
    cliche_needed = any(w in emb_lower for w in ("tisn", "emboss", "folg", "foil", "konger", "hot")) or bool(
        tool_text(CLICHE_TOOLING))
    cliche_text = tool_text(CLICHE_TOOLING) or ("biriktirilmagan" if cliche_needed else "kerak emas")
    plate_tools_text = tool_text(PLATE_TOOLING)

    # Spec panel on the right
    # Paper the order asks for (type + density) is set before a stock item is picked
    # from the warehouse, so both are printed: the request and the chosen stock.
    _gsm = od.get("targetGsm") or od.get("paperDensity") or od.get("grammage")
    paper_spec = " • ".join(p for p in [
        str(od.get("targetPaperType") or "").strip(),
        f"{float(_gsm):g} g/m²" if _gsm else "",
    ] if p)
    _imp = od.get("impositionState") or {}
    press_sheet_w = _imp.get("sheetW") or od.get("pressSheetW")
    press_sheet_h = _imp.get("sheetH") or od.get("pressSheetH")
    lam = str(od.get("lamination") or "")
    lam = "" if lam.lower() in ("", "none", "-", "yo'q") else lam
    lam_full = " • ".join(p for p in [
        lam, {"1s": "1 tomon", "2s": "2 tomon"}.get(str(od.get("laminationSides") or ""), ""),
        f"{od.get('laminationMicron')} mkm" if lam and od.get("laminationMicron") else "",
    ] if p)
    emb = str(od.get("embellishment") or "")
    ink_sides = profiles.ink_sides(tech, od, back_printed)
    px.__dict__.update(
        hole_on=hole_on, hole_size=hole_size, hole_pos=hole_pos, hole_offset=hole_offset,
        die_text=die_text, cliche_text=cliche_text, plate_tools_text=plate_tools_text, paper_spec=paper_spec,
        ink_sides=ink_sides, lam_full=lam_full, coating=str(od.get("coating") or ""), emb=emb,
        kash_on=kash_on, kash_mode=kash_mode, kash_layers=kash_layers,
        press_sheet_w=press_sheet_w, press_sheet_h=press_sheet_h,
    )
    info_rows = profiles.spec_rows(tech, px)
    info_x = geo_x0 + zone_w + 4.0
    info_w = geo_x1 - info_x
    draw_box(info_x, geo_top, info_w, geo_body_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0", lw=0.5)
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.5)
    c.line((info_x - 2.0) * mm, y_mm(geo_top), (info_x - 2.0) * mm, y_mm(geo_top + geo_body_h))

    # Inks: one line per side, process channels as one chip and every spot ink as its own
    # chip in press-unit order. Chips flow onto another line instead of being cut.
    INK_FS, INK_CHIP_H, INK_LINE_H, INK_SIDE_W, INK_SQ = 6.4, 4.4, 5.4, 15.0, 2.6
    ink_x0 = info_x + 2.0
    ink_w = info_w - 4.0
    chips_w = ink_w - INK_SIDE_W

    def side_chips(side) -> List[Dict[str, Any]]:
        chips = []
        if side["process"]:
            text = "CMYK" if len(side["process"]) == 4 else " ".join(l for l, _ in side["process"])
            chips.append({"squares": [hx for _, hx in side["process"]], "text": text})
        chips += [{"squares": [sp["hex"]], "text": sp["name"]} for sp in side["spots"]]
        for ch in chips:
            ch["w"] = 1.0 + len(ch["squares"]) * INK_SQ + 1.0 + c.stringWidth(ch["text"], FONT_BOLD, INK_FS) / mm + 1.4
        return chips

    def flow(chips) -> List[List[Dict[str, Any]]]:
        lines: List[List[Dict[str, Any]]] = [[]]
        used = 0.0
        for ch in chips:
            ch["w"] = min(ch["w"], chips_w)
            if lines[-1] and used + ch["w"] > chips_w:
                lines.append([])
                used = 0.0
            lines[-1].append(ch)
            used += ch["w"] + 1.2
        return lines

    ink_layout = [(side, flow(side_chips(side))) for side in ink_sides]
    ink_notes = [f"{sp['name']} — {sp['note']}" for side in ink_sides for sp in side["spots"] if sp["note"]]
    ink_notes = list(dict.fromkeys(ink_notes))  # a "both" spot is listed once
    ink_h = (4.2 + sum(len(lines) * INK_LINE_H for _, lines in ink_layout) + len(ink_notes) * 3.4 + 1.6
             if ink_sides else 0.0)

    if ink_sides:
        iy = geo_top + 1.5
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.6)
        c.drawString(ink_x0 * mm, y_mm(iy + 2.6), f"BO'YOQLAR • {profiles.ink_formula(ink_sides)}")
        ly = iy + 4.2
        for side, lines in ink_layout:
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 6.6)
            c.drawString(ink_x0 * mm, y_mm(ly + INK_CHIP_H / 2.0 + 0.9), side["label"])
            c.setFillColor(colors.HexColor("#64748b"))
            c.setFont(FONT_BOLD, 6.0)
            if side["count"]:
                c.drawRightString((ink_x0 + INK_SIDE_W - 2.0) * mm, y_mm(ly + INK_CHIP_H / 2.0 + 0.9),
                                  str(side["count"]))
            if not side["printed"] or not lines[0]:
                draw_fitted_text(c, "bosilmaydi" if not side["printed"] else "—", ink_x0 + INK_SIDE_W,
                                 y_mm(ly + INK_CHIP_H / 2.0 + 1.0), chips_w, font_name=FONT_BOLD,
                                 base_font_size=7.4, color="#64748b", max_lines=1)
            for line in lines:
                cx = ink_x0 + INK_SIDE_W
                for ch in line:
                    draw_box(cx, ly, ch["w"], INK_CHIP_H, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.4)
                    sx = cx + 1.0
                    for hx in ch["squares"]:
                        draw_box(sx, ly + (INK_CHIP_H - INK_SQ) / 2.0, INK_SQ, INK_SQ, fill_hex=hx,
                                 stroke_hex="#94a3b8", lw=0.3)
                        sx += INK_SQ
                    draw_fitted_text(c, ch["text"], sx + 1.0, y_mm(ly + INK_CHIP_H / 2.0 + 0.8),
                                     ch["w"] - (sx - cx) - 1.4, font_name=FONT_BOLD, base_font_size=INK_FS,
                                     min_font_size=5.0, max_lines=1)
                    cx += ch["w"] + 1.2
                ly += INK_LINE_H
        for note in ink_notes:
            draw_fitted_text(c, note, ink_x0, y_mm(ly + 2.4), ink_w, font_name=FONT_REGULAR,
                             base_font_size=6.2, min_font_size=5.0, color="#475569", max_lines=1)
            ly += 3.4
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(ink_x0 * mm, y_mm(geo_top + ink_h), (ink_x0 + ink_w) * mm, y_mm(geo_top + ink_h))

    rows_top = geo_top + ink_h
    info_cols = 2 if info_w >= 80.0 else 1
    per_col = math.ceil(len(info_rows) / info_cols)
    row_h = min(9.4, (geo_body_h - ink_h - 3.0) / per_col)
    col_w = (info_w - 4.0) / info_cols
    val_size = 8.4 if row_h >= 8.0 else 7.4
    for idx, (label, value) in enumerate(info_rows):
        ci, ri = divmod(idx, per_col)
        ix = info_x + 2.0 + ci * col_w
        iy = rows_top + 1.5 + ri * row_h
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.6)
        c.drawString(ix * mm, y_mm(iy + 2.6), str(label).upper())
        draw_fitted_text(c, value, ix, y_mm(iy + 2.6 + val_size * 0.3528 + 1.4), col_w - 3.0, font_name=FONT_BOLD,
                         base_font_size=val_size, min_font_size=5.6, max_lines=1)
        if ri < per_col - 1:
            c.setStrokeColor(colors.HexColor("#e2e8f0"))
            c.setLineWidth(0.3)
            c.line(ix * mm, y_mm(iy + row_h - 0.4), (ix + col_w - 2.0) * mm, y_mm(iy + row_h - 0.4))

    # ─── 4. KASHIROVKA (only when the order is mounted) ───────────────────────
    # Lamination, coating, inks and paper are in the spec panel above; this block only
    # carries what a mounted job adds: the layers, glue, curing and the mounted density.
    sec4_top = sec3_top + sec3_h + 2.0
    if kash_on:
        sec4_h = kash_h
        draw_box(9, sec4_top, full_w_mm, sec4_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
        glue_gsm = float(od.get("kashirovkaGlueGsm") or 0)
        curing_hours = od.get("kashirovkaCuringHours")
        net_gsm = sum(int(l.get("grammage") or 0) for l in kash_layers)
        mounted = round(net_gsm + max(0, len(kash_layers) - 1) * glue_gsm) if net_gsm else 0
        draw_panel_header(9.8, sec4_top + 0.8, full_w_mm - 1.6, f"KASHIROVKA • {kash_mode.upper()}",
                          f"ZICHLIK: {mounted} g/m²" if mounted else "")
        cells = [
            ("Yelim sarfi", f"{glue_gsm:g} g/m²" if glue_gsm else "—"),
            ("Quritish", f"{curing_hours} soat" if curing_hours else "—"),
            ("Priladka", f"{make_ready} varaq" if make_ready else "—"),
            ("Strategiya", str(od.get("kashirovkaStrategy") or "—")),
        ]
        cw = (full_w_mm - 4.0) / len(cells)
        for i, (lbl, val) in enumerate(cells):
            cx = 11.0 + i * cw
            c.setFillColor(colors.HexColor("#64748b"))
            c.setFont(FONT_BOLD, 5.8)
            c.drawString(cx * mm, y_mm(sec4_top + 10.0), lbl.upper())
            draw_fitted_text(c, val, cx, y_mm(sec4_top + 15.2), cw - 3.0, font_name=FONT_BOLD, base_font_size=8.4,
                             min_font_size=6.0, max_lines=1)
        layer_cols = [("№", 10), ("QATLAM", 50), ("QOG'OZ", 80.4), ("GSM", 25), ("BOSMA", 25)]

        def layer_cell(ri: int, ci: int):
            if ri >= len(kash_layers):
                return None
            layer = kash_layers[ri]
            gsm = int(layer.get("grammage") or 0)
            return [
                (str(ri + 1), True, "#64748b"),
                (str(layer.get("label") or f"{ri + 1}-qatlam"), True, "#0f172a"),
                (str(layer.get("paperStock") or "—"), False, "#334155"),
                (f"{gsm} g/m²" if gsm else "—", True, "#0f172a"),
                (str(layer.get("colors") or "—"), False, "#334155"),
            ][ci]

        draw_grid(sec4_top + 18.0, layer_cols, KASH_ROW_H, max(1, len(kash_layers)), layer_cell, x0=9.8, font=7.6)
    else:
        sec4_h = -2.0

    # Size breakdown (shown on page 2 with the SKU artworks)
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


    # ─── 5. READINESS: the order's own checks, plus the machines on the route ──
    # Status comes from the order's checks (set on the order screen); a step without a
    # check gets an empty cell for the shop floor to fill in.
    sec5_top = sec4_top + sec4_h + 2.0
    checks = od.get("checks") or {}
    audit = checks.get("audit") or {}
    sku_files = sum(
        1 for a in sku_artworks_raw
        if isinstance(a, dict) and (a.get("frontArtworkUrl") or a.get("backArtworkUrl"))
    )
    if sku_files:
        design_detail = f"{sku_files} SKU maketi yuklangan"
    elif front_raw_p1 or back_raw_p1:
        design_detail = "Oldi" + (" va orqa" if back_raw_p1 else "") + " maket yuklangan"
    else:
        design_detail = "Maket yuklanmagan"
    mats = req.materials or []
    short = [m for m in mats if str(m.availability or "").lower() in ("low stock", "out of stock", "on order")]
    paper_detail = " • ".join(p for p in [
        str(od.get("paperStock") or "") or (f"{paper_spec} (ombordan tanlanmagan)" if paper_spec else ""),
        f"{len(mats)} material" + (f", {len(short)} yetishmaydi" if short else "") if mats else "",
    ] if p) or "—"
    forms = int(imp_summary.get("forms") or 0)
    plates = int(imp_summary.get("ctpPlates") or 0)
    plates_detail = " • ".join(p for p in [
        f"{forms} forma" if forms else "", f"{plates} plastina" if plates else "",
        f"{gross_sheets:,} bosma list".replace(",", " ") if gross_sheets else "",
        plate_tools_text,
    ] if p) or "Imposition qilinmagan"
    tooling_detail = " • ".join(p for p in [
        f"Shtamp: {die_text}",
        f"Klishe: {cliche_text}" if cliche_needed else "",
    ] if p)
    machine_names: List[str] = []
    for op in req.operations or []:
        if op.machine and op.machine != "—" and op.machine not in machine_names:
            machine_names.append(op.machine)
    sample_detail = " • ".join(p for p in [
        f"{sample_qty} {unit}" if sample_qty else "",
        SAMPLE_PURPOSE_LABELS.get(str(sample.get("testPurpose") or ""), ""),
        str(sample.get("testMachine") or ""),
        sample_paper or ("asosiy qog'oz" if od.get("paperStock") else "qog'oz tanlanmagan"),
        f"{sample_sheets} list" if sample_sheets else "",
    ] if p)
    px.__dict__.update(
        design_detail=design_detail, paper_detail=paper_detail, plates_detail=plates_detail,
        tooling_detail=tooling_detail, machine_names=machine_names, sample_detail=sample_detail,
        mats_count_detail=f"{len(mats)} material" + (f", {len(short)} yetishmaydi" if short else "") if mats else "",
    )
    ready_rows = profiles.ready_rows(tech, px)
    ready_checks = [key for key, _, _ in ready_rows if key and key != "__sample__"]
    ready_cols = [("№", 8), ("TAYYORGARLIK", 38), ("TAFSILOT", 74.4), ("HOLAT", 24), ("TEKSHIRDI", 28), ("IMZO", 18)]
    ready_row_h = max(5.0, min(7.0, (p1_bottom - sec5_top - 7.0 - REPORT_HEAD_H - 1.0) / len(ready_rows)))
    sec5_h = 7.0 + REPORT_HEAD_H + len(ready_rows) * ready_row_h + 1.0
    done = sum(1 for key in ready_checks if checks.get(key))
    draw_box(9, sec5_top, full_w_mm, sec5_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec5_top + 0.8, full_w_mm - 1.6, "ISHLAB CHIQARISHGA TAYYORGARLIK",
                      f"{done} / {len(ready_checks)} TAYYOR")

    def ready_cell(ri: int, ci: int):
        key, title, detail = ready_rows[ri]
        if ci == 0:
            return (str(ri + 1), True, "#64748b")
        if ci == 1:
            return (title, True, "#0f172a")
        if ci == 2:
            return (detail, False, "#334155")
        if key == "__sample__":
            if ci == 3:
                return SAMPLE_STATUS.get(sample_status, ("—", True, "#64748b"))
            if ci == 4:
                who = " • ".join(str(v) for v in (
                    [sample.get("approvedBy"), sample.get("approvedAt")] if sample_status == "approved"
                    else [sample.get("producedBy"), sample.get("producedAt")]
                ) if v)
                return (who, False, "#475569") if who else None
            return None
        if ci == 3 and key:
            return ("TAYYOR", True, "#15803d") if checks.get(key) else ("KUTILMOQDA", True, "#b45309")
        if ci == 4 and key:
            a = audit.get(key) or {}
            who = " • ".join(str(v) for v in [a.get("verifiedBy"), a.get("verifiedAt")] if v)
            return (who, False, "#475569") if who and checks.get(key) else None
        return None

    draw_grid(sec5_top + 7.0, ready_cols, ready_row_h, len(ready_rows), ready_cell, x0=9.8,
              font=7.6 if ready_row_h >= 6.5 else 6.8)

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

    draw_footer(1, profiles.FOOTER_TITLES[tech])
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
    # Guillotine jobs carry the layout tab's cutting plan; the first form is printed
    cut_plans = pick_cut_plans(od)

    def mass_plan(op) -> str:
        return f"{op.plannedQty:,.0f} {op.planUnit or ''}".replace(",", " ").strip() if op.plannedQty else ""

    def sample_plan(op) -> str:
        unit_l = str(op.planUnit or "").lower()
        if unit_l in ("varaq", "list", "sheets"):
            return f"{sample_sheets} varaq" if sample_sheets else ""
        if unit_l in ("metr", "m"):
            return ""
        return f"{sample_qty} {op.planUnit or unit}" if sample_qty else ""

    # Until the sample is approved the route is printed twice: the sample run, then the mass run
    sample_block = sample_on and sample_status != "approved"
    route_rows: List[Dict[str, Any]] = []
    # Without a route the blocks get blank rows to be written in by hand
    blank_rows = [{"kind": "blank"}] * EMPTY_ROUTE_ROWS
    if sample_block:
        route_rows.append({"kind": "banner", "color": "#b45309", "text": " • ".join(p for p in [
            "NAMUNA", f"{sample_qty} {unit}" if sample_qty else "",
            f"qog'oz: {sample_paper}" if sample_paper else "", f"{sample_sheets} list" if sample_sheets else "",
            SAMPLE_STATUS.get(sample_status, ("",))[0],
        ] if p)})
        route_rows += [{"kind": "op", "op": op, "plan": sample_plan(op)} for op in ops_all] or blank_rows
        route_rows.append({"kind": "banner", "color": "#1d4ed8",
                           "text": f"TIRAJ • {net_qty:,} {unit}".replace(",", " ") + " • namuna tasdiqlangandan keyin"})
        route_rows += [{"kind": "op", "op": op, "plan": mass_plan(op)} for op in ops_all] or blank_rows
    else:
        route_rows += [{"kind": "op", "op": op, "plan": mass_plan(op)} for op in ops_all]

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

    # SKU artworks uploaded per model / size (each size's own file, else the order's own)
    sku_art_map: Dict[str, Dict[str, Any]] = {}
    for a in sku_artworks_raw:
        if not isinstance(a, dict):
            continue
        for k in (a.get("skuId"), a.get("sizeCode"), a.get("size")):
            if k:
                sku_art_map[str(k).strip().upper()] = a
        if a.get("model") and a.get("sizeCode"):
            sku_art_map[f"{str(a['model']).strip()}___{str(a['sizeCode']).strip().upper()}"] = a

    sku_cards: List[Dict[str, Any]] = []
    for s_idx, s_item in enumerate(sizes_raw):
        s_str = str(s_item.get("size") or s_item.get("sizeCode") or "ALL")
        s_model = str(s_item.get("model") or (s_str.split(" - ")[0] if " - " in s_str else ""))
        s_code = str(s_item.get("sizeCode") or (s_str.split(" - ")[1] if " - " in s_str else s_str)).strip().upper()
        art = (
            sku_art_map.get(str(s_item.get("id") or "").strip().upper())
            or sku_art_map.get(f"{s_model}___{s_code}")
            or sku_art_map.get(s_code)
            or {}
        )
        f_raw = get_raw_artwork(art.get("frontArtworkUrl") or art.get("frontArtworkThumb")) if art else None
        b_raw = get_raw_artwork(art.get("backArtworkUrl") or art.get("backArtworkThumb")) if art else None
        if art and not b_raw and back_raw_p1:
            b_raw = back_raw_p1  # one back shared by every size
        sku_cards.append({
            "model": "" if s_model.strip().upper() in ("", "STD", "—", "-") else s_model.strip(),
            "code": s_code,
            "qty": int(s_item.get("quantity") or 0),
            "front": f_raw,
            "back": b_raw,
        })
    art_cards = [card for card in sku_cards if card["front"] or card["back"]]
    show_size_table = not art_cards and len(sizes_raw) > 1
    art_cols = min(len(art_cards), 6) if art_cards else 0
    art_rows = math.ceil(len(art_cards) / art_cols) if art_cards else 0
    size_halves = 2 if len(sizes_raw) > 8 else 1
    size_rows = math.ceil(len(sizes_raw) / size_halves)

    def sku_block_h(s: float) -> float:
        if art_cards:
            card_h = max(30.0, (58.0 if art_rows == 1 else 44.0) * s)
            return REPORT_PANEL_H + art_rows * card_h + (art_rows - 1) * 3.0 + REPORT_GAP_MM
        if show_size_table:
            return REPORT_PANEL_H + REPORT_HEAD_H + size_rows * max(4.6, 6.2 * s) + REPORT_GAP_MM
        return 0.0

    def page2_height(op_h: float, mat_h: float, pl_h: float, blank: int, plates: List[Dict[str, Any]],
                     n_ops: int, n_mats: int) -> float:
        h = sku_block_h(op_h / REPORT_OP_ROW_H)
        h += REPORT_PANEL_H + REPORT_HEAD_H + (n_ops or EMPTY_ROUTE_ROWS) * op_h + REPORT_GAP_MM
        if cut_plans:
            h += REPORT_PANEL_H + cut_block_body_h(op_h / REPORT_OP_ROW_H) + REPORT_GAP_MM
        if plates:
            h += REPORT_PANEL_H + REPORT_HEAD_H + len(plates) * pl_h + REPORT_GAP_MM
        if n_mats or blank:
            h += REPORT_PANEL_H + REPORT_HEAD_H + (n_mats + blank) * mat_h + REPORT_GAP_MM
        return h + REPORT_SIGN_H

    avail2 = REPORT_BOTTOM_MM - REPORT_TOP_MM
    n_ops, n_mats, plates_shown = len(route_rows), len(mats_all), plate_rows
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
    s_used = op_h / REPORT_OP_ROW_H

    # 0. SKU artworks (or, without files, the size breakdown) ahead of the route
    if art_cards:
        total_sku_qty = sum(card["qty"] for card in sku_cards)
        draw_panel_header(9.0, cur, full_w_mm, "SKU MAKETLARI",
                          f"{len(art_cards)} SKU • {total_sku_qty:,} {unit}".replace(",", " "))
        card_h = max(30.0, (58.0 if art_rows == 1 else 44.0) * s_used)
        gap_a = 3.0
        card_w = (full_w_mm - (art_cols - 1) * gap_a) / art_cols
        for a_idx, card in enumerate(art_cards):
            col_i, row_i = a_idx % art_cols, a_idx // art_cols
            acx = 9.0 + col_i * (card_w + gap_a)
            acy = cur + REPORT_PANEL_H + row_i * (card_h + gap_a)
            draw_box(acx, acy, card_w, card_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1", lw=0.5)
            draw_box(acx, acy, card_w, 5.2, fill_hex="#0f172a", stroke_hex=None)
            title = f"{card['model']} • {card['code']}" if card["model"] else card["code"]
            qty_txt = f"{card['qty']:,}".replace(",", " ") if card["qty"] else ""
            qty_w = c.stringWidth(qty_txt, FONT_BOLD, 6.8) / mm + 3.0 if qty_txt else 0.0
            draw_fitted_text(c, title, acx + 2.0, y_mm(acy + 3.8), card_w - 4.0 - qty_w, font_name=FONT_BOLD,
                             base_font_size=7.4, min_font_size=5.2, color="#ffffff", max_lines=1)
            if qty_txt:
                c.setFillColor(colors.HexColor("#93c5fd"))
                c.setFont(FONT_BOLD, 6.8)
                c.drawRightString((acx + card_w - 2.0) * mm, y_mm(acy + 3.8), qty_txt)

            sides = [(raw, lbl) for raw, lbl in ((card["front"], "OLDI"), (card["back"], "ORQA")) if raw]
            slot_top = acy + 6.4
            slot_hh = card_h - 6.4 - 4.6
            slot_ww = (card_w - 3.0 - (len(sides) - 1) * 2.0) / len(sides)
            if aspect >= slot_ww / slot_hh:
                aw, ah = slot_ww, max(6.0, slot_ww / aspect)
            else:
                ah, aw = slot_hh, max(6.0, slot_hh * aspect)
            for si, (raw, lbl) in enumerate(sides):
                sx = acx + 1.5 + si * (slot_ww + 2.0)
                ax = sx + (slot_ww - aw) / 2.0
                ay = slot_top + (slot_hh - ah) / 2.0
                if raw["kind"] == "pdf":
                    vector_overlays.append({
                        "page_idx": 1, "x_mm": ax, "y_mm": ay, "w_mm": aw, "h_mm": ah,
                        "pdf_bytes": raw["bytes"], "draw_contour": True,
                    })
                else:
                    draw_raster_or_svg(c, raw, ax, ay, aw, ah, y_mm)
                c.setFillColor(colors.HexColor("#64748b"))
                c.setFont(FONT_BOLD, 5.4)
                c.drawCentredString((sx + slot_ww / 2.0) * mm, y_mm(acy + card_h - 1.4), lbl)
        cur += REPORT_PANEL_H + art_rows * card_h + (art_rows - 1) * gap_a + REPORT_GAP_MM
    elif show_size_table:
        draw_panel_header(9.0, cur, full_w_mm, L["sizeBreakdown"], f"{len(sizes_raw)} SKU")
        size_row_h = max(4.6, 6.2 * s_used)
        block_w = (full_w_mm - (size_halves - 1) * 2.0) / size_halves
        size_cols = [("№", 10), ("MODEL", 0), ("RAZMER", 0), ("MIQDOR", 30), ("ULUSH", 20)]
        flex_w = (block_w - sum(w for _, w in size_cols)) / 2.0
        size_cols = [(n, w or flex_w) for n, w in size_cols]
        for h_idx in range(size_halves):
            part = sku_cards[h_idx * size_rows:(h_idx + 1) * size_rows]

            def size_cell(ri: int, ci: int, part=part, base=h_idx * size_rows):
                if ri >= len(part):
                    return None
                card = part[ri]
                if ci == 0:
                    return (str(base + ri + 1), False, "#64748b")
                if ci == 1:
                    return (card["model"] or "—", False, "#334155")
                if ci == 2:
                    return (card["code"], True, "#0f172a")
                if ci == 3:
                    return (f"{card['qty']:,}".replace(",", " "), True, "#0f172a")
                return (f"{round((card['qty'] / net_qty) * 100) if net_qty > 0 else 100}%", False, "#64748b")

            draw_grid(cur + REPORT_PANEL_H, size_cols, size_row_h, size_rows, size_cell,
                      x0=9.0 + h_idx * (block_w + 2.0), font=7.4 if size_row_h >= 6.0 else 6.6)
        cur += REPORT_PANEL_H + REPORT_HEAD_H + size_rows * size_row_h + REPORT_GAP_MM

    # 1. Route with blank actuals the operators fill in by hand (sample block first, if any)
    hidden_ops = sum(1 for r in route_rows[n_ops:] if r["kind"] == "op")
    badge = f"{len(ops_all)} BOSQICH" + (" • NAMUNA + TIRAJ" if sample_block else "") + (
        f" • +{hidden_ops} SIG'MADI" if hidden_ops > 0 else "")
    draw_panel_header(9.0, cur, full_w_mm, L["techRoute"], badge)

    def op_cell(ri: int, ci: int):
        if ri >= n_ops:
            return None
        row = route_rows[ri]
        if row["kind"] == "blank":
            return None
        if row["kind"] == "banner":
            return (row["text"], True, row["color"]) if ci == 1 else None
        op = row["op"]
        if ci == 2:
            return (row["plan"], True, "#0f172a") if row["plan"] else None
        if ci == 0:
            return (str(op.stepNumber), True, "#475569")
        if ci == 1:
            machine = op.machine if op.machine and op.machine != "—" else ""
            if machine and op_h >= 7.0:
                return [(op.name, True, "#0f172a"), (machine, False, "#64748b")]
            return (f"{op.name} • {machine}" if machine else op.name, True, "#0f172a")
        if ci == 9 and op.operator and op.operator != "—":
            return (op.operator, False, "#334155")
        return None

    banner_rows = [i for i, r in enumerate(route_rows[:n_ops]) if r["kind"] == "banner"]
    draw_grid(cur + REPORT_PANEL_H, REPORT_OP_COLS, op_h, n_ops or EMPTY_ROUTE_ROWS, op_cell, font=row_font,
              shaded_rows=banner_rows, merge=(1, len(REPORT_OP_COLS) - 1))
    cur += REPORT_PANEL_H + REPORT_HEAD_H + (n_ops or EMPTY_ROUTE_ROWS) * op_h + REPORT_GAP_MM

    # 1b. Guillotine cutting plan: knife order and back gauge settings for the cutter
    if cut_plans:
        cut_body = cut_block_body_h(s_used)
        draw_panel_header(9.0, cur, full_w_mm, "KESISH REJASI", cut_plan_badge(cut_plans[0], len(cut_plans)))
        draw_cut_plan_block(c, cur + REPORT_PANEL_H, 9.0, full_w_mm, cut_body, cut_plans[0], y_mm)
        cur += REPORT_PANEL_H + cut_body + REPORT_GAP_MM

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
