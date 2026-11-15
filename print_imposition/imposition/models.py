"""
Poligrafiya Montaj va Preflight - Asosiy Ma'lumot Modellari
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple, Dict, Any


class ImpositionMode(str, Enum):
    SINGLE_SIDED = "single_sided"          # Faqat Oldi tomon
    SHEETWISE = "sheetwise"                # Oldi va Orqa alohida sahifalarda (klapan o'zgarmaydi, orqa o'ngdan chapga)
    WORK_AND_TURN = "work_and_turn"        # Svoj (bitta listda oldi va orqa, yon klapan bo'yicha aylanadi)
    WORK_AND_TUMBLE = "work_and_tumble"    # Bosh-oyoq aylanish (klapan o'zgaradi)


class JobCategory(str, Enum):
    GUILLOTINE = "guillotine"              # Oddiy kesim (Giloton - vizitka, flayer, blank, plakat)
    DIE_CUT = "diecut"                     # Pichoqli ish (Qolip / Shtants / Packaging)


class GuillotineCutStyle(str, Enum):
    SINGLE_CUT = "single"                  # 1 ta pichoq bilan (0 mm oraliq / flush cut, oq fon va blanklar)
    DOUBLE_CUT = "double"                  # 2 ta pichoq bilan (2-4 mm chiqindi tasma, rangli fon va vizitka/flayer)


class SheetAlignment(str, Enum):
    CENTER = "center"                      # Varaq markazida (avtomatik simmetrik sentr)
    GRIPPER = "gripper"                    # Mashina klapani bo'yicha (pastda 12-15 mm klapan margin)


class TemplateStyle(str, Enum):
    STANDARD_COLORBAR = "standard"         # Keng CMYK/Spot rang shkalasi, krestlar, burchak kroplar
    COMPACT_SIDE_INFO = "compact"          # 0 mm oraliq, yakka kroplar, chapda vertikal to'liq pasport va ranglar
    PACKAGING_DIE_CUT = "packaging"        # Qo'shaloq kroplar, chapda ish/rang, o'ngda o'lcham/zahira, alohida pichoq
    OFFSET_STANDARD = "offset_standard"    # Gilotin Ofset: CMYK shkala, 4 ta krest, gilotin pasporti
    DIGITAL_COMPACT = "digital_compact"    # Gilotin Raqamli: Shkalasiz ixcham uslub, faqat krop va qisqa pasport


class GridFillDirection(str, Enum):
    COL_BY_COL = "col"                     # Ustun bo'yicha (yuqoridan pastga — tasma qilib kesish va taxlash oson)
    ROW_BY_ROW = "row"                     # Qator bo'yicha (chapdan o'ngga)


class GangingStrategy(str, Enum):
    SMART_NO_SPLIT = "smart_no_split"      # Har bir tur faqat 1 ta formada (Kratnost 1x, 2x, 3x + Klasterlash)
    MAX_ECONOMY_SPLIT = "max_economy_split"# Turni formalar orasida bo'lishga ruxsat (minimal list va 0% chiqindi)
    SINGLE_FORM_PROPORTIONAL = "single_form" # Barcha turlarni 1 ta formaga proporsional joylashtirish
    MANUAL_SLOTS = "manual"                # Foydalanuvchi qo'lda bergan katak sonlari bo'yicha


class BackSideMode(str, Enum):
    NONE = "none"                          # Faqat Oldi
    SHARED = "shared"                      # Barcha turlar uchun bitta umumiy Orqa PDF
    PER_VARIANT_ALTERNATING = "alternating"# Ko'p betli PDF da: 1-Oldi, 2-Orqa, 3-Oldi, 4-Orqa...
    PER_VARIANT_SEPARATE = "separate"      # Har bir tur uchun alohida Orqa PDF/sahifa


@dataclass
class DesignVariant:
    variant_id: int
    name: str                              # Masalan: 'S', 'M', 'L', 'XL' yoki 'Vizitka_1'
    front_pdf_path: str
    front_page_num: int = 0                # 0-indeksli sahifa raqami
    back_pdf_path: Optional[str] = None
    back_page_num: Optional[int] = None
    order_quantity: int = 1000             # Shu tur bo'yicha buyurtma soni (dona)
    assigned_slots: int = 0                # Qo'lda berilgan katak soni (0 = avto hisoblash)
    manual_slots: bool = False             # Qo'lda o'zgartirilganmi?


@dataclass
class FormSlotAllocation:
    variant: DesignVariant
    variant_index: int                     # variants ro'yxatidagi indeksi
    slots: int                             # Shu formada nechta katak oladi
    target_qty: int                        # Shu formadan olinishi kerak bo'lgan adad
    produced_qty: int                      # slots * sheet_run
    overprint_qty: int                     # produced_qty - target_qty

    @property
    def overprint_pct(self) -> float:
        if self.target_qty <= 0:
            return 0.0
        return (self.overprint_qty / self.target_qty) * 100.0


@dataclass
class FormPlan:
    form_index: int                        # 1, 2, ...
    total_forms: int                       # Jami formalar soni
    sheet_run: int                         # Shu forma necha toza list bosiladi
    total_sheets_with_waste: int           # sheet_run + waste_sheets
    allocations: List[FormSlotAllocation] = field(default_factory=list)

    @property
    def used_slots(self) -> int:
        return sum(a.slots for a in self.allocations)

    @property
    def total_produced_qty(self) -> int:
        return sum(a.produced_qty for a in self.allocations)

    @property
    def total_overprint_qty(self) -> int:
        return sum(max(0, a.overprint_qty) for a in self.allocations)

    def summary_str(self) -> str:
        parts = [f"{a.variant.name}({a.slots})" for a in self.allocations if a.slots > 0]
        return ", ".join(parts)


@dataclass
class SheetConfig:
    width_mm: float = 500.0
    height_mm: float = 350.0
    margin_left_mm: float = 12.0
    margin_right_mm: float = 12.0
    margin_top_mm: float = 12.0
    margin_bottom_mm: float = 15.0         # Klapan (gripper margin) odatda pastda yoki yon tomonda

    @property
    def width_pt(self) -> float:
        return self.width_mm * 72.0 / 25.4

    @property
    def height_pt(self) -> float:
        return self.height_mm * 72.0 / 25.4


@dataclass
class BleedAndGutterConfig:
    trim_width_mm: float = 100.0           # Mahsulotning toza kesim o'lchami
    trim_height_mm: float = 75.0
    bleed_mm: float = 1.5                  # Standart ichki kesish zahirasi
    inner_bleed_mm: float = 1.5            # Ichki chegaralardagi fon (qo'shnilar orasida 1.5 + 1.5 = 3.0 mm)
    outer_bleed_mm: float = 3.0            # Montaj blokining tashqi 4 tarafidagi fon (3 mm)
    gutter_x_mm: float = 3.0               # Oraliq masofa (X o'qi): 3.0 mm
    gutter_y_mm: float = 3.0               # Oraliq masofa (Y o'qi): 3.0 mm
    auto_extend_bleed: bool = True         # Bleed yetishmasa avtomatik cho'zish
    crop_length_mm: float = 4.0            # Krop chiziqlari uzunligi
    crop_gap_mm: float = 1.0               # Krop chizig'ining tashqi fondan narida boshlanish bo'shlig'i
    crop_offset_mm: Optional[float] = None # Ixtiyoriy to'g'ridan-to'g'ri offset
    alignment: SheetAlignment = SheetAlignment.CENTER # Varaqda joylashuv (Markaz yoki Klapan)

    @property
    def trim_width_pt(self) -> float:
        return self.trim_width_mm * 72.0 / 25.4

    @property
    def trim_height_pt(self) -> float:
        return self.trim_height_mm * 72.0 / 25.4

    @property
    def bleed_pt(self) -> float:
        return self.bleed_mm * 72.0 / 25.4

    @property
    def inner_bleed_pt(self) -> float:
        return self.inner_bleed_mm * 72.0 / 25.4

    @property
    def outer_bleed_pt(self) -> float:
        return self.outer_bleed_mm * 72.0 / 25.4

    @property
    def gutter_x_pt(self) -> float:
        return self.gutter_x_mm * 72.0 / 25.4

    @property
    def gutter_y_pt(self) -> float:
        return self.gutter_y_mm * 72.0 / 25.4

    @property
    def crop_offset_pt(self) -> float:
        if self.crop_offset_mm is not None:
            return self.crop_offset_mm * 72.0 / 25.4
        return (self.outer_bleed_mm + self.crop_gap_mm) * 72.0 / 25.4


@dataclass
class ColorChannel:
    name: str                              # Masalan 'Cyan', 'Magenta', 'Yellow', 'Black', 'PANTONE 1655 C'
    is_spot: bool = False                  # Spot/Pantone rangi
    cmyk: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 1.0) # Ekvivalent CMYK (0.0 .. 1.0)
    density: float = 1.0


@dataclass
class JobMetadata:
    order_number: str = "№1001"
    job_name: str = "Montaj_Buyurtma"
    date_str: str = "07.11.2025"
    order_quantity: int = 100000           # Buyurtma soni (dona)
    waste_sheets: int = 0                  # Priladka/brak uchun qo'shimcha listlar
    calculated_sheets: int = 0             # Bosilishi kerak bo'lgan listlar soni
    colors: List[ColorChannel] = field(default_factory=list)
    side_name: str = "Oldi"                # 'Oldi', 'Orqa', 'Pichoq'
    sheet_form_str: str = "50x35sm"
    custom_notes: str = ""
    category: JobCategory = JobCategory.GUILLOTINE # Oddiy Gilotin yoki Pichoqli
    cut_style: GuillotineCutStyle = GuillotineCutStyle.DOUBLE_CUT # 1 ta yoki 2 ta pichoq


@dataclass
class PlacedItem:
    col: int
    row: int
    # Sahifadagi toza kesim koordinatalari (pt)
    trim_x: float
    trim_y: float
    trim_w: float
    trim_h: float
    rotation: int = 0                      # 0, 90, 180, 270
    is_back_side: bool = False
    variant_index: int = 0                 # To'plamdagi dizayn indeksi (0..N-1)
    variant_name: str = ""                 # To'plamdagi dizayn nomi (masalan 'S', 'M', 'L')


@dataclass
class PreflightIssue:
    severity: str                          # 'INFO', 'WARNING', 'ERROR'
    category: str                          # 'DPI', 'COLOR', 'FONT', 'BLEED', 'HAIRLINE', 'OVERPRINT'
    message: str
    details: str = ""
    page_num: int = 1


@dataclass
class ImagePreflightInfo:
    xref: int
    page_num: int
    width_px: int
    height_px: int
    display_w_mm: float
    display_h_mm: float
    dpi_x: float
    dpi_y: float
    effective_dpi: float
    colorspace: str
    bpc: int


@dataclass
class PreflightReport:
    file_path: str
    page_count: int
    is_valid: bool = True
    issues: List[PreflightIssue] = field(default_factory=list)
    images: List[ImagePreflightInfo] = field(default_factory=list)
    colors: List[ColorChannel] = field(default_factory=list)
    fonts: List[str] = field(default_factory=list)
    unembedded_fonts: List[str] = field(default_factory=list)
    has_rgb: bool = False
    has_low_dpi: bool = False
    detected_bleed_mm: float = 0.0
    trim_box_mm: Tuple[float, float] = (0.0, 0.0)
    media_box_mm: Tuple[float, float] = (0.0, 0.0)

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "WARNING")

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "ERROR")
