import io
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfgen.canvas import FILL_NON_ZERO
from reportlab.pdfbase import pdfmetrics
from reportlab.graphics.shapes import Drawing
import logging
import re
from reportlab.graphics.barcode import code128, qr
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.lib.pagesizes import A4

from app.core.fonts import FONT_REGULAR, FONT_BOLD
from app.core.s3 import upload_buffer_to_s3
from app.schemas.documents import *

logger = logging.getLogger(__name__)

# Termoprinter faqat qora rang chiqaradi: yorliqda bir rangli (mono) logotip ishlatiladi
_LOGO_FILE = os.path.join(os.path.dirname(__file__), "..", "core", "printgoo_logo_mono.svg")
_LOGO_CACHE: Dict[str, Any] = {}


def _load_logo():
    """Mono SVG yo'lini (faqat M/L/C/Z buyruqlari) ReportLab uchun o'qiydi: ((buyruq, [nuqtalar]), ...) va chegara qutisi."""
    if "logo" in _LOGO_CACHE:
        return _LOGO_CACHE["logo"]
    result = None
    try:
        with open(_LOGO_FILE, encoding="utf-8") as f:
            d = re.search(r'<path[^>]*\sd="([^"]+)"', f.read()).group(1)
        tokens = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
        cmds, i = [], 0
        arity = {"M": 2, "L": 2, "C": 6, "Z": 0}
        while i < len(tokens):
            cmd = tokens[i]
            i += 1
            n = arity[cmd]
            cmds.append((cmd, [float(t) for t in tokens[i:i + n]]))
            i += n
        xs = [v for _, a in cmds for v in a[0::2]]
        ys = [v for _, a in cmds for v in a[1::2]]
        result = (cmds, (min(xs), min(ys), max(xs), max(ys)))
    except Exception:
        logger.exception("Box label logo could not be loaded")
    _LOGO_CACHE["logo"] = result
    return result


def _draw_logo(c, x_pt: float, top_pt: float, max_w_pt: float, max_h_pt: float):
    """Logotipni (x, top) burchakka sig'adigan eng katta o'lchamda chizadi; chizilgan kenglikni (pt) qaytaradi."""
    logo = _load_logo()
    if not logo:
        return 0.0
    cmds, (minx, miny, maxx, maxy) = logo
    scale = min(max_w_pt / (maxx - minx), max_h_pt / (maxy - miny))

    def pt(px, py):
        return x_pt + (px - minx) * scale, top_pt - (py - miny) * scale

    path = c.beginPath()
    for cmd, a in cmds:
        if cmd == "M":
            path.moveTo(*pt(a[0], a[1]))
        elif cmd == "L":
            path.lineTo(*pt(a[0], a[1]))
        elif cmd == "C":
            path.curveTo(*pt(a[0], a[1]), *pt(a[2], a[3]), *pt(a[4], a[5]))
        else:
            path.close()
    c.saveState()
    c.setFillColor(colors.black)
    c.drawPath(path, stroke=0, fill=1, fillMode=FILL_NON_ZERO)
    c.restoreState()
    return (maxx - minx) * scale


def _fit_text(text: str, font: str, size: float, max_width_pt: float, min_size: float = 6.5):
    """Matn berilgan kenglikka sig'ishi uchun shrift kichraytiriladi; baribir sig'masa, oxiriga '...' qo'yiladi."""
    s = size
    while s > min_size and pdfmetrics.stringWidth(text, font, s) > max_width_pt:
        s -= 0.5
    if pdfmetrics.stringWidth(text, font, s) > max_width_pt:
        while len(text) > 1 and pdfmetrics.stringWidth(text + "...", font, s) > max_width_pt:
            text = text[:-1]
        text = text + "..."
    return text, s


