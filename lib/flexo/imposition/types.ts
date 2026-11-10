export interface GearItem {
  gear: number;
  pitch_diameter: number;
  plate_thickness: number;
  cylinder_diameter: number;
  film_length: number;
  printing_length: number;
  available: boolean;
}

export interface DetectedColor {
  color_id: number;
  name: string;
  rgb: number[];
  hex_code: string;
  object_count: number;
}

export interface DesignAnalysis {
  item_key: string;
  display_name: string;
  output_stem: string;
  page_index: number;
  sub_index: number;
  total_sub_designs: number;
  width_mm: number;
  length_mm: number;
  has_outer_border: boolean;
  border_stroke_width_pt: number;
  vector_paths_count: number;
  text_blocks_count: number;
  suggested_gear: number;
  suggested_copies: number;
  printing_length_mm: number;
  film_length_mm: number;
  slot_printing_length_mm: number;
  slot_film_length_mm: number;
  per_copy_diff_mm: number;
  total_diff_mm: number;
  compression_ratio: number;
  colors: DetectedColor[];
  source_preview_url: string;
  source_pdf_url?: string;
  source_pdf_filename?: string;
}

export interface AnalyzeResponse {
  job_id: string;
  filename: string;
  design_count: number;
  designs: DesignAnalysis[];
}

export interface DesignOverride {
  item_key: string;
  custom_gear?: number | null;
  custom_copies?: number | null;
}

export interface GenerateRequest {
  remove_outer_border: boolean;
  separate_colors: boolean;
  color_output_mode: "side_by_side" | "separate_files";
  combine_same_gear: boolean;
  column_gap_mm: number;
  max_cylinder_width_mm: number;
  regmark_enabled: boolean;
  regmark_stroke_mm: number;
  regmark_tick_mm: number;
  regmark_custom_width_mm?: number | null;
  overrides?: DesignOverride[];
}

export interface OutputFile {
  filename: string;
  file_type: string;
  size_bytes: number;
  download_url: string;
  preview_url?: string | null;
}

export interface AuditReport {
  passed: boolean;
  is_pure_grayscale_black: boolean;
  non_black_drawings_count: number;
  non_black_text_spans_count: number;
  details: string[];
}

export interface GenerateResultItem {
  design_key: string;
  display_name: string;
  gear: number;
  copies: number;
  printing_length_mm: number;
  film_length_mm: number;
  colors: string[];
  output_files: OutputFile[];
  audit?: AuditReport | null;
}

export interface GenerateResponse {
  job_id: string;
  items: GenerateResultItem[];
  all_files: OutputFile[];
  created_at: number;
}
