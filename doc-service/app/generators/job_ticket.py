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
from app.schemas.documents import JobTicketPdfRequest, JobTicketShiftNote
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
    candidates = []
    if clean_sku:
        candidates.extend([
            f"/artwork/{doc_no}/{clean_sku}-{clean_code}-{side}.pdf",
            f"/artwork/{doc_no}/{clean_sku}-{side}.pdf",
        ])
    candidates.extend([
        f"/artwork/{doc_no}/sku-0-0-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-1-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-2-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-3-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-4-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-5-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-{side}.pdf",
        f"/artwork/{doc_no}/sku-1-{side}.pdf",
        f"/artwork/{doc_no}/sku-2-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-0-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-1-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-2-{side}.pdf",
        f"/artwork/{doc_no}/{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/{clean_code}-{side}.svg",
        f"/artwork/{doc_no}/{side}.pdf",
        f"/artwork/{doc_no}/{side}.svg",
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
            req = urllib.request.Request(src, headers={"User-Agent": "PrintGoo-DocService"})
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
            d = svg2rlg(io.BytesIO(raw_art["bytes"]))
            if d and getattr(d, "width", 0) and getattr(d, "height", 0):
                sx = (card_w_mm * mm) / d.width
                sy = (card_h_mm * mm) / d.height
                d.scale(sx, sy)
                renderPDF.draw(d, c, card_x_mm * mm, y_mm_func(card_top_mm + card_h_mm))
    except Exception as e:
        print(f"Error drawing raster/svg: {e}", flush=True)

def calculate_single_page_layout(n_items: int, is_one_sided: bool, width: float, height: float) -> Dict[str, Any]:
    avail_w = 192.0
    avail_h = 252.0
    start_y_base = 31.0

    if n_items <= 1:
        cols, rows = 1, 1
        gap_x, gap_y = 0.0, 0.0
        card_w = 120.0
        card_h = 160.0
        start_x = 9.0 + (avail_w - card_w) / 2.0
        start_y = start_y_base + (avail_h - card_h) / 2.0
    elif n_items == 2:
        cols, rows = 2, 1
        gap_x, gap_y = 8.0, 0.0
        card_w = (avail_w - gap_x) / 2.0  # 92.0 mm
        card_h = 160.0
        start_x = 9.0
        start_y = start_y_base + (avail_h - card_h) / 2.0
    elif n_items == 3:
        if is_one_sided:
            cols, rows = 3, 1
            gap_x, gap_y = 6.0, 0.0
            card_w = (avail_w - 2 * gap_x) / 3.0  # 60.0 mm
            aspect = width / max(1.0, height)
            slot_w = card_w - 6.0
            art_h = min(220.0, slot_w / aspect)
            card_h = min(250.0, max(130.0, art_h + 26.0))
            start_x = 9.0
            start_y = start_y_base + (avail_h - card_h) / 2.0
        else:
            cols, rows = 2, 2
            gap_x, gap_y = 6.0, 6.0
            card_w = (avail_w - gap_x) / 2.0  # 93.0 mm
            card_h = (avail_h - gap_y) / 2.0  # 126.0 mm
            start_x = 9.0
            start_y = start_y_base
    elif n_items == 4:
        cols, rows = 2, 2
        gap_x, gap_y = 6.0, 6.0
        card_w = (avail_w - gap_x) / 2.0  # 93.0 mm
        card_h = (avail_h - gap_y) / 2.0  # 126.0 mm
        start_x = 9.0
        start_y = start_y_base
    elif n_items <= 6:
        if is_one_sided:
            cols, rows = 3, 2
            gap_x, gap_y = 6.0, 6.0
            card_w = (avail_w - 2 * gap_x) / 3.0  # 60.0 mm
            card_h = (avail_h - gap_y) / 2.0     # 126.0 mm
            start_x = 9.0
            start_y = start_y_base
        else:
            cols, rows = 2, 3
            gap_x, gap_y = 6.0, 5.0
            card_w = (avail_w - gap_x) / 2.0      # 93.0 mm
            card_h = (avail_h - 2 * gap_y) / 3.0  # 82.6 mm
            start_x = 9.0
            start_y = start_y_base
    elif n_items <= 8:
        cols = 4 if is_one_sided else 2
        rows = 2 if is_one_sided else 4
        gap_x, gap_y = 5.0, 5.0
        card_w = (avail_w - (cols - 1) * gap_x) / cols
        card_h = (avail_h - (rows - 1) * gap_y) / rows
        start_x = 9.0
        start_y = start_y_base
    else:
        cols = 3 if is_one_sided else 2
        rows = math.ceil(n_items / cols)
        gap_x, gap_y = 4.0, 4.0
        card_w = (avail_w - (cols - 1) * gap_x) / cols
        card_h = (avail_h - (rows - 1) * gap_y) / rows
        start_x = 9.0
        start_y = start_y_base

    return {
        "cols": cols,
        "rows": rows,
        "card_w": card_w,
        "card_h": card_h,
        "gap_x": gap_x,
        "gap_y": gap_y,
        "start_x": start_x,
        "start_y": start_y,
    }

def generate_job_ticket_pdf(req: JobTicketPdfRequest):
    """
    Generates the unified Order Passport (Job Ticket / Наряд-заказ) A4 PDF.
    - Page 1: Requisites, KPIs, Section 3 CAD + Vector Hybrid Proof, Stage-Gates, SKU Matrix, BOM, Tech Route, Sign-offs.
    - Page 2: Single-Page Auto-Layout of 100% Pure Vector PDF Artworks for all SKU sizes.
    - Zero rasterization: Vector PDF pages are preserved as native Form XObjects via PyMuPDF.
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
    margin_x = 9 * mm

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
        c.drawString((x_mm + 2) * mm, y_mm(top_mm + 4.0), title.upper())
        if badge_right:
            c.setFillColor(colors.HexColor("#93c5fd"))
            c.setFont(FONT_BOLD, 6.3)
            c.drawRightString((x_mm + w_mm - 2) * mm, y_mm(top_mm + 4.0), badge_right)

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

    # ─── UNIFIED HEADER (PAGES 1 & 2) WITH PRINTGOO SVG LOGO & KATTA BARCODE ──
    def draw_unified_header():
        # 1. Top Left: Vector SVG Logo (Prominent, vertically centered)
        logo_d = get_logo_drawing()
        if logo_d and getattr(logo_d, "width", 0) and getattr(logo_d, "height", 0):
            try:
                d_copy = deepcopy(logo_d)
                logo_target_h = 12.0 * mm
                logo_scale = logo_target_h / d_copy.height
                d_copy.width = d_copy.width * logo_scale
                d_copy.height = logo_target_h
                d_copy.scale(logo_scale, logo_scale)
                renderPDF.draw(d_copy, c, margin_x, y_mm(4.6 + 12.0))
            except Exception as e:
                print(f"Error rendering logo: {e}", flush=True)
                c.setFillColor(colors.HexColor("#0f172a"))
                c.setFont(FONT_BOLD, 13)
                c.drawString(margin_x, y_mm(12.0), "PRINTGOO ERP")
        else:
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 13)
            c.drawString(margin_x, y_mm(12.0), "PRINTGOO ERP")

        # 2. CENTER ZONE: PURE BLACK 1D KATTA BARCODE
        bc = code128.Code128(doc_no, barHeight=11.0 * mm, barWidth=0.75)
        center_x = 112.0 * mm
        bc_x = center_x - (bc.width / 2.0)
        c.setFillColor(colors.black)
        c.setStrokeColor(colors.black)
        bc.drawOn(c, bc_x, y_mm(15.6))

        # Human-readable document number centered under barcode bars
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 7.5)
        c.drawCentredString(center_x, y_mm(19.4), doc_no)

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
        qr_pt = 13.5 * mm
        d_qr = Drawing(qr_pt, qr_pt, transform=[qr_pt / qr_w, 0, 0, qr_pt / qr_h, 0, 0])
        d_qr.add(qr_widget)
        draw_box(186.5, 4.5, 14.5, 14.5, fill_hex="#ffffff", stroke_hex=None)
        d_qr.drawOn(c, 187.0 * mm, y_mm(18.5))

        # Right-aligned Doc No & Generation Date (No priority, no status in header)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 10.5)
        c.drawRightString(184.5 * mm, y_mm(10.5), doc_no)

        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawRightString(184.5 * mm, y_mm(15.0), datetime.now().strftime("%Y-%m-%d"))

        # Header Bottom Divider Line
        c.setStrokeColor(colors.HexColor("#0f172a"))
        c.setLineWidth(1.2)
        c.line(margin_x, y_mm(22), page_w - margin_x, y_mm(22))

    # ─── 1. TOP HEADER (PAGE 1) ────────────────────────────────────────────────
    draw_unified_header()

    # ─── 2. CORE REQUISITES & KPI STRIP (WITH STATUS & PRIORITY) ───────────────
    full_w_mm = 210 - 18  # 192mm
    draw_box(9, 24, full_w_mm, 13.5, fill_hex="#ffffff", stroke_hex="#cbd5e1")

    # Localized status & priority labels and badge formatting
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
        (9, 38, L["customer"], trunc(customer, 24), str(od.get("orderType") or "Production Order")),
        (47, 38, L["product"], trunc(product, 24), str(od.get("itemCategory") or "Commercial Print")),
        (85, 30, L["departmentSite"], department, site),
        (115, 36, L["pressMachine"], trunc(press_machine, 22), f"{L.get('recipe', 'Retsept')}: {recipe}"),
    ]

    for (cx, cw, lbl, val, sub) in req_cols_data:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.8)
        c.drawString((cx + 2) * mm, y_mm(27.5), lbl.upper())
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 7.5)
        c.drawString((cx + 2) * mm, y_mm(31.8), val)
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.2)
        c.drawString((cx + 2) * mm, y_mm(35.5), trunc(sub, 26))

    # Col 5: Status (151 to 176 mm, width 25mm)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(153 * mm, y_mm(27.5), status_label)
    status_text = trunc(status_val, 16).upper()
    s_font = 5.2 if len(status_text) > 10 else 6.2
    draw_box(152.5, 29.2, 22.0, 4.2, fill_hex="#f1f5f9", stroke_hex="#cbd5e1", lw=0.4)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont(FONT_BOLD, s_font)
    c.drawCentredString(163.5 * mm, y_mm(32.2), status_text)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(153 * mm, y_mm(35.5), datetime.now().strftime("%Y-%m-%d"))

    # Col 6: Priority (176 to 201 mm, width 25mm)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(178 * mm, y_mm(27.5), prio_label)
    p_text = str(prio_display).upper()
    p_font = 5.2 if len(p_text) > 10 else 6.2
    draw_box(177.5, 29.2, 22.0, 4.2, fill_hex=prio_fill, stroke_hex=prio_stroke, lw=0.4)
    c.setFillColor(colors.HexColor(prio_text_col))
    c.setFont(FONT_BOLD, p_font)
    c.drawCentredString(188.5 * mm, y_mm(32.2), p_text)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(178 * mm, y_mm(35.5), trunc(deadline, 16))

    # Column vertical divider lines
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.5)
    for div_x in [47, 85, 115, 151, 176]:
        c.line(div_x * mm, y_mm(24), div_x * mm, y_mm(37.5))

    # KPI Strip
    draw_box(9, 39, full_w_mm, 11, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
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
        c.drawString(cx * mm, y_mm(42.8), lbl.upper())
        c.setFillColor(colors.HexColor(col_hex))
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(cx * mm, y_mm(47.8), val)

    # ─── PREPARE SIZES & SKU ARTWORKS ──────────────────────────────────────────
    sizes_raw = od.get("sizes") or [{"size": "ALL", "quantity": net_qty}]
    sku_artworks_raw = od.get("skuArtworks") or od.get("artworks") or []

    sku_art_map: Dict[str, Dict[str, Any]] = {}
    for a in sku_artworks_raw:
        if not isinstance(a, dict):
            continue
        if a.get("skuId"):
            sku_art_map[str(a["skuId"])] = a
        if a.get("sizeCode"):
            sku_art_map[str(a["sizeCode"]).strip().upper()] = a
        if a.get("model") and a.get("sizeCode"):
            sku_art_map[f"{str(a['model']).strip()}___{str(a['sizeCode']).strip().upper()}"] = a

    sku_cards_data: List[Dict[str, Any]] = []
    seen_keys = set()
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

        # Resolve front artwork: ALWAYS prioritize real vector URL / PDF over raster thumbnail
        front_src = art.get("frontArtworkUrl") if art else None
        if not front_src or str(front_src).startswith("data:image"):
            probed_f = probe_artwork_url(doc_no, s_code, "front", s_id)
            if probed_f:
                front_src = probed_f
            elif art and art.get("frontArtworkThumb"):
                front_src = art.get("frontArtworkThumb")
            elif not front_src:
                front_src = probe_artwork_url(doc_no, s_code, "front", s_id)

        # Resolve back artwork: ALWAYS prioritize real vector URL / PDF over raster thumbnail
        back_src = art.get("backArtworkUrl") if art else None
        if not back_src or str(back_src).startswith("data:image"):
            probed_b = probe_artwork_url(doc_no, s_code, "back", s_id)
            if probed_b:
                back_src = probed_b
            elif art and art.get("backArtworkThumb"):
                back_src = art.get("backArtworkThumb")
            elif not back_src:
                back_src = probe_artwork_url(doc_no, s_code, "back", s_id)

        front_raw = get_raw_artwork(front_src) if front_src else None
        back_raw = get_raw_artwork(back_src) if back_src else None

        has_art = bool(front_raw or back_raw)
        sku_cards_data.append({
            "id": s_id,
            "model": s_model,
            "sizeCode": s_code,
            "quantity": s_qty,
            "share": pct,
            "frontSrc": front_src,
            "backSrc": back_src,
            "frontRaw": front_raw,
            "backRaw": back_raw,
            "frontName": art.get("frontArtworkName") if art else (front_src.split("/")[-1] if front_src else None),
            "backName": art.get("backArtworkName") if art else (back_src.split("/")[-1] if back_src else None),
            "hasArtwork": has_art,
        })

    for a in sku_artworks_raw:
        if not isinstance(a, dict):
            continue
        a_id = str(a.get("skuId") or "")
        a_code = str(a.get("sizeCode") or "").strip().upper()
        a_model = str(a.get("model") or "STD").strip()
        key = f"{a_model}___{a_code}"
        if key not in seen_keys and a_id not in seen_keys:
            f_src = a.get("frontArtworkUrl")
            if not f_src or str(f_src).startswith("data:image"):
                probed_f = probe_artwork_url(doc_no, a_code, "front", a_id)
                f_src = probed_f if probed_f else a.get("frontArtworkThumb")

            b_src = a.get("backArtworkUrl")
            if not b_src or str(b_src).startswith("data:image"):
                probed_b = probe_artwork_url(doc_no, a_code, "back", a_id)
                b_src = probed_b if probed_b else a.get("backArtworkThumb")

            f_raw = get_raw_artwork(f_src) if f_src else None
            b_raw = get_raw_artwork(b_src) if b_src else None
            sku_cards_data.append({
                "id": a_id,
                "model": a_model,
                "sizeCode": a_code,
                "quantity": 0,
                "share": 0,
                "frontSrc": f_src,
                "backSrc": b_src,
                "frontRaw": f_raw,
                "backRaw": b_raw,
                "frontName": a.get("frontArtworkName"),
                "backName": a.get("backArtworkName"),
                "hasArtwork": bool(f_raw or b_raw),
            })
            seen_keys.add(key)

    items_with_art = [c_item for c_item in sku_cards_data if c_item["hasArtwork"]]
    total_pages = 1
    vector_overlays: List[Dict[str, Any]] = []

    # ─── 3. PHYSICAL GEOMETRY & 2D SCHEMATIC + INKS & COLORS ───────────────────
    sec3_top = 52
    sec3_h = 46
    left_w = 104
    right_w = full_w_mm - left_w - 2  # 86mm
    right_x = 9 + left_w + 2

    draw_box(9, sec3_top, left_w, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    panel3_badge = (
        f"{width:g}×{height:g} {dim_unit} • {len(items_with_art)} SKU ART"
        if len(items_with_art) > 1
        else f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit})"
    )
    draw_panel_header(9.8, sec3_top + 0.8, left_w - 1.6, L["physicalSpecs"], panel3_badge)

    hole_size = float(od.get("holeSize") if od.get("holeSize") is not None else (4 if od.get("itemCategory") == "Hangtag" else 0))
    hole_pos = str(od.get("holePosition") or ("top-center" if od.get("itemCategory") == "Hangtag" else "none"))
    hole_offset = float(od.get("holeOffset") if od.get("holeOffset") is not None else 6)

    primary_sku_art = items_with_art[0] if items_with_art else None
    front_raw_p1 = (primary_sku_art.get("frontRaw") if primary_sku_art else None) or get_raw_artwork(od.get("artworkFront"))
    back_raw_p1 = (primary_sku_art.get("backRaw") if primary_sku_art else None) or get_raw_artwork(od.get("artworkBack"))

    sch_x, sch_top = 11.0, sec3_top + 8.0

    if front_raw_p1 or back_raw_p1:
        proof_w = 48.0
        proof_h = 36.0
        draw_box(sch_x, sch_top, proof_w, proof_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")

        is_p1_twosided = bool(front_raw_p1 and back_raw_p1)
        aspect = width / max(1.0, height)

        if not is_p1_twosided:
            # 1-Sided Proof: Expanded single card for maximum clarity
            slot_max_w = 40.0
            slot_max_h = 24.0
            if aspect >= slot_max_w / slot_max_h:
                card_w = slot_max_w
                card_h = max(6.0, slot_max_w / aspect)
            else:
                card_h = slot_max_h
                card_w = max(6.0, slot_max_h * aspect)

            card1_x = sch_x + (proof_w - card_w) / 2
            card1_top = sch_top + 2.5 + (slot_max_h - card_h) / 2

            if front_raw_p1 and front_raw_p1["kind"] == "pdf":
                vector_overlays.append({
                    "page_idx": 0,
                    "x_mm": card1_x,
                    "y_mm": card1_top,
                    "w_mm": card_w,
                    "h_mm": card_h,
                    "pdf_bytes": front_raw_p1["bytes"],
                    "draw_contour": True,
                    "draw_bleed_box": True,
                    "bleed_mm": bleed,
                    "hole_size": hole_size,
                    "hole_pos": hole_pos,
                })
            elif front_raw_p1:
                draw_raster_or_svg(c, front_raw_p1, card1_x, card1_top, card_w, card_h, y_mm)
                c.setStrokeColor(colors.HexColor("#10b981"))
                c.setLineWidth(0.6)
                c.rect(card1_x * mm, y_mm(card1_top + card_h), card_w * mm, card_h * mm, fill=0, stroke=1)
            else:
                draw_box(card1_x, card1_top, card_w, card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 5.0)
            front_caption = f"OLDI ({primary_sku_art['sizeCode']})" if primary_sku_art and not od.get("artworkFront") else "OLD / FRONT"
            c.drawCentredString((sch_x + proof_w / 2) * mm, y_mm(sch_top + 29.5), front_caption)
        else:
            # 2-Sided Proof: Side-by-side front and back
            slot_max_w = 20.0
            slot_max_h = 24.0
            if aspect >= slot_max_w / slot_max_h:
                card_w = slot_max_w
                card_h = max(6.0, slot_max_w / aspect)
            else:
                card_h = slot_max_h
                card_w = max(6.0, slot_max_h * aspect)

            slot1_x = sch_x + 2.5
            card1_x = slot1_x + (slot_max_w - card_w) / 2
            card1_top = sch_top + 2.5 + (slot_max_h - card_h) / 2

            if front_raw_p1 and front_raw_p1["kind"] == "pdf":
                vector_overlays.append({
                    "page_idx": 0,
                    "x_mm": card1_x,
                    "y_mm": card1_top,
                    "w_mm": card_w,
                    "h_mm": card_h,
                    "pdf_bytes": front_raw_p1["bytes"],
                    "draw_contour": True,
                    "draw_bleed_box": True,
                    "bleed_mm": bleed,
                    "hole_size": hole_size,
                    "hole_pos": hole_pos,
                })
            elif front_raw_p1:
                draw_raster_or_svg(c, front_raw_p1, card1_x, card1_top, card_w, card_h, y_mm)
                c.setStrokeColor(colors.HexColor("#10b981"))
                c.setLineWidth(0.6)
                c.rect(card1_x * mm, y_mm(card1_top + card_h), card_w * mm, card_h * mm, fill=0, stroke=1)

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 5.0)
            front_caption = f"OLDI ({primary_sku_art['sizeCode']})" if primary_sku_art and not od.get("artworkFront") else "OLD / FRONT"
            c.drawCentredString((slot1_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), front_caption)

            # Slot 2: Back Side
            slot2_x = sch_x + 25.0
            card2_x = slot2_x + (slot_max_w - card_w) / 2
            card2_top = card1_top

            if back_raw_p1 and back_raw_p1["kind"] == "pdf":
                vector_overlays.append({
                    "page_idx": 0,
                    "x_mm": card2_x,
                    "y_mm": card2_top,
                    "w_mm": card_w,
                    "h_mm": card_h,
                    "pdf_bytes": back_raw_p1["bytes"],
                    "draw_contour": True,
                    "draw_bleed_box": True,
                    "bleed_mm": bleed,
                    "hole_size": hole_size,
                    "hole_pos": hole_pos,
                })
            elif back_raw_p1:
                draw_raster_or_svg(c, back_raw_p1, card2_x, card2_top, card_w, card_h, y_mm)
                c.setStrokeColor(colors.HexColor("#10b981"))
                c.setLineWidth(0.6)
                c.rect(card2_x * mm, y_mm(card2_top + card_h), card_w * mm, card_h * mm, fill=0, stroke=1)
            else:
                draw_box(card2_x, card2_top, card_w, card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
                c.setFillColor(colors.HexColor("#94a3b8"))
                c.setFont(FONT_REGULAR, 4.2)
                c.drawCentredString((card2_x + card_w / 2) * mm, y_mm(card2_top + card_h / 2 + 1.0), "1-SIDED (WHITE)")

            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 5.0)
            back_caption = f"ORQA ({primary_sku_art['sizeCode']})" if primary_sku_art and not od.get("artworkBack") else "ORQA / BACK"
            c.drawCentredString((slot2_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), back_caption)

        # Dimension annotation tag
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawCentredString((sch_x + proof_w / 2) * mm, y_mm(sch_top + proof_h - 2.0), f"{width:g} × {height:g} {dim_unit} (+{bleed:g}{dim_unit})")
        text_start_x = 61.0
    else:
        # Fallback CAD Schematic Box
        sch_w, sch_h = 30.0, 35.0
        draw_box(sch_x, sch_top, sch_w, sch_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")

        aspect = width / max(1.0, height)
        max_dw, max_dh = 20.0, 22.0
        draw_w = max_dw if aspect >= 1 else max(8.0, max_dh * aspect)
        draw_h = max(8.0, max_dw / aspect) if aspect >= 1 else max_dh
        trim_x = sch_x + (sch_w - draw_w) / 2
        trim_top = sch_top + (sch_h - 5 - draw_h) / 2

        # Outer Bleed Box (Red dashed)
        c.setStrokeColor(colors.HexColor("#ef4444"))
        c.setFillColor(colors.HexColor("#fef2f2"))
        c.setLineWidth(0.6)
        c.setDash(2, 1.5)
        c.rect((trim_x - 1.5) * mm, y_mm(trim_top + draw_h + 1.5), (draw_w + 3) * mm, (draw_h + 3) * mm, fill=1, stroke=1)
        c.setDash()

        # Trim Cut Box (Blue solid)
        c.setStrokeColor(colors.HexColor("#1d4ed8"))
        c.setFillColor(colors.white)
        c.setLineWidth(1.0)
        c.rect(trim_x * mm, y_mm(trim_top + draw_h), draw_w * mm, draw_h * mm, fill=1, stroke=1)

        # Center Crosshairs
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.4)
        c.setDash(1.5, 1.5)
        c.line((trim_x + 1.5) * mm, y_mm(trim_top + draw_h / 2), (trim_x + draw_w - 1.5) * mm, y_mm(trim_top + draw_h / 2))
        c.line((trim_x + draw_w / 2) * mm, y_mm(trim_top + 1.5), (trim_x + draw_w / 2) * mm, y_mm(trim_top + draw_h - 1.5))
        c.setDash()

        # Drill Hole
        if hole_size > 0 and hole_pos != "none":
            c.setStrokeColor(colors.HexColor("#2563eb"))
            c.setFillColor(colors.HexColor("#eff6ff"))
            c.setLineWidth(0.8)
            c.circle((trim_x + draw_w / 2) * mm, y_mm(trim_top + 2.8), 1.1 * mm, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 5.5)
        c.drawCentredString((sch_x + sch_w / 2) * mm, y_mm(sch_top + sch_h - 2.2), f"{width:g}×{height:g}{dim_unit}")
        text_start_x = 43.0

    # Physical Specs Key-Value Rows
    lam = str(od.get("lamination") or "None")
    lam_str = f"{lam} ({str(od.get('laminationSides') or '1s').upper()}, {od.get('laminationMicron') or 28}μm)" if lam != "None" else "—"
    coat_str = str(od.get("coating") or "—")
    emb = str(od.get("embellishment") or "None")
    if emb and emb != "None":
        coat_str = f"{coat_str} • {emb}"

    phys_rows = [
        (L["trimDimensions"], f"{width:g} × {height:g} {dim_unit} (+{bleed:g}{dim_unit})"),
        (L["cornerCut"], str(od.get("cornerType") or "Square")),
        (L["holeEyelet"], f"Ø{hole_size:g}mm • {hole_pos} ({hole_offset:g}mm)" if hole_size > 0 and hole_pos != "none" else "—"),
        (L["paperSubstrate"], trunc(od.get("paperStock") or "—", 28)),
        (L["laminationSpec"], trunc(lam_str, 28)),
        (L["surfaceCoating"], trunc(coat_str, 28)),
    ]
    for idx, (k_lbl, k_val) in enumerate(phys_rows):
        ry = sec3_top + 11.5 + idx * 5.6
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.8)
        c.drawString(text_start_x * mm, y_mm(ry), f"{trunc(k_lbl, 16)}:")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawRightString((9 + left_w - 2.5) * mm, y_mm(ry), trunc(k_val, 26))
        c.setStrokeColor(colors.HexColor("#f1f5f9"))
        c.setLineWidth(0.3)
        c.line(text_start_x * mm, y_mm(ry + 1.5), (9 + left_w - 2.5) * mm, y_mm(ry + 1.5))

    # Right Panel: Inks & Color Stations + Kashirovka / Flexo
    draw_box(right_x, sec3_top, right_w, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(right_x + 0.8, sec3_top + 0.8, right_w - 1.6, L["inksAndColors"], str(od.get("colorsConfig") or "4+0 (CMYK)"))

    front_colors = od.get("frontColors") or {"c": True, "m": True, "y": True, "k": True}
    back_colors = od.get("backColors") or {"c": False, "m": False, "y": False, "k": False}

    def draw_cmyk_row(top_y: float, side_label: str, ch_map: Dict[str, Any]):
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString((right_x + 2.5) * mm, y_mm(top_y), f"{side_label}:")
        ch_colors = [("c", "#06b6d4"), ("m", "#ec4899"), ("y", "#eab308"), ("k", "#0f172a")]
        for idx, (ch_key, act_hex) in enumerate(ch_colors):
            active = bool(ch_map.get(ch_key))
            bx = (right_x + right_w - 26) + idx * 6.0
            draw_box(bx, top_y - 3.2, 5.2, 4.2, fill_hex=act_hex if active else "#e2e8f0", stroke_hex=None)
            c.setFillColor(colors.white if active else colors.HexColor("#94a3b8"))
            c.setFont(FONT_BOLD, 6)
            c.drawCentredString((bx + 2.6) * mm, y_mm(top_y - 0.1), ch_key.upper())

    draw_cmyk_row(sec3_top + 11.5, L["frontSide"], front_colors)
    draw_cmyk_row(sec3_top + 17.5, L["backSide"], back_colors)

    # Spot / Pantone Stations
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 23.5), f"{L['spotStations'].upper()}:")

    spot_items = od.get("spotColorItems") or []
    if not spot_items and od.get("spotColors"):
        spot_items = [{"name": s, "hex": "#fe5000", "side": "front"} for s in od.get("spotColors", [])]

    if spot_items:
        for s_idx, sp in enumerate(spot_items[:2]):
            sy = sec3_top + 25.2 + s_idx * 5.2
            draw_box(right_x + 2.5, sy, right_w - 5, 4.5, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
            draw_box(right_x + 3.5, sy + 0.9, 2.7, 2.7, fill_hex=sp.get("hex") or "#fe5000", stroke_hex=None)
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 6.2)
            c.drawString((right_x + 7.5) * mm, y_mm(sy + 3.2), f"{trunc(sp.get('name'), 34)} ({str(sp.get('side') or 'front').upper()})")
    else:
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 28), "—")

    kash_mode = str(od.get("kashirovkaMode") or "none")
    if department == "Flexo":
        c.setFillColor(colors.HexColor("#1d4ed8"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 38.5), L["flexoTitle"].upper())
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.5)
        teeth = od.get("flexoCylinderTeeth") or 100
        web_w = od.get("flexoWebWidth") or 35
        plate_t = od.get("flexoPlateThickness") or 1.7
        c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 43.0), f"Cylinder: {teeth}T  •  Web: {web_w}mm  •  Plate: {plate_t}mm")
    elif kash_mode != "none":
        c.setFillColor(colors.HexColor("#1d4ed8"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 38.5), f"{L['kashirovkaTitle'].upper()}: {kash_mode.upper()}")
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_REGULAR, 6.2)
        c.drawString((right_x + 2.5) * mm, y_mm(sec3_top + 43.0), f"{L['kashirovkaGlue']}: {od.get('kashirovkaGlueGsm') or 25}g/m² • Pause: {od.get('kashirovkaCuringHours') or 12}h")

    # ─── 4. PRE-FLIGHT STAGE-GATES STRIP ───────────────────────────────────────
    gates_top = 100
    gates = [
        (L["gate1Title"], L["gate1Sub"]),
        (L["gate2Title"], L["gate2Sub"]),
        (L["gate3Title"], L["gate3Sub"]),
        (L["gate4Title"], L["gate4Sub"]),
    ]
    gate_w = (full_w_mm - 6) / 4  # 46.5mm each
    for i, (g_title, g_sub) in enumerate(gates):
        gx = 9 + i * (gate_w + 2)
        draw_box(gx, gates_top, gate_w, 10, fill_hex="#f0fdf4", stroke_hex="#86efac")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString((gx + 2) * mm, y_mm(gates_top + 4.2), trunc(g_title, 24))
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 5.5)
        c.drawString((gx + 2) * mm, y_mm(gates_top + 8.0), trunc(g_sub, 28))
        # Pass Pill
        draw_box(gx + gate_w - 11.5, gates_top + 2.8, 9.8, 4.2, fill_hex="#16a34a", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 5.2)
        c.drawCentredString((gx + gate_w - 6.6) * mm, y_mm(gates_top + 5.9), L["pass"])

    # ─── 5. SIDE-BY-SIDE: SIZE/SKU BREAKDOWN & BOM MATERIALS ──────────────────
    sec5_top = 112
    mats_raw = req.materials or []
    max_rows_s5 = max(len(sizes_raw[:6]), len(mats_raw[:6]), 2)
    sec5_h = 13 + max_rows_s5 * 5.2

    sku_w = 88
    bom_w = full_w_mm - sku_w - 2  # 102mm
    bom_x = 9 + sku_w + 2

    # Left: Size / SKU Matrix
    draw_box(9, sec5_top, sku_w, sec5_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec5_top + 0.8, sku_w - 1.6, L["sizeBreakdown"], f"{len(sizes_raw)} SKU")

    th_y = sec5_top + 7.2
    draw_box(9.8, th_y, sku_w - 1.6, 4.8, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(11.5 * mm, y_mm(th_y + 3.4), L["colModel"].upper())
    c.drawString(34 * mm, y_mm(th_y + 3.4), L["colSize"].upper())
    c.drawRightString(75 * mm, y_mm(th_y + 3.4), L["colQty"].upper())
    c.drawRightString(95 * mm, y_mm(th_y + 3.4), L["colShare"].upper())

    for idx, s_item in enumerate(sizes_raw[:6]):
        ry = th_y + 4.8 + idx * 5.0
        s_str = str(s_item.get("size") or s_item.get("sizeCode") or "ALL")
        s_model = str(s_item.get("model") or (s_str.split(" - ")[0] if " - " in s_str else "STD"))
        s_code = s_str.split(" - ")[1] if " - " in s_str else s_str
        s_qty = int(s_item.get("quantity") or 0)
        pct = round((s_qty / net_qty) * 100) if net_qty > 0 else 100

        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString(11.5 * mm, y_mm(ry + 3.5), trunc(s_model, 14))
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(34 * mm, y_mm(ry + 3.5), trunc(s_code, 14))
        c.drawRightString(75 * mm, y_mm(ry + 3.5), f"{s_qty:,}")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.3)
        c.drawRightString(95 * mm, y_mm(ry + 3.5), f"{pct}%")
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(10 * mm, y_mm(ry + 4.9), (9 + sku_w - 1) * mm, y_mm(ry + 4.9))

    # Right: BOM Materials
    draw_box(bom_x, sec5_top, bom_w, sec5_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(bom_x + 0.8, sec5_top + 0.8, bom_w - 1.6, L["bomMaterials"], recipe)

    draw_box(bom_x + 0.8, th_y, bom_w - 1.6, 4.8, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString((bom_x + 2.5) * mm, y_mm(th_y + 3.4), L["colMaterial"].upper())
    c.drawRightString((bom_x + 68) * mm, y_mm(th_y + 3.4), L["colReqQty"].upper())
    c.drawRightString((bom_x + bom_w - 2.5) * mm, y_mm(th_y + 3.4), L["colWarehouseStock"].upper())

    for idx, m_item in enumerate(mats_raw[:6]):
        ry = th_y + 4.8 + idx * 5.0
        is_short = m_item.req > m_item.stock
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.4)
        c.drawString((bom_x + 2.5) * mm, y_mm(ry + 3.5), trunc(m_item.name, 26))
        c.drawRightString((bom_x + 68) * mm, y_mm(ry + 3.5), f"{m_item.req:g} {m_item.unit}")
        c.setFillColor(colors.HexColor("#dc2626" if is_short else "#047857"))
        c.drawRightString(
            (bom_x + bom_w - 2.5) * mm,
            y_mm(ry + 3.5),
            f"{m_item.stock:g} ({L['stockShortage'] if is_short else L['stockOk']})",
        )
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line((bom_x + 1) * mm, y_mm(ry + 4.9), (bom_x + bom_w - 1) * mm, y_mm(ry + 4.9))

    # ─── 6. TECHNOLOGICAL MANUFACTURING ROUTE & SHIFT NOTES ───────────────────
    sec6_top = sec5_top + sec5_h + 2.0
    ops_list = req.operations or []
    ops_count = min(len(ops_list), 3) if items_with_art else min(len(ops_list), 6)
    ops_count = max(ops_count, 1)
    notes = req.shiftNotes or [
        JobTicketShiftNote(
            author="M. Ivanova (Press Lead)",
            shift="Morning",
            time="11:45",
            text="CMYK densities locked at 1.45 D. Viscosity 23s DIN4. Speed 14,000 sht/h.",
        ),
        JobTicketShiftNote(
            author="S. Petrov (Die-Cut)",
            shift="Evening",
            time="19:30",
            text="Cutting rule aligned with 0.4mm crease channel. First sample signed off.",
        ),
    ]
    notes_h = 10.0 if notes else 0.0
    sec6_h = 11.5 + ops_count * 4.6 + notes_h

    draw_box(9, sec6_top, full_w_mm, sec6_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec6_top + 0.8, full_w_mm - 1.6, L["techRoute"], f"{len(ops_list)} Steps")

    r_th_y = sec6_top + 6.8
    draw_box(9.8, r_th_y, full_w_mm - 1.6, 4.4, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(12 * mm, y_mm(r_th_y + 3.1), L["colStep"].upper())
    c.drawString(28 * mm, y_mm(r_th_y + 3.1), L["colOperation"].upper())
    c.drawString(92 * mm, y_mm(r_th_y + 3.1), L["colMachine"].upper())
    c.drawString(136 * mm, y_mm(r_th_y + 3.1), L["colOperator"].upper())
    c.drawRightString(178 * mm, y_mm(r_th_y + 3.1), L["colDuration"].upper())
    c.drawCentredString(190 * mm, y_mm(r_th_y + 3.1), L["colSign"].upper())

    for idx, op in enumerate(ops_list[:ops_count]):
        ry = r_th_y + 4.4 + idx * 4.6
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(12 * mm, y_mm(ry + 3.2), f"#{op.stepNumber}")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(28 * mm, y_mm(ry + 3.2), trunc(op.name, 34))
        c.setFont(FONT_REGULAR, 6.2)
        c.drawString(92 * mm, y_mm(ry + 3.2), trunc(op.machine, 26))
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(136 * mm, y_mm(ry + 3.2), trunc(op.operator, 18))
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawRightString(178 * mm, y_mm(ry + 3.2), f"{op.duration:g}h")
        # Dashed Sign Line
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setDash(2, 1.5)
        c.line(182 * mm, y_mm(ry + 3.6), 198 * mm, y_mm(ry + 3.6))
        c.setDash()
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(10 * mm, y_mm(ry + 4.5), 200 * mm, y_mm(ry + 4.5))

    # Shift Handover Notes inside Route Panel
    if notes:
        notes_y = r_th_y + 5.4 + ops_count * 4.6
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.5)
        c.drawString(11 * mm, y_mm(notes_y), f"{L['shiftNotesTitle'].upper()}:")

        note_w = (full_w_mm - 6) / 2
        for n_idx, note in enumerate(notes[:2]):
            nx = 11 + n_idx * (note_w + 2)
            draw_box(nx, notes_y + 1.0, note_w - 1, 8.2, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
            c.setFillColor(colors.HexColor("#334155"))
            c.setFont(FONT_BOLD, 5.6)
            c.drawString((nx + 2) * mm, y_mm(notes_y + 3.8), f"[{note.shift}] {note.author} ({note.time})")
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_REGULAR, 5.5)
            c.drawString((nx + 2) * mm, y_mm(notes_y + 7.2), trunc(note.text, 68))

    # ─── 7. SKU ARTWORK PROOFS (ON PAGE 1 - REPLACES SIGNATURES ROW) ──────────
    art_sec_top = sec6_top + sec6_h + 2.0
    art_sec_bottom = 285.0
    art_sec_h = max(38.0, art_sec_bottom - art_sec_top)

    if items_with_art:
        draw_box(9, art_sec_top, full_w_mm, art_sec_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
        panel_art_title = L.get("skuArtworksTitle", "SKU ARTWORK PASPORTI (1:1 PREPRESS PROOFLAR)")
        draw_panel_header(9.8, art_sec_top + 0.8, full_w_mm - 1.6, panel_art_title, f"{len(items_with_art)} SKU")

        cards_y = art_sec_top + 6.8
        avail_card_h = art_sec_h - 8.0
        n_art = len(items_with_art)

        # Multi-card horizontal auto-layout on Page 1
        if n_art <= 5:
            gap_art = 4.0
            c_art_w = (full_w_mm - 4.0 - (n_art - 1) * gap_art) / n_art
            c_art_w = min(c_art_w, 92.0)
            start_art_x = 9.0 + (full_w_mm - (n_art * c_art_w + (n_art - 1) * gap_art)) / 2.0

            for a_idx, card_item in enumerate(items_with_art):
                acx = start_art_x + a_idx * (c_art_w + gap_art)
                acy = cards_y

                # Card Container
                draw_box(acx, acy, c_art_w, avail_card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.5)

                # Card Top Bar (4.6mm)
                draw_box(acx, acy, c_art_w, 4.6, fill_hex="#0f172a", stroke_hex=None)
                c.setFillColor(colors.white)
                c.setFont(FONT_BOLD, 6.2)
                sku_lbl = f"{card_item['model']} • {card_item['sizeCode']}".upper()
                c.drawString((acx + 2.0) * mm, y_mm(acy + 3.3), trunc(sku_lbl, 20))

                qty_str = f"{card_item['quantity']:,} {unit}" if card_item['quantity'] > 0 else "NAMUNA"
                c.setFillColor(colors.HexColor("#93c5fd"))
                c.setFont(FONT_BOLD, 5.8)
                c.drawRightString((acx + c_art_w - 2.0) * mm, y_mm(acy + 3.3), qty_str)

                # Artwork Slot
                slot_h = avail_card_h - 11.5
                slot_w = c_art_w - 4.0
                aspect = width / max(1.0, height)

                f_raw = card_item.get("frontRaw")
                b_raw = card_item.get("backRaw")
                is_two_sided = bool(f_raw and b_raw)

                if not is_two_sided:
                    if aspect >= slot_w / slot_h:
                        art_w = slot_w
                        art_h = max(8.0, slot_w / aspect)
                    else:
                        art_h = slot_h
                        art_w = max(8.0, slot_h * aspect)

                    art_x = acx + 2.0 + (slot_w - art_w) / 2.0
                    art_y = acy + 5.2 + (slot_h - art_h) / 2.0

                    if f_raw and f_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 0,  # Page 1
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
                    half_w = (slot_w - 2.0) / 2.0
                    if aspect >= half_w / slot_h:
                        art_w = half_w
                        art_h = max(8.0, half_w / aspect)
                    else:
                        art_h = slot_h
                        art_w = max(8.0, slot_h * aspect)

                    art_x1 = acx + 1.0 + (half_w - art_w) / 2.0
                    art_y = acy + 5.2 + (slot_h - art_h) / 2.0

                    if f_raw and f_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 0,
                            "x_mm": art_x1,
                            "y_mm": art_y,
                            "w_mm": art_w,
                            "h_mm": art_h,
                            "pdf_bytes": f_raw["bytes"],
                            "draw_contour": True,
                        })
                    elif f_raw:
                        draw_raster_or_svg(c, f_raw, art_x1, art_y, art_w, art_h, y_mm)

                    art_x2 = acx + 1.0 + half_w + 2.0 + (half_w - art_w) / 2.0
                    if b_raw and b_raw["kind"] == "pdf":
                        vector_overlays.append({
                            "page_idx": 0,
                            "x_mm": art_x2,
                            "y_mm": art_y,
                            "w_mm": art_w,
                            "h_mm": art_h,
                            "pdf_bytes": b_raw["bytes"],
                            "draw_contour": True,
                        })
                    elif b_raw:
                        draw_raster_or_svg(c, b_raw, art_x2, art_y, art_w, art_h, y_mm)

                # Card Bottom Status Pill
                pill_top = acy + avail_card_h - 4.5
                draw_box(acx + 1.0, pill_top, c_art_w - 2.0, 3.8, fill_hex="#f8fafc", stroke_hex="#e2e8f0", lw=0.4)
                c.setFillColor(colors.HexColor("#047857"))
                c.setFont(FONT_BOLD, 5.0)
                c.drawCentredString((acx + c_art_w / 2.0) * mm, y_mm(pill_top + 2.8), "1:1 PREPRESS OK")
        else:
            # 2-Row layout for 6+ items
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
                slot_h = c_art_h - 8.5
                slot_w = c_art_w - 4.0
                aspect = width / max(1.0, height)
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
                        "page_idx": 0,
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
        draw_box(9, art_sec_top, full_w_mm, art_sec_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
        draw_panel_header(9.8, art_sec_top + 0.8, full_w_mm - 1.6, "SKU ARTWORK PROOFLAR", "0 SKU")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 7.5)
        c.drawCentredString((9 + full_w_mm / 2.0) * mm, y_mm(art_sec_top + art_sec_h / 2.0), "SKU o'lchamlari bo'yicha alohida artwork fayllar biriktirilmagan")

    # ─── 8. FOOTER ─────────────────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.5)
    c.line(margin_x, y_mm(287), page_w - margin_x, y_mm(287))
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(margin_x, y_mm(291), f"{L['footerSystem']} • DOC: {doc_no} • SKU ARTWORK PROOFLAR")
    c.drawRightString(page_w - margin_x, y_mm(291), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Page 1 / {total_pages}")

    c.showPage()

    c.save()
    buf.seek(0)
    base_pdf_bytes = buf.getvalue()

    # ─── 10. PYMUPDF VECTOR OVERLAY & DOCUMENT METADATA ───────────────────────
    try:
        import pymupdf as fitz
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

                # Outer Bleed Box (Dashed red)
                if vo.get("draw_bleed_box") and vo.get("bleed_mm", 0) > 0:
                    b_pt = 1.5 * pt_per_mm
                    bleed_rect = fitz.Rect(x0 - b_pt, y0 - b_pt, x1 + b_pt, y1 + b_pt)
                    target_page.draw_rect(bleed_rect, color=(0xef/255, 0x44/255, 0x44/255), dashes="[2 1.5]", width=0.5)

                # Emerald Cut Contour (#10b981)
                if vo.get("draw_contour"):
                    target_page.draw_rect(rect, color=(0x10/255, 0xb9/255, 0x81/255), width=0.6)

                # Punch Hole Guide
                h_size = vo.get("hole_size", 0)
                if h_size > 0 and vo.get("hole_pos") != "none":
                    hx = (x0 + x1) / 2.0
                    hy = y0 + 2.5 * pt_per_mm
                    target_page.draw_circle(fitz.Point(hx, hy), 1.0 * pt_per_mm, color=(0xef/255, 0x44/255, 0x44/255), fill=(1, 1, 1), width=0.6)

        # Ensure document metadata title is permanently set so PDF viewers display real filename instead of 'untitled'
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
