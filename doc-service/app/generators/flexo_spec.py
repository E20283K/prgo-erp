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

def generate_flexo_pdf(req: FlexoPdfRequest):
    """
    Generates a technical Flexo Production Specification PDF using ReportLab,
    including vector imposition schematic, QR code, and Code128 Barcode.
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4  # 210mm x 297mm in points
    margin = 12 * mm

    # Helper to convert top-down Y (mm) to ReportLab bottom-up Y (points)
    def y_top(mm_from_top: float) -> float:
        return page_h - (mm_from_top * mm)

    # 1. Header Banner (Dark Slate)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(margin, y_top(30), page_w - 2 * margin, 18 * mm, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 12)
    c.drawString(margin + 5 * mm, y_top(20), "PRINTGOO — FLEXOGRAPHIC PRODUCTION SPECIFICATION")

    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont(FONT_REGULAR, 8)
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    c.drawString(
        margin + 5 * mm,
        y_top(26),
        f"DOC: {req.docNo}   |   DATE: {date_str}   |   STATUS: APPROVED FOR PRESS",
    )

    # Draw QR Code inside Header right side
    qr_payload = req.qrData or f"ORDER:{req.docNo}|CUST:{req.customer}|TEETH:{req.gearTeeth}T"
    qr_widget = qr.QrCodeWidget(qr_payload)
    qr_bounds = qr_widget.getBounds()
    qr_w = qr_bounds[2] - qr_bounds[0]
    qr_h = qr_bounds[3] - qr_bounds[1]
    qr_size = 16 * mm
    d_qr = Drawing(qr_size, qr_size, transform=[qr_size / qr_w, 0, 0, qr_size / qr_h, 0, 0])
    d_qr.add(qr_widget)
    # White background box for QR
    c.setFillColor(colors.white)
    c.rect(page_w - margin - 17 * mm, y_top(29), 16 * mm, 16 * mm, fill=1, stroke=0)
    d_qr.drawOn(c, page_w - margin - 17 * mm, y_top(29))

    # 2. Customer & Machine Info Box
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.rect(margin, y_top(52), page_w - 2 * margin, 18 * mm, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(margin + 4 * mm, y_top(40), "Customer:")
    c.drawString(margin + 4 * mm, y_top(47), "Product:")
    c.drawString(margin + 95 * mm, y_top(40), "Press Machine:")
    c.drawString(margin + 95 * mm, y_top(47), "Substrate:")

    c.setFont(FONT_REGULAR, 8.5)
    c.drawString(margin + 24 * mm, y_top(40), req.customer)
    c.drawString(margin + 24 * mm, y_top(47), req.productName)
    c.drawString(margin + 122 * mm, y_top(40), req.machineName)
    c.drawString(margin + 122 * mm, y_top(47), f"{req.materialName} ({req.webWidth} mm)")

    # Code128 Barcode on top-right of Customer Box
    barcode_val = req.barcodeData or req.docNo
    bc = code128.Code128(barcode_val, barHeight=8 * mm, barWidth=0.9)
    bc.drawOn(c, page_w - margin - 52 * mm, y_top(49))

    # 3. Cylinder & Tooling Parameters
    c.setFillColor(colors.HexColor("#1e40af"))
    c.setFont(FONT_BOLD, 9.5)
    c.drawString(margin, y_top(58), "1. CYLINDER & TOOLING PARAMETERS")

    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.rect(margin, y_top(88), page_w - 2 * margin, 27 * mm, fill=1, stroke=1)

    col1, col2, col3 = margin + 4 * mm, margin + 65 * mm, margin + 125 * mm

    def draw_kv(x_pt: float, y_mm: float, label: str, val: str, val_color="#0f172a"):
        c.setFont(FONT_REGULAR, 8)
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(x_pt, y_top(y_mm), label)
        c.setFont(FONT_BOLD, 8)
        c.setFillColor(colors.HexColor(val_color))
        c.drawString(x_pt + 27 * mm, y_top(y_mm), val)

    draw_kv(col1, 67, "Gear Teeth:", f"{req.gearTeeth} Teeth ({req.gearTeeth}T)")
    draw_kv(col2, 67, "Cylinder Ø:", f"{req.cylinderDiameter} mm")
    draw_kv(col3, 67, "Plate Thickness:", f"{req.plateThickness} mm")

    draw_kv(col1, 75, "Printing Repeat:", f"{req.printingLength} mm", "#2563eb")
    draw_kv(col2, 75, "Film Length:", f"{req.filmLength} mm")
    draw_kv(col3, 75, "Pitch Ø (PCD):", f"{req.pitchCircleDiameter} mm")

    color_names = ", ".join([col.name for col in req.colors]) or "CMYK"
    draw_kv(col1, 83, "Colors / Plates:", f"{len(req.colors) or 4} ({color_names})")
    draw_kv(col2, 83, "Usable Width:", f"{req.usablePrintWidth} / {req.webWidth} mm")
    draw_kv(col3, 83, "Side Trim Waste:", f"{req.sideWasteWidth} mm", "#dc2626")

    # 4. Production Run & Material Calculations
    c.setFillColor(colors.HexColor("#1e40af"))
    c.setFont(FONT_BOLD, 9.5)
    c.drawString(margin, y_top(95), "2. PRODUCTION RUN & MATERIAL CALCULATIONS")

    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.rect(margin, y_top(125), page_w - 2 * margin, 27 * mm, fill=1, stroke=1)

    draw_kv(col1, 104, "Product Size:", f"{req.productWidth}×{req.productHeight} mm ({req.orientation})")
    draw_kv(col2, 104, "Across Count:", f"{req.acrossCount} across")
    draw_kv(col3, 104, "Around Repeat:", f"{req.aroundCount} around")

    draw_kv(col1, 112, "Required Qty:", f"{req.requiredQuantity:,} pcs")
    draw_kv(col2, 112, "Target Qty:", f"{req.productionTargetQuantity:,} pcs")
    draw_kv(col3, 112, "Actual Yield:", f"{req.actualYieldQuantity:,} pcs", "#16a34a")

    draw_kv(col1, 120, "Cylinder Cycles:", f"{req.repeatCount:,} revs")
    draw_kv(col2, 120, "Linear Meter:", f"{req.materialConsumptionMeters:,.1f} m ({req.materialConsumptionSqM} m²)")
    draw_kv(col3, 120, "Substrate Yield:", f"{req.yieldPercent}% ({req.wasteSqM} m² waste)")

    # 5. Vector Imposition Schematic (1 Repeat)
    c.setFillColor(colors.HexColor("#1e40af"))
    c.setFont(FONT_BOLD, 9.5)
    c.drawString(margin, y_top(132), "3. IMPOSITION PREVIEW & DIMENSION SCHEMATIC (1 REPEAT)")

    box_top_mm = 135
    box_h_mm = 115
    box_w_mm = (page_w - 2 * margin) / mm

    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.rect(margin, y_top(box_top_mm + box_h_mm), box_w_mm * mm, box_h_mm * mm, fill=1, stroke=1)

    max_draw_w = box_w_mm - 30
    max_draw_h = box_h_mm - 20
    scale = min(
        max_draw_w / max(req.webWidth, 1),
        max_draw_h / max(req.printingLength, 1),
        1.2,
    )

    draw_web_w = req.webWidth * scale
    draw_web_h = req.printingLength * scale
    start_x_mm = (margin / mm) + (box_w_mm - draw_web_w) / 2
    start_y_top_mm = box_top_mm + (box_h_mm - draw_web_h) / 2

    # Web Substrate Rectangle
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#64748b"))
    c.setLineWidth(1)
    c.rect(
        start_x_mm * mm,
        y_top(start_y_top_mm + draw_web_h),
        draw_web_w * mm,
        draw_web_h * mm,
        fill=1,
        stroke=1,
    )

    # Machine Direction Label
    c.setFont(FONT_BOLD, 7)
    c.setFillColor(colors.HexColor("#0284c7"))
    c.drawCentredString(
        (start_x_mm + draw_web_w / 2) * mm,
        y_top(start_y_top_mm - 2.5),
        f"MACHINE DIRECTION  |  WEB WIDTH: {req.webWidth} mm",
    )

    # Placed Labels
    c.setStrokeColor(colors.HexColor("#2563eb"))
    c.setFillColor(colors.HexColor("#eff6ff"))
    c.setLineWidth(0.7)

    for pos in req.positions:
        px = (start_x_mm + pos.x * scale) * mm
        pw = (pos.width * scale) * mm
        ph = (pos.height * scale) * mm
        py = y_top(start_y_top_mm + (pos.y + pos.height) * scale)
        c.rect(px, py, pw, ph, fill=1, stroke=1)

        if pos.width * scale > 10 and pos.height * scale > 6:
            c.setFillColor(colors.HexColor("#1e40af"))
            c.setFont(FONT_BOLD, 6)
            c.drawCentredString(px + pw / 2, py + ph / 2 - 2, f"{pos.width}×{pos.height}")
            c.setFillColor(colors.HexColor("#eff6ff"))

    # Repeat Boundary Dashed Line
    c.setStrokeColor(colors.HexColor("#dc2626"))
    c.setDash(4, 3)
    c.line(
        (start_x_mm - 4) * mm,
        y_top(start_y_top_mm + draw_web_h),
        (start_x_mm + draw_web_w + 4) * mm,
        y_top(start_y_top_mm + draw_web_h),
    )
    c.setDash()
    c.setFillColor(colors.HexColor("#dc2626"))
    c.setFont(FONT_BOLD, 6.5)
    c.drawCentredString(
        (start_x_mm + draw_web_w / 2) * mm,
        y_top(start_y_top_mm + draw_web_h + 4),
        f"REPEAT CUT BOUNDARY: {req.printingLength} mm ({req.gearTeeth}T)",
    )

    # 6. Signatures Footer
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.rect(margin, y_top(282), page_w - 2 * margin, 24 * mm, fill=1, stroke=1)

    for idx, role in enumerate(["Prepress Engineer:", "Press Lead Operator:", "Quality Control (QC):"]):
        sx = margin + (10 + idx * 60) * mm
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont(FONT_BOLD, 7.5)
        c.drawString(sx, y_top(264), role)
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.line(sx, y_top(274), sx + 45 * mm, y_top(274))
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_REGULAR, 7)
        c.drawString(sx, y_top(278), "Sign & Date")

    c.showPage()
    c.save()
    buf.seek(0)

    filename = f"Flexo_Spec_{req.docNo}_{req.gearTeeth}T.pdf"

    if req.saveToS3:
        bucket = os.getenv("S3_BUCKET_DOCS", "printgoo-docs")
        key = req.s3Key or f"flexo-specs/{filename}"
        upload_buffer_to_s3(buf, bucket, key, "application/pdf")
        return {"ok": True, "bucket": bucket, "s3Key": key, "filename": filename}

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


