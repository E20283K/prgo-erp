"""
Marks Generator: Texnik belgilar, Krop chiziqlari, Rang shkalasi (Color Bar) va Pasport yozuvlari
"""

import io
from dataclasses import dataclass
from typing import List, Optional, Tuple
from reportlab.lib.colors import CMYKColor, CMYKColorSep
from reportlab.pdfbase.pdfmetrics import stringWidth
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

# Poligrafik Registration rangi: PDF dagi maxsus "/Separation /All" bo'yog'i barcha qoliplarga,
# shu jumladan Pantone (spot) qoliplariga ham 100% chiqadi. Alternativ (ekran) ko'rinishi 100/100/100/100.
REG_COLOR = CMYKColorSep(1.0, 1.0, 1.0, 1.0, spotName="All", density=1.0)

# Belgilar va qog'oz cheti / tashqi fon orasidagi xavfsiz oraliqlar
EDGE_SAFE_PT = 1.0 * MM_TO_PT     # Gilotina kesish xatoligi (list cheti)
BLEED_SAFE_PT = 0.5 * MM_TO_PT    # Tashqi fondan (bleed) uzoqlik
MARK_SAFE_PT = 0.3 * MM_TO_PT     # Privodka kresti uchun minimal bo'shliq

REG_RADIUS_PT = 3.5 * MM_TO_PT
REG_MIN_RADIUS_PT = 1.2 * MM_TO_PT

INFO_FONT = "Helvetica"
INFO_FONT_SIZE = 6.5
INFO_MIN_FONT_SIZE = 4.0
# Helvetica: ascent ~0.72, descent ~0.21 em; rang teglari fon to'rtburchagi bilan ~1.0 em
INFO_ASCENT = 0.75
INFO_DESCENT = 0.25

COLOR_BAR_SQ_W = 4.5 * MM_TO_PT
COLOR_BAR_SQ_H = 3.5 * MM_TO_PT
COLOR_BAR_MIN_H = 1.5 * MM_TO_PT
COLOR_BAR_CENTER_GAP = 12.0 * MM_TO_PT  # Yuqori markaziy krest atrofidagi toza zona (har tarafga)


@dataclass
class FreeZones:
    """List cheti bilan montaj blokining tashqi foni (bleed) orasidagi haqiqiy bo'sh joy (pt)."""
    left: float
    right: float
    top: float
    bottom: float


