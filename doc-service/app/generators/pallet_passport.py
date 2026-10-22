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
from app.core.constants import trunc

def generate_pallet_passport_pdf(req: PalletPassportPdfRequest):
    """
    Generates multi-page A4 Pallet Routing Passport sheets (Pallet Route Sheet) using ReportLab.
    Each pallet gets its own dedicated A4 page with high-contrast borders,
    QR code, workpiece and paper specs, giant pallet numbering, shop-floor steps table, and QC stamps.
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    margin_x = 10 * mm

    def y_mm(mm_from_top: float) -> float:
        return page_h - (mm_from_top * mm)

    def draw_box(x_mm: float, top_mm: float, w_mm: float, h_mm: float, fill_hex="#ffffff", stroke_hex="#000000", lw=1.0):
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

    pallets_to_render = req.pallets if req.pallets else [
        PalletPassportItemData(palletNumber=1, palletCode="PL-01", totalPallets=1, plannedSheets=req.totalQuantity)
    ]
    total_pallets = len(pallets_to_render)
    full_w = 190.0  # mm (210 - 20)

    for p_idx, pallet in enumerate(pallets_to_render):
        # 1. Organization Banner & Header
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 14)
        c.drawString(margin_x, y_mm(14), "PRINTGOO ERP // ISHLAB CHIQARISH")

        c.setFont(FONT_BOLD, 7.5)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(margin_x, y_mm(18.5), "MARSHRUT PASPORTI VA QOG'OZ HARAKATI XARITASI (PALLET ROUTE SHEET)")

        # Pallet Badge Top Right
        draw_box(130, 8.5, 34, 6.5, fill_hex="#000000", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(147 * mm, y_mm(13.2), "PALET PASPORTI")

        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 8.5)
        c.drawCentredString(147 * mm, y_mm(18.5), f"{pallet.palletCode} / {req.workOrderNo}")

        # Real QR Code Top Right
        draw_box(169, 7.5, 17, 17, fill_hex="#ffffff", stroke_hex="#000000", lw=1.2)
        qr_payload = f"WO:{req.workOrderNo}|PALLET:{pallet.palletNumber}|CODE:{pallet.palletCode}|SHEETS:{pallet.plannedSheets}|CUST:{req.customer}"
        qr_widget = qr.QrCodeWidget(qr_payload)
        qr_bounds = qr_widget.getBounds()
        qr_w = qr_bounds[2] - qr_bounds[0]
        qr_h = qr_bounds[3] - qr_bounds[1]
        qr_pt = 15.5 * mm
        d_qr = Drawing(qr_pt, qr_pt, transform=[qr_pt / qr_w, 0, 0, qr_pt / qr_h, 0, 0])
        d_qr.add(qr_widget)
        d_qr.drawOn(c, 169.8 * mm, y_mm(24.0))

        # Divider line
        c.setStrokeColor(colors.black)
        c.setLineWidth(1.5)
        c.line(margin_x, y_mm(26), margin_x + full_w * mm, y_mm(26))

        # 2. Order & Product Summary Card
        card_top = 28.5
        card_h = 24.0
        draw_box(10, card_top, full_w, card_h, fill_hex="#f8fafc", stroke_hex="#000000", lw=1.2)

        # Col 1: Customer & Product
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6)
        c.drawString(12 * mm, y_mm(card_top + 4), "BUYURTMACHI:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 9.5)
        c.drawString(12 * mm, y_mm(card_top + 8.5), trunc(req.customer, 28))

        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6)
        c.drawString(12 * mm, y_mm(card_top + 14), "MAHSULOT NOMI:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 9.5)
        c.drawString(12 * mm, y_mm(card_top + 19), trunc(req.product, 28))

        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.8)
        c.line(75 * mm, y_mm(card_top + 2), 75 * mm, y_mm(card_top + card_h - 2))

        # Col 2: Order Metadata & Deadline
        c.setFont(FONT_BOLD, 6.5)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString(78 * mm, y_mm(card_top + 5), "BUYURTMA №:")
        c.setFillColor(colors.black)
        c.drawString(108 * mm, y_mm(card_top + 5), req.workOrderNo)

        if req.clientOrderNo:
            c.setFillColor(colors.HexColor("#64748b"))
            c.drawString(78 * mm, y_mm(card_top + 10), "MIJOZ KODI:")
            c.setFillColor(colors.black)
            c.drawString(108 * mm, y_mm(card_top + 10), req.clientOrderNo)

        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString(78 * mm, y_mm(card_top + 15), "SEX / USULI:")
        c.setFillColor(colors.black)
        c.drawString(108 * mm, y_mm(card_top + 15), req.department.upper())

        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString(78 * mm, y_mm(card_top + 20), "MUDDATI:")
        c.setFillColor(colors.HexColor("#dc2626"))
        c.setFont(FONT_BOLD, 7.5)
        c.drawString(108 * mm, y_mm(card_top + 20), req.deadline or "—")

        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.8)
        c.line(135 * mm, y_mm(card_top + 2), 135 * mm, y_mm(card_top + card_h - 2))

        # Col 3: Paper & Format
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_BOLD, 6)
        c.drawString(138 * mm, y_mm(card_top + 4), "QOG'OZ / MATERIAL:")
        c.setFillColor(colors.black)
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(138 * mm, y_mm(card_top + 8.5), trunc(req.paperStock, 28))

        format_str = f"{req.pressSheetW:g}×{req.pressSheetH:g} mm" if req.pressSheetW and req.pressSheetH else "Standart"
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString(138 * mm, y_mm(card_top + 15), f"List bichimi: {format_str}")
        c.drawString(138 * mm, y_mm(card_top + 20), f"Ranglilik: {req.colorsConfig or '4+0'}")

        # 3. Big Eye-Catching Pallet Banner
        ban_top = card_top + card_h + 3.0
        ban_h = 23.0
        draw_box(10, ban_top, full_w, ban_h, fill_hex="#000000", stroke_hex=None)

        # Pallet number
        c.setFillColor(colors.HexColor("#a1a1aa"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(14 * mm, y_mm(ban_top + 5), "PALET RAQAMI (PALLET NO):")
        c.setFillColor(colors.HexColor("#34d399"))  # Emerald
        c.setFont(FONT_BOLD, 22)
        c.drawString(14 * mm, y_mm(ban_top + 18), f"{pallet.palletNumber}")
        c.setFillColor(colors.HexColor("#a1a1aa"))
        c.setFont(FONT_BOLD, 12)
        c.drawString(28 * mm, y_mm(ban_top + 18), f"/ {pallet.totalPallets}")

        c.setStrokeColor(colors.HexColor("#3f3f46"))
        c.setLineWidth(0.8)
        c.line(75 * mm, y_mm(ban_top + 3), 75 * mm, y_mm(ban_top + ban_h - 3))

        # Planned Sheets
        c.setFillColor(colors.HexColor("#a1a1aa"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(80 * mm, y_mm(ban_top + 5), "PALETDAGI QOG'OZ (LIST SONI):")
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 20)
        c.drawString(80 * mm, y_mm(ban_top + 18), f"{pallet.plannedSheets:,}")
        c.setFillColor(colors.HexColor("#a1a1aa"))
        c.setFont(FONT_BOLD, 9)
        c.drawString(125 * mm, y_mm(ban_top + 18), "LIST")

        c.setStrokeColor(colors.HexColor("#3f3f46"))
        c.setLineWidth(0.8)
        c.line(142 * mm, y_mm(ban_top + 3), 142 * mm, y_mm(ban_top + ban_h - 3))

        # Total Order Target
        c.setFillColor(colors.HexColor("#a1a1aa"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(146 * mm, y_mm(ban_top + 5), "UMUMIY BUYURTMA:")
        c.setFillColor(colors.HexColor("#e4e4e7"))
        c.setFont(FONT_BOLD, 13)
        c.drawString(146 * mm, y_mm(ban_top + 15), f"{req.totalQuantity:,}")
        c.setFont(FONT_REGULAR, 7)
        c.drawString(146 * mm, y_mm(ban_top + 20), "dona tayyor mahsulot")

        # 4. Operator Notice Banner
        not_top = ban_top + ban_h + 3.0
        not_h = 10.0
        draw_box(10, not_top, full_w, not_h, fill_hex="#fef3c7", stroke_hex="#f59e0b", lw=0.8)
        c.setFillColor(colors.HexColor("#92400e"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(13 * mm, y_mm(not_top + 4.2), "DIQQAT OPERATORLAR:")
        c.setFont(FONT_REGULAR, 6.0)
        c.drawString(13 * mm, y_mm(not_top + 7.8), "Har bir operatsiyada kirgan listni va sof chiqqan hamda brak listlarni ruchka bilan to'ldiring va imzo qo'ying.")
        c.drawRightString(196 * mm, y_mm(not_top + 7.8), "Keyingi sexga o'tkazishda QR-kodni skanerlang!")

        # 5. Main Shop-Floor Traveler Steps Table
        tbl_top = not_top + not_h + 3.0
        th_h = 6.5
        draw_box(10, tbl_top, full_w, th_h, fill_hex="#000000", stroke_hex=None)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6)
        c.drawCentredString(14 * mm, y_mm(tbl_top + 4.5), "№")
        c.drawString(20 * mm, y_mm(tbl_top + 4.5), "TEXNOLOGIK BOSQICH VA DASTGOH")
        c.drawCentredString(88 * mm, y_mm(tbl_top + 4.5), "KIRISH (LIST)")
        c.drawCentredString(110 * mm, y_mm(tbl_top + 4.5), "PRILADKA (BRAK)")
        c.drawCentredString(132 * mm, y_mm(tbl_top + 4.5), "JARAYON BRAKI")
        c.drawCentredString(154 * mm, y_mm(tbl_top + 4.5), "SOF CHIQISH")
        c.drawCentredString(174 * mm, y_mm(tbl_top + 4.5), "OPERATOR")
        c.drawCentredString(191 * mm, y_mm(tbl_top + 4.5), "SANA / VAQT")

        ops_list = req.operations if req.operations else [
            JobTicketOperationItem(stepNumber=10, name="Katta bichimda kesish (Paper Cut)", machine="Polar 115 High-Speed"),
            JobTicketOperationItem(stepNumber=20, name="Ofset bosma (Offset Print)", machine="Heidelberg Speedmaster XL 106"),
            JobTicketOperationItem(stepNumber=30, name="Laminatsiya (Thermal Lamination)", machine="Autobond Mini 76"),
            JobTicketOperationItem(stepNumber=40, name="Shtans-forma kesim (Die-Cutting)", machine="Bobst Novacut 106"),
            JobTicketOperationItem(stepNumber=50, name="Qadoqlash va OTK (Packing)", machine="Manual Inspection"),
        ]

        row_y = tbl_top + th_h
        row_h = 13.0

        for s_i, op in enumerate(ops_list):
            draw_box(10, row_y, full_w, row_h, fill_hex="#ffffff" if s_i % 2 == 0 else "#fafafa", stroke_hex="#000000", lw=0.8)
            # Col lines
            c.setStrokeColor(colors.black)
            c.setLineWidth(0.8)
            for sep_x in [18, 78, 99, 121, 143, 165, 183]:
                c.line(sep_x * mm, y_mm(row_y), sep_x * mm, y_mm(row_y + row_h))

            # Number
            c.setFillColor(colors.HexColor("#000000"))
            c.setFont(FONT_BOLD, 8)
            c.drawCentredString(14 * mm, y_mm(row_y + 8), str(s_i + 1))

            # Op name + machine
            c.drawString(20 * mm, y_mm(row_y + 5.5), trunc(op.name, 36))
            c.setFont(FONT_REGULAR, 6)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawString(20 * mm, y_mm(row_y + 10), trunc(op.machine, 38))

            # Input sheets (first row auto filled)
            if s_i == 0:
                c.setFillColor(colors.black)
                c.setFont(FONT_BOLD, 8.5)
                c.drawCentredString(88.5 * mm, y_mm(row_y + 8), f"{pallet.plannedSheets:,}")

            # Operator signature dashes
            c.setStrokeColor(colors.HexColor("#a1a1aa"))
            c.setDash(2, 1.5)
            c.line(167 * mm, y_mm(row_y + 10.5), 181 * mm, y_mm(row_y + 10.5))
            c.line(185 * mm, y_mm(row_y + 10.5), 198 * mm, y_mm(row_y + 10.5))
            c.setDash()

            row_y += row_h

        # 2 Extra blank rows for unplanned re-work / finishing
        for extra in [1, 2]:
            draw_box(10, row_y, full_w, row_h - 2, fill_hex="#ffffff", stroke_hex="#000000", lw=0.6)
            c.setStrokeColor(colors.black)
            c.setLineWidth(0.6)
            for sep_x in [18, 78, 99, 121, 143, 165, 183]:
                c.line(sep_x * mm, y_mm(row_y), sep_x * mm, y_mm(row_y + row_h - 2))
            c.setFillColor(colors.HexColor("#94a3b8"))
            c.setFont(FONT_BOLD, 7)
            c.drawCentredString(14 * mm, y_mm(row_y + 7), f"+{extra}")
            c.setFont(FONT_REGULAR, 6.5)
            c.drawString(20 * mm, y_mm(row_y + 7), "Qo'shimcha ishlov / Qayta ishlash: _______________________")
            row_y += row_h - 2

        # 6. Bottom Notes & QC Approval Box
        foot_top = max(row_y + 4.0, 252.0)
        draw_box(10, foot_top, 114, 25, fill_hex="#f8fafc", stroke_hex="#000000", lw=1.0)
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(12 * mm, y_mm(foot_top + 4.5), "SEX USTASI VA OPERATOR IZOHLARI / TEXNIK KO'RSATMA:")
        c.setFont(FONT_REGULAR, 6.0)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.drawString(12 * mm, y_mm(foot_top + 9.5), "(Masalan: bo'yoq quritish vaqti, qo'shimcha lak, kesishdagi qoldiqlar...)")

        # QC Approval Box
        draw_box(126, foot_top, 74, 25, fill_hex="#ffffff", stroke_hex="#000000", lw=1.0)
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont(FONT_BOLD, 6.2)
        c.drawString(128 * mm, y_mm(foot_top + 4.5), "SMENA USTASI / OTK SIFAT NAZORATI:")
        c.setFillColor(colors.black)
        c.setFont(FONT_REGULAR, 6.5)
        c.drawString(128 * mm, y_mm(foot_top + 11), "F.I.SH: ________________________")
        c.drawString(128 * mm, y_mm(foot_top + 17), "Imzo:  ________________________")

        # QC Stamp placeholder
        draw_box(180, foot_top + 4, 18, 18, fill_hex=None, stroke_hex="#000000", lw=0.8)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont(FONT_BOLD, 5.5)
        c.drawCentredString(189 * mm, y_mm(foot_top + 11), "OTK SHTAMPI")
        c.setFont(FONT_REGULAR, 4.8)
        c.drawCentredString(189 * mm, y_mm(foot_top + 16), "QC APPROVED")

        # 7. Page footer
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(0.5)
        c.line(margin_x, y_mm(287), margin_x + full_w * mm, y_mm(287))
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont(FONT_REGULAR, 6.0)
        c.drawString(margin_x, y_mm(291), f"PrintGoo ERP • Palet Identifikatori: {pallet.palletCode}-{req.workOrderNo}")
        c.drawRightString(margin_x + full_w * mm, y_mm(291), f"Chop etilgan sana: {datetime.now().strftime('%Y-%m-%d %H:%M')} • Palet {pallet.palletNumber} / {total_pallets}")

        c.showPage()

    c.save()
    buf.seek(0)

    filename = f"Pallet_Passports_{req.workOrderNo}.pdf"
    if req.saveToS3:
        bucket = os.getenv("S3_BUCKET_DOCS", "printgoo-docs")
        key = req.s3Key or f"pallet-passports/{filename}"
        upload_buffer_to_s3(buf, bucket, key, "application/pdf")
        return {"ok": True, "bucket": bucket, "s3Key": key, "filename": filename}

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


