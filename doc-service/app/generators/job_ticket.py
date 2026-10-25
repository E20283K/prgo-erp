import io
import os
import math
import base64
from datetime import datetime
from typing import Optional, List, Dict, Any

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

from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF
from copy import deepcopy

from app.core.fonts import FONT_REGULAR, FONT_BOLD
from app.core.s3 import upload_buffer_to_s3
from app.schemas.documents import JobTicketPdfRequest, JobTicketShiftNote, JobTicketOperationItem
from app.core.constants import DEFAULT_JOB_TICKET_LABELS, trunc

_LOGO_DRAWING_CACHE = None

def get_logo_drawing():
    global _LOGO_DRAWING_CACHE
    if _LOGO_DRAWING_CACHE is not None:
        return _LOGO_DRAWING_CACHE
    logo_paths = [
        "/app/printgoo_logo.svg",
        os.path.join(os.path.dirname(__file__), "..", "core", "printgoo_logo.svg"),
        os.path.join(os.path.dirname(__file__), "..", "..", "printgoo_logo.svg"),
        "printgoo_logo.svg",
    ]
    for p in logo_paths:
        if os.path.exists(p):
            try:
                _LOGO_DRAWING_CACHE = svg2rlg(p)
                return _LOGO_DRAWING_CACHE
            except Exception as e:
                print(f"Error loading logo from {p}: {e}", flush=True)
    return None

def probe_artwork_url(doc_no: str, s_code: str, side: str = "front", sku_id: str = "") -> Optional[str]:
    clean_code = str(s_code).strip().upper()
    clean_sku = str(sku_id).strip()
    sizes_to_check = [clean_code] if clean_code != "ALL" else ["L", "M", "S", "XL", "2XL", "XS", "ALL", "STD"]
    candidates = []
    if clean_sku:
        candidates.extend([
            f"/artwork/{doc_no}/{clean_sku}-{clean_code}-{side}.pdf",
            f"/artwork/{doc_no}/{clean_sku}-{side}.pdf",
            f"/artwork/{doc_no}/{clean_sku}.pdf",
        ])
    for sc in sizes_to_check:
        candidates.extend([
            f"/artwork/{doc_no}/sku-0-0-{sc}-{side}.pdf",
            f"/artwork/{doc_no}/sku-0-1-{sc}-{side}.pdf",
            f"/artwork/{doc_no}/sku-0-2-{sc}-{side}.pdf",
            f"/artwork/{doc_no}/sku-0-3-{sc}-{side}.pdf",
            f"/artwork/{doc_no}/{sc}-{side}.pdf",
            f"/artwork/{doc_no}/{sc}.pdf",
        ])
    candidates.extend([
        f"/artwork/{doc_no}/sku-0-{side}.pdf",
        f"/artwork/{doc_no}/sku-1-{side}.pdf",
        f"/artwork/{doc_no}/sku-2-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-0-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-1-{side}.pdf",
        f"/artwork/{doc_no}/{side}.pdf",
        f"/artwork/{doc_no}/{side}.svg",
        f"/artwork/{doc_no}/front.pdf",
        f"/artwork/{doc_no}/artwork.pdf",
    ])
    import urllib.request
    for cand in candidates:
        for base in ["http://host.docker.internal:3000", "http://localhost:3000", "http://127.0.0.1:3000"]:
            try:
                full_url = f"{base}{cand}"
                req = urllib.request.Request(full_url, headers={"User-Agent": "PrintGoo-DocService"}, method="HEAD")
                with urllib.request.urlopen(req, timeout=0.8) as resp:
                    if resp.status == 200:
                        return cand
            except Exception:
                continue
    return None

