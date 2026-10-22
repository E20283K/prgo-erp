import io
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import code128, qr
from reportlab.lib.utils import ImageReader
import base64
from PIL import Image as PILImage

class LoadedArtwork:
    def __init__(self, kind: str, content: Any, width: float, height: float):
        self.kind = kind  # "image" or "drawing"
        self.content = content  # ImageReader or Drawing
        self.width = max(1.0, float(width))
        self.height = max(1.0, float(height))

def load_artwork_source(img_src: Optional[str]) -> Optional[LoadedArtwork]:
    if not img_src or not isinstance(img_src, str):
        return None
    try:
        if img_src.startswith("data:image"):
            header, body = img_src.split(",", 1)
            if "svg" in header:
                try:
                    import urllib.parse
                    from svglib.svglib import svg2rlg
                    svg_str = base64.b64decode(body).decode("utf-8") if ";base64" in header else urllib.parse.unquote(body)
                    d = svg2rlg(io.StringIO(svg_str))
                    if d and getattr(d, "width", 0) and getattr(d, "height", 0):
                        return LoadedArtwork("drawing", d, d.width, d.height)
                except Exception as svg_err:
                    print(f"svglib parse error: {svg_err}", flush=True)
                return None
            else:
                img_bytes = base64.b64decode(body)
                pil_img = PILImage.open(io.BytesIO(img_bytes))
                w, h = pil_img.size
                if pil_img.mode in ("RGBA", "P"):
                    bg = PILImage.new("RGB", pil_img.size, (255, 255, 255))
                    if pil_img.mode == "RGBA":
                        bg.paste(pil_img, mask=pil_img.split()[3])
                    else:
                        bg.paste(pil_img)
                    pil_img = bg
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=92)
                buf.seek(0)
                return LoadedArtwork("image", ImageReader(buf), w, h)
        elif img_src.startswith("http://") or img_src.startswith("https://"):
            import urllib.request
            req = urllib.request.Request(img_src, headers={"User-Agent": "PrintGoo-DocService"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = resp.read()
                pil_img = PILImage.open(io.BytesIO(data))
                w, h = pil_img.size
                buf = io.BytesIO()
                pil_img.convert("RGB").save(buf, format="JPEG", quality=90)
                buf.seek(0)
                return LoadedArtwork("image", ImageReader(buf), w, h)
    except Exception as e:
        print(f"Failed to load artwork source in ReportLab: {e}", flush=True)
        return None
    return None

def draw_artwork_item(c, art: LoadedArtwork, card_x_mm: float, card_top_mm: float, card_w_mm: float, card_h_mm: float, y_mm_func):
    if art.kind == "image":
        c.drawImage(
            art.content,
            card_x_mm * mm,
            y_mm_func(card_top_mm + card_h_mm),
            card_w_mm * mm,
            card_h_mm * mm,
            preserveAspectRatio=True,
        )
    elif art.kind == "drawing":
        from reportlab.graphics import renderPDF
        d = art.content
        sx = (card_w_mm * mm) / art.width
        sy = (card_h_mm * mm) / art.height
        d.scale(sx, sy)
        renderPDF.draw(d, c, card_x_mm * mm, y_mm_func(card_top_mm + card_h_mm))

from reportlab.lib.pagesizes import A4

from app.core.fonts import FONT_REGULAR, FONT_BOLD
from app.core.s3 import upload_buffer_to_s3
from app.schemas.documents import *
from app.core.constants import DEFAULT_JOB_TICKET_LABELS, trunc

def generate_job_ticket_pdf(req: JobTicketPdfRequest):
    """
    Generates the unified Order Passport (Job Ticket / Наряд-заказ) A4 PDF using ReportLab.
    Includes native QR code, Code128 Barcode, 2D Vector Die-Cut & Bleed schematic,
    CMYK + Pantone stations, Stage-Gates, SKU Matrix, BOM Materials, Tech Route, and 4-Stage Sign-offs.
    """
    L = {**DEFAULT_JOB_TICKET_LABELS, **(req.labels or {})}
    od = req.orderData or {}
    doc_no = req.docNo or "WO-00772"

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
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

    # ─── 1. TOP HEADER WITH QR CODE & CODE128 BARCODE ─────────────────────────
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont(FONT_BOLD, 13)
    c.drawString(margin_x, y_mm(12), "PRINTGOO ERP")

    # Dark Badge
    badge_text = L["badge"]
    badge_w = max(32, len(badge_text) * 1.65)
    draw_box(39, 8.2, badge_w, 4.8, fill_hex="#0f172a", stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 6.3)
    c.drawCentredString((39 + badge_w / 2) * mm, y_mm(11.6), badge_text)

    # Priority Badge
    prio_hex = "#dc2626" if priority.lower() in ("urgent", "high") else "#2563eb"
    prio_x = 39 + badge_w + 2
    draw_box(prio_x, 8.2, 16, 4.8, fill_hex=prio_hex, stroke_hex=None)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 6.3)
    c.drawCentredString((prio_x + 8) * mm, y_mm(11.6), priority.upper())

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_REGULAR, 7)
    c.drawString(margin_x, y_mm(17), L["subtitle"])

    # Code128 Barcode in Header Center-Right
    bc = code128.Code128(doc_no, barHeight=7.5 * mm, barWidth=0.75)
    bc.drawOn(c, 118 * mm, y_mm(16.5))

    # DocNo & Status Right
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont(FONT_BOLD, 11.5)
    c.drawRightString(185 * mm, y_mm(12), doc_no)
    c.setFillColor(colors.HexColor("#475569"))
    c.setFont(FONT_REGULAR, 6.5)
    c.drawRightString(185 * mm, y_mm(16.5), f"{status} • {datetime.now().strftime('%Y-%m-%d')}")

    # QR Code on far right (14x14 mm)
    draw_box(187, 6.5, 14, 14, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    qr_payload = f"WO:{doc_no}|CUST:{customer}|QTY:{net_qty}|MACH:{press_machine}"
    qr_widget = qr.QrCodeWidget(qr_payload)
    qr_bounds = qr_widget.getBounds()
    qr_w = qr_bounds[2] - qr_bounds[0]
    qr_h = qr_bounds[3] - qr_bounds[1]
    qr_pt = 13 * mm
    d_qr = Drawing(qr_pt, qr_pt, transform=[qr_pt / qr_w, 0, 0, qr_pt / qr_h, 0, 0])
    d_qr.add(qr_widget)
    d_qr.drawOn(c, 187.5 * mm, y_mm(20.0))

    # Header Bottom Divider Line
    c.setStrokeColor(colors.HexColor("#0f172a"))
    c.setLineWidth(1.3)
    c.line(margin_x, y_mm(22), page_w - margin_x, y_mm(22))

    # ─── 2. CORE REQUISITES & KPI STRIP ────────────────────────────────────────
    full_w_mm = 210 - 18  # 192mm
    draw_box(9, 24, full_w_mm, 13.5, fill_hex="#ffffff", stroke_hex="#cbd5e1")

    req_cols = [
        (L["customer"], trunc(customer, 28), str(od.get("orderType") or "Production Order")),
        (L["product"], trunc(product, 28), str(od.get("itemCategory") or "Commercial Print")),
        (L["departmentSite"], department, site),
        (L["pressMachine"], trunc(press_machine, 28), f"{L['recipe']}: {recipe}"),
    ]
    for i, (lbl, val, sub) in enumerate(req_cols):
        cx = 11 + i * 47.5
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 5.8)
        c.drawString(cx * mm, y_mm(27.5), lbl.upper())
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 7.8)
        c.drawString(cx * mm, y_mm(31.8), val)
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_REGULAR, 6.3)
        c.drawString(cx * mm, y_mm(35.5), trunc(sub, 32))

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

    # ─── 3. PHYSICAL GEOMETRY & 2D SCHEMATIC + INKS & COLORS ───────────────────
    sec3_top = 52
    sec3_h = 46
    left_w = 104
    right_w = full_w_mm - left_w - 2  # 86mm
    right_x = 9 + left_w + 2

    # Left Panel: Physical Specs & 2D Cut Schematic
    draw_box(9, sec3_top, left_w, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec3_top + 0.8, left_w - 1.6, L["physicalSpecs"], f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit})")

    # Drill Hole parameters
    hole_size = float(od.get("holeSize") if od.get("holeSize") is not None else (4 if od.get("itemCategory") == "Hangtag" else 0))
    hole_pos = str(od.get("holePosition") or ("top-center" if od.get("itemCategory") == "Hangtag" else "none"))
    hole_offset = float(od.get("holeOffset") if od.get("holeOffset") is not None else 6)

    # Check for Real Artwork (Front & Back)
    art_front = load_artwork_source(od.get("artworkFront"))
    art_back = load_artwork_source(od.get("artworkBack"))

    sch_x, sch_top = 11.0, sec3_top + 8.0

    if art_front or art_back:
        # ── FRONT & BACK SIDE-BY-SIDE PROOF BOX ──
        proof_w = 48.0
        proof_h = 36.0
        draw_box(sch_x, sch_top, proof_w, proof_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")

        # Proportional Aspect Ratio Calculation
        slot_max_w = 20.0
        slot_max_h = 24.0
        aspect = width / max(1.0, height)
        if aspect >= slot_max_w / slot_max_h:
            card_w = slot_max_w
            card_h = max(6.0, slot_max_w / aspect)
        else:
            card_h = slot_max_h
            card_w = max(6.0, slot_max_h * aspect)

        # Slot 1: Front Side
        slot1_x = sch_x + 2.5
        card1_x = slot1_x + (slot_max_w - card_w) / 2
        card1_top = sch_top + 2.5 + (slot_max_h - card_h) / 2

        if art_front:
            draw_artwork_item(c, art_front, card1_x, card1_top, card_w, card_h, y_mm)
        else:
            draw_box(card1_x, card1_top, card_w, card_h, fill_hex="#ffffff", stroke_hex="#e2e8f0")

        # Emerald cut contour outline
        c.setStrokeColor(colors.HexColor("#10b981"))
        c.setLineWidth(0.6)
        c.rect(card1_x * mm, y_mm(card1_top + card_h), card_w * mm, card_h * mm, fill=0, stroke=1)

        # Punch hole guide
        if hole_size > 0 and hole_pos != "none":
            c.setStrokeColor(colors.HexColor("#ef4444"))
            c.setFillColor(colors.white)
            c.setLineWidth(0.6)
            c.circle((card1_x + card_w / 2) * mm, y_mm(card1_top + 2.0), 0.9 * mm, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 5.0)
        c.drawCentredString((slot1_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), "OLD / FRONT")

        # Slot 2: Back Side
        slot2_x = sch_x + 25.0
        card2_x = slot2_x + (slot_max_w - card_w) / 2
        card2_top = card1_top

        if art_back:
            draw_artwork_item(c, art_back, card2_x, card2_top, card_w, card_h, y_mm)
            c.setStrokeColor(colors.HexColor("#10b981"))
            c.setLineWidth(0.6)
            c.rect(card2_x * mm, y_mm(card2_top + card_h), card_w * mm, card_h * mm, fill=0, stroke=1)
        else:
            # White 1-sided back placeholder
            draw_box(card2_x, card2_top, card_w, card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
            c.setFillColor(colors.HexColor("#94a3b8"))
            c.setFont(FONT_REGULAR, 4.2)
            c.drawCentredString((card2_x + card_w / 2) * mm, y_mm(card2_top + card_h / 2 + 1.0), "1-SIDED (WHITE)")

        # Punch hole on back
        if hole_size > 0 and hole_pos != "none":
            c.setStrokeColor(colors.HexColor("#ef4444"))
            c.setFillColor(colors.white)
            c.setLineWidth(0.6)
            c.circle((card2_x + card_w / 2) * mm, y_mm(card2_top + 2.0), 0.9 * mm, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 5.0)
        c.drawCentredString((slot2_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), "ORQA / BACK")

        # Physical dimension tag
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 5.2)
        c.drawCentredString((sch_x + proof_w / 2) * mm, y_mm(sch_top + proof_h - 2.0), f"{width:g} × {height:g} {dim_unit} (+{bleed:g}{dim_unit})")

        text_start_x = 61.0
    else:
        # Fallback 2D Schematic Box (30mm x 35mm)
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
        c.setFont(FONT_REGULAR, 6.2)
        c.drawString(text_start_x * mm, y_mm(ry), f"{k_lbl}:")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.4)
        c.drawRightString((9 + left_w - 2.5) * mm, y_mm(ry), k_val)
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

    # Conditional Flexo or Kashirovka summary at bottom of Right Panel
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
    sizes_raw = od.get("sizes") or [{"size": "ALL", "quantity": net_qty}]
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
        s_str = str(s_item.get("size") or "ALL")
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
    sec6_top = sec5_top + sec5_h + 2.5
    ops_list = req.operations or []
    ops_count = max(len(ops_list[:7]), 1)
    sec6_h = 26 + ops_count * 5.2

    draw_box(9, sec6_top, full_w_mm, sec6_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    draw_panel_header(9.8, sec6_top + 0.8, full_w_mm - 1.6, L["techRoute"], f"{len(ops_list)} Steps")

    r_th_y = sec6_top + 7.2
    draw_box(9.8, r_th_y, full_w_mm - 1.6, 4.8, fill_hex="#f1f5f9", stroke_hex="#cbd5e1")
    c.setFillColor(colors.HexColor("#334155"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(12 * mm, y_mm(r_th_y + 3.4), L["colStep"].upper())
    c.drawString(28 * mm, y_mm(r_th_y + 3.4), L["colOperation"].upper())
    c.drawString(92 * mm, y_mm(r_th_y + 3.4), L["colMachine"].upper())
    c.drawString(142 * mm, y_mm(r_th_y + 3.4), L["colOperator"].upper())
    c.drawRightString(176 * mm, y_mm(r_th_y + 3.4), L["colDuration"].upper())
    c.drawCentredString(190 * mm, y_mm(r_th_y + 3.4), L["colSign"].upper())

    for idx, op in enumerate(ops_list[:7]):
        ry = r_th_y + 4.8 + idx * 5.2
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(12 * mm, y_mm(ry + 3.6), f"#{op.stepNumber}")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(28 * mm, y_mm(ry + 3.6), trunc(op.name, 34))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString(92 * mm, y_mm(ry + 3.6), trunc(op.machine, 26))
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(142 * mm, y_mm(ry + 3.6), trunc(op.operator, 18))
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawRightString(176 * mm, y_mm(ry + 3.6), f"{op.duration:g}h")
        # Dashed Sign Line
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setDash(2, 1.5)
        c.line(182 * mm, y_mm(ry + 4.0), 198 * mm, y_mm(ry + 4.0))
        c.setDash()
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.3)
        c.line(10 * mm, y_mm(ry + 5.1), 200 * mm, y_mm(ry + 5.1))

    # Shift Handover Notes inside Route Panel
    notes_y = r_th_y + 6.2 + ops_count * 5.2
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_BOLD, 5.8)
    c.drawString(11 * mm, y_mm(notes_y), f"{L['shiftNotesTitle'].upper()}:")

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
    note_w = (full_w_mm - 6) / 2
    for n_idx, note in enumerate(notes[:2]):
        nx = 11 + n_idx * (note_w + 2)
        draw_box(nx, notes_y + 1.2, note_w - 1, 9.5, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 6.0)
        c.drawString((nx + 2) * mm, y_mm(notes_y + 4.8), f"[{note.shift}] {note.author} ({note.time})")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_REGULAR, 5.8)
        c.drawString((nx + 2) * mm, y_mm(notes_y + 8.8), trunc(note.text, 68))

    # ─── 7. 4-PARTY SHOP-FLOOR SIGN-OFF STAMPS ────────────────────────────────
    sign_top = min(sec6_top + sec6_h + 3, 263)
    signs = [
        (L["signPrepress"], L["signPrepressSub"]),
        (L["signPress"], L["signPressSub"]),
        (L["signFinish"], L["signFinishSub"]),
        (L["signQc"], L["signQcSub"]),
    ]
    sign_w = (full_w_mm - 6) / 4
    for i, (s_title, s_sub) in enumerate(signs):
        sx = 9 + i * (sign_w + 2)
        draw_box(sx, sign_top, sign_w, 20, fill_hex="#f8fafc", stroke_hex="#94a3b8")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 6.3)
        c.drawString((sx + 2) * mm, y_mm(sign_top + 4.2), trunc(s_title, 26))
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 5.4)
        c.drawString((sx + 2) * mm, y_mm(sign_top + 7.5), trunc(s_sub, 30))
        # Dashed Signature Line
        c.setStrokeColor(colors.HexColor("#64748b"))
        c.setDash(2, 1.5)
        c.line((sx + 2) * mm, y_mm(sign_top + 14.8), (sx + sign_w - 2) * mm, y_mm(sign_top + 14.8))
        c.setDash()
        c.setFont(FONT_REGULAR, 5.4)
        c.drawString((sx + 2) * mm, y_mm(sign_top + 18.2), L["signLabel"])
        c.drawRightString((sx + sign_w - 12) * mm, y_mm(sign_top + 18.2), L["dateLabel"])

    # ─── 8. FOOTER ─────────────────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.5)
    c.line(margin_x, y_mm(287), page_w - margin_x, y_mm(287))
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont(FONT_REGULAR, 6.0)
    c.drawString(margin_x, y_mm(291), f"{L['footerSystem']} • DOC: {doc_no}")
    c.drawRightString(page_w - margin_x, y_mm(291), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Page 1 / 1")

    c.showPage()
    c.save()
    buf.seek(0)

    filename = f"Order_Passport_{doc_no}.pdf"
    if req.saveToS3:
        bucket = os.getenv("S3_BUCKET_DOCS", "printgoo-docs")
        key = req.s3Key or f"job-tickets/{filename}"
        upload_buffer_to_s3(buf, bucket, key, "application/pdf")
        return {"ok": True, "bucket": bucket, "s3Key": key, "filename": filename}

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


