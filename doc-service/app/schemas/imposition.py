"""
Pydantic schemas for the Flexo Label Imposition endpoints.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class GearItemSchema(BaseModel):
    gear: int
    pitch_diameter: float
    plate_thickness: float
    cylinder_diameter: float
    film_length: float
    printing_length: float
    available: bool


class DetectedColorSchema(BaseModel):
    color_id: int
    name: str
    rgb: List[float]
    hex_code: str
    object_count: int = 1


class DesignAnalysisSchema(BaseModel):
    item_key: str
    display_name: str
    output_stem: str
    page_index: int
    sub_index: int
    total_sub_designs: int
    width_mm: float
    length_mm: float
    has_outer_border: bool
    border_stroke_width_pt: float
    vector_paths_count: int
    text_blocks_count: int
    suggested_gear: int
    suggested_copies: int
    printing_length_mm: float
    film_length_mm: float
    slot_printing_length_mm: float
    slot_film_length_mm: float
    per_copy_diff_mm: float
    total_diff_mm: float
    compression_ratio: float
    colors: List[DetectedColorSchema]
    source_preview_url: str
    source_pdf_url: Optional[str] = None
    source_pdf_filename: Optional[str] = None


class AnalyzeResponse(BaseModel):
    job_id: str
    filename: str
    design_count: int
    designs: List[DesignAnalysisSchema]


class DesignOverrideSchema(BaseModel):
    item_key: str
    custom_gear: Optional[int] = None
    custom_copies: Optional[int] = None


class GenerateRequest(BaseModel):
    remove_outer_border: bool = True
    separate_colors: bool = True
    color_output_mode: str = "side_by_side"  # "side_by_side" or "separate_files"
    combine_same_gear: bool = False
    column_gap_mm: float = 5.0
    max_cylinder_width_mm: float = 0.0
    regmark_enabled: bool = True
    regmark_stroke_mm: float = 0.2
    regmark_tick_mm: float = 0.7
    regmark_custom_width_mm: Optional[float] = None
    overrides: Optional[List[DesignOverrideSchema]] = None


class OutputFileSchema(BaseModel):
    filename: str
    file_type: str  # "pdf", "svg", "eps", "png"
    size_bytes: int
    download_url: str
    preview_url: Optional[str] = None


class AuditReportSchema(BaseModel):
    passed: bool
    is_pure_grayscale_black: bool
    non_black_drawings_count: int = 0
    non_black_text_spans_count: int = 0
    details: List[str] = []


class GenerateResultItemSchema(BaseModel):
    design_key: str
    display_name: str
    gear: int
    copies: int
    printing_length_mm: float
    film_length_mm: float
    colors: List[str]
    output_files: List[OutputFileSchema]
    audit: Optional[AuditReportSchema] = None


class GenerateResponse(BaseModel):
    job_id: str
    items: List[GenerateResultItemSchema]
    all_files: List[OutputFileSchema]
    created_at: float
