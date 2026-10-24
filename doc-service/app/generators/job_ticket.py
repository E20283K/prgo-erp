import io
import os
import math
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

def load_pdf_page_as_image(pdf_bytes: bytes, page_index: int = 0, scale: float = 3.0) -> Optional[LoadedArtwork]:
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_bytes)
        if len(pdf) > page_index:
            page = pdf[page_index]
            pil_img = page.render(scale=scale).to_pil()
            w, h = pil_img.size
            if pil_img.mode in ("RGBA", "P"):
                bg = PILImage.new("RGB", pil_img.size, (255, 255, 255))
                if pil_img.mode == "RGBA":
                    bg.paste(pil_img, mask=pil_img.split()[3])
                else:
                    bg.paste(pil_img)
                pil_img = bg
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=95)
            buf.seek(0)
            return LoadedArtwork("image", ImageReader(buf), w, h)
    except Exception as e:
        print(f"pypdfium2 render error: {e}", flush=True)
    return None

def probe_artwork_url(doc_no: str, s_code: str, side: str = "front") -> Optional[str]:
    clean_code = str(s_code).strip().upper()
    candidates = [
        f"/artwork/{doc_no}/sku-0-0-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-1-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-2-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-3-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-4-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/sku-0-5-{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/{clean_code}-{side}.pdf",
        f"/artwork/{doc_no}/{clean_code}-{side}.svg",
        f"/artwork/{doc_no}/{clean_code}-{side}.png",
        f"/artwork/{doc_no}/{side}.pdf",
        f"/artwork/{doc_no}/{side}.svg",
        f"/artwork/{doc_no}/{side}.png",
    ]
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

