"""
Marks Generator: Texnik belgilar, Krop chiziqlari, Rang shkalasi (Color Bar) va Pasport yozuvlari
"""

import io
import math
from typing import List, Tuple, Optional
from reportlab.lib.colors import CMYKColor, CMYKColorSep
from reportlab.pdfgen import canvas

from .models import (
    SheetConfig,
    BleedAndGutterConfig,
    PlacedItem,
    JobMetadata,
    TemplateStyle,
    ColorChannel,
)

MM_TO_PT = 72.0 / 25.4
PT_TO_MM = 25.4 / 72.0

# Poligrafik Registration rangi (barcha kanallarda 100% chiqishi uchun)
# ReportLab da CMYKColor(1, 1, 1, 1) yoki alohida separatsiya orqali
REG_COLOR = CMYKColor(1.0, 1.0, 1.0, 1.0)
BLACK_COLOR = CMYKColor(0.0, 0.0, 0.0, 1.0)


class MarksGenerator:
    """Montaj varag'idagi barcha vektorli belgilarni generatsiya qiluvchi sinf."""

    @staticmethod
    def create_marks_pdf_bytes(
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        items: List[PlacedItem],
        job: JobMetadata,
        style: TemplateStyle = TemplateStyle.PACKAGING_DIE_CUT,
        is_dieline_sheet: bool = False
    ) -> bytes:
        """ReportLab orqali toza vektorli texnik qatlamni (marks overlay) hosil qiladi."""
        packet = io.BytesIO()
        canv = canvas.Canvas(packet, pagesize=(sheet.width_pt, sheet.height_pt))

        # 1. Krop chiziqlarini (Crop Marks) chizish
        MarksGenerator._draw_crop_marks(canv, sheet, bg_config, items)

        # 2. Privodka krestlarini (Registration Marks) chizish
        MarksGenerator._draw_registration_marks(canv, sheet)

        # 3. Rang shkalasini (Color Bar) chizish (agar Standard yoki tegishli shablon bo'lsa)
        if style in (TemplateStyle.STANDARD_COLORBAR, TemplateStyle.PACKAGING_DIE_CUT, TemplateStyle.OFFSET_STANDARD) and not is_dieline_sheet:
            MarksGenerator._draw_color_bars(canv, sheet, job.colors)

        # 4. Yon tomondagi pasport yozuvlari (Metadata)
        MarksGenerator._draw_sheet_metadata(canv, sheet, bg_config, items, job, style, is_dieline_sheet)

        # 5. Klapan (Gripper) va Verniy burchak texnik belgilarini chizish
        MarksGenerator._draw_gripper_marks(canv, sheet, bg_config, items)

        canv.save()
        packet.seek(0)
        return packet.getvalue()

    @staticmethod
    def _draw_crop_marks(
        canv: canvas.Canvas,
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        items: List[PlacedItem]
    ):
        """
        Krop chiziqlarini FAQAT montaj blokining tashqi perimetriga chizish.
        Ichki maydonda hech qanday krop chizig'i chizilmaydi (faqat tashqarida bo'ladi).
        """
        if not items:
            return

        canv.saveState()
        canv.setStrokeColor(REG_COLOR)
        canv.setLineWidth(0.35) # ~0.12 mm ingichka aniq krop chizig'i

        crop_len = bg_config.crop_length_mm * MM_TO_PT
        crop_off = bg_config.crop_offset_pt

        # 1. Montaj blokining umumiy tashqi chegaralarini (bounding box) aniqlash
        min_x = min(item.trim_x for item in items)
        max_x = max(item.trim_x + item.trim_w for item in items)
        min_y = min(item.trim_y for item in items)
        max_y = max(item.trim_y + item.trim_h for item in items)

        # 2. Barcha ustunlarning vertikal kesish chiziqlari (X koordinatalari)
        x_coords = set()
        for item in items:
            x_coords.add(round(item.trim_x, 2))
            x_coords.add(round(item.trim_x + item.trim_w, 2))
        sorted_x = sorted(list(x_coords))

        # 3. Barcha qatorlarning gorizontal kesish chiziqlari (Y koordinatalari)
        y_coords = set()
        for item in items:
            y_coords.add(round(item.trim_y, 2))
            y_coords.add(round(item.trim_y + item.trim_h, 2))
        sorted_y = sorted(list(y_coords))

        sheet_h = sheet.height_pt

        # Vertikal krop chiziqlari: FAQAT yuqori va pastki tashqi chetlarga
        for x in sorted_x:
            # Yuqori chet: montaj blokidan tepaga qarab
            y_top_start = min_y - crop_off
            y_top_end = min_y - crop_off - crop_len
            canv.line(x, sheet_h - y_top_start, x, sheet_h - y_top_end)

            # Pastki chet: montaj blokidan pastga qarab
            y_bot_start = max_y + crop_off
            y_bot_end = max_y + crop_off + crop_len
            canv.line(x, sheet_h - y_bot_start, x, sheet_h - y_bot_end)

        # Gorizontal krop chiziqlari: FAQAT chap va o'ng tashqi chetlarga
        for y in sorted_y:
            rl_y = sheet_h - y
            # Chap chet: montaj blokidan chapga qarab
            canv.line(min_x - crop_off, rl_y, min_x - crop_off - crop_len, rl_y)
            # O'ng chet: montaj blokidan o'ngga qarab
            canv.line(max_x + crop_off, rl_y, max_x + crop_off + crop_len, rl_y)

        canv.restoreState()

    @staticmethod
    def _draw_registration_marks(canv: canvas.Canvas, sheet: SheetConfig):
        """Qog'ozning 4 chetiga privodka krestlarini (doira + krest) chizish."""
        canv.saveState()
        canv.setStrokeColor(REG_COLOR)
        canv.setLineWidth(0.3)

        w = sheet.width_pt
        h = sheet.height_pt
        r = 3.5 * MM_TO_PT # radius 3.5 mm

        # 4 ta markaziy nuqta (tepa, past, chap, o'ng)
        centers = [
            (w / 2.0, sheet.margin_bottom_mm * MM_TO_PT / 2.0), # Pastki (klapan oraliq)
            (w / 2.0, h - sheet.margin_top_mm * MM_TO_PT / 2.0), # Yuqori
            (sheet.margin_left_mm * MM_TO_PT / 2.0, h / 2.0), # Chap
            (w - sheet.margin_right_mm * MM_TO_PT / 2.0, h / 2.0), # O'ng
        ]

        for cx, cy in centers:
            canv.circle(cx, cy, r, stroke=1, fill=0)
            canv.circle(cx, cy, r * 0.5, stroke=1, fill=0)
            canv.line(cx - r * 1.5, cy, cx + r * 1.5, cy)
            canv.line(cx, cy - r * 1.5, cx, cy + r * 1.5)

        canv.restoreState()

    @staticmethod
    def _draw_color_bars(canv: canvas.Canvas, sheet: SheetConfig, colors: List[ColorChannel]):
        """Yuqori hoshiyaga CMYK va Spot ranglar shkalasini chizish (1-rasm)."""
        if not colors:
            return

        canv.saveState()
        sq_w = 4.5 * MM_TO_PT
        sq_h = 3.5 * MM_TO_PT

        # Yuqori qismdagi joylashuv (yuqori hoshiya ichida)
        y_top = sheet.height_pt - (sheet.margin_top_mm * MM_TO_PT * 0.75)
        
        # Barcha ranglar uchun 100%, 75%, 50% kataklar
        densities = [1.0, 0.7, 0.4]
        blocks = []
        for col in colors:
            for dens in densities:
                if col.is_spot:
                    c, m, y, k = col.cmyk
                    fill_c = CMYKColorSep(c * dens, m * dens, y * dens, k * dens, spotName=col.name, density=dens)
                else:
                    c, m, y, k = col.cmyk
                    fill_c = CMYKColor(c * dens, m * dens, y * dens, k * dens)
                blocks.append(fill_c)

        if not blocks:
            canv.restoreState()
            return

        # Yuqori markaziy privodka kresti bilan ustma-ust tushmasligi uchun
        # markazda kamida 24 mm (har tarafga 12 mm) toza xavfsizlik oraliq qoldiriladi.
        cx = sheet.width_pt / 2.0
        gap_half = 12.0 * MM_TO_PT

        mid = (len(blocks) + 1) // 2
        left_blocks = blocks[:mid]
        right_blocks = blocks[mid:]

        # Chap qanot (markaziy krestdan chapda)
        left_w = len(left_blocks) * sq_w
        curr_x = cx - gap_half - left_w
        for fill_c in left_blocks:
            canv.setFillColor(fill_c)
            canv.setStrokeColor(REG_COLOR)
            canv.setLineWidth(0.2)
            canv.rect(curr_x, y_top, sq_w, sq_h, fill=1, stroke=1)
            curr_x += sq_w

        # O'ng qanot (markaziy krestdan o'ngda)
        curr_x = cx + gap_half
        for fill_c in right_blocks:
            canv.setFillColor(fill_c)
            canv.setStrokeColor(REG_COLOR)
            canv.setLineWidth(0.2)
            canv.rect(curr_x, y_top, sq_w, sq_h, fill=1, stroke=1)
            curr_x += sq_w

        canv.restoreState()

    @staticmethod
    def _draw_color_tags(
        canv: canvas.Canvas,
        start_x: float,
        colors: List[ColorChannel],
        font_name: str,
        font_size: float
    ) -> float:
        """Har bir rang kanalini o'zining haqiqiy bo'yog'ida (separatsiyasida) chiqarish."""
        curr_x = start_x
        for col in colors:
            c_name = col.name
            if col.is_spot:
                c, m, y, k = col.cmyk
                txt_color = CMYKColorSep(c, m, y, k, spotName=col.name, density=1.0)
            else:
                c, m, y, k = col.cmyk
                txt_color = CMYKColor(c, m, y, k)

            # Sariq (Yellow) yoki o'ta och ranglar oq qog'ozda o'qilishi uchun yengil fon
            is_very_light = (col.name.lower() in ("yellow", "process yellow") or "11-0602" in col.name)
            if is_very_light:
                canv.saveState()
                canv.setFillColor(CMYKColor(0, 0, 0, 0.08))
                w_tag = canv.stringWidth(f" {c_name} ", font_name, font_size)
                canv.rect(curr_x, -1.5, w_tag, font_size + 2.5, fill=1, stroke=0)
                canv.restoreState()

            canv.setFillColor(txt_color)
            tag_str = f" {c_name}  "
            canv.drawString(curr_x, 0, tag_str)
            curr_x += canv.stringWidth(tag_str, font_name, font_size)
        return curr_x

    @staticmethod
    def _draw_sheet_metadata(
        canv: canvas.Canvas,
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        items: List[PlacedItem],
        job: JobMetadata,
        style: TemplateStyle,
        is_dieline: bool
    ):
        """
        Yon hoshiyalarga pasport yozuvlarini chiqarish.
        MUHIM POLIGRAFIK QOIDA:
        Yon privodka krestlari (Registration Marks) y = h / 2.0 nuqtada joylashgan.
        Krestlar va matnlar ustma-ust tushmasligi uchun krest atrofida +/- 15 mm daxlsiz
        toza zona ajratiladi. Matnlar esa krestdan PASTKI (Zone 1) va YUQORI (Zone 2)
        hududlarga ajratib joylashtiriladi.
        """
        canv.saveState()

        font_name = "Helvetica"
        font_size = 6.5
        canv.setFont(font_name, font_size)

        side_title = "Pichoq (Die-cut)" if is_dieline else job.side_name

        w = sheet.width_pt
        h = sheet.height_pt
        reg_y = h / 2.0
        reg_buffer = 15.0 * MM_TO_PT  # Privodka kresti atrofidagi daxlsiz zona (+/- 15 mm)

        # 1-zona: Pastki hudud (klapan/gripper belgilaridan tepada, krestdan kamida 15 mm pastda)
        y_zone1_start = max(18.0 * MM_TO_PT, sheet.margin_bottom_mm * MM_TO_PT + 5.0 * MM_TO_PT)
        y_zone1_max = reg_y - reg_buffer

        # 2-zona: Yuqori hudud (krestdan kamida 15 mm tepada boshlanadi)
        y_zone2_start = reg_y + reg_buffer

        # Matnning X koordinatasi (hoshiya kengligiga mos holda markazlashtiriladi)
        x_left = sheet.margin_left_mm * MM_TO_PT * 0.45
        x_right = w - (sheet.margin_right_mm * MM_TO_PT * 0.45)

        # Matn uzunligini nazorat qilish va krest tomon oshib ketishining oldini olish
        available_zone1 = y_zone1_max - y_zone1_start
        safe_job_name = job.job_name
        if len(safe_job_name) > 36:
            safe_job_name = safe_job_name[:33] + "..."

        if style in (TemplateStyle.COMPACT_SIDE_INFO, TemplateStyle.DIGITAL_COMPACT):
            # -------------------------------------------------------------
            # 2-rasm uslubi (Compact / Digital):
            # Chap hoshiyada:
            # - Pastki qism (Zone 1): Fayl nomi, Forma, Buyurtma soni, List soni
            # - [KREST ZONASI BO'SH SAQLANADI]
            # - Yuqori qism (Zone 2): Sana, Sahifa, Rang kanallari (har biri o'z bo'yog'ida)
            # -------------------------------------------------------------

            # 1. Pastki blok (Zone 1)
            notes_suffix = f"    [{job.custom_notes}]" if job.custom_notes else ""
            info_part1 = (
                f"Fayl: {safe_job_name}    "
                f"Forma: {job.sheet_form_str}    "
                f"Buyurtma soni: {job.order_quantity:,} dona    "
                f"Bosilishi kerak: {job.calculated_sheets:,} list"
                f"{notes_suffix}"
            ).replace(",", " ")

            # Agar tor varaqda matn krest zonasiga yaqinlashsa, xavfsiz qisqartirish
            while canv.stringWidth(info_part1, font_name, font_size) > available_zone1 - 5.0 and len(notes_suffix) > 6:
                notes_suffix = notes_suffix[:-5] + "...]"
                info_part1 = (
                    f"Fayl: {safe_job_name}  "
                    f"Forma: {job.sheet_form_str}  "
                    f"Buyurtma: {job.order_quantity:,}  "
                    f"List: {job.calculated_sheets:,}"
                    f"{notes_suffix}"
                ).replace(",", " ")

            while canv.stringWidth(info_part1, font_name, font_size) > available_zone1 - 5.0 and len(safe_job_name) > 8:
                safe_job_name = safe_job_name[:-4] + "..."
                info_part1 = (
                    f"Fayl: {safe_job_name}  "
                    f"Forma: {job.sheet_form_str}  "
                    f"Buyurtma: {job.order_quantity:,}  "
                    f"List: {job.calculated_sheets:,}"
                ).replace(",", " ")

            canv.saveState()
            canv.translate(x_left, y_zone1_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)
            canv.drawString(0, 0, info_part1)
            canv.restoreState()

            # 2. Yuqori blok (Zone 2 - Krestdan 15 mm tepada boshlanadi)
            canv.saveState()
            canv.translate(x_left, y_zone2_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)

            info_part2 = f"Sana: {job.date_str}    Sahifa: {side_title}    Rang: "
            canv.drawString(0, 0, info_part2)
            x_off = canv.stringWidth(info_part2, font_name, font_size)

            MarksGenerator._draw_color_tags(canv, x_off, job.colors, font_name, font_size)
            canv.restoreState()

        else:
            # -------------------------------------------------------------
            # 3-rasm uslubi (Packaging) & Standard:
            # Chap hoshiyada:
            # - Pastki qism: Ish nomi va Sahifa
            # - [KREST ZONASI BO'SH SAQLANADI]
            # - Yuqori qism: Rang kanallari (har biri o'z bo'yog'ida)
            #
            # O'ng hoshiyada:
            # - Pastki qism: Qog'oz o'lchami va Mahsulot o'lchami
            # - [KREST ZONASI BO'SH SAQLANADI]
            # - Yuqori qism: Ketadigan joyi (Bleed) va Oraliq (Gutter)
            # -------------------------------------------------------------

            # 1. Chap tomon - Pastki blok (Zone 1)
            notes_str = f"    List: {job.calculated_sheets:,}".replace(",", " ")
            if job.custom_notes:
                notes_str += f" ({job.custom_notes})"
            info_left_part1 = f"Ish nomi: {safe_job_name}    Sahifa: {side_title}{notes_str}"
            while canv.stringWidth(info_left_part1, font_name, font_size) > available_zone1 - 5.0 and len(info_left_part1) > 25:
                info_left_part1 = info_left_part1[:-5] + "..."
            canv.saveState()
            canv.translate(x_left, y_zone1_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)
            canv.drawString(0, 0, info_left_part1)
            canv.restoreState()

            # 2. Chap tomon - Yuqori blok (Zone 2 - Krestdan 15 mm tepada)
            canv.saveState()
            canv.translate(x_left, y_zone2_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)
            canv.drawString(0, 0, "Rang: ")
            x_off = canv.stringWidth("Rang: ", font_name, font_size)
            MarksGenerator._draw_color_tags(canv, x_off, job.colors, font_name, font_size)
            canv.restoreState()

            # 3. O'ng tomon - Pastki blok (Zone 1)
            info_right_part1 = (
                f"Qog'oz o'lchami: {sheet.width_mm:.0f}x{sheet.height_mm:.0f} mm    "
                f"Mahsulot o'lchami: {bg_config.trim_width_mm:.0f}x{bg_config.trim_height_mm:.0f} mm"
            )
            canv.saveState()
            canv.translate(x_right, y_zone1_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)
            canv.drawString(0, 0, info_right_part1)
            canv.restoreState()

            # 4. O'ng tomon - Yuqori blok (Zone 2 - Krestdan 15 mm tepada)
            info_right_part2 = (
                f"Fon (Bleed): {bg_config.bleed_mm:.1f} mm    "
                f"Oraliq (Gutter): {bg_config.gutter_x_mm:.1f}x{bg_config.gutter_y_mm:.1f} mm"
            )
            canv.saveState()
            canv.translate(x_right, y_zone2_start)
            canv.rotate(90)
            canv.setFillColor(BLACK_COLOR)
            canv.drawString(0, 0, info_right_part2)
            canv.restoreState()

        canv.restoreState()

    @staticmethod
    def _draw_gripper_marks(
        canv: canvas.Canvas,
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        items: List[PlacedItem]
    ):
        """
        Klapan (Gripper margin) va 'Verniy burchak' texnik belgilarini chizish.
        Bu belgilar pechatnik (mashinist) va gilotina (rezchik) uchun qog'ozning
        mashinaga kirish va bazalanish tekisligini ko'rsatadi.
        Dizayn va krop blokidan butunlay tashqarida, faqat pastki bo'sh hoshiyada joylashadi.
        """
        canv.saveState()
        canv.setStrokeColor(REG_COLOR)
        canv.setFillColor(REG_COLOR)
        canv.setLineWidth(0.35)

        w = sheet.width_pt
        h = sheet.height_pt
        klapan_pt = sheet.margin_bottom_mm * MM_TO_PT
        cy = klapan_pt / 2.0
        cx = w / 2.0

        font_name = "Helvetica-Bold"
        font_size = 5.5
        canv.setFont(font_name, font_size)

        # 1. Pastki markaziy krest yonidagi Klapan ko'rsatkichi (Matn va vektor strelkalar)
        tri_w = 2.5 * MM_TO_PT
        tri_h = 2.0 * MM_TO_PT

        def draw_feed_arrow(canv, center_x, center_y):
            p = canv.beginPath()
            p.moveTo(center_x, center_y + tri_h / 2.0)
            p.lineTo(center_x - tri_w / 2.0, center_y - tri_h / 2.0)
            p.lineTo(center_x + tri_w / 2.0, center_y - tri_h / 2.0)
            p.close()
            canv.drawPath(p, fill=1, stroke=0)

        offset_x = 12.0 * MM_TO_PT
        # O'ng tomonda: KLAPAN {gripper} mm (GRIPPER)
        draw_feed_arrow(canv, cx + offset_x, cy)
        canv.drawString(cx + offset_x + tri_w, cy - 2.0, f"KLAPAN {sheet.margin_bottom_mm:.0f} mm (GRIPPER)")

        # Chap tomonda: BOSMA KLAPANI
        draw_feed_arrow(canv, cx - offset_x, cy)
        canv.drawRightString(cx - offset_x - tri_w, cy - 2.0, f"BOSMA KLAPANI: {sheet.margin_bottom_mm:.0f} mm")

        # 2. Verniy burchak (Reference Corner / Верный угол) - pastki chap burchakda
        bx = max(4.0 * MM_TO_PT, sheet.margin_left_mm * MM_TO_PT * 0.4)
        by = max(3.0 * MM_TO_PT, klapan_pt * 0.25)
        arm_len = 6.0 * MM_TO_PT

        # 90 gradus burchak chizig'i
        canv.setLineWidth(0.6)
        canv.line(bx, by, bx + arm_len, by)
        canv.line(bx, by, bx, by + arm_len)
        canv.setLineWidth(0.35)

        canv.setFont(font_name, 5.0)
        canv.drawString(bx + 2.0, by + 2.0, "VERNY UGOL")

        # 3. Klapan balandligini ko'rsatuvchi chekka shtrixlar (Left & Right Ticks)
        tick_len = 3.5 * MM_TO_PT
        canv.line(0, klapan_pt, tick_len, klapan_pt)
        canv.line(w, klapan_pt, w - tick_len, klapan_pt)

        canv.setFont("Helvetica", 4.5)
        canv.drawString(tick_len + 1.5, klapan_pt - 1.5, f"{sheet.margin_bottom_mm:.0f}mm")
        canv.drawRightString(w - tick_len - 1.5, klapan_pt - 1.5, f"{sheet.margin_bottom_mm:.0f}mm")

        canv.restoreState()
