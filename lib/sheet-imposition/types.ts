/** Mirrors doc-service/app/schemas/sheet_imposition.py */

export type SheetImpositionMode = "single_sided" | "sheetwise" | "work_and_turn";
export type GangingStrategy = "smart_no_split" | "max_economy_split" | "single_form" | "manual";
export type FillDirection = "col" | "row";
export type SheetAlignment = "center" | "gripper";
export type TemplateStyle = "standard" | "compact" | "packaging" | "offset_standard" | "digital_compact";
export type JobCategory = "guillotine" | "diecut";
export type CutStyle = "single" | "double";

export interface SheetParams {
  width_mm: number;
  height_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
  margin_top_mm: number;
  margin_bottom_mm: number;
}

export interface BleedParams {
  trim_width_mm: number;
  trim_height_mm: number;
  bleed_mm: number;
  inner_bleed_mm: number;
  outer_bleed_mm: number;
  gutter_x_mm: number;
  gutter_y_mm: number;
  crop_length_mm: number;
  crop_gap_mm: number;
  auto_extend_bleed: boolean;
  alignment: SheetAlignment;
}

export interface ManualGrid {
  cols: number;
  rows: number;
  rotation: 0 | 90;
}

export interface VariantInput {
  name: string;
  quantity: number;
  manual_slots?: number | null;
  sku_id?: string | null;
}

export interface LayoutParams {
  sheet: SheetParams;
  bleed: BleedParams;
  mode: SheetImpositionMode;
  strategy: GangingStrategy;
  max_overprint_pct: number;
  fill_direction: FillDirection;
  waste_sheets: number;
  allow_rotation: boolean;
  /** Fixed orientation for the automatic grid; null = best of 0°/90° */
  rotation?: 0 | 90 | null;
  manual_grid?: ManualGrid | null;
}

export interface CalculateRequest extends LayoutParams {
  variants: VariantInput[];
}

export interface SlotAllocation {
  variant_index: number;
  variant_name: string;
  slots: number;
  target_qty: number;
  produced_qty: number;
  overprint_qty: number;
  overprint_pct: number;
}

export interface PlacedCell {
  col: number;
  row: number;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rotation: number;
  variant_index: number;
  variant_name: string;
}

export interface FormPlan {
  form_index: number;
  total_forms: number;
  sheet_run: number;
  total_sheets_with_waste: number;
  used_slots: number;
  total_produced_qty: number;
  total_overprint_qty: number;
  allocations: SlotAllocation[];
  front_cells: PlacedCell[];
  back_cells: PlacedCell[];
}

export interface CalculateResponse {
  cols: number;
  rows: number;
  rotation: number;
  items_per_sheet: number;
  item_w_mm: number;
  item_h_mm: number;
  block_w_mm: number;
  block_h_mm: number;
  utilization_pct: number;
  total_order_qty: number;
  total_sheets: number;
  forms: FormPlan[];
}

export interface ManifestItem {
  name: string;
  sku_id?: string | null;
  quantity: number;
  front_file: number;
  front_page?: number;
  back_file?: number | null;
  back_page?: number | null;
}

export interface AnalyzedVariant {
  variant_index: number;
  name: string;
  sku_id?: string | null;
  quantity: number;
  front_file_name: string;
  front_page: number;
  back_file_name?: string | null;
  back_page?: number | null;
  thumbnail_url?: string | null;
}

export interface PreflightIssue {
  severity: "INFO" | "WARNING" | "ERROR" | string;
  category: string;
  message: string;
  details: string;
  page_num: number;
}

export interface ColorChannel {
  name: string;
  is_spot: boolean;
  cmyk: [number, number, number, number];
}

export interface PreflightReport {
  is_valid: boolean;
  page_count: number;
  error_count: number;
  warning_count: number;
  issues: PreflightIssue[];
  colors: ColorChannel[];
  fonts: string[];
  unembedded_fonts: string[];
  has_rgb: boolean;
  has_low_dpi: boolean;
  min_image_dpi?: number | null;
  detected_bleed_mm: number;
  trim_box_mm: [number, number];
  media_box_mm: [number, number];
}

export interface DielineTrim {
  trim_w_mm: number;
  trim_h_mm: number;
  page_w_mm: number;
  page_h_mm: number;
}

export interface AnalyzeResponse {
  job_id: string;
  variants: AnalyzedVariant[];
  preflight: PreflightReport;
  dieline?: DielineTrim | null;
}

export interface JobInfo {
  order_number: string;
  job_name: string;
  date_str?: string | null;
  custom_notes: string;
  category: JobCategory;
  cut_style: CutStyle;
  style: TemplateStyle;
  colors?: ColorChannel[] | null;
}

export interface GenerateRequest extends LayoutParams {
  variants?: VariantInput[] | null;
  job: JobInfo;
  export_separate_files: boolean;
  include_proof_overlay: boolean;
}

export interface OutputFile {
  filename: string;
  label: string;
  url: string;
  size_bytes: number;
}

export interface PagePreview {
  page_index: number;
  label: string;
  url: string;
  width_mm: number;
  height_mm: number;
}

export interface GenerateResponse {
  job_id: string;
  files: OutputFile[];
  pages: PagePreview[];
  cols: number;
  rows: number;
  rotation: number;
  items_per_sheet: number;
  calculated_sheets: number;
  has_back: boolean;
  has_dieline: boolean;
  forms: FormPlan[];
  generation_time_ms: number;
}