def load_artwork_source(img_src: Optional[str]) -> Optional[LoadedArtwork]:
    if not img_src or not isinstance(img_src, str):
        return None
    try:
        if img_src.startswith("data:application/pdf") or ";base64," in img_src and "pdf" in img_src[:30].lower():
            _, body = img_src.split(",", 1)
            pdf_bytes = base64.b64decode(body)
            return load_pdf_page_as_image(pdf_bytes)
        elif img_src.startswith("data:image"):
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
                if img_bytes.startswith(b"%PDF"):
                    return load_pdf_page_as_image(img_bytes)
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
        elif img_src.startswith("/"):
            app_hosts = ["http://host.docker.internal:3000", "http://localhost:3000", "http://127.0.0.1:3000"]
            import urllib.request
            data = None
            for base in app_hosts:
                try:
                    full_url = f"{base}{img_src}"
                    req = urllib.request.Request(full_url, headers={"User-Agent": "PrintGoo-DocService"})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        if resp.status == 200:
                            data = resp.read()
                            break
                except Exception:
                    continue
            if data:
                if data.startswith(b"%PDF") or img_src.lower().endswith(".pdf"):
                    return load_pdf_page_as_image(data)
                elif img_src.lower().endswith(".svg") or b"<svg" in data[:100]:
                    try:
                        from svglib.svglib import svg2rlg
                        d = svg2rlg(io.BytesIO(data))
                        if d and getattr(d, "width", 0) and getattr(d, "height", 0):
                            return LoadedArtwork("drawing", d, d.width, d.height)
                    except Exception as svg_err:
                        print(f"svglib relative url error: {svg_err}", flush=True)
                else:
                    pil_img = PILImage.open(io.BytesIO(data))
                    w, h = pil_img.size
                    buf = io.BytesIO()
                    pil_img.convert("RGB").save(buf, format="JPEG", quality=92)
                    buf.seek(0)
                    return LoadedArtwork("image", ImageReader(buf), w, h)
        elif img_src.startswith("http://") or img_src.startswith("https://"):
            import urllib.request
            req = urllib.request.Request(img_src, headers={"User-Agent": "PrintGoo-DocService"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = resp.read()
                if data.startswith(b"%PDF") or img_src.lower().endswith(".pdf"):
                    return load_pdf_page_as_image(data)
                elif img_src.lower().endswith(".svg") or b"<svg" in data[:100]:
                    try:
                        from svglib.svglib import svg2rlg
                        d = svg2rlg(io.BytesIO(data))
                        if d and getattr(d, "width", 0) and getattr(d, "height", 0):
                            return LoadedArtwork("drawing", d, d.width, d.height)
                    except Exception:
                        pass
                pil_img = PILImage.open(io.BytesIO(data))
                w, h = pil_img.size
                buf = io.BytesIO()
                pil_img.convert("RGB").save(buf, format="JPEG", quality=90)
                buf.seek(0)
                return LoadedArtwork("image", ImageReader(buf), w, h)
    except Exception as e:
        print(f"Failed to load artwork source in ReportLab ({img_src}): {e}", flush=True)
        return None
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
        elif img_src.startswith("/"):
            # Server-relative path: fetch from Next.js server
            app_hosts = ["http://host.docker.internal:3000", "http://localhost:3000", "http://127.0.0.1:3000"]
            import urllib.request
            data = None
            for base in app_hosts:
                try:
                    full_url = f"{base}{img_src}"
                    req = urllib.request.Request(full_url, headers={"User-Agent": "PrintGoo-DocService"})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        if resp.status == 200:
                            data = resp.read()
                            break
                except Exception:
                    continue
            if data:
                if img_src.lower().endswith(".svg"):
                    try:
                        from svglib.svglib import svg2rlg
                        d = svg2rlg(io.BytesIO(data))
                        if d and getattr(d, "width", 0) and getattr(d, "height", 0):
                            return LoadedArtwork("drawing", d, d.width, d.height)
                    except Exception:
                        pass
                else:
                    pil_img = PILImage.open(io.BytesIO(data))
                    w, h = pil_img.size
                    buf = io.BytesIO()
                    pil_img.convert("RGB").save(buf, format="JPEG", quality=92)
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

    # ─── PREPARE SIZES & SKU ARTWORKS ──────────────────────────────────────────
    sizes_raw = od.get("sizes") or [{"size": "ALL", "quantity": net_qty}]
    sku_artworks_raw = od.get("skuArtworks") or []

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
        s_str = str(s_item.get("size") or "ALL")
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

        front_src = (art.get("frontArtworkThumb") or art.get("frontArtworkUrl")) if art else None
        back_src = (art.get("backArtworkThumb") or art.get("backArtworkUrl")) if art else None

        # Auto-discover uploaded files if not in payload map
        if not front_src:
            front_src = probe_artwork_url(doc_no, s_code, "front")
        if not back_src:
            back_src = probe_artwork_url(doc_no, s_code, "back")

        has_art = bool(front_src or back_src)
        sku_cards_data.append({
            "id": s_id,
            "model": s_model,
            "sizeCode": s_code,
            "quantity": s_qty,
            "share": pct,
            "frontSrc": front_src,
            "backSrc": back_src,
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
            sku_cards_data.append({
                "id": a_id,
                "model": a_model,
                "sizeCode": a_code,
                "quantity": 0,
                "share": 0,
                "frontSrc": a.get("frontArtworkThumb") or a.get("frontArtworkUrl"),
                "backSrc": a.get("backArtworkThumb") or a.get("backArtworkUrl"),
                "frontName": a.get("frontArtworkName"),
                "backName": a.get("backArtworkName"),
                "hasArtwork": bool(a.get("frontArtworkThumb") or a.get("frontArtworkUrl") or a.get("backArtworkThumb") or a.get("backArtworkUrl")),
            })
            seen_keys.add(key)

    items_with_art = [c_item for c_item in sku_cards_data if c_item["hasArtwork"]]

    cards_per_page = 6
    art_pages_count = (len(items_with_art) + cards_per_page - 1) // cards_per_page if items_with_art else 0
    total_pages = 1 + art_pages_count

    # ─── 3. PHYSICAL GEOMETRY & 2D SCHEMATIC + INKS & COLORS ───────────────────
    sec3_top = 52
    sec3_h = 46
    left_w = 104
    right_w = full_w_mm - left_w - 2  # 86mm
    right_x = 9 + left_w + 2

    # Left Panel: Physical Specs & 2D Cut Schematic
    draw_box(9, sec3_top, left_w, sec3_h, fill_hex="#ffffff", stroke_hex="#cbd5e1")
    panel3_badge = (
        f"{width:g}×{height:g} {dim_unit} • {len(items_with_art)} SKU ART"
        if len(items_with_art) > 1
        else f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit})"
    )
    draw_panel_header(9.8, sec3_top + 0.8, left_w - 1.6, L["physicalSpecs"], panel3_badge)

    # Drill Hole parameters
    hole_size = float(od.get("holeSize") if od.get("holeSize") is not None else (4 if od.get("itemCategory") == "Hangtag" else 0))
    hole_pos = str(od.get("holePosition") or ("top-center" if od.get("itemCategory") == "Hangtag" else "none"))
    hole_offset = float(od.get("holeOffset") if od.get("holeOffset") is not None else 6)

    # Check for Real Artwork (Front & Back) — Fallback to primary SKU artwork if global is empty
    primary_sku_art = items_with_art[0] if items_with_art else None
    front_src = od.get("artworkFront") or (primary_sku_art.get("frontSrc") if primary_sku_art else None)
    back_src = od.get("artworkBack") or (primary_sku_art.get("backSrc") if primary_sku_art else None)
    art_front = load_artwork_source(front_src)
    art_back = load_artwork_source(back_src)

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
        front_caption = f"OLDI ({primary_sku_art['sizeCode']})" if primary_sku_art and not od.get("artworkFront") else "OLD / FRONT"
        c.drawCentredString((slot1_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), front_caption)

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
        back_caption = f"ORQA ({primary_sku_art['sizeCode']})" if primary_sku_art and not od.get("artworkBack") else "ORQA / BACK"
        c.drawCentredString((slot2_x + slot_max_w / 2) * mm, y_mm(sch_top + 29.5), back_caption)

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
    c.drawRightString(page_w - margin_x, y_mm(291), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Page 1 / {total_pages}")

    c.showPage()

    # ─── 9. PAGE 2+: SKU ARTWORK SPECIFICATION SHEETS ────────────────────────
    if items_with_art:
        cards_per_page = 6
        for page_idx in range(art_pages_count):
            if page_idx > 0:
                c.showPage()
            current_page = 2 + page_idx

            # Header for Artwork Page
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 12)
            c.drawString(margin_x, y_mm(12), "PRINTGOO ERP")

            art_badge = "SKU ARTWORK PASPORTI (1:1 PROOF)"
            badge_w = max(42, len(art_badge) * 1.65)
            draw_box(39, 8.2, badge_w, 4.8, fill_hex="#0f172a", stroke_hex=None)
            c.setFillColor(colors.white)
            c.setFont(FONT_BOLD, 6.2)
            c.drawCentredString((39 + badge_w / 2) * mm, y_mm(11.6), art_badge)

            # DocNo Right
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont(FONT_BOLD, 11)
            c.drawRightString(185 * mm, y_mm(12), doc_no)
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont(FONT_REGULAR, 6.5)
            c.drawRightString(185 * mm, y_mm(16.5), f"Jami {len(items_with_art)} ta razmer • {datetime.now().strftime('%Y-%m-%d')}")

            c.setFillColor(colors.HexColor("#475569"))
            c.setFont(FONT_REGULAR, 7)
            c.drawString(margin_x, y_mm(17), f"Buyurtmachi: {trunc(customer, 24)}  •  Mahsulot: {trunc(product, 28)}  •  Kesim: {width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit} bleed)")

            c.setStrokeColor(colors.HexColor("#0f172a"))
            c.setLineWidth(1.3)
            c.line(margin_x, y_mm(21), page_w - margin_x, y_mm(21))

            chunk = items_with_art[page_idx * cards_per_page : (page_idx + 1) * cards_per_page]
            n_chunk = len(chunk)

            if n_chunk <= 2:
                card_h = 115.0
                max_dw = 38.0
                max_dh = 80.0
            elif n_chunk <= 4:
                card_h = 106.0
                max_dw = 38.0
                max_dh = 72.0
            else:
                card_h = 78.0
                max_dw = 38.0
                max_dh = 46.0

            col_w = 93.0
            gap_x = 6.0
            gap_y = 6.0
            start_y = 25.0

            for c_i, card_item in enumerate(chunk):
                col_i = c_i % 2
                row_i = c_i // 2
                cx = 9.0 + col_i * (col_w + gap_x)
                cy = start_y + row_i * (card_h + gap_y)

                draw_box(cx, cy, col_w, card_h, fill_hex="#ffffff", stroke_hex="#cbd5e1", lw=0.6)

                # Card Top Bar (5.8mm)
                draw_box(cx, cy, col_w, 5.8, fill_hex="#0f172a", stroke_hex=None)
                c.setFillColor(colors.white)
                c.setFont(FONT_BOLD, 7.0)
                sku_title = f"{card_item['model']} • {card_item['sizeCode']}".upper()
                c.drawString((cx + 2.5) * mm, y_mm(cy + 4.1), sku_title)

                c.setFillColor(colors.HexColor("#93c5fd"))
                c.setFont(FONT_BOLD, 6.2)
                qty_str = f"{card_item['quantity']:,} {unit} ({card_item['share']}%)" if card_item['quantity'] > 0 else "NAMUNA"
                c.drawRightString((cx + col_w - 2.5) * mm, y_mm(cy + 4.1), qty_str)

                aspect = width / max(1.0, height)
                if aspect >= max_dw / max_dh:
                    art_w = max_dw
                    art_h = max(8.0, max_dw / aspect)
                else:
                    art_h = max_dh
                    art_w = max(8.0, max_dh * aspect)

                slot_w = (col_w - 9.0) / 2
                slot_h = card_h - 13.0

                # ── FRONT SLOT ──
                slot1_x = cx + 3.0
                art1_x = slot1_x + (slot_w - art_w) / 2
                art1_y = cy + 7.5 + (max_dh - art_h) / 2

                loaded_f = load_artwork_source(card_item.get("frontSrc"))
                if loaded_f:
                    draw_artwork_item(c, loaded_f, art1_x, art1_y, art_w, art_h, y_mm)
                else:
                    draw_box(art1_x, art1_y, art_w, art_h, fill_hex="#f8fafc", stroke_hex="#e2e8f0")
                    c.setFillColor(colors.HexColor("#94a3b8"))
                    c.setFont(FONT_REGULAR, 4.5)
                    c.drawCentredString((art1_x + art_w / 2) * mm, y_mm(art1_y + art_h / 2 + 1), "YUKLANMAGAN")

                c.setStrokeColor(colors.HexColor("#10b981"))
                c.setLineWidth(0.6)
                c.rect(art1_x * mm, y_mm(art1_y + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)

                if hole_size > 0 and hole_pos != "none":
                    c.setStrokeColor(colors.HexColor("#ef4444"))
                    c.setFillColor(colors.white)
                    c.setLineWidth(0.6)
                    c.circle((art1_x + art_w / 2) * mm, y_mm(art1_y + 2.0), 0.9 * mm, fill=1, stroke=1)

                label_y = cy + card_h - 9.0
                c.setFillColor(colors.HexColor("#0f172a"))
                c.setFont(FONT_BOLD, 5.0)
                c.drawCentredString((slot1_x + slot_w / 2) * mm, y_mm(label_y), "OLDI (FRONT)")
                c.setFillColor(colors.HexColor("#64748b"))
                c.setFont(FONT_REGULAR, 4.2)
                c.drawCentredString((slot1_x + slot_w / 2) * mm, y_mm(label_y + 2.6), trunc(card_item.get("frontName") or "front.pdf", 24))

                # ── BACK SLOT ──
                slot2_x = cx + 3.0 + slot_w + 3.0
                art2_x = slot2_x + (slot_w - art_w) / 2
                art2_y = art1_y

                loaded_b = load_artwork_source(card_item.get("backSrc"))
                if loaded_b:
                    draw_artwork_item(c, loaded_b, art2_x, art2_y, art_w, art_h, y_mm)
                    c.setStrokeColor(colors.HexColor("#10b981"))
                    c.setLineWidth(0.6)
                    c.rect(art2_x * mm, y_mm(art2_y + art_h), art_w * mm, art_h * mm, fill=0, stroke=1)
                    if hole_size > 0 and hole_pos != "none":
                        c.setStrokeColor(colors.HexColor("#ef4444"))
                        c.setFillColor(colors.white)
                        c.setLineWidth(0.6)
                        c.circle((art2_x + art_w / 2) * mm, y_mm(art2_y + 2.0), 0.9 * mm, fill=1, stroke=1)
                    c.setFillColor(colors.HexColor("#0f172a"))
                    c.setFont(FONT_BOLD, 5.0)
                    c.drawCentredString((slot2_x + slot_w / 2) * mm, y_mm(label_y), "ORQA (BACK)")
                    c.setFillColor(colors.HexColor("#64748b"))
                    c.setFont(FONT_REGULAR, 4.2)
                    c.drawCentredString((slot2_x + slot_w / 2) * mm, y_mm(label_y + 2.6), trunc(card_item.get("backName") or "back.pdf", 24))
                else:
                    draw_box(art2_x, art2_y, art_w, art_h, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
                    c.setFillColor(colors.HexColor("#94a3b8"))
                    c.setFont(FONT_REGULAR, 4.2)
                    c.drawCentredString((art2_x + art_w / 2) * mm, y_mm(art2_y + art_h / 2 + 1), "1-TOMONLAMA (OQ)")
                    c.setFillColor(colors.HexColor("#0f172a"))
                    c.setFont(FONT_BOLD, 5.0)
                    c.drawCentredString((slot2_x + slot_w / 2) * mm, y_mm(label_y), "ORQA (OQ)")

                # Bottom Footer strip of card (5.5mm)
                strip_top = cy + card_h - 5.5
                draw_box(cx, strip_top, col_w, 5.5, fill_hex="#f8fafc", stroke_hex="#cbd5e1")
                c.setFillColor(colors.HexColor("#475569"))
                c.setFont(FONT_REGULAR, 5.2)
                c.drawString((cx + 2.5) * mm, y_mm(strip_top + 3.8), f"{width:g}×{height:g} {dim_unit} (+{bleed:g}{dim_unit}) • {od.get('cornerType') or 'Square'}")

                pill_w = 26.0
                draw_box(cx + col_w - pill_w - 2.0, strip_top + 1.1, pill_w, 3.5, fill_hex="#16a34a", stroke_hex=None)
                c.setFillColor(colors.white)
                c.setFont(FONT_BOLD, 4.5)
                c.drawCentredString((cx + col_w - pill_w / 2 - 2.0) * mm, y_mm(strip_top + 3.6), "1:1 PREPRESS OK")

            # Page Footer
            c.setStrokeColor(colors.HexColor("#cbd5e1"))
            c.setLineWidth(0.5)
            c.line(margin_x, y_mm(287), page_w - margin_x, y_mm(287))
            c.setFillColor(colors.HexColor("#64748b"))
            c.setFont(FONT_REGULAR, 6.0)
            c.drawString(margin_x, y_mm(291), f"{L['footerSystem']} • DOC: {doc_no} • SKU ARTWORK PROOFLAR")
            c.drawRightString(page_w - margin_x, y_mm(291), f"{L['printDate']}: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Page {current_page} / {total_pages}")

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