def _fit_font_size(band: float) -> Optional[float]:
    """Berilgan kenglikdagi tasmaga sig'adigan shrift o'lchami (sig'masa None)."""
    usable = band - EDGE_SAFE_PT - BLEED_SAFE_PT
    size = min(INFO_FONT_SIZE, usable / (INFO_ASCENT + INFO_DESCENT))
    return size if size >= INFO_MIN_FONT_SIZE else None


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

        zones = MarksGenerator._free_zones(sheet, bg_config, items)
        with_color_bar = (
            style in (TemplateStyle.STANDARD_COLORBAR, TemplateStyle.PACKAGING_DIE_CUT, TemplateStyle.OFFSET_STANDARD)
            and not is_dieline_sheet
        )

        # 1. Krop chiziqlarini (Crop Marks) chizish
        MarksGenerator._draw_crop_marks(canv, sheet, bg_config, items)

        # 2. Privodka krestlarini (Registration Marks) chizish
        MarksGenerator._draw_registration_marks(canv, sheet, zones)

        # 3. Rang shkalasini (Color Bar) chizish (agar Standard yoki tegishli shablon bo'lsa)
        if with_color_bar:
            MarksGenerator._draw_color_bars(canv, sheet, zones, job.colors)

        # 4. Yon tomondagi pasport yozuvlari (Metadata)
        MarksGenerator._draw_sheet_metadata(
            canv, sheet, bg_config, zones, job, style, is_dieline_sheet,
            MarksGenerator._color_bar_span(sheet, zones, job.colors) if with_color_bar else None,
        )

        # 5. Klapan (Gripper) va Verniy burchak texnik belgilarini chizish
        MarksGenerator._draw_gripper_marks(canv, sheet, bg_config, zones)

        canv.save()
        packet.seek(0)
        return packet.getvalue()

    @staticmethod
    def _free_zones(sheet: SheetConfig, bg_config: BleedAndGutterConfig, items: List[PlacedItem]) -> FreeZones:
        """
        Belgilar uchun haqiqiy bo'sh joy: list cheti -> montaj blokining tashqi foni.
        Hoshiya (margin) kesim chizig'igacha o'lchanadi va tashqi fon uning ichiga tushadi,
        "Markaz" joylashuvida esa blok hoshiyalardan qat'i nazar markazlashadi.
        """
        w = sheet.width_pt
        h = sheet.height_pt
        bleed = bg_config.outer_bleed_pt
        if items:
            min_x = min(it.trim_x for it in items)
            max_x = max(it.trim_x + it.trim_w for it in items)
            min_y = min(it.trim_y for it in items)          # yuqoridan (PyMuPDF koordinatasi)
            max_y = max(it.trim_y + it.trim_h for it in items)
            left, right = min_x - bleed, w - max_x - bleed
            top, bottom = min_y - bleed, h - max_y - bleed
        else:
            left = sheet.margin_left_mm * MM_TO_PT - bleed
            right = sheet.margin_right_mm * MM_TO_PT - bleed
            top = sheet.margin_top_mm * MM_TO_PT - bleed
            bottom = sheet.margin_bottom_mm * MM_TO_PT - bleed
        return FreeZones(max(0.0, left), max(0.0, right), max(0.0, top), max(0.0, bottom))

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
    def _draw_registration_marks(canv: canvas.Canvas, sheet: SheetConfig, zones: FreeZones):
        """
        Qog'ozning 4 chetiga privodka krestlarini (doira + krest) chizish.
        Krest o'z tomonidagi bo'sh tasma markaziga qo'yiladi va unga sig'adigan qilib
        kichraytiriladi; juda tor tasmada (fon yoki mahsulot ustiga chiqmasligi uchun) chizilmaydi.
        """
        canv.saveState()
        canv.setStrokeColor(REG_COLOR)
        canv.setLineWidth(0.3)

        w = sheet.width_pt
        h = sheet.height_pt

        # (markaz x, markaz y, tasma kengligi) — tepa, past, chap, o'ng
        marks = [
            (w / 2.0, zones.bottom / 2.0, zones.bottom),
            (w / 2.0, h - zones.top / 2.0, zones.top),
            (zones.left / 2.0, h / 2.0, zones.left),
            (w - zones.right / 2.0, h / 2.0, zones.right),
        ]

        for cx, cy, band in marks:
            half = band / 2.0 - MARK_SAFE_PT
            r = min(REG_RADIUS_PT, half)
            if r < REG_MIN_RADIUS_PT:
                continue
            arm = min(r * 1.5, half)
            canv.circle(cx, cy, r, stroke=1, fill=0)
            canv.circle(cx, cy, r * 0.5, stroke=1, fill=0)
            canv.line(cx - arm, cy, cx + arm, cy)
            canv.line(cx, cy - arm, cx, cy + arm)

        canv.restoreState()

    @staticmethod
    def _color_bar_blocks(colors: List[ColorChannel]) -> list:
        blocks = []
        for col in colors or []:
            for dens in (1.0, 0.7, 0.4):  # 100%, 70%, 40% kataklar
                c, m, y, k = col.cmyk
                if col.is_spot:
                    blocks.append(CMYKColorSep(c * dens, m * dens, y * dens, k * dens, spotName=col.name, density=dens))
                else:
                    blocks.append(CMYKColor(c * dens, m * dens, y * dens, k * dens))
        return blocks

    @staticmethod
    def _color_bar_height(zones: FreeZones) -> Optional[float]:
        bar_h = min(COLOR_BAR_SQ_H, zones.top - 2 * BLEED_SAFE_PT)
        return bar_h if bar_h >= COLOR_BAR_MIN_H else None

    @staticmethod
    def _color_bar_span(sheet: SheetConfig, zones: FreeZones, colors: List[ColorChannel]) -> Optional[Tuple[float, float]]:
        """Rang shkalasi egallaydigan gorizontal oraliq (x0, x1), chizilmasa None."""
        blocks = MarksGenerator._color_bar_blocks(colors)
        if not blocks or MarksGenerator._color_bar_height(zones) is None:
            return None
        cx = sheet.width_pt / 2.0
        mid = (len(blocks) + 1) // 2
        return (
            cx - COLOR_BAR_CENTER_GAP - mid * COLOR_BAR_SQ_W,
            cx + COLOR_BAR_CENTER_GAP + (len(blocks) - mid) * COLOR_BAR_SQ_W,
        )

    @staticmethod
    def _draw_color_bars(canv: canvas.Canvas, sheet: SheetConfig, zones: FreeZones, colors: List[ColorChannel]):
        """Yuqori bo'sh tasmaga CMYK va Spot ranglar shkalasini chizish (1-rasm)."""
        blocks = MarksGenerator._color_bar_blocks(colors)
        bar_h = MarksGenerator._color_bar_height(zones)
        if not blocks or bar_h is None:
            return

        canv.saveState()
        sq_w = COLOR_BAR_SQ_W

        # Yuqori bo'sh tasma markazida (tashqi fonga tegmaydi)
        y_bottom = sheet.height_pt - zones.top / 2.0 - bar_h / 2.0

        # Yuqori markaziy privodka kresti bilan ustma-ust tushmasligi uchun
        # markazda kamida 24 mm (har tarafga 12 mm) toza xavfsizlik oraliq qoldiriladi.
        cx = sheet.width_pt / 2.0
        mid = (len(blocks) + 1) // 2
        left_blocks = blocks[:mid]
        right_blocks = blocks[mid:]

        canv.setStrokeColor(REG_COLOR)
        canv.setLineWidth(0.2)

        # Chap qanot (markaziy krestdan chapda)
        curr_x = cx - COLOR_BAR_CENTER_GAP - len(left_blocks) * sq_w
        for fill_c in left_blocks:
            canv.setFillColor(fill_c)
            canv.rect(curr_x, y_bottom, sq_w, bar_h, fill=1, stroke=1)
            curr_x += sq_w

        # O'ng qanot (markaziy krestdan o'ngda)
        curr_x = cx + COLOR_BAR_CENTER_GAP
        for fill_c in right_blocks:
            canv.setFillColor(fill_c)
            canv.rect(curr_x, y_bottom, sq_w, bar_h, fill=1, stroke=1)
            curr_x += sq_w

        canv.restoreState()

    @staticmethod
    def _color_tags_width(colors: List[ColorChannel], font_name: str, font_size: float) -> float:
        return sum(stringWidth(f" {c.name}  ", font_name, font_size) for c in colors or [])

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
                pad = font_size * 0.2
                canv.rect(curr_x, -pad, w_tag, font_size + pad, fill=1, stroke=0)
                canv.restoreState()

            canv.setFillColor(txt_color)
            tag_str = f" {c_name}  "
            canv.drawString(curr_x, 0, tag_str)
            curr_x += canv.stringWidth(tag_str, font_name, font_size)
        return curr_x

    @staticmethod
    def _fit_text(canv: canvas.Canvas, text: str, max_w: float, font_name: str, font_size: float) -> str:
        """Matnni max_w ga sig'guncha oxiridan qisqartirish."""
        if canv.stringWidth(text, font_name, font_size) <= max_w:
            return text
        while len(text) > 4 and canv.stringWidth(text + "...", font_name, font_size) > max_w:
            text = text[:-1]
        return text.rstrip() + "..." if len(text) > 4 else ""

    @staticmethod
    def _draw_info_line(
        canv: canvas.Canvas,
        text: str,
        colors: Optional[List[ColorChannel]],
        font_size: float,
        max_w: float,
    ):
        """Joriy koordinatada (0, 0) dan bitta pasport qatori: matn + ixtiyoriy rang teglari."""
        canv.setFont(INFO_FONT, font_size)
        tags_w = MarksGenerator._color_tags_width(colors, INFO_FONT, font_size) if colors else 0.0
        text = MarksGenerator._fit_text(canv, text, max(0.0, max_w - tags_w), INFO_FONT, font_size)
        # Pasport har bir qolipda o'qilishi uchun Registration rangida
        canv.setFillColor(REG_COLOR)
        canv.drawString(0, 0, text)
        if colors and tags_w <= max_w:
            MarksGenerator._draw_color_tags(canv, canv.stringWidth(text, INFO_FONT, font_size), colors, INFO_FONT, font_size)

    @staticmethod
    def _draw_sheet_metadata(
        canv: canvas.Canvas,
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        zones: FreeZones,
        job: JobMetadata,
        style: TemplateStyle,
        is_dieline: bool,
        color_bar_span: Optional[Tuple[float, float]] = None,
    ):
        """
        Yon hoshiyalarga pasport yozuvlarini chiqarish.
        MUHIM POLIGRAFIK QOIDA:
        Yon privodka krestlari (Registration Marks) y = h / 2.0 nuqtada joylashgan.
        Krestlar va matnlar ustma-ust tushmasligi uchun krest atrofida +/- 15 mm daxlsiz
        toza zona ajratiladi. Matnlar esa krestdan PASTKI (Zone 1) va YUQORI (Zone 2)
        hududlarga ajratib joylashtiriladi.

        Yon tasma (list cheti -> tashqi fon) yozuvga tor bo'lsa, shrift kichraytiriladi;
        undan ham tor bo'lsa, o'sha tomonning yozuvlari yuqori tasmaga gorizontal ko'chiriladi
        (fon yoki mahsulot ustiga hech qachon chiqmaydi).
        """
        canv.saveState()

        side_title = "Pichoq (Die-cut)" if is_dieline else job.side_name

        w = sheet.width_pt
        h = sheet.height_pt
        reg_y = h / 2.0
        reg_buffer = 15.0 * MM_TO_PT  # Privodka kresti atrofidagi daxlsiz zona (+/- 15 mm)

        # 1-zona: Pastki hudud (klapan/gripper belgilaridan tepada, krestdan kamida 15 mm pastda)
        y_zone1_start = max(18.0 * MM_TO_PT, sheet.margin_bottom_mm * MM_TO_PT + 5.0 * MM_TO_PT)
        y_zone1_max = reg_y - reg_buffer
        available_zone1 = y_zone1_max - y_zone1_start

        # 2-zona: Yuqori hudud (krestdan kamida 15 mm tepada boshlanadi)
        y_zone2_start = reg_y + reg_buffer
        available_zone2 = (h - zones.top) - y_zone2_start

        safe_job_name = job.job_name
        if len(safe_job_name) > 36:
            safe_job_name = safe_job_name[:33] + "..."

        # Har bir tomon uchun: (pastki qator matni, yuqori qator matni, yuqori qatorga rang teglari)
        if style in (TemplateStyle.COMPACT_SIDE_INFO, TemplateStyle.DIGITAL_COMPACT):
            # 2-rasm uslubi (Compact / Digital): faqat chap hoshiya
            notes_suffix = f"    [{job.custom_notes}]" if job.custom_notes else ""
            left = (
                # Muhim ma'lumotlar boshida: joy yetmasa, oxiri (fayl nomi, izoh) qisqartiriladi
                (
                    f"Forma: {job.sheet_form_str}    "
                    f"Buyurtma soni: {job.order_quantity:,} dona    "
                    f"Bosilishi kerak: {job.calculated_sheets:,} list    "
                    f"Fayl: {safe_job_name}"
                    f"{notes_suffix}"
                ).replace(",", " "),
                f"Sana: {job.date_str}    Sahifa: {side_title}    Rang: ",
            )
            right = None
        else:
            # 3-rasm uslubi (Packaging) & Standard: chapda ish nomi + ranglar, o'ngda o'lchamlar
            # Muhim ma'lumotlar boshida: joy yetmasa, oxiri (ish nomi, izoh) qisqartiriladi
            notes_str = f" ({job.custom_notes})" if job.custom_notes else ""
            left = (
                f"Sahifa: {side_title}    "
                f"List: {job.calculated_sheets:,}    ".replace(",", " ")
                + f"Ish nomi: {safe_job_name}{notes_str}",
                "Rang: ",
            )
            right = (
                f"Qog'oz o'lchami: {sheet.width_mm:.0f}x{sheet.height_mm:.0f} mm    "
                f"Mahsulot o'lchami: {bg_config.trim_width_mm:.0f}x{bg_config.trim_height_mm:.0f} mm",
                f"Fon (Bleed): {bg_config.bleed_mm:.1f} mm    "
                f"Oraliq (Gutter): {bg_config.gutter_x_mm:.1f}x{bg_config.gutter_y_mm:.1f} mm",
            )

        def band_baseline(band_start: float, band: float, size: float) -> float:
            """Burilgan (90°) matn bazaviy chizig'i: harflar -x tomonga (ascent), +x ga (descent) chiqadi."""
            lo = band_start + EDGE_SAFE_PT if band_start == 0 else band_start + BLEED_SAFE_PT
            hi = band_start + band - (BLEED_SAFE_PT if band_start == 0 else EDGE_SAFE_PT)
            center = (lo + hi) / 2.0
            return center + (INFO_ASCENT - INFO_DESCENT) * size / 2.0

        def draw_vertical(x_base: float, size: float, lines: Tuple[str, str], with_colors: bool):
            for y0, text, avail, colors in (
                (y_zone1_start, lines[0], available_zone1, None),
                (y_zone2_start, lines[1], available_zone2, job.colors if with_colors else None),
            ):
                if avail <= 0:
                    continue
                canv.saveState()
                canv.translate(x_base, y0)
                canv.rotate(90)
                MarksGenerator._draw_info_line(canv, text, colors, size, avail - 5.0)
                canv.restoreState()

        fallback_top: List[Tuple[str, Tuple[str, str], bool]] = []

        for side, lines, band, band_start in (
            ("left", left, zones.left, 0.0),
            ("right", right, zones.right, w - zones.right),
        ):
            if lines is None:
                continue
            with_colors = side == "left"
            size = _fit_font_size(band)
            if size is not None:
                draw_vertical(band_baseline(band_start, band, size), size, lines, with_colors)
            else:
                fallback_top.append((side, lines, with_colors))

        # Yon tasma tor: yozuvlar yuqori tasmaga gorizontal (rang shkalasi va markaziy krestdan chetda)
        if fallback_top:
            top_size = _fit_font_size(zones.top)
            if top_size is not None:
                # Gorizontal matn: harflar +y ga (ascent), -y ga (descent) chiqadi
                lo = h - zones.top + BLEED_SAFE_PT
                hi = h - EDGE_SAFE_PT
                baseline = (lo + hi) / 2.0 - (INFO_ASCENT - INFO_DESCENT) * top_size / 2.0
                gap = 3.0 * MM_TO_PT
                if color_bar_span:
                    mid_x0, mid_x1 = color_bar_span
                else:
                    mid_x0, mid_x1 = w / 2.0 - COLOR_BAR_CENTER_GAP, w / 2.0 + COLOR_BAR_CENTER_GAP
                edge_x = max(gap, EDGE_SAFE_PT)

                for side, lines, with_colors in fallback_top:
                    text = f"{lines[0]}    {lines[1]}"
                    colors = job.colors if with_colors else None
                    if side == "left":
                        x0, max_w = edge_x, mid_x0 - gap - edge_x
                    else:
                        x0, max_w = mid_x1 + gap, (w - edge_x) - (mid_x1 + gap)
                    if max_w <= 0:
                        continue
                    canv.saveState()
                    canv.translate(x0, baseline)
                    MarksGenerator._draw_info_line(canv, text, colors, top_size, max_w)
                    canv.restoreState()

        canv.restoreState()

    @staticmethod
    def _draw_gripper_marks(
        canv: canvas.Canvas,
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        zones: FreeZones,
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
        # Pastki privodka kresti bilan bir chiziqda (pastki bo'sh tasma markazi)
        cy = zones.bottom / 2.0
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

        if zones.bottom >= tri_h + 2 * BLEED_SAFE_PT:
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
        arm_len = min(6.0 * MM_TO_PT, zones.bottom - BLEED_SAFE_PT - by)

        if arm_len >= 2.0 * MM_TO_PT:
            # 90 gradus burchak chizig'i
            canv.setLineWidth(0.6)
            canv.line(bx, by, bx + arm_len, by)
            canv.line(bx, by, bx, by + arm_len)
            canv.setLineWidth(0.35)

            canv.setFont(font_name, 5.0)
            canv.drawString(bx + 2.0, by + 2.0, "VERNY UGOL")

        # 3. Klapan balandligini ko'rsatuvchi chekka shtrixlar (Left & Right Ticks)
        # Shtrix va yozuv yon bo'sh tasmadan (tashqi fongacha) chiqmaydi
        tick_label = f"{sheet.margin_bottom_mm:.0f}mm"
        label_w = stringWidth(tick_label, "Helvetica", 4.5)
        canv.setFont("Helvetica", 4.5)
        for band, at_left in ((zones.left, True), (zones.right, False)):
            tick_len = min(3.5 * MM_TO_PT, band - BLEED_SAFE_PT)
            if tick_len < 1.0 * MM_TO_PT:
                continue
            if at_left:
                canv.line(0, klapan_pt, tick_len, klapan_pt)
            else:
                canv.line(w, klapan_pt, w - tick_len, klapan_pt)
            if tick_len + 1.5 + label_w <= band - BLEED_SAFE_PT:
                if at_left:
                    canv.drawString(tick_len + 1.5, klapan_pt - 1.5, tick_label)
                else:
                    canv.drawRightString(w - tick_len - 1.5, klapan_pt - 1.5, tick_label)

        canv.restoreState()
