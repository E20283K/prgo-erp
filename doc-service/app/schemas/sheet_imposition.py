"""
Pydantic schemas for the sheet-fed (offset/digital) imposition endpoints.
Enum string values mirror app.sheet_imposition.models exactly.
"""

from __future__ import annotations

from typing import List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

ModeLiteral = Literal["single_sided", "sheetwise", "work_and_turn"]
StrategyLiteral = Literal["smart_no_split", "max_economy_split", "single_form", "manual"]
FillLiteral = Literal["col", "row"]
AlignmentLiteral = Literal["center", "gripper"]
StyleLiteral = Literal["standard", "compact", "packaging", "offset_standard", "digital_compact"]
CategoryLiteral = Literal["guillotine", "diecut"]
CutStyleLiteral = Literal["single", "double"]


# ---------------------------------------------------------------------------
# Shared layout parameters
# ---------------------------------------------------------------------------


class SheetSchema(BaseModel):
    width_mm: float = Field(500.0, gt=0)
    height_mm: float = Field(350.0, gt=0)
    margin_left_mm: float = Field(12.0, ge=0)
    margin_right_mm: float = Field(12.0, ge=0)
    margin_top_mm: float = Field(12.0, ge=0)
    margin_bottom_mm: float = Field(15.0, ge=0)


class BleedSchema(BaseModel):
    trim_width_mm: float = Field(100.0, gt=0)
    trim_height_mm: float = Field(75.0, gt=0)
    bleed_mm: float = Field(1.5, ge=0)
    inner_bleed_mm: float = Field(1.5, ge=0)
    outer_bleed_mm: float = Field(3.0, ge=0)
    gutter_x_mm: float = Field(3.0, ge=0)
    gutter_y_mm: float = Field(3.0, ge=0)
    crop_length_mm: float = Field(4.0, ge=0)
    crop_gap_mm: float = Field(1.0, ge=0)
    auto_extend_bleed: bool = True
    alignment: AlignmentLiteral = "center"


class ManualGridSchema(BaseModel):
    cols: int = Field(..., ge=1)
    rows: int = Field(..., ge=1)
    rotation: Literal[0, 90] = 0


class VariantInputSchema(BaseModel):
    name: str
    quantity: int = Field(1000, ge=1)
    manual_slots: Optional[int] = Field(None, ge=1)
    sku_id: Optional[str] = None


class LayoutParamsSchema(BaseModel):
    sheet: SheetSchema = SheetSchema()
    bleed: BleedSchema = BleedSchema()
    mode: ModeLiteral = "single_sided"
    strategy: StrategyLiteral = "smart_no_split"
    max_overprint_pct: float = Field(10.0, ge=0)
    fill_direction: FillLiteral = "col"
    waste_sheets: int = Field(0, ge=0)
    allow_rotation: bool = True
    # Fixed orientation for the automatic grid (None = best of 0°/90° when allow_rotation)
    rotation: Optional[Literal[0, 90]] = None
    manual_grid: Optional[ManualGridSchema] = None


class CalculateRequest(LayoutParamsSchema):
    variants: List[VariantInputSchema] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


class SlotAllocationSchema(BaseModel):
    variant_index: int
    variant_name: str
    slots: int
    target_qty: int
    produced_qty: int
    overprint_qty: int
    overprint_pct: float


class PlacedCellSchema(BaseModel):
    col: int
    row: int
    x_mm: float
    y_mm: float
    w_mm: float
    h_mm: float
    rotation: int
    variant_index: int
    variant_name: str


class FormPlanSchema(BaseModel):
    form_index: int
    total_forms: int
    sheet_run: int
    total_sheets_with_waste: int
    used_slots: int
    total_produced_qty: int
    total_overprint_qty: int
    allocations: List[SlotAllocationSchema]
    front_cells: List[PlacedCellSchema] = []
    back_cells: List[PlacedCellSchema] = []


class CalculateResponse(BaseModel):
    cols: int
    rows: int
    rotation: int
    items_per_sheet: int
    item_w_mm: float
    item_h_mm: float
    block_w_mm: float
    block_h_mm: float
    utilization_pct: float
    total_order_qty: int
    total_sheets: int
    forms: List[FormPlanSchema]


# ---------------------------------------------------------------------------
# Analyze (upload + preflight)
# ---------------------------------------------------------------------------


class ManifestItemSchema(BaseModel):
    """One design variant; *_file are indexes into the uploaded `files` list."""

    name: str
    sku_id: Optional[str] = None
    quantity: int = Field(1000, ge=1)
    front_file: int = Field(..., ge=0)
    front_page: int = Field(0, ge=0)
    back_file: Optional[int] = Field(None, ge=0)
    back_page: Optional[int] = Field(None, ge=0)


class AnalyzedVariantSchema(BaseModel):
    variant_index: int
    name: str
    sku_id: Optional[str] = None
    quantity: int
    front_file_name: str
    front_page: int
    back_file_name: Optional[str] = None
    back_page: Optional[int] = None
    thumbnail_url: Optional[str] = None


class PreflightIssueSchema(BaseModel):
    severity: str
    category: str
    message: str
    details: str = ""
    page_num: int = 1


class ColorChannelSchema(BaseModel):
    name: str
    is_spot: bool = False
    cmyk: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 1.0)


class PreflightReportSchema(BaseModel):
    is_valid: bool
    page_count: int
    error_count: int
    warning_count: int
    issues: List[PreflightIssueSchema]
    colors: List[ColorChannelSchema]
    fonts: List[str]
    unembedded_fonts: List[str]
    has_rgb: bool
    has_low_dpi: bool
    min_image_dpi: Optional[float] = None
    detected_bleed_mm: float
    trim_box_mm: Tuple[float, float]
    media_box_mm: Tuple[float, float]


class DielineTrimSchema(BaseModel):
    trim_w_mm: float
    trim_h_mm: float
    page_w_mm: float
    page_h_mm: float


class AnalyzeResponse(BaseModel):
    job_id: str
    variants: List[AnalyzedVariantSchema]
    preflight: PreflightReportSchema
    dieline: Optional[DielineTrimSchema] = None


# ---------------------------------------------------------------------------
# Generate (PDF imposition)
# ---------------------------------------------------------------------------


class JobInfoSchema(BaseModel):
    order_number: str = ""
    job_name: str = ""
    date_str: Optional[str] = None
    custom_notes: str = ""
    category: CategoryLiteral = "guillotine"
    cut_style: CutStyleLiteral = "double"
    style: StyleLiteral = "offset_standard"
    colors: Optional[List[ColorChannelSchema]] = None


class GenerateRequest(LayoutParamsSchema):
    # Quantities / manual slots override what was uploaded at analyze time (matched by index).
    variants: Optional[List[VariantInputSchema]] = None
    job: JobInfoSchema = JobInfoSchema()
    export_separate_files: bool = True
    include_proof_overlay: bool = True


class OutputFileSchema(BaseModel):
    filename: str
    label: str
    url: str
    size_bytes: int


class PagePreviewSchema(BaseModel):
    page_index: int
    label: str
    url: str
    width_mm: float
    height_mm: float


class GenerateResponse(BaseModel):
    job_id: str
    files: List[OutputFileSchema]
    pages: List[PagePreviewSchema]
    cols: int
    rows: int
    rotation: int
    items_per_sheet: int
    calculated_sheets: int
    has_back: bool
    has_dieline: bool
    forms: List[FormPlanSchema]
    generation_time_ms: int
