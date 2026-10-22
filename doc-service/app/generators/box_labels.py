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
from reportlab.lib.pagesizes import A4

from app.core.fonts import FONT_REGULAR, FONT_BOLD
from app.core.s3 import upload_buffer_to_s3
from app.schemas.documents import *

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
    boxes = req.boxes if req.boxes else [
        BoxLabelItemData(
            boxNumber=1,
            boxCode=f"BX-{req.workOrderNo}-01",
            quantity=1000,
            packerName="Operator",
            barcode=f"{req.workOrderNo}-B01",
        )
    ]

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

        # 1. Header (Brand & Document Type)
        # Top banner
        c.setFillColor(colors.black)
        c.rect(margin * mm, y_mm(margin + 12), inner_w * mm, 12 * mm, fill=1, stroke=0)

        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 12)
        c.drawString((margin + 3) * mm, y_mm(margin + 7.5), "PRINTGOO PACKAGING")

        c.setFont(FONT_REGULAR, 7.5)
        c.drawString((margin + 3) * mm, y_mm(margin + 11.2), "ISHLAB CHIQARISH VA QADOQLASH PASPORTI")

        # Top Right Badge inside banner
        draw_box(label_w_mm - margin - 22, margin + 2, 19, 8, fill_hex="#ffffff", stroke_hex="#ffffff", lw=0.5)
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 8.5)
        c.drawCentredString((label_w_mm - margin - 12.5) * mm, y_mm(margin + 7), "PASSPORT")

        # 2. Work Order & Customer Info Grid
        curr_y = margin + 14.5
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 2) * mm, y_mm(curr_y + 2.5), "BUYURTMA RAQAMI:")
        c.drawString((margin + 48) * mm, y_mm(curr_y + 2.5), "BUYURTMACHI (MIJOZ):")

        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 10.5)
        wo_display = req.workOrderNo
        if req.clientOrderNo:
            wo_display += f" ({req.clientOrderNo})"
        c.drawString((margin + 2) * mm, y_mm(curr_y + 7.2), wo_display)

        c.setFont(FONT_BOLD, 9.5)
        cust_display = req.customer or "—"
        if len(cust_display) > 24:
            cust_display = cust_display[:22] + "..."
        c.drawString((margin + 48) * mm, y_mm(curr_y + 7.2), cust_display)

        # Divider line
        curr_y += 10.0
        c.setLineWidth(0.8)
        c.setStrokeColor(colors.black)
        c.line(margin * mm, y_mm(curr_y), (margin + inner_w) * mm, y_mm(curr_y))

        # 3. Product Name Box
        curr_y += 1.5
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 2) * mm, y_mm(curr_y + 2.5), "MAHSULOT NOMI:")

        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 9.5)
        prod_lines = []
        raw_prod = req.product or "Chop etilgan mahsulot"
        if len(raw_prod) > 42:
            prod_lines.append(raw_prod[:40])
            prod_lines.append(raw_prod[40:80])
        else:
            prod_lines.append(raw_prod)

        for idx, line_txt in enumerate(prod_lines[:2]):
            c.drawString((margin + 2) * mm, y_mm(curr_y + 7.0 + (idx * 4.0)), line_txt)

        curr_y += 8.0 + (len(prod_lines) * 3.5)
        c.line(margin * mm, y_mm(curr_y), (margin + inner_w) * mm, y_mm(curr_y))

        # 4. Model and Size / Artikul Section (Very prominent for warehouse sorting)
        curr_y += 2.0
        model_w = (inner_w - 2.0) / 2.0
        draw_box(margin + 1, curr_y, model_w, 15, fill_hex="#f1f5f9", stroke_hex="#000000", lw=0.8)
        draw_box(margin + 2 + model_w, curr_y, model_w, 15, fill_hex="#f1f5f9", stroke_hex="#000000", lw=0.8)

        # Model label & value
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 3) * mm, y_mm(curr_y + 3.8), "MODEL / ARTIKUL:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 10.5)
        model_txt = box.model or "Standart"
        if len(model_txt) > 17:
            model_txt = model_txt[:15] + ".."
        c.drawString((margin + 3) * mm, y_mm(curr_y + 11.0), model_txt)

        # Size label & value
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 3.8), "O'LCHAM (SIZE):")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 13.0)
        size_txt = box.sizeCode or "STANDARD"
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 11.5), size_txt)

        curr_y += 17.0

        # 5. Giant Box Number & Quantity Impact Area
        draw_box(margin + 1, curr_y, model_w, 24, fill_hex="#ffffff", stroke_hex="#000000", lw=1.2)
        draw_box(margin + 2 + model_w, curr_y, model_w, 24, fill_hex="#ffffff", stroke_hex="#000000", lw=1.2)

        # Left: Box Number
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 3) * mm, y_mm(curr_y + 4.0), "QUTI RAQAMI:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 22.0)
        c.drawString((margin + 4) * mm, y_mm(curr_y + 18.0), str(box.boxNumber))
        c.setFont(FONT_BOLD, 10.0)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString((margin + 4 + (len(str(box.boxNumber)) * 8.5)) * mm, y_mm(curr_y + 18.0), f"/ {total_boxes}")

        # Right: Quantity in Box
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 4.0), "MIQDOR (SONI):")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 20.0)
        c.drawString((margin + 4 + model_w) * mm, y_mm(curr_y + 18.0), f"{box.quantity:,}")
        c.setFont(FONT_BOLD, 8.5)
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString((margin + 4 + model_w + (len(f"{box.quantity:,}") * 8.0)) * mm, y_mm(curr_y + 18.0), " dona")

        curr_y += 26.0

        # 6. Barcode Section (Code128 vector barcode)
        barcode_raw = box.barcode or f"{req.workOrderNo}-B{str(box.boxNumber).zfill(2)}"
        clean_barcode = "".join(ch for ch in barcode_raw if ch.isalnum() or ch in "-_")
        if not clean_barcode:
            clean_barcode = f"{req.workOrderNo}-{box.boxNumber}"

        try:
            # Code128 barcode drawing
            bc = code128.Code128(
                clean_barcode,
                barHeight=13 * mm,
                barWidth=0.33 * mm,
                humanReadable=False,
            )
            bc_d = Drawing(bc.width, bc.height)
            bc_d.add(bc)

            # Center the barcode horizontally
            bc_x = (label_w_mm - (bc.width / mm)) / 2.0
            bc_y = curr_y
            bc_d.drawOn(c, bc_x * mm, y_mm(bc_y + 13.0))

            # Human readable text below barcode
            c.setFillColor(colors.black)
            c.setFont(FONT_BOLD, 8.5)
            c.drawCentredString((label_w_mm / 2.0) * mm, y_mm(bc_y + 17.0), f"*{clean_barcode}*")
        except Exception:
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
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont(FONT_REGULAR, 7.0)

        # Packed Date
        pack_date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
        if box.packedAt:
            try:
                dt_obj = datetime.fromisoformat(box.packedAt.replace("Z", "+00:00"))
                pack_date_str = dt_obj.strftime("%d.%m.%Y %H:%M")
            except Exception:
                pack_date_str = str(box.packedAt)[:16]

        c.drawString(detail_x * mm, y_mm(curr_y + 4.5), f"Sana: {pack_date_str}")

        # Packer name
        packer = box.packerName or "Qadoqlovchi"
        c.drawString(detail_x * mm, y_mm(curr_y + 9.0), f"Qadoqlovchi: {packer}")

        # Tara code
        c.drawString(detail_x * mm, y_mm(curr_y + 13.5), f"Quti ID: {box.boxCode}")

        # QC Pass badge
        draw_box(detail_x, curr_y + 15.0, 36.0, 4.5, fill_hex="#0f172a", stroke_hex="#0f172a", lw=0.5)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6.5)
        c.drawCentredString((detail_x + 18.0) * mm, y_mm(curr_y + 18.2), "OTK / QC APPROVED")

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