def get_raw_artwork(src: Optional[str]) -> Optional[Dict[str, Any]]:
    if not src or not isinstance(src, str):
        return None
    try:
        if src.startswith("data:application/pdf") or (";base64," in src and "pdf" in src[:30].lower()):
            _, body = src.split(",", 1)
            pdf_bytes = base64.b64decode(body)
            return {"kind": "pdf", "bytes": pdf_bytes, "source": src}
        elif src.startswith("data:image"):
            header, body = src.split(",", 1)
            if "svg" in header:
                svg_bytes = base64.b64decode(body) if ";base64" in header else body.encode("utf-8")
                return {"kind": "svg", "bytes": svg_bytes, "source": src}
            else:
                img_bytes = base64.b64decode(body)
                if img_bytes.startswith(b"%PDF"):
                    return {"kind": "pdf", "bytes": img_bytes, "source": src}
                return {"kind": "image", "bytes": img_bytes, "source": src}
        elif src.startswith("/"):
            app_hosts = ["http://host.docker.internal:3000", "http://localhost:3000", "http://127.0.0.1:3000"]
            import urllib.request
            data = None
            for base in app_hosts:
                try:
                    full_url = f"{base}{src}"
                    req = urllib.request.Request(full_url, headers={"User-Agent": "PrintGoo-DocService"})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        if resp.status == 200:
                            data = resp.read()
                            break
                except Exception:
                    continue
            if data:
                if data.startswith(b"%PDF") or src.lower().endswith(".pdf"):
                    return {"kind": "pdf", "bytes": data, "source": src}
                elif src.lower().endswith(".svg") or b"<svg" in data[:100]:
                    return {"kind": "svg", "bytes": data, "source": src}
                else:
                    return {"kind": "image", "bytes": data, "source": src}
        elif src.startswith("http://") or src.startswith("https://"):
            import urllib.request
            rewritten_src = src.replace("localhost:3000", "host.docker.internal:3000").replace("127.0.0.1:3000", "host.docker.internal:3000")
            req = urllib.request.Request(rewritten_src, headers={"User-Agent": "PrintGoo-DocService"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = resp.read()
                if data.startswith(b"%PDF") or src.lower().endswith(".pdf"):
                    return {"kind": "pdf", "bytes": data, "source": src}
                elif src.lower().endswith(".svg") or b"<svg" in data[:100]:
                    return {"kind": "svg", "bytes": data, "source": src}
                else:
                    return {"kind": "image", "bytes": data, "source": src}
    except Exception as e:
        print(f"Failed to fetch raw artwork ({src}): {e}", flush=True)
    return None

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

    while len(text) > 4 and c.stringWidth(text + "…", font_name, curr_size) > max_w_pt:
        text = text[:-1]
    if c.stringWidth(text, font_name, curr_size) > max_w_pt:
        text = text[:-1] + "…"

    c.setFillColor(colors.HexColor(color))
    c.setFont(font_name, curr_size)
    if align == "center":
        c.drawCentredString(x_mm * mm, y_pos_pt, text)
    elif align == "right":
        c.drawRightString(x_mm * mm, y_pos_pt, text)
    else:
        c.drawString(x_mm * mm, y_pos_pt, text)

def generate_job_ticket_pdf(req: JobTicketPdfRequest):
    """
    Generates the unified 2-Page Industrial Order Passport (Job Ticket / Наряд-заказ) A4 PDF.
    - Page 1: Requisites, KPIs, 3-Card Physical Geometry (Front, Back, Dieline CAD/vector),
              Technical Coatings & Kashirovka Multi-Layer Panel, Inks, Readiness Gates, Sign-off Stamps.
    - Page 2: Full Technological Manufacturing Route Table (ALL operations without cutoff),
              Shift Handover Notes, BOM Materials & Size Breakdown Matrix, and SKU Prepress Proof Gallery.
    - Pure vector preservation: PDF vector pages embedded directly as native Form XObjects via PyMuPDF.
    """
    L = {**DEFAULT_JOB_TICKET_LABELS, **(req.labels or {})}
    od = req.orderData or {}
    doc_no = req.docNo or "WO-00772"

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    filename = f"Order_Passport_{doc_no}.pdf"
    c.setTitle(filename)
    c.setAuthor("PrintGoo ERP")
    c.setSubject(f"Order Passport {doc_no}")
    c.setCreator("PrintGoo Industrial Prepress Engine")
    page_w, page_h = A4  # 210mm x 297mm
    margin_x = 9.0 * mm
    full_w_mm = 192.0  # 210 - 2 * 9mm
    total_pages = 2

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

    # ─── Extract & Calculate Core Metrics ──────────────────────────────────────
    width = float(od.get("width") or 50)
    height = float(od.get("height") or 90)
    dim_unit = str(od.get("dimensionUnit") or "mm")
    bleed = float(od.get("bleed") if od.get("bleed") is not None else 2)
    item_w = width + 2 * bleed
    item_h = height + 2 * bleed
    cols = max(1, int(960 // (item_w + 2)))
    rows = max(1, int(660 // (item_h + 2)))
    yield_per_sheet = max(1, cols * rows)
    net_qty = int(od.get("quantity") or 5000)
    make_ready = int(od.get("kashirovkaMakeReadySheets") or 50)
    gross_sheets = int((net_qty / yield_per_sheet) * 1.05 + 0.999) + make_ready

    priority = str(od.get("priority") or "Normal")
    status = str(od.get("status") or "Active")
    customer = str(od.get("customer") or "—")
    product = str(od.get("product") or "—")
    department = str(od.get("department") or "Offset")
    site = str(od.get("site") or "Building 1")
    press_machine = str(od.get("pressMachine") or "—")
    recipe = str(od.get("recipe") or "OFFSET_STD_V1")
    unit = str(od.get("unit") or "pcs")
    start_date = str(od.get("startDate") or "—")
    deadline = str(od.get("deadline") or "—")

    # ─── UNIFIED HEADER (PAGES 1 & 2) WITH ENLARGED VECTOR LOGO & BARCODE ─────
    def draw_unified_header(page_num: int):
        # 1. Top Left: Vector SVG Logo (Enlarged to 16.5mm height)
        logo_d = get_logo_drawing()
        if logo_d and getattr(logo_d, "width", 0) and getattr(logo_d, "height", 0):
            try:
                d_copy = deepcopy(logo_d)
                logo_target_h = 16.5 * mm
                logo_scale = logo_target_h / d_copy.height
                d_copy.width = d_copy.width * logo_scale
                d_copy.height = logo_target_h
                d_copy.scale(logo_scale, logo_scale)
                renderPDF.draw(d_copy, c, margin_x, y_mm(3.5 + 16.5))
            except Exception as e:
                print(f"Error rendering enlarged logo: {e}", flush=True)
                c.setFillColor(colors.HexColor("#0f172a"))
                c.setFont(FONT_BOLD, 15)
                c.drawString(margin_x, y_mm(14.0), "PRINTGOO ERP")
        else:
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
    req_h = 14.0
    draw_box(9, req_top, full_w_mm, req_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")

    status_label = str(L.get("status") or L.get("colStatus") or "HOLATI").upper()
    status_val = str(od.get("status") or "Active").strip()

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
        (9, 38, L["customer"], customer, str(od.get("orderType") or "Production Order")),
        (47, 38, L["product"], product, str(od.get("itemCategory") or "Commercial Print")),
        (85, 30, L["departmentSite"], department, site),
        (115, 36, L["pressMachine"], press_machine, f"{L.get('recipe', 'Retsept')}: {recipe}"),
    ]

    for (cx, cw, lbl, val, sub) in req_cols_data:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.8)
        c.drawString((cx + 2) * mm, y_mm(req_top + 3.5), lbl.upper())
        # Use max_lines=1 with downscale so main value never clashes with sub
        draw_fitted_text(c, val, cx + 2, y_mm(req_top + 7.5), cw - 4, font_name=FONT_BOLD, base_font_size=7.2, min_font_size=5.0, max_lines=1)
        draw_fitted_text(c, sub, cx + 2, y_mm(req_top + 11.8), cw - 4, font_name=FONT_REGULAR, base_font_size=6.0, min_font_size=4.8, color="#475569", max_lines=1)

    # Col 5: Status
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(153 * mm, y_mm(req_top + 3.5), status_label)
    status_text = status_val.upper()
    draw_box(152.5, req_top + 5.0, 22.0, 4.2, fill_hex="#f1f5f9", stroke_hex="#cbd5e1", lw=0.4)
    draw_fitted_text(c, status_text, 163.5, y_mm(req_top + 8.0), 20.0, font_name=FONT_BOLD, base_font_size=6.0, min_font_size=4.8, align="center")
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.8)
    c.drawString(153 * mm, y_mm(req_top + 12.0), datetime.now().strftime("%Y-%m-%d"))

    # Col 6: Priority
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(178 * mm, y_mm(req_top + 3.5), prio_label)
    p_text = str(prio_display).upper()
    draw_box(177.5, req_top + 5.0, 22.0, 4.2, fill_hex=prio_fill, stroke_hex=prio_stroke, lw=0.4)
    draw_fitted_text(c, p_text, 188.5, y_mm(req_top + 8.0), 20.0, font_name=FONT_BOLD, base_font_size=6.0, min_font_size=4.8, color=prio_text_col, align="center")
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.8)
    c.drawString(178 * mm, y_mm(req_top + 12.0), trunc(deadline, 16))

    # Vertical divider lines
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.5)
    for div_x in [47, 85, 115, 151, 176]:
        c.line(div_x * mm, y_mm(req_top), div_x * mm, y_mm(req_top + req_h))

    # ─── 2. KPI STRIP ─────────────────────────────────────────────────────────
    kpi_top = req_top + req_h + 1.5
    draw_box(9, kpi_top, full_w_mm, 10.5, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
    kpis = [
        (L["netRun"], f"{net_qty:,} {unit}", "#1d4ed8"),
        (L["grossSheets"], f"{gross_sheets:,} sht", "#0f172a"),
        (L["impositionYield"], f"{yield_per_sheet} pcs / sht ({cols}×{rows})", "#047857"),
        (L["scheduleWindow"], f"{start_date} → {deadline}", "#0f172a"),
    ]
    for i, (lbl, val, col_hex) in enumerate(kpis):
        cx = 11 + i * 47.5
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.8)
        c.drawString(cx * mm, y_mm(kpi_top + 3.8), lbl.upper())
        c.setFillColor(colors.HexColor(col_hex))
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(cx * mm, y_mm(kpi_top + 8.6), val)

    # ─── 3. PHYSICAL GEOMETRY (3 SIDE-BY-SIDE PROOFS: FRONT, BACK, DIELINE) ───
    sec3_top = kpi_top + 12.0
    sec3_h = 58.0
    draw_box(9, sec3_top, full_w_mm, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    panel3_badge = f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit}) • {od.get('shapeType', 'Standard').upper()}"
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
    aspect = width / max(1.0, height)

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
    c.setFillColor(colors.HexColor("#93c5fd" if back_raw_p1 else "#cbd5e1"))
    c.setFont(FONT_BOLD, 5.2)
    c.drawRightString((c2_x + p_card_w - 2.0) * mm, y_mm(p_card_top + 3.0), "2-SIDED" if back_raw_p1 else "1-SIDED")

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
        c.drawCentredString((art2_x + art_w / 2) * mm, y_mm(art2_top + art_h / 2 + 1.0), "1-TOMONLI (ORQASI OQ)")

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_BOLD, 4.8)
    back_lbl = f"ORQA YUZI • {width:g}×{height:g}{dim_unit}" if back_raw_p1 else "ORQA BOSMA MAVJUD EMAS"
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
    tooling_lbl = f"SHTAMP: {trunc(od.get('selectedToolingName') or 'Standart pichoq', 18)} (+{bleed:g}mm)"
    c.drawCentredString((c3_x + p_card_w / 2) * mm, y_mm(p_card_top + p_card_h - 1.8), tooling_lbl)

    # Bottom Specs Bar inside Section 3
    s3_bar_top = sec3_top + 47.5
    s3_bar_h = 9.0
    draw_box(11.0, s3_bar_top, full_w_mm - 4.0, s3_bar_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    phys_cells = [
        (11.0, 46.0, L["trimDimensions"], f"{width:g} × {height:g} {dim_unit} (+{bleed:g}{dim_unit})"),
        (57.0, 44.0, L["cornerCut"], str(od.get("cornerType") or "Square")),
        (101.0, 45.0, L["holeEyelet"], f"Ø{hole_size:g}mm • {hole_pos}" if hole_size > 0 and hole_pos != "none" else "—"),
        (146.0, 53.0, L["paperSubstrate"], str(od.get("paperStock") or "—")),
    ]
    for (cx, cw, clbl, cval) in phys_cells:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawString((cx + 2.0) * mm, y_mm(s3_bar_top + 3.0), clbl.upper())
        draw_fitted_text(c, cval, cx + 2.0, y_mm(s3_bar_top + 6.8), cw - 4.0, font_name=FONT_BOLD, base_font_size=6.2, min_font_size=5.0, max_lines=1)

    # ─── 4. TECHNICAL COATINGS, LAK & KASHIROVKA SPECIFICATION ────────────────
    sec4_top = sec3_top + sec3_h + 2.0
    sec4_h = 74.0
    draw_box(9, sec4_top, full_w_mm, sec4_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec4_top + 0.8, full_w_mm - 1.6, "TEXNOLOGIK QOPLAMALAR, LAK VA KASHIROVKA SPECIFIKATSIYASI")

    col_left_w = 93.0
    col_right_w = full_w_mm - col_left_w - 6.0  # ~93.0mm
    col_right_x = 9.0 + col_left_w + 4.0

    # LEFT COLUMN: LAMINATION, VARNISH/COATING, INKS
    # 1. Lamination Box
    lam_top = sec4_top + 7.0
    lam_h = 19.0
    draw_box(11.0, lam_top, col_left_w, lam_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, lam_top, col_left_w, 4.0, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.5)
    c.drawString(13.0 * mm, y_mm(lam_top + 2.8), "LAMINATSIYA (LAMINATION FILM)")
    lam_name = str(od.get("lamination") or "None")
    c.setFillColor(colors.HexColor("#93c5fd" if lam_name != "None" else "#94a3b8"))
    c.drawRightString((11.0 + col_left_w - 2.0) * mm, y_mm(lam_top + 2.8), "MAVJUD" if lam_name != "None" else "YO'Q")

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(lam_top + 7.5), "Turi:")
    draw_fitted_text(c, lam_name, 22.0, y_mm(lam_top + 7.5), col_left_w - 13.0, font_name=FONT_BOLD, base_font_size=6.2)

    lam_sides = str(od.get("laminationSides") or "1s").upper()
    lam_micron = od.get("laminationMicron") or 28
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(lam_top + 12.0), "Parametr:")
    draw_fitted_text(c, f"Tomoni: {lam_sides}  •  Qalinligi: {lam_micron} μm  •  Plenka: BOPP Thermal", 25.0, y_mm(lam_top + 12.0), col_left_w - 16.0, font_name=FONT_REGULAR, base_font_size=5.8)

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(lam_top + 16.5), "Holat:")
    draw_fitted_text(c, "Harorat: 110-115°C • Bosim: 18 MPa • Rulon tarangligi normal", 22.0, y_mm(lam_top + 16.5), col_left_w - 13.0, font_name=FONT_REGULAR, base_font_size=5.5, color="#047857")

    # 2. Varnish & Surface Coatings Box
    coat_top = lam_top + lam_h + 2.5
    coat_h = 19.0
    draw_box(11.0, coat_top, col_left_w, coat_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, coat_top, col_left_w, 4.0, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.5)
    c.drawString(13.0 * mm, y_mm(coat_top + 2.8), "LAK VA PARDOZLASH (COATING & EMBELLISHMENT)")
    coat_val = str(od.get("coating") or "—")
    emb_val = str(od.get("embellishment") or "None")

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(coat_top + 7.5), "Lak turi:")
    draw_fitted_text(c, coat_val, 25.0, y_mm(coat_top + 7.5), col_left_w - 16.0, font_name=FONT_BOLD, base_font_size=6.2)

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(coat_top + 12.0), "Pardoz:")
    draw_fitted_text(c, f"Maxsus effekt: {emb_val}", 25.0, y_mm(coat_top + 12.0), col_left_w - 16.0, font_name=FONT_REGULAR, base_font_size=5.8)

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(coat_top + 16.5), "Qoplash:")
    draw_fitted_text(c, "Selektiv UV (Spot UV 100%) • Anirox: 12 cm³/m²", 25.0, y_mm(coat_top + 16.5), col_left_w - 16.0, font_name=FONT_REGULAR, base_font_size=5.5, color="#1d4ed8")

    # 3. Inks (CMYK + Spot/Pantone) Box
    ink_top = coat_top + coat_h + 2.5
    ink_h = 23.0
    draw_box(11.0, ink_top, col_left_w, ink_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(11.0, ink_top, col_left_w, 4.0, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.5)
    c.drawString(13.0 * mm, y_mm(ink_top + 2.8), "BO'YOQLAR (CMYK + SPOT STANSIYALARI)")
    c.setFillColor(colors.HexColor("#93c5fd"))
    c.drawRightString((11.0 + col_left_w - 2.0) * mm, y_mm(ink_top + 2.8), str(od.get("colorsConfig") or "4+0"))

    front_colors = od.get("frontColors") or {"c": True, "m": True, "y": True, "k": True}
    back_colors = od.get("backColors") or {"c": False, "m": False, "y": False, "k": False}

    def draw_cmyk_row_p1(top_y: float, side_label: str, ch_map: Dict[str, Any]):
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.8)
        c.drawString(13.0 * mm, y_mm(top_y), f"{side_label}:")
        ch_colors = [("c", "#06b6d4"), ("m", "#ec4899"), ("y", "#eab308"), ("k", "#0f172a")]
        for idx, (ch_key, act_hex) in enumerate(ch_colors):
            active = bool(ch_map.get(ch_key))
            bx = (11.0 + col_left_w - 26) + idx * 6.0
            draw_box(bx, top_y - 3.2, 5.2, 4.0, fill_hex=act_hex if active else "#e2e8f0", stroke_hex=None)
            c.setFillColor(colors.white if active else colors.HexColor("#94a3b8"))
            c.setFont(FONT_BOLD, 5.5)
            c.drawCentredString((bx + 2.6) * mm, y_mm(top_y - 0.2), ch_key.upper())

    draw_cmyk_row_p1(ink_top + 7.5, L["frontSide"], front_colors)
    draw_cmyk_row_p1(ink_top + 13.0, L["backSide"], back_colors)

    # Spot Color Chips
    spot_items = od.get("spotColorItems") or []
    if not spot_items and od.get("spotColors"):
        spot_items = [{"name": s, "hex": "#fe5000", "side": "front"} for s in od.get("spotColors", [])]

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 5.5)
    c.drawString(13.0 * mm, y_mm(ink_top + 18.2), "Pantone:")
    if spot_items:
        for s_idx, sp in enumerate(spot_items[:2]):
            sx = 28.0 + s_idx * 36.0
            draw_box(sx, ink_top + 15.2, 3.2, 3.2, fill_hex=sp.get("hex") or "#fe5000", stroke_hex=None)
            draw_fitted_text(c, f"{sp.get('name')} ({sp.get('side', 'front').upper()})", sx + 4.5, y_mm(ink_top + 18.2), 31.0, font_name=FONT_BOLD, base_font_size=5.5)
    else:
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 5.5)
        c.drawString(28.0 * mm, y_mm(ink_top + 18.2), "Qo'shimcha Pantone talab etilmaydi (Faqat standart CMYK)")

    # RIGHT COLUMN: KASHIROVKA SPECIFICATION & SUBSTRATE LAYERS
    kash_mode = str(od.get("kashirovkaMode") or "none")
    kash_box_top = sec4_top + 7.0
    kash_box_h = 63.5
    draw_box(col_right_x, kash_box_top, col_right_w, kash_box_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
    draw_box(col_right_x, kash_box_top, col_right_w, 4.0, fill_hex="#334155", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 5.5)
    c.drawString((col_right_x + 2.0) * mm, y_mm(kash_box_top + 2.8), "KASHIROVKA VA QATLAMLAR MATRITSASI (SUBSTRATE)")
    c.setFillColor(colors.HexColor("#93c5fd" if kash_mode != "none" else "#cbd5e1"))
    c.drawRightString((col_right_x + col_right_w - 2.0) * mm, y_mm(kash_box_top + 2.8), kash_mode.upper())

    if kash_mode != "none":
        glue_gsm = od.get("kashirovkaGlueGsm") or 25
        curing_hours = od.get("kashirovkaCuringHours") or 12
        kash_strategy = str(od.get("kashirovkaStrategy") or "split_half_sheet")

        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 5.5)
        c.drawString((col_right_x + 2.0) * mm, y_mm(kash_box_top + 7.5), f"Yelim sarfi: {glue_gsm} g/m² • Quritish: {curing_hours}h • Priladka: {make_ready} sht")
        c.drawString((col_right_x + 2.0) * mm, y_mm(kash_box_top + 11.5), f"Strategiya: {kash_strategy} • Yelim turi: PVAC Dispersiya")

        # Table Header
        l_th_top = kash_box_top + 13.5
        draw_box(col_right_x + 1.0, l_th_top, col_right_w - 2.0, 4.0, fill_hex="#e2e8f0", stroke_hex=None)
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.0)
        c.drawString((col_right_x + 2.5) * mm, y_mm(l_th_top + 2.8), "№")
        c.drawString((col_right_x + 8.0) * mm, y_mm(l_th_top + 2.8), "QATLAM NOMI (ROLE)")
        c.drawString((col_right_x + 40.0) * mm, y_mm(l_th_top + 2.8), "QOG'OZ MARKASI (STOCK)")
        c.drawRightString((col_right_x + 78.0) * mm, y_mm(l_th_top + 2.8), "GSM")
        c.drawRightString((col_right_x + col_right_w - 3.0) * mm, y_mm(l_th_top + 2.8), "BOSMA")

        layers = od.get("kashirovkaLayers") or [
            {"role": "top_liner", "label": "Face Liner (Old)", "paperStock": "Coated Cardboard", "grammage": 300, "colors": "4+0"},
            {"role": "bottom_liner", "label": "Back Liner (Orqa)", "paperStock": "Coated Cardboard", "grammage": 300, "colors": "4+0"},
        ]
        if kash_mode == "triplex" and len(layers) < 3:
            layers.insert(1, {"role": "core_board", "label": "Core Filler (O'rta)", "paperStock": "Colorplan Black", "grammage": 300, "colors": "0+0"})

        total_net_gsm = 0
        for l_idx, layer in enumerate(layers[:3]):
            ly_top = l_th_top + 4.2 + l_idx * 6.5
            l_gsm = int(layer.get("grammage") or 300)
            total_net_gsm += l_gsm
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont(FONT_BOLD, 5.5)
            c.drawString((col_right_x + 2.5) * mm, y_mm(ly_top + 4.2), str(l_idx + 1))
            draw_fitted_text(c, layer.get("label") or f"Layer {l_idx+1}", col_right_x + 8.0, y_mm(ly_top + 4.2), 31.0, font_name=FONT_BOLD, base_font_size=5.5)
            draw_fitted_text(c, layer.get("paperStock") or "Standard", col_right_x + 40.0, y_mm(ly_top + 4.2), 36.0, font_name=FONT_REGULAR, base_font_size=5.5)
            c.drawRightString((col_right_x + 78.0) * mm, y_mm(ly_top + 4.2), f"{l_gsm}g")
            c.drawRightString((col_right_x + col_right_w - 3.0) * mm, y_mm(ly_top + 4.2), str(layer.get("colors") or "4+0"))
            c.setStrokeColor(colors.HexColor("#e2e8f0"))
            c.setLineWidth(0.3)
            c.line((col_right_x + 1.0) * mm, y_mm(ly_top + 6.0), (col_right_x + col_right_w - 1.0) * mm, y_mm(ly_top + 6.0))

        # Totals Strip
        total_mounted_gsm = total_net_gsm + (len(layers) - 1) * glue_gsm
        estimated_caliper = round((total_mounted_gsm * 1.32) / 1000, 2)
        tot_top = kash_box_top + kash_box_h - 12.0
        draw_box(col_right_x + 1.0, tot_top, col_right_w - 2.0, 10.0, fill_hex="#eff6ff", stroke_hex="#bfdbfe")
        c.setFillColor(colors.HexColor("#1d4ed8"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 4.0), f"JAMI QALINLIK (CALIPER): ~{estimated_caliper} mm")
        c.drawRightString((col_right_x + col_right_w - 3.0) * mm, y_mm(tot_top + 4.0), f"ZICHLIK: {total_mounted_gsm} g/m²")
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.0)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 7.8), "Kashirovka qatlamlari presslangandan so'ng 12 soat quritish tanaffusi shart.")
    else:
        # Monotype (Standard single substrate)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 8.5), "YAGONA ASOSIY QOG'OZ SPECIFIKATSIYASI")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 5.5)
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 13.0), "Xomashyo markasi:")
        draw_fitted_text(c, str(od.get("paperStock") or "Coated Cardboard 300g/m²"), col_right_x + 3.0, y_mm(kash_box_top + 18.0), col_right_w - 6.0, font_name=FONT_BOLD, base_font_size=6.5)

        press_w = od.get("pressSheetW") or 700
        press_h = od.get("pressSheetH") or 1000
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 24.0), f"Bichim listi (Press Sheet): {press_w} × {press_h} mm")
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 29.0), "Tolalar yo'nalishi (Grain): Bo'ylama (Long Grain ||)")
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 34.0), "Namlik va saqlash: 20-22°C, 50-55% RH standart ombor rejimi")
        c.drawString((col_right_x + 3.0) * mm, y_mm(kash_box_top + 39.0), f"Bitta listdan chiqish: {yield_per_sheet} dona ({cols} × {rows} qoliplash)")

        tot_top = kash_box_top + kash_box_h - 14.0
        draw_box(col_right_x + 1.0, tot_top, col_right_w - 2.0, 12.0, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 4.5), "STANDART MONOTIP QOG'OZ (KASHIROVKASIZ)")
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.0)
        c.drawString((col_right_x + 3.0) * mm, y_mm(tot_top + 8.5), "Qatlamlar yopishtirilmaydi. To'g'ridan-to'g'ri ofset bosmaga uzatiladi.")

    # ─── 5. PRE-FLIGHT STAGE-GATES STRIP ───────────────────────────────────────
    gates_top = sec4_top + sec4_h + 2.0
    gates_h = 13.0
    gates = [
        (L["gate1Title"], L["gate1Sub"]),
        (L["gate2Title"], L["gate2Sub"]),
        (L["gate3Title"], L["gate3Sub"]),
        (L["gate4Title"], L["gate4Sub"]),
    ]
    gate_w = (full_w_mm - 6.0) / 4.0  # 46.5mm each
    for i, (g_title, g_sub) in enumerate(gates):
        gx = 9.0 + i * (gate_w + 2.0)
        draw_box(gx, gates_top, gate_w, gates_h, fill_hex="#f0fdf4", stroke_hex="#86efac")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString((gx + 2.0) * mm, y_mm(gates_top + 4.5), trunc(g_title, 22))
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.0)
        c.drawString((gx + 2.0) * mm, y_mm(gates_top + 8.5), trunc(g_sub, 26))
        # Pass Pill
        draw_box(gx + gate_w - 11.0, gates_top + 2.5, 9.5, 4.0, fill_hex="#16a34a", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 5.2)
        c.drawCentredString((gx + gate_w - 6.2) * mm, y_mm(gates_top + 5.5), L["pass"])

    # ─── 8. FULL TECHNOLOGICAL MANUFACTURING ROUTE (ALL OPERATIONS) ───────────
    sec8_top = gates_top + gates_h + 2.0
    ops_list = req.operations or []
    if not ops_list:
        ops_list = [
            JobTicketOperationItem(stepNumber=10, name="CTP Plitalarni lazerda ochish", machine="Kodak Magnus 800", operator="M. Qodirov", duration=0.8, status="Finished"),
            JobTicketOperationItem(stepNumber=20, name="Ofset bosma 4+0 CMYK", machine="Heidelberg Speedmaster XL 106", operator="A. Rahimov", duration=2.5, status="Finished"),
            JobTicketOperationItem(stepNumber=30, name="Suv asosli dispersiyali laklash", machine="Heidelberg Inline Coater", operator="A. Rahimov", duration=0.5, status="Finished"),
            JobTicketOperationItem(stepNumber=40, name="Termolaminatsiya (Matte BOPP)", machine="Autobond Mini 76", operator="I. Zokirov", duration=1.2, status="In Progress"),
            JobTicketOperationItem(stepNumber=50, name="Tirakli kesish va Shtamplash", machine="Bobst SP 102-E", operator="S. Umarov", duration=1.8, status="Queued"),
            JobTicketOperationItem(stepNumber=60, name="Qadoqlash va Yakuniy OTK", machine="Avtomat Qadoqlash", operator="D. Aliyeva", duration=0.6, status="Queued"),
        ]

    ops_to_draw = len(ops_list)
    row_h_op = 5.6
    sec8_h = 12.0 + ops_to_draw * row_h_op

    draw_box(9, sec8_top, full_w_mm, sec8_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec8_top + 0.8, full_w_mm - 1.6, L["techRoute"], f"{len(ops_list)} BOSQICHLAR")

    r_th_y = sec8_top + 6.8
    draw_box(9.8, r_th_y, full_w_mm - 1.6, 4.4, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(11.0 * mm, y_mm(r_th_y + 3.1), "№")
    c.drawString(22.0 * mm, y_mm(r_th_y + 3.1), str(L.get("colOperation") or "OPERATSIYA").upper())
    c.drawString(86.0 * mm, y_mm(r_th_y + 3.1), str(L.get("colMachine") or "DASTGOH").upper())
    c.drawString(126.0 * mm, y_mm(r_th_y + 3.1), "OPERATOR")
    c.drawRightString(160.0 * mm, y_mm(r_th_y + 3.1), "VAQT")
    c.drawCentredString(173.5 * mm, y_mm(r_th_y + 3.1), "HOLAT")
    c.drawCentredString(191.5 * mm, y_mm(r_th_y + 3.1), "IMZO")

    for idx, op in enumerate(ops_list):
        ry = r_th_y + 4.4 + idx * row_h_op
        bg_col = "#ffffff" if idx % 2 == 0 else "#f8fafc"
        draw_box(9.8, ry, full_w_mm - 1.6, row_h_op, fill_hex=bg_col, stroke_hex=None)

        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString(11.0 * mm, y_mm(ry + 3.6), f"#{op.stepNumber}")

        draw_fitted_text(c, op.name, 22.0, y_mm(ry + 3.6), 62.0, font_name=FONT_BOLD, base_font_size=6.2, min_font_size=4.8)
        draw_fitted_text(c, op.machine, 86.0, y_mm(ry + 3.6), 38.0, font_name=FONT_REGULAR, base_font_size=6.0, min_font_size=4.8, color="#334155")
        draw_fitted_text(c, op.operator, 126.0, y_mm(ry + 3.6), 28.0, font_name=FONT_REGULAR, base_font_size=6.0, min_font_size=4.8, color="#475569")

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawRightString(162.0 * mm, y_mm(ry + 3.6), f"{op.duration:g}h")

        # Status badge
        s_op = str(op.status or "Queued")
        s_fill = "#dcfce7" if s_op == "Finished" else ("#fef9c3" if s_op == "In Progress" else "#f1f5f9")
        s_text_c = "#15803d" if s_op == "Finished" else ("#a16207" if s_op == "In Progress" else "#475569")
        draw_box(166.0, ry + 1.1, 15.0, 3.6, fill_hex=s_fill, stroke_hex=None)
        c.setFillColor(colors.HexColor(s_text_c))
        c.setFont(FONT_BOLD, 4.8)
        c.drawCentredString(173.5 * mm, y_mm(ry + 3.6), s_op[:8].upper())

        # Operator sign line
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setDash(2.0, 1.5)
        c.line(184.0 * mm, y_mm(ry + 3.8), 199.0 * mm, y_mm(ry + 3.8))
        c.setDash()

        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(10.0 * mm, y_mm(ry + row_h_op), 200.0 * mm, y_mm(ry + row_h_op))

    # ─── 7. PAGE 1 FOOTER ──────────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.5)
    c.line(margin_x, y_mm(287.0), page_w - margin_x, y_mm(287.0))
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(margin_x, y_mm(291.0), f"{L['footerSystem']} • DOC: {doc_no} • MAXSULOT PASPORTI VA SPETSIFIKATSIYASI")
    c.drawRightString(page_w - margin_x, y_mm(291.0), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Sahifa 1 / {total_pages}")

    c.showPage()

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2: FULL TECH ROUTE, SHIFT NOTES, BOM MATERIALS & SKU PREPRESS GALLERY
    # ══════════════════════════════════════════════════════════════════════════
    draw_unified_header(2)

    # ─── 9. SHIFT HANDOVER & OPERATOR NOTES ───────────────────────────────────
    notes_top = 24.5
    notes = req.shiftNotes or [
        JobTicketShiftNote(
            author="M. Ivanova (Bosma brigadiri)",
            shift="1-smena",
            time="11:45",
            text="CMYK zichliklari 1.45 D ga qulflangan. Viskozitet 23s DIN4. Tezlik 14,000 ottisk/soat.",
        ),
        JobTicketShiftNote(
            author="S. Umarov (Shtamplash)",
            shift="2-smena",
            time="19:30",
            text="Bobst 102E da pichoq o'rnatildi, 0.4mm bigovka kanali moslandi. Birinchi namuna OTK tasdiqladi.",
        ),
    ]
    notes_h = 13.5
    draw_box(9, notes_top, full_w_mm, notes_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, notes_top + 0.8, full_w_mm - 1.6, L["shiftNotesTitle"])

    note_w = (full_w_mm - 6.0) / 2.0
    for n_idx, note in enumerate(notes[:2]):
        nx = 11.0 + n_idx * (note_w + 2.0)
        ny = notes_top + 6.5
        draw_box(nx, ny, note_w, 6.2, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawString((nx + 2.0) * mm, y_mm(ny + 2.4), f"[{note.shift}] {note.author} ({note.time})")
        draw_fitted_text(c, note.text, nx + 2.0, y_mm(ny + 5.0), note_w - 4.0, font_name=FONT_REGULAR, base_font_size=5.2, min_font_size=4.5)

    # ─── 10. SIDE-BY-SIDE: SIZE MATRIX & BOM MATERIALS ────────────────────────
    sec10_top = notes_top + notes_h + 2.0
    sizes_raw = od.get("sizes")
    if not sizes_raw and sku_artworks_raw:
        sizes_raw = []
        for idx, a in enumerate(sku_artworks_raw):
            if isinstance(a, dict):
                s_name = a.get("size") or a.get("sizeCode")
                if not s_name:
                    fn = a.get("frontFileName") or a.get("frontArtworkUrl") or ""
                    parts = fn.split("-")
                    if len(parts) >= 4:
                        s_name = parts[3].split(".")[0].upper()
                    else:
                        s_name = a.get("skuId") or f"SKU-{idx+1}"
                sizes_raw.append({
                    "id": a.get("skuId") or f"sku-{idx}",
                    "size": s_name,
                    "model": a.get("model") or "STD",
                    "quantity": int(a.get("qty") or a.get("quantity") or (net_qty // max(len(sku_artworks_raw), 1)))
                })
    if not sizes_raw:
        sizes_raw = [{"size": "ALL", "quantity": net_qty}]
    mats_raw = req.materials or []
    max_rows_s10 = max(len(sizes_raw[:6]), len(mats_raw[:6]), 3)
    sec10_h = 12.0 + max_rows_s10 * 5.0

    sku_w = 88.0
    bom_w = full_w_mm - sku_w - 2.0  # 102.0mm
    bom_x = 9.0 + sku_w + 2.0

    # Left: Size Matrix
    draw_box(9, sec10_top, sku_w, sec10_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec10_top + 0.8, sku_w - 1.6, L["sizeBreakdown"], f"{len(sizes_raw)} SKU")

    th_y = sec10_top + 6.8
    draw_box(9.8, th_y, sku_w - 1.6, 4.4, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(11.5 * mm, y_mm(th_y + 3.1), L["colModel"].upper())
    c.drawString(34.0 * mm, y_mm(th_y + 3.1), L["colSize"].upper())
    c.drawRightString(75.0 * mm, y_mm(th_y + 3.1), L["colQty"].upper())
    c.drawRightString(95.0 * mm, y_mm(th_y + 3.1), L["colShare"].upper())

    for idx, s_item in enumerate(sizes_raw[:6]):
        ry = th_y + 4.4 + idx * 5.0
        s_str = str(s_item.get("size") or s_item.get("sizeCode") or "ALL")
        s_model = str(s_item.get("model") or (s_str.split(" - ")[0] if " - " in s_str else "STD"))
        s_code = s_str.split(" - ")[1] if " - " in s_str else s_str
        s_qty = int(s_item.get("quantity") or 0)
        pct = round((s_qty / net_qty) * 100) if net_qty > 0 else 100

        draw_fitted_text(c, s_model, 11.5, y_mm(ry + 3.4), 21.0, font_name=FONT_REGULAR, base_font_size=6.2)
        draw_fitted_text(c, s_code, 34.0, y_mm(ry + 3.4), 22.0, font_name=FONT_BOLD, base_font_size=6.2)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawRightString(75.0 * mm, y_mm(ry + 3.4), f"{s_qty:,}")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.0)
        c.drawRightString(95.0 * mm, y_mm(ry + 3.4), f"{pct}%")
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(10.0 * mm, y_mm(ry + 4.9), (9.0 + sku_w - 1.0) * mm, y_mm(ry + 4.9))

    # Right: BOM Materials
    draw_box(bom_x, sec10_top, bom_w, sec10_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(bom_x + 0.8, sec10_top + 0.8, bom_w - 1.6, L["bomMaterials"], recipe)

    draw_box(bom_x + 0.8, th_y, bom_w - 1.6, 4.4, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((bom_x + 2.5) * mm, y_mm(th_y + 3.1), L["colMaterial"].upper())
    c.drawRightString((bom_x + 68.0) * mm, y_mm(th_y + 3.1), L["colReqQty"].upper())
    c.drawRightString((bom_x + bom_w - 2.5) * mm, y_mm(th_y + 3.1), L["colWarehouseStock"].upper())

    for idx, m_item in enumerate(mats_raw[:6]):
        ry = th_y + 4.4 + idx * 5.0
        is_short = m_item.req > m_item.stock
        draw_fitted_text(c, m_item.name, bom_x + 2.5, y_mm(ry + 3.4), 44.0, font_name=FONT_BOLD, base_font_size=6.2)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawRightString((bom_x + 68.0) * mm, y_mm(ry + 3.4), f"{m_item.req:g} {m_item.unit}")
        c.setFillColor(colors.HexColor("#dc2626" if is_short else "#047857"))
        c.drawRightString(
            (bom_x + bom_w - 2.5) * mm,
            y_mm(ry + 3.4),
            f"{m_item.stock:g} ({L['stockShortage'] if is_short else L['stockOk']})",
        )
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line((bom_x + 1.0) * mm, y_mm(ry + 4.9), (bom_x + bom_w - 1.0) * mm, y_mm(ry + 4.9))

    # ─── 11. SKU ARTWORK PREPRESS GALLERY (COMPACT CONTENT-ADAPTIVE HEIGHT) ───
    sec11_top = sec10_top + sec10_h + 2.0
    # Auto-calculate compact card height based on artwork aspect ratio
    # Prevent bloated empty space while keeping high density
    _is_two = bool(od.get("artworkBack") or any((a.get("backArtworkUrl") or a.get("backArtworkThumb")) for a in sku_artworks_raw if isinstance(a, dict)))
    if _is_two:
        _calc_art_h = min(28.0 / max(0.2, aspect), 50.0)
    else:
        _calc_art_h = min(48.0 / max(0.2, aspect), 55.0)
    c_art_h_target = max(48.0, _calc_art_h + 16.0)
    sec11_h = c_art_h_target + 9.0

    sku_cards_data: List[Dict[str, Any]] = []
    seen_keys = set()
    sku_art_map: Dict[str, Dict[str, Any]] = {}
    for a in sku_artworks_raw:
        if not isinstance(a, dict):
            continue
        if a.get("skuId"):
            sku_art_map[str(a["skuId"])] = a
        if a.get("sizeCode"):
            sku_art_map[str(a["sizeCode"]).strip().upper()] = a
        if a.get("size"):
            sku_art_map[str(a["size"]).strip().upper()] = a
        if a.get("model") and a.get("sizeCode"):
            sku_art_map[f"{str(a['model']).strip()}___{str(a['sizeCode']).strip().upper()}"] = a

    for s_idx, s_item in enumerate(sizes_raw):
        s_id = str(s_item.get("id") or f"sku-{s_idx}")
        s_str = str(s_item.get("size") or s_item.get("sizeCode") or "ALL")
        s_model = str(s_item.get("model") or (s_str.split(" - ")[0] if " - " in s_str else "STD"))
        s_code = (s_str.split(" - ")[1] if " - " in s_str else s_str).strip().upper()
        s_qty = int(s_item.get("quantity") or 0)
        pct = round((s_qty / net_qty) * 100) if net_qty > 0 else 100

        art = (
            sku_art_map.get(s_id)
            or sku_art_map.get(f"{s_model}___{s_code}")
            or sku_art_map.get(s_code)
            or sku_art_map.get(s_str.strip().upper())
        )
        key = f"{s_model}___{s_code}"
        seen_keys.add(key)
        seen_keys.add(s_id)

        f_src = art.get("frontArtworkUrl") if art else None
        if not f_src or str(f_src).startswith("data:image"):
            probed_f = probe_artwork_url(doc_no, s_code, "front", s_id)
            f_src = probed_f or (art.get("frontArtworkThumb") if art else None) or front_src

        b_src = art.get("backArtworkUrl") if art else None
        if not b_src or str(b_src).startswith("data:image"):
            probed_b = probe_artwork_url(doc_no, s_code, "back", s_id)
            b_src = probed_b or (art.get("backArtworkThumb") if art else None) or back_src

        f_raw = get_raw_artwork(f_src) if f_src else None
        b_raw = get_raw_artwork(b_src) if b_src else None
        has_art = bool(f_raw or b_raw)

        sku_cards_data.append({
            "id": s_id,
            "model": s_model,
            "sizeCode": s_code,
            "quantity": s_qty,
            "share": pct,
            "frontRaw": f_raw,
            "backRaw": b_raw,
            "hasArtwork": has_art,
        })

    items_with_art = [c_item for c_item in sku_cards_data if c_item["hasArtwork"]]

    if items_with_art:
        draw_box(9, sec11_top, full_w_mm, sec11_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
        panel_art_title = L.get("skuArtworksTitle", "SKU ARTWORK PASPORTI (1:1 PREPRESS PROOFLAR)")
        draw_panel_header(9.8, sec11_top + 0.8, full_w_mm - 1.6, panel_art_title, f"{len(items_with_art)} SKU")

        cards_y = sec11_top + 6.8
        avail_card_h = c_art_h_target
        n_art = len(items_with_art)

        if n_art <= 5:
            gap_art = 4.0
            c_art_w = (full_w_mm - 4.0 - (n_art - 1) * gap_art) / n_art
            c_art_w = min(c_art_w, 92.0)
            start_art_x = 9.0 + (full_w_mm - (n_art * c_art_w + (n_art - 1) * gap_art)) / 2.0

            for a_idx, card_item in enumerate(items_with_art):
                acx = start_art_x + a_idx * (c_art_w + gap_art)
                acy = cards_y

                draw_box(acx, acy, c_art_w, avail_card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.5)
                draw_box(acx, acy, c_art_w, 4.4, fill_hex="#0f172a", stroke_hex=None)
                c.setFillColor(colors.white)
                c.setFont(FONT_BOLD, 6.0)
                sku_lbl = f"{card_item['model']} • {card_item['sizeCode']}".upper()
                c.drawString((acx + 2.0) * mm, y_mm(acy + 3.1), trunc(sku_lbl, 20))

                qty_str = f"{card_item['quantity']:,} {unit}" if card_item['quantity'] > 0 else "NAMUNA"
                c.setFillColor(colors.HexColor("#93c5fd"))
                c.setFont(FONT_BOLD, 5.5)
                c.drawRightString((acx + c_art_w - 2.0) * mm, y_mm(acy + 3.1), qty_str)

                slot_h = avail_card_h - 11.0
                slot_w = c_art_w - 4.0
                f_raw = card_item.get("frontRaw")
                b_raw = card_item.get("backRaw")
                is_two_sided = bool(f_raw and b_raw)

                max_slot_h = avail_card_h - 10.5
                if not is_two_sided:
                    if aspect >= slot_w / max_slot_h:
                        art_w = slot_w
                        art_h = max(8.0, slot_w / aspect)
                    else:
                        art_h = max_slot_h
                        art_w = max(8.0, max_slot_h * aspect)

                    art_x = acx + 2.0 + (slot_w - art_w) / 2.0
                    art_y = acy + 5.2 + (max_slot_h - art_h) / 2.0

                    if f_raw and f_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 1,  # Page 2
                            "x_mm": art_x,
                            "y_mm": art_y,
                            "w_mm": art_w,
                            "h_mm": art_h,
                            "pdf_bytes": f_raw["bytes"],
                            "draw_contour": True,
                            "draw_bleed_box": True,
                            "bleed_mm": bleed,
                            "hole_size": hole_size,
                            "hole_pos": hole_pos,
                        })
                    elif f_raw:
                        draw_raster_or_svg(c, f_raw, art_x, art_y, art_w, art_h, y_mm)
                        c.setStrokeColor(colors.HexColor("#10b981"))
                        c.setLineWidth(0.6)
                        c.rect(art_x * mm, y_mm(art_y + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)
                else:
                    # Side-by-side compact presentation (Front + Back)
                    half_w = (slot_w - 2.0) / 2.0
                    if aspect >= half_w / max_slot_h:
                        art_w = half_w
                        art_h = max(8.0, half_w / aspect)
                    else:
                        art_h = max_slot_h
                        art_w = max(8.0, max_slot_h * aspect)

                    art_x1 = acx + 1.0 + (half_w - art_w) / 2.0
                    art_x2 = acx + 1.0 + half_w + 2.0 + (half_w - art_w) / 2.0
                    art_y = acy + 5.2 + (max_slot_h - art_h) / 2.0

                    if f_raw and f_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 1,
                            "x_mm": art_x1,
                            "y_mm": art_y,
                            "w_mm": art_w,
                            "h_mm": art_h,
                            "pdf_bytes": f_raw["bytes"],
                            "draw_contour": True,
                            "draw_bleed_box": True,
                            "bleed_mm": bleed,
                            "hole_size": hole_size,
                            "hole_pos": hole_pos,
                        })
                    elif f_raw:
                        draw_raster_or_svg(c, f_raw, art_x1, art_y, art_w, art_h, y_mm)

                    if b_raw and b_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 1,
                            "x_mm": art_x2,
                            "y_mm": art_y,
                            "w_mm": art_w,
                            "h_mm": art_h,
                            "pdf_bytes": b_raw["bytes"],
                            "draw_contour": True,
                            "draw_bleed_box": True,
                            "bleed_mm": bleed,
                        })
                    elif b_raw:
                        draw_raster_or_svg(c, b_raw, art_x2, art_y, art_w, art_h, y_mm)

                pill_top = acy + avail_card_h - 4.5
                draw_box(acx + 1.0, pill_top, c_art_w - 2.0, 3.8, fill_hex="#f8fafc", stroke_hex="#e2e8f0", lw=0.4)
                c.setFillColor(colors.HexColor("#047857"))
                c.setFont(FONT_BOLD, 5.0)
                c.drawCentredString((acx + c_art_w / 2.0) * mm, y_mm(pill_top + 2.8), "1:1 PREPRESS OK")
        else:
            cols_art = math.ceil(n_art / 2)
            gap_art = 4.0
            c_art_w = (full_w_mm - 4.0 - (cols_art - 1) * gap_art) / cols_art
            c_art_h = (avail_card_h - gap_art) / 2.0

            for a_idx, card_item in enumerate(items_with_art):
                col_i = a_idx % cols_art
                row_i = a_idx // cols_art
                acx = 11.0 + col_i * (c_art_w + gap_art)
                acy = cards_y + row_i * (c_art_h + gap_art)

                draw_box(acx, acy, c_art_w, c_art_h, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.5)
                draw_box(acx, acy, c_art_w, 4.0, fill_hex="#0f172a", stroke_hex=None)
                c.setFillColor(colors.white)
                c.setFont(FONT_BOLD, 5.8)
                c.drawString((acx + 2.0) * mm, y_mm(acy + 2.8), trunc(f"{card_item['sizeCode']}", 14))

                f_raw = card_item.get("frontRaw")
                slot_h = c_art_h - 8.0
                slot_w = c_art_w - 4.0
                if aspect >= slot_w / slot_h:
                    art_w = slot_w
                    art_h = max(6.0, slot_w / aspect)
                else:
                    art_h = slot_h
                    art_w = max(6.0, slot_h * aspect)

                art_x = acx + 2.0 + (slot_w - art_w) / 2.0
                art_y = acy + 4.5 + (slot_h - art_h) / 2.0

                if f_raw and f_raw["kind"] == "pdf":
                    vector_overlays.append({
                        "page_idx": 1,
                        "x_mm": art_x,
                        "y_mm": art_y,
                        "w_mm": art_w,
                        "h_mm": art_h,
                        "pdf_bytes": f_raw["bytes"],
                        "draw_contour": True,
                    })
                elif f_raw:
                    draw_raster_or_svg(c, f_raw, art_x, art_y, art_w, art_h, y_mm)
    else:
        draw_box(9, sec11_top, full_w_mm, sec11_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
        draw_panel_header(9.8, sec11_top + 0.8, full_w_mm - 1.6, "SKU PREPRESS PROOFLAR MATRITSASI", "MASTER PROOF")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 7.5)
        c.drawCentredString((9 + full_w_mm / 2.0) * mm, y_mm(sec11_top + sec11_h / 2.0), "SKU o'lchamlari bo'yicha yagona tasdiqlangan master artwork qo'llaniladi (1-sahifaga qarang)")

    # ─── 12. BOSMA FORMALAR VA TIRAJ TAQSIMOTI (PLATES RUN & YIELD) ───────────
    sec12_top = sec11_top + sec11_h + 2.5
    avail_sec12_h = max(25.0, 285.0 - sec12_top)

    # 1. Resolve plates data
    imp_state = od.get("impositionState") or {}
    plates_data = imp_state.get("plateCalculations") or od.get("plateCalculations") or []

    press_sheet_w = float(imp_state.get("sheetW") or od.get("pressSheetW") or 500)
    press_sheet_h = float(imp_state.get("sheetH") or od.get("pressSheetH") or 350)
    prod_w_val = float(od.get("width") or 50)
    prod_h_val = float(od.get("height") or 80)
    eff_pieces = int(imp_state.get("effectivePieces") or ((press_sheet_w // (prod_w_val + 4)) * (press_sheet_h // (prod_h_val + 4))) or 1)

    if not plates_data:
        # Fallback single plate distribution from sizes_raw
        p_sheets = math.ceil(net_qty / max(1, eff_pieces))
        p_assignments = []
        for s_item in sizes_raw:
            s_q = int(s_item.get("quantity") or 0)
            s_slots = max(1, round((s_q / max(1, net_qty)) * eff_pieces))
            p_assignments.append({
                "sizeCode": str(s_item.get("size") or s_item.get("sizeCode") or "STD"),
                "model": str(s_item.get("model") or "STD"),
                "slots": s_slots,
                "targetQuantity": s_q,
                "yieldQuantity": s_slots * p_sheets,
                "overproduction": max(0, (s_slots * p_sheets) - s_q),
            })
        plates_data = [{
            "id": "plate-1",
            "name": "Forma 1",
            "requiredSheets": p_sheets,
            "unassignedSlots": max(0, eff_pieces - sum(a["slots"] for a in p_assignments)),
            "totalYield": sum(a["yieldQuantity"] for a in p_assignments),
            "totalOverproduction": sum(a["overproduction"] for a in p_assignments),
            "assignments": p_assignments,
        }]

    total_sheets_run = sum(p.get("requiredSheets", 0) for p in plates_data)
    total_yield = sum(p.get("totalYield", 0) for p in plates_data)
    total_over = sum(p.get("totalOverproduction", 0) for p in plates_data)
    total_sku_count = sum(len(p.get("assignments", [])) for p in plates_data)

    # Dynamic height calculation: banner (5.2) + subheader (4.2) + SKU rows (4.4 each) + padding
    needed_h = 7.0 + len(plates_data) * 9.8 + total_sku_count * 4.4 + 4.0
    sec12_h = min(avail_sec12_h, max(28.0, needed_h))

    draw_box(9, sec12_top, full_w_mm, sec12_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(
        9.8,
        sec12_top + 0.8,
        full_w_mm - 1.6,
        "BOSMA FORMALAR VA TIRAJ TAQSIMOTI (PLATES RUN & YIELD)",
        f"{len(plates_data)} FORMA · JAMI {total_sheets_run:,} LIST",
    )

    curr_y = sec12_top + 6.6
    for p_idx, plate in enumerate(plates_data):
        if curr_y + 12.0 > sec12_top + sec12_h:
            break

        p_name = str(plate.get("name") or f"Forma {p_idx+1}")
        p_sheets = int(plate.get("requiredSheets") or 0)
        p_yield = int(plate.get("totalYield") or 0)
        p_over = int(plate.get("totalOverproduction") or 0)
        assignments = plate.get("assignments") or []
        used_s = eff_pieces - int(plate.get("unassignedSlots") or 0)
        used_pct = round((used_s / max(1, eff_pieces)) * 100)

        # 1. Forma Banner Header
        banner_h = 5.2
        draw_box(9.8, curr_y, full_w_mm - 1.6, banner_h, fill_hex="#0f172a", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(12.0 * mm, y_mm(curr_y + 3.6), f"{p_name.upper()}")
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 5.5)
        c.drawString(32.0 * mm, y_mm(curr_y + 3.6), f"({used_s}/{eff_pieces} joy band · {used_pct}% · {len(assignments)} SKU)")

        # Sheet run highlight
        c.setFillColor(colors.HexColor("#fef08a"))  # Yellow 200
        c.setFont(FONT_BOLD, 7.0)
        c.drawString(82.0 * mm, y_mm(curr_y + 3.6), f"BOSMA TIRAJ: {p_sheets:,} LIST")

        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6.2)
        c.drawRightString(165.0 * mm, y_mm(curr_y + 3.6), f"Chiqish: {p_yield:,} dona")

        c.setFillColor(colors.HexColor("#4ade80" if p_over >= 0 else "#f87171"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawRightString((9.0 + full_w_mm - 2.5) * mm, y_mm(curr_y + 3.6), f"+{p_over:,}" if p_over >= 0 else f"{p_over:,}")

        curr_y += banner_h

        # 2. Sub-table Column Headers
        col_hdr_h = 4.2
        draw_box(9.8, curr_y, full_w_mm - 1.6, col_hdr_h, fill_hex="#f1f5f9", stroke_hex="#cbd5e1", lw=0.4)
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawString(12.0 * mm, y_mm(curr_y + 2.9), "#")
        c.drawString(20.0 * mm, y_mm(curr_y + 2.9), "MODEL / ARTIKUL")
        c.drawString(60.0 * mm, y_mm(curr_y + 2.9), "O'LCHAM (SIZE)")
        c.drawCentredString(96.0 * mm, y_mm(curr_y + 2.9), "MAKETDAGI JOY (SLOTS)")
        c.drawCentredString(124.0 * mm, y_mm(curr_y + 2.9), "ULUSH (%)")
        c.drawRightString(150.0 * mm, y_mm(curr_y + 2.9), "BUYURTMA")
        c.drawRightString(172.0 * mm, y_mm(curr_y + 2.9), "REJA CHIQISH")
        c.drawRightString((9.0 + full_w_mm - 2.5) * mm, y_mm(curr_y + 2.9), "FARQ (+/-)")

        curr_y += col_hdr_h

        # 3. Individual SKU Rows
        row_h = 4.4
        for a_idx, a in enumerate(assignments):
            if curr_y + row_h > sec12_top + sec12_h - 1.0:
                break

            s_code = str(a.get("sizeCode") or a.get("sizeLabel") or a.get("size") or "STD")
            s_model = str(a.get("model") or "STD")
            s_slots = int(a.get("slots") or 1)
            s_target = int(a.get("targetQuantity") or 0)
            s_yield = int(a.get("yieldQuantity") or (s_slots * p_sheets))
            s_diff = int(a.get("overproduction") if a.get("overproduction") is not None else (s_yield - s_target))
            s_pct = round((s_slots / max(1, eff_pieces)) * 100, 1)

            # Alternating background
            if a_idx % 2 == 1:
                draw_box(9.8, curr_y, full_w_mm - 1.6, row_h, fill_hex="#f8fafc", stroke_hex=None)

            # Row text
            c.setFillColor(colors.HexColor("#64748b"))
            c.setFont(FONT_REGULAR, 5.2)
            c.drawString(12.0 * mm, y_mm(curr_y + 3.1), str(a_idx + 1))

            c.setFillColor(colors.HexColor("#1e293b"))
            c.setFont(FONT_BOLD, 5.8)
            draw_fitted_text(c, s_model, 20.0, y_mm(curr_y + 3.1), 38.0, font_name=FONT_BOLD, base_font_size=5.8)

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 6.2)
            draw_fitted_text(c, s_code, 60.0, y_mm(curr_y + 3.1), 24.0, font_name=FONT_BOLD, base_font_size=6.2)

            c.setFillColor(colors.HexColor("#1d4ed8"))
            c.setFont(FONT_BOLD, 6.0)
            c.drawCentredString(96.0 * mm, y_mm(curr_y + 3.1), f"{s_slots} ta joy ({s_slots}x)")

            c.setFillColor(colors.HexColor("#64748b"))
            c.setFont(FONT_REGULAR, 5.5)
            c.drawCentredString(124.0 * mm, y_mm(curr_y + 3.1), f"{s_pct}%")

            c.setFillColor(colors.HexColor("#475569"))
            c.setFont(FONT_REGULAR, 5.8)
            c.drawRightString(150.0 * mm, y_mm(curr_y + 3.1), f"{s_target:,}")

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 6.2)
            c.drawRightString(172.0 * mm, y_mm(curr_y + 3.1), f"{s_yield:,}")

            c.setFillColor(colors.HexColor("#15803d" if s_diff >= 0 else "#dc2626"))
            c.setFont(FONT_BOLD, 5.8)
            c.drawRightString((9.0 + full_w_mm - 2.5) * mm, y_mm(curr_y + 3.1), f"+{s_diff:,}" if s_diff > 0 else "0" if s_diff == 0 else f"{s_diff:,}")

            # Border line under each SKU
            c.setStrokeColor(colors.HexColor("#e2e8f0"))
            c.setLineWidth(0.3)
            c.line(10.0 * mm, y_mm(curr_y + row_h), (9.0 + full_w_mm - 1.0) * mm, y_mm(curr_y + row_h))

            curr_y += row_h

        curr_y += 2.0  # Spacing between plates

    # ─── 12. PAGE 2 FOOTER ─────────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.5)
    c.line(margin_x, y_mm(287.0), page_w - margin_x, y_mm(287.0))
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(margin_x, y_mm(291.0), f"{L['footerSystem']} • DOC: {doc_no} • ISHLAB CHIQARISH MARSHRUTI VA SMENA JURNALI")
    c.drawRightString(page_w - margin_x, y_mm(291.0), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Sahifa 2 / {total_pages}")

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

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Filename": filename,
        },
    )