def generate_box_labels_pdf(req: BoxLabelsPdfRequest):
    """Generates industrial packaging thermal box labels (100mm x 150mm) with Barcode (Code128),
    QR Code, size/model breakdown, and high-contrast warehouse markers using ReportLab."""
    buf = io.BytesIO()

    # 100mm x 150mm standard thermal label size
    label_w_mm = 100.0
    label_h_mm = 150.0
    page_size = (label_w_mm * mm, label_h_mm * mm)

    c = canvas.Canvas(buf, pagesize=page_size)

    total_boxes = req.totalBoxes or max(len(req.boxes), 1)
    boxes = req.boxes
    if not boxes:
        raise HTTPException(status_code=422, detail="Yorliq chop etish uchun kamida bitta quti kerak")

    def y_mm(val_from_top: float) -> float:
        return (label_h_mm - val_from_top) * mm

    def draw_box(x: float, y: float, w: float, h: float, fill_hex: Optional[str] = None, stroke_hex: str = "#000000", lw: float = 1.0):
        c.saveState()
        c.setLineWidth(lw)
        c.setStrokeColor(colors.HexColor(stroke_hex))
        if fill_hex:
            c.setFillColor(colors.HexColor(fill_hex))
            c.rect(x * mm, y_mm(y + h), w * mm, h * mm, fill=1, stroke=1)
        else:
            c.rect(x * mm, y_mm(y + h), w * mm, h * mm, fill=0, stroke=1)
        c.restoreState()

    for box in boxes:
        # Outer heavy border (typical 100x150 mm industrial tag)
        margin = 4.0
        inner_w = label_w_mm - (2 * margin) # 92 mm
        draw_box(margin, margin, inner_w, label_h_mm - (2 * margin), fill_hex="#ffffff", stroke_hex="#000000", lw=1.5)

        # 1. Header: oq fonda qora logotip (termoprinter uchun), qora to'ldirilgan banner yo'q
        logo_w_pt = _draw_logo(c, (margin + 3) * mm, y_mm(margin + 2.5), 34 * mm, 12 * mm)
        if not logo_w_pt:
            c.setFillColor(colors.black)
            c.setFont(FONT_BOLD, 12)
            c.drawString((margin + 3) * mm, y_mm(margin + 9), "PRINTGOO")

        text_x = (margin + 3) * mm + max(logo_w_pt, 24 * mm) + 4 * mm
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 7.0)
        c.drawString(text_x, y_mm(margin + 7.0), "ISHLAB CHIQARISH VA")
        c.drawString(text_x, y_mm(margin + 10.6), "QADOQLASH PASPORTI")

        # Top right: "PASSPORT" belgisi (qora ramka)
        draw_box(label_w_mm - margin - 22, margin + 3, 19, 8, fill_hex="#ffffff", stroke_hex="#000000", lw=1.0)
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 8.5)
        c.drawCentredString((label_w_mm - margin - 12.5) * mm, y_mm(margin + 8.4), "PASSPORT")

        # Header ostidagi qalin chiziq
        c.setStrokeColor(colors.black)
        c.setLineWidth(1.5)
        c.line(margin * mm, y_mm(margin + 16), (margin + inner_w) * mm, y_mm(margin + 16))

        # 2. Work Order & Customer Info Grid
        curr_y = margin + 18.5
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 2) * mm, y_mm(curr_y + 2.5), "BUYURTMA RAQAMI:")
        c.drawString((margin + 48) * mm, y_mm(curr_y + 2.5), "BUYURTMACHI (MIJOZ):")

        c.setFillColor(colors.black)
        wo_display = req.workOrderNo
        if req.clientOrderNo:
            wo_display += f" ({req.clientOrderNo})"
        # Buyurtma raqami mijoz nomi ustiga chiqib ketmasligi uchun 44 mm ga sig'diriladi
        wo_display, wo_size = _fit_text(wo_display, FONT_BOLD, 10.5, 44.0 * mm)
        c.setFont(FONT_BOLD, wo_size)
        c.drawString((margin + 2) * mm, y_mm(curr_y + 7.2), wo_display)

        cust_display, cust_size = _fit_text(
            req.customer or "—", FONT_BOLD, 9.5, (inner_w - 48 - 2.0) * mm
        )
        c.setFont(FONT_BOLD, cust_size)
        c.drawString((margin + 48) * mm, y_mm(curr_y + 7.2), cust_display)

        # Divider line
        curr_y += 10.0
        c.setLineWidth(0.8)
        c.setStrokeColor(colors.black)
        c.line(margin * mm, y_mm(curr_y), (margin + inner_w) * mm, y_mm(curr_y))

        # 3. Product Name Box
        curr_y += 1.5
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 2) * mm, y_mm(curr_y + 2.5), "MAHSULOT NOMI:")

        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 9.5)
        raw_prod = (req.product or "").strip() or "—"
        prod_lines = simpleSplit(raw_prod, FONT_BOLD, 9.5, (inner_w - 4.0) * mm)
        if len(prod_lines) > 3:
            prod_lines = prod_lines[:3]
            prod_lines[2], _ = _fit_text(prod_lines[2] + " ...", FONT_BOLD, 9.5, (inner_w - 4.0) * mm, 9.5)

        for idx, line_txt in enumerate(prod_lines):
            c.drawString((margin + 2) * mm, y_mm(curr_y + 7.0 + (idx * 4.0)), line_txt)

        curr_y += 8.0 + (len(prod_lines) * 4.0)
        c.line(margin * mm, y_mm(curr_y), (margin + inner_w) * mm, y_mm(curr_y))

        # 4. Model and Size / Artikul Section (Very prominent for warehouse sorting)
        curr_y += 2.0
        model_w = (inner_w - 3.0) / 2.0  # ikki katak chap/o'ng chetdan bir xil masofada
        draw_box(margin + 1, curr_y, model_w, 15, fill_hex="#ffffff", stroke_hex="#000000", lw=0.8)
        draw_box(margin + 2 + model_w, curr_y, model_w, 15, fill_hex="#ffffff", stroke_hex="#000000", lw=0.8)

        # Model label & value
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 3) * mm, y_mm(curr_y + 3.8), "MODEL / ARTIKUL:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 10.5)
        model_txt, model_size = _fit_text(box.model or "—", FONT_BOLD, 10.5, (model_w - 4.0) * mm)
        c.setFont(FONT_BOLD, model_size)
        c.drawString((margin + 3) * mm, y_mm(curr_y + 11.0), model_txt)

        # Size label & value
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 3.8), "O'LCHAM (SIZE):")
        c.setFillColor(colors.black)
        size_txt, size_size = _fit_text(
            (box.sizeCode or "").strip() or (req.productSize or "").strip() or "—", FONT_BOLD, 13.0, (model_w - 5.0) * mm
        )
        c.setFont(FONT_BOLD, size_size)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 11.5), size_txt)

        curr_y += 17.0

        # 5. Giant Box Number & Quantity Impact Area
        draw_box(margin + 1, curr_y, model_w, 24, fill_hex="#ffffff", stroke_hex="#000000", lw=1.2)
        draw_box(margin + 2 + model_w, curr_y, model_w, 24, fill_hex="#ffffff", stroke_hex="#000000", lw=1.2)

        # Left: Box Number
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 3) * mm, y_mm(curr_y + 4.0), "QUTI RAQAMI:")
        c.setFillColor(colors.black)
        num_txt = str(box.boxNumber)
        total_txt = f"/ {total_boxes}"
        num_size = 22.0
        while num_size > 10.0 and (
            pdfmetrics.stringWidth(num_txt, FONT_BOLD, num_size) + pdfmetrics.stringWidth(" " + total_txt, FONT_BOLD, 10.0)
            > (model_w - 6.0) * mm
        ):
            num_size -= 1.0
        c.setFont(FONT_BOLD, num_size)
        c.drawString((margin + 4) * mm, y_mm(curr_y + 18.0), num_txt)
        c.setFont(FONT_BOLD, 10.0)
        c.setFillColor(colors.black)
        c.drawString(
            (margin + 4) * mm + pdfmetrics.stringWidth(num_txt, FONT_BOLD, num_size) + 2.0,
            y_mm(curr_y + 18.0),
            total_txt,
        )

        # Right: Quantity in Box
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 4.0), "MIQDOR (SONI):")
        c.setFillColor(colors.black)
        qty_txt = f"{int(box.quantity or 0):,}"
        unit_txt = " dona"
        qty_size = 20.0
        qty_avail = (model_w - 6.0) * mm
        while qty_size > 9.0 and (
            pdfmetrics.stringWidth(qty_txt, FONT_BOLD, qty_size) + pdfmetrics.stringWidth(unit_txt, FONT_BOLD, 8.5) > qty_avail
        ):
            qty_size -= 1.0
        c.setFont(FONT_BOLD, qty_size)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 18.0), qty_txt)
        c.setFont(FONT_BOLD, 8.5)
        c.setFillColor(colors.black)
        c.drawString(
            (margin + 4 + model_w) * mm + pdfmetrics.stringWidth(qty_txt, FONT_BOLD, qty_size),
            y_mm(curr_y + 18.0),
            unit_txt,
        )

        curr_y += 26.0

        # 6. Barcode Section (Code128 vector barcode)
        barcode_raw = box.barcode or f"{req.workOrderNo}-B{str(box.boxNumber).zfill(2)}"
        clean_barcode = "".join(ch for ch in barcode_raw if ch.isalnum() or ch in "-_")
        if not clean_barcode:
            clean_barcode = f"{req.workOrderNo}-{box.boxNumber}"

        try:
            # Code128: Flowable, shuning uchun to'g'ridan-to'g'ri canvasga chiziladi (Drawing.add ishlamaydi)
            max_bc_w = (inner_w - 4.0) * mm
            bar_w = 0.33 * mm
            bc = code128.Code128(clean_barcode, barHeight=13 * mm, barWidth=bar_w, humanReadable=False)
            # Uzun kod yorliqqa sig'masa, chiziq qalinligi kamaytiriladi (skaner o'qiy oladigan minimumgacha)
            while bc.width > max_bc_w and bar_w > 0.19 * mm:
                bar_w -= 0.02 * mm
                bc = code128.Code128(clean_barcode, barHeight=13 * mm, barWidth=bar_w, humanReadable=False)
            if bc.width > max_bc_w:
                raise ValueError(f"Shtrix-kod yorliqqa sig'maydi: {clean_barcode}")

            # Center the barcode horizontally
            bc_x = (label_w_mm - (bc.width / mm)) / 2.0
            bc_y = curr_y
            bc.drawOn(c, bc_x * mm, y_mm(bc_y + 13.0))

            # Human readable text below barcode
            c.setFillColor(colors.black)
            c.setFont(FONT_BOLD, 8.5)
            c.drawCentredString((label_w_mm / 2.0) * mm, y_mm(bc_y + 17.0), f"*{clean_barcode}*")
        except Exception:
            logger.exception("Box label barcode failed for %s", clean_barcode)
            # Fallback simple line representation
            c.setFillColor(colors.black)
            c.setFont(FONT_BOLD, 10)
            c.drawCentredString((label_w_mm / 2.0) * mm, y_mm(curr_y + 10.0), f"BARCODE: {clean_barcode}")

        curr_y += 19.5

        # 7. QR Code + Warehouse Logistics Details
        c.line(margin * mm, y_mm(curr_y), (margin + inner_w) * mm, y_mm(curr_y))
        curr_y += 1.5

        # Vector QR code on the left (20x20 mm)
        qr_data = f"PRINTGOO|WO:{req.workOrderNo}|BX:{box.boxNumber}|QTY:{box.quantity}|BC:{clean_barcode}"
        qr_code = qr.QrCodeWidget(qr_data)
        qr_code.barWidth = 19 * mm
        qr_code.barHeight = 19 * mm
        qr_d = Drawing(19 * mm, 19 * mm)
        qr_d.add(qr_code)
        qr_d.drawOn(c, (margin + 1.5) * mm, y_mm(curr_y + 19.0))

        # Details on the right of QR code
        detail_x = margin + 24.0
        c.setFillColor(colors.black)
        c.setFont(FONT_REGULAR, 7.0)

        # Packed Date: sana yo'q bo'lsa, o'ylab topilmaydi
        pack_date_str = "—"
        if box.packedAt:
            try:
                dt_obj = datetime.fromisoformat(box.packedAt.replace("Z", "+00:00"))
                pack_date_str = dt_obj.strftime("%d.%m.%Y %H:%M")
            except Exception:
                pack_date_str = str(box.packedAt)[:16]

        c.drawString(detail_x * mm, y_mm(curr_y + 4.5), f"Sana: {pack_date_str}")

        # Packer name
        packer = (box.packerName or "").strip() or "—"
        packer_txt, packer_size = _fit_text(
            f"Qadoqlovchi: {packer}", FONT_REGULAR, 7.0, (label_w_mm - margin - 2.0 - detail_x) * mm, 5.5
        )
        c.setFont(FONT_REGULAR, packer_size)
        c.drawString(detail_x * mm, y_mm(curr_y + 9.0), packer_txt)
        c.setFont(FONT_REGULAR, 7.0)

        # Tara code
        c.drawString(detail_x * mm, y_mm(curr_y + 13.5), f"Quti ID: {box.boxCode}")

        c.showPage()

    c.save()
    buf.seek(0)

    filename = f"Box_Labels_{req.workOrderNo}.pdf"
    if req.saveToS3:
        bucket = os.getenv("S3_BUCKET_DOCS", "printgoo-docs")
        key = req.s3Key or f"box-labels/{filename}"
        upload_buffer_to_s3(buf, bucket, key, "application/pdf")
        return {"ok": True, "bucket": bucket, "s3Key": key, "filename": filename}

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


