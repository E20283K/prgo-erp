"""
FastAPI router for sheet-fed (offset / digital) imposition.

Wraps app.sheet_imposition (ported from the standalone print_imposition program):
- POST /sheet-imposition/calculate          : grid + ganged form plans + cell coordinates (no files)
- POST /sheet-imposition/analyze            : upload artwork PDFs, build variants, preflight, thumbnails
- POST /sheet-imposition/{job_id}/generate  : vector imposition PDF (+ separate sides) and page previews
- GET  /sheet-imposition/{job_id}/files/{f} : serve cached PDFs / PNGs
"""

from __future__ import annotations

import datetime
import json
import logging
import mimetypes
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pymupdf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.imposition_cache import DEFAULT_CACHE_DIR, ImpositionCache
from app.schemas.sheet_imposition import (
    AnalyzedVariantSchema,
    AnalyzeResponse,
    CalculateRequest,
    CalculateResponse,
    ColorChannelSchema,
    DielineTrimSchema,
    FormPlanSchema,
    GenerateRequest,
    GenerateResponse,
    LayoutParamsSchema,
    ManifestItemSchema,
    OutputFileSchema,
    PagePreviewSchema,
    PlacedCellSchema,
    PreflightIssueSchema,
    PreflightReportSchema,
    SlotAllocationSchema,
    VariantInputSchema,
)
from app.sheet_imposition.calculator import PT_TO_MM, LayoutCalculator
from app.sheet_imposition.engine import ImpositionEngine
from app.sheet_imposition.models import (
    BleedAndGutterConfig,
    ColorChannel,
    DesignVariant,
    FormPlan,
    GangingStrategy,
    GridFillDirection,
    GuillotineCutStyle,
    ImpositionMode,
    JobCategory,
    JobMetadata,
    PlacedItem,
    PreflightReport,
    SheetAlignment,
    SheetConfig,
    TemplateStyle,
)
from app.sheet_imposition.preflight import PreflightChecker

logger = logging.getLogger("sheet_imposition.router")

router = APIRouter(prefix="/sheet-imposition", tags=["Sheet Imposition"])

sheet_imposition_cache = ImpositionCache(base_dir=DEFAULT_CACHE_DIR.parent / "sheet_imposition")

PUBLIC_PREFIX = "/api/sheet-imposition"
OUTPUT_STEM = "montaj"
THUMB_DPI = 72
PREVIEW_DPI = 110
MAX_UPLOAD_BYTES = 100 * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers: request -> engine models
# ---------------------------------------------------------------------------


def _file_url(job_id: str, filename: str, version: Optional[int] = None) -> str:
    url = f"{PUBLIC_PREFIX}/{job_id}/files/{filename}"
    return f"{url}?v={version}" if version else url


def _sheet_config(p: LayoutParamsSchema) -> SheetConfig:
    s = p.sheet
    return SheetConfig(
        width_mm=s.width_mm,
        height_mm=s.height_mm,
        margin_left_mm=s.margin_left_mm,
        margin_right_mm=s.margin_right_mm,
        margin_top_mm=s.margin_top_mm,
        margin_bottom_mm=s.margin_bottom_mm,
    )


def _bleed_config(p: LayoutParamsSchema) -> BleedAndGutterConfig:
    b = p.bleed
    return BleedAndGutterConfig(
        trim_width_mm=b.trim_width_mm,
        trim_height_mm=b.trim_height_mm,
        bleed_mm=b.bleed_mm,
        inner_bleed_mm=b.inner_bleed_mm,
        outer_bleed_mm=b.outer_bleed_mm,
        gutter_x_mm=b.gutter_x_mm,
        gutter_y_mm=b.gutter_y_mm,
        auto_extend_bleed=b.auto_extend_bleed,
        crop_length_mm=b.crop_length_mm,
        crop_gap_mm=b.crop_gap_mm,
        alignment=SheetAlignment(b.alignment),
    )


def _resolve_grid(p: LayoutParamsSchema, sheet: SheetConfig, bg: BleedAndGutterConfig) -> Tuple[int, int, int]:
    if p.manual_grid:
        return p.manual_grid.cols, p.manual_grid.rows, p.manual_grid.rotation
    if p.rotation == 90:
        # Count the grid with the item turned, then let generate_layout rotate the artwork.
        turned = BleedAndGutterConfig(
            trim_width_mm=bg.trim_height_mm,
            trim_height_mm=bg.trim_width_mm,
            gutter_x_mm=bg.gutter_x_mm,
            gutter_y_mm=bg.gutter_y_mm,
        )
        grid = LayoutCalculator.calculate_optimal_grid(sheet, turned, allow_rotation=False)
        return grid["cols"], grid["rows"], 90
    allow = p.allow_rotation and p.rotation is None
    grid = LayoutCalculator.calculate_optimal_grid(sheet, bg, allow_rotation=allow)
    return grid["cols"], grid["rows"], grid["rotation"]


def _apply_variant_inputs(variants: List[DesignVariant], inputs: List[VariantInputSchema]) -> None:
    for v, inp in zip(variants, inputs):
        v.order_quantity = inp.quantity
        if inp.manual_slots:
            v.assigned_slots = inp.manual_slots
            v.manual_slots = True
        else:
            v.assigned_slots = 0
            v.manual_slots = False


def _variants_without_files(inputs: List[VariantInputSchema]) -> List[DesignVariant]:
    variants = [
        DesignVariant(variant_id=i + 1, name=inp.name or f"V{i + 1}", front_pdf_path="")
        for i, inp in enumerate(inputs)
    ]
    _apply_variant_inputs(variants, inputs)
    return variants


def _cell(item: PlacedItem) -> PlacedCellSchema:
    return PlacedCellSchema(
        col=item.col,
        row=item.row,
        x_mm=round(item.trim_x * PT_TO_MM, 3),
        y_mm=round(item.trim_y * PT_TO_MM, 3),
        w_mm=round(item.trim_w * PT_TO_MM, 3),
        h_mm=round(item.trim_h * PT_TO_MM, 3),
        rotation=item.rotation,
        variant_index=item.variant_index,
        variant_name=item.variant_name,
    )


def _form_schema(
    fp: FormPlan,
    p: LayoutParamsSchema,
    sheet: SheetConfig,
    bg: BleedAndGutterConfig,
    cols: int,
    rows: int,
    rotation: int,
    with_cells: bool,
) -> FormPlanSchema:
    front_cells: List[PlacedCellSchema] = []
    back_cells: List[PlacedCellSchema] = []
    if with_cells:
        front, back = LayoutCalculator.generate_layout(
            sheet=sheet,
            bg_config=bg,
            cols=cols,
            rows=rows,
            rotation=rotation,
            mode=ImpositionMode(p.mode),
            center_grid=True,
            fill_direction=GridFillDirection(p.fill_direction),
            form_plan=fp,
        )
        front_cells = [_cell(i) for i in front]
        back_cells = [_cell(i) for i in (back or [])]

    return FormPlanSchema(
        form_index=fp.form_index,
        total_forms=fp.total_forms,
        sheet_run=fp.sheet_run,
        total_sheets_with_waste=fp.total_sheets_with_waste,
        used_slots=fp.used_slots,
        total_produced_qty=fp.total_produced_qty,
        total_overprint_qty=fp.total_overprint_qty,
        allocations=[
            SlotAllocationSchema(
                variant_index=a.variant_index,
                variant_name=a.variant.name,
                slots=a.slots,
                target_qty=a.target_qty,
                produced_qty=a.produced_qty,
                overprint_qty=a.overprint_qty,
                overprint_pct=round(a.overprint_pct, 2),
            )
            for a in fp.allocations
        ],
        front_cells=front_cells,
        back_cells=back_cells,
    )


def _preflight_schema(report: PreflightReport) -> PreflightReportSchema:
    dpis = [img.effective_dpi for img in report.images if img.effective_dpi > 0]
    return PreflightReportSchema(
        is_valid=report.is_valid,
        page_count=report.page_count,
        error_count=report.error_count,
        warning_count=report.warning_count,
        issues=[
            PreflightIssueSchema(
                severity=i.severity,
                category=i.category,
                message=i.message,
                details=i.details,
                page_num=i.page_num,
            )
            for i in report.issues
        ],
        colors=[ColorChannelSchema(name=c.name, is_spot=c.is_spot, cmyk=tuple(c.cmyk)) for c in report.colors],
        fonts=sorted(set(report.fonts)),
        unembedded_fonts=sorted(set(report.unembedded_fonts)),
        has_rgb=report.has_rgb,
        has_low_dpi=report.has_low_dpi,
        min_image_dpi=round(min(dpis), 1) if dpis else None,
        detected_bleed_mm=report.detected_bleed_mm,
        trim_box_mm=tuple(report.trim_box_mm),
        media_box_mm=tuple(report.media_box_mm),
    )


def _page_count(path: Path) -> int:
    doc = pymupdf.open(str(path))
    try:
        return len(doc)
    finally:
        doc.close()


def _render_png(pdf_path: Path, page_index: int, target: Path, dpi: int) -> Tuple[float, float]:
    doc = pymupdf.open(str(pdf_path))
    try:
        page = doc[max(0, min(page_index, len(doc) - 1))]
        page.get_pixmap(dpi=dpi, alpha=False).save(str(target))
        return round(page.rect.width * PT_TO_MM, 2), round(page.rect.height * PT_TO_MM, 2)
    finally:
        doc.close()


def _svg_to_pdf(data: bytes, name: str) -> bytes:
    """Vector SVG (mm units) -> single-page PDF via MuPDF, keeping physical size."""
    try:
        src = pymupdf.open(stream=data, filetype="svg")
        try:
            return src.convert_to_pdf()
        finally:
            src.close()
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"SVG pichoqni o'qib bo'lmadi ({name}): {ex}")


def _output_label(filename: str) -> str:
    stem = Path(filename).stem
    form = ""
    if "_forma" in stem:
        form = " " + stem.split("_forma", 1)[1].split("_", 1)[0]
    if stem.endswith("_oldi"):
        return f"Oldi{form}"
    if stem.endswith("_orqa"):
        return f"Orqa{form}"
    if stem.endswith("_pichoq"):
        return "Pichoq"
    return "Montaj"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/calculate", response_model=CalculateResponse)
def calculate_layout(req: CalculateRequest):
    """Grid capacity, ganged form plans and per-cell coordinates (mm, top-left origin)."""
    sheet = _sheet_config(req)
    bg = _bleed_config(req)
    cols, rows, rotation = _resolve_grid(req, sheet, bg)
    items_per_sheet = max(1, cols * rows)

    variants = _variants_without_files(req.variants)
    plans = LayoutCalculator.optimize_ganged_forms(
        variants=variants,
        items_per_sheet=items_per_sheet,
        strategy=GangingStrategy(req.strategy),
        max_overprint_pct=req.max_overprint_pct,
        waste_sheets=req.waste_sheets,
    )

    item_w = bg.trim_height_mm if rotation in (90, 270) else bg.trim_width_mm
    item_h = bg.trim_width_mm if rotation in (90, 270) else bg.trim_height_mm
    block_w = cols * item_w + max(0, cols - 1) * bg.gutter_x_mm
    block_h = rows * item_h + max(0, rows - 1) * bg.gutter_y_mm
    utilization = (items_per_sheet * item_w * item_h) / (sheet.width_mm * sheet.height_mm) * 100.0

    return CalculateResponse(
        cols=cols,
        rows=rows,
        rotation=rotation,
        items_per_sheet=items_per_sheet,
        item_w_mm=item_w,
        item_h_mm=item_h,
        block_w_mm=round(block_w, 3),
        block_h_mm=round(block_h, 3),
        utilization_pct=round(utilization, 2),
        total_order_qty=sum(v.order_quantity for v in variants),
        total_sheets=sum(fp.total_sheets_with_waste for fp in plans),
        forms=[_form_schema(fp, req, sheet, bg, cols, rows, rotation, with_cells=True) for fp in plans],
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_artwork(
    files: List[UploadFile] = File(...),
    manifest: Optional[str] = Form(None),
    dieline_file: Optional[int] = Form(None),
    expected_trim_w: Optional[float] = Form(None),
    expected_trim_h: Optional[float] = Form(None),
    job_id: Optional[str] = Form(None),
):
    """
    Stores uploaded artwork PDFs, builds design variants and runs preflight.
    `manifest` (JSON list of ManifestItemSchema) maps variants to file indexes / pages;
    without it every page of every file becomes a front-only variant.
    `dieline_file` is the index of the die-cut file among `files`; it may be PDF or SVG
    (SVG in mm units is converted to PDF before caching).
    """
    if dieline_file is not None and not (0 <= dieline_file < len(files)):
        raise HTTPException(status_code=400, detail="Pichoq fayli indeksi noto'g'ri.")

    payload: List[Tuple[str, bytes]] = []
    for idx, f in enumerate(files):
        name = (f.filename or "").strip()
        lower = name.lower()
        is_svg_dieline = idx == dieline_file and lower.endswith(".svg")
        if not lower.endswith(".pdf") and not is_svg_dieline:
            raise HTTPException(status_code=400, detail=f"Faqat PDF fayllar qabul qilinadi: {name or '?'}")
        data = await f.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"Bo'sh fayl: {name}")
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail=f"Fayl juda katta: {name}")
        if is_svg_dieline:
            name, data = f"{Path(name).stem}.pdf", _svg_to_pdf(data, name)
        payload.append((name, data))
    if not payload:
        raise HTTPException(status_code=400, detail="Kamida bitta PDF fayl yuklanishi shart.")

    manifest_items: List[ManifestItemSchema] = []
    if manifest:
        try:
            manifest_items = [ManifestItemSchema(**m) for m in json.loads(manifest)]
        except Exception as ex:
            raise HTTPException(status_code=400, detail=f"Manifest noto'g'ri: {ex}")

    jid, saved = sheet_imposition_cache.create_job_multi(payload, job_id=job_id)
    job_dir = sheet_imposition_cache.get_job_dir(jid)

    try:
        page_counts = [_page_count(p) for p in saved]
    except Exception as ex:
        raise HTTPException(status_code=422, detail=f"PDF faylni ochib bo'lmadi: {ex}")

    # Variants -> stored as file names relative to source_files/ so meta stays portable
    variant_rows: List[Dict] = []
    if manifest_items:
        for m in manifest_items:
            for idx, page in ((m.front_file, m.front_page), (m.back_file, m.back_page)):
                if idx is None:
                    continue
                if idx >= len(saved) or idx == dieline_file:
                    raise HTTPException(status_code=400, detail=f"'{m.name}': fayl indeksi noto'g'ri.")
                if (page or 0) >= page_counts[idx]:
                    raise HTTPException(status_code=400, detail=f"'{m.name}': sahifa {page + 1} mavjud emas.")
            variant_rows.append(
                {
                    "name": m.name,
                    "sku_id": m.sku_id,
                    "quantity": m.quantity,
                    "front_file": saved[m.front_file].name,
                    "front_page": m.front_page,
                    "back_file": saved[m.back_file].name if m.back_file is not None else None,
                    "back_page": (m.back_page or 0) if m.back_file is not None else None,
                }
            )
    else:
        front_paths = [str(p) for i, p in enumerate(saved) if i != dieline_file]
        for v in ImpositionEngine.build_variants_from_files(front_paths, multi_page_mode="pages"):
            variant_rows.append(
                {
                    "name": v.name,
                    "sku_id": None,
                    "quantity": v.order_quantity,
                    "front_file": Path(v.front_pdf_path).name,
                    "front_page": v.front_page_num,
                    "back_file": None,
                    "back_page": None,
                }
            )
    if not variant_rows:
        raise HTTPException(status_code=422, detail="Yuklangan fayllarda dizayn topilmadi.")

    src_dir = job_dir / "source_files"
    variants = _variants_from_rows(variant_rows, src_dir)

    expected = (expected_trim_w, expected_trim_h) if expected_trim_w and expected_trim_h else None
    checker = PreflightChecker(target_dpi=300.0)
    report = checker.check_multi_variants(variants, expected_trim_mm=expected)

    dieline_schema: Optional[DielineTrimSchema] = None
    if dieline_file is not None:
        tw, th, pw, ph = ImpositionEngine.detect_dieline_trim_mm(str(saved[dieline_file]))
        dieline_schema = DielineTrimSchema(trim_w_mm=tw, trim_h_mm=th, page_w_mm=pw, page_h_mm=ph)

    stamp = int(time.time())
    previews_dir = job_dir / "source_previews"
    analyzed: List[AnalyzedVariantSchema] = []
    for i, (row, v) in enumerate(zip(variant_rows, variants)):
        thumb_name = f"thumb_{i}.png"
        thumb_url: Optional[str] = None
        try:
            _render_png(Path(v.front_pdf_path), v.front_page_num, previews_dir / thumb_name, THUMB_DPI)
            thumb_url = _file_url(jid, thumb_name, stamp)
        except Exception as ex:
            logger.warning("Thumbnail failed for %s: %s", row["name"], ex)
        analyzed.append(
            AnalyzedVariantSchema(
                variant_index=i,
                name=row["name"],
                sku_id=row["sku_id"],
                quantity=row["quantity"],
                front_file_name=row["front_file"],
                front_page=row["front_page"],
                back_file_name=row["back_file"],
                back_page=row["back_page"],
                thumbnail_url=thumb_url,
            )
        )

    sheet_imposition_cache.update_meta(
        jid,
        {
            "kind": "sheet",
            "variants": variant_rows,
            "dieline_file": saved[dieline_file].name if dieline_file is not None else None,
            "colors": [c.model_dump() for c in _preflight_schema(report).colors],
        },
    )

    return AnalyzeResponse(job_id=jid, variants=analyzed, preflight=_preflight_schema(report), dieline=dieline_schema)


def _variants_from_rows(rows: List[Dict], src_dir: Path) -> List[DesignVariant]:
    out: List[DesignVariant] = []
    for i, r in enumerate(rows):
        out.append(
            DesignVariant(
                variant_id=i + 1,
                name=r["name"],
                front_pdf_path=str(src_dir / r["front_file"]),
                front_page_num=int(r.get("front_page") or 0),
                back_pdf_path=str(src_dir / r["back_file"]) if r.get("back_file") else None,
                back_page_num=int(r.get("back_page") or 0) if r.get("back_file") else None,
                order_quantity=int(r.get("quantity") or 1000),
            )
        )
    return out


@router.post("/{job_id}/generate", response_model=GenerateResponse)
def generate_imposition(job_id: str, req: GenerateRequest):
    """Runs the vector imposition for an analyzed job and renders page previews."""
    started = time.time()
    try:
        job_dir = sheet_imposition_cache.get_job_dir(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Ish topilmadi yoki kesh muddati o'tgan. Qayta tahlil qiling.")

    meta = sheet_imposition_cache.get_meta(job_id)
    rows = meta.get("variants") or []
    if meta.get("kind") != "sheet" or not rows:
        raise HTTPException(status_code=409, detail="Ish tahlil qilinmagan.")

    src_dir = job_dir / "source_files"
    variants = _variants_from_rows(rows, src_dir)
    if req.variants:
        if len(req.variants) != len(variants):
            raise HTTPException(status_code=400, detail="Variantlar soni tahlildagi bilan mos emas.")
        _apply_variant_inputs(variants, req.variants)

    dieline_path = str(src_dir / meta["dieline_file"]) if meta.get("dieline_file") else None

    sheet = _sheet_config(req)
    bg = _bleed_config(req)
    cols, rows_n, rotation = _resolve_grid(req, sheet, bg)

    job_in = req.job
    colors_in = job_in.colors if job_in.colors is not None else [ColorChannelSchema(**c) for c in meta.get("colors") or []]
    job = JobMetadata(
        order_number=job_in.order_number or "",
        job_name=job_in.job_name or Path(rows[0]["front_file"]).stem,
        date_str=job_in.date_str or datetime.date.today().strftime("%d.%m.%Y"),
        order_quantity=sum(v.order_quantity for v in variants),
        waste_sheets=req.waste_sheets,
        colors=[ColorChannel(name=c.name, is_spot=c.is_spot, cmyk=tuple(c.cmyk)) for c in colors_in],
        sheet_form_str=f"{sheet.width_mm / 10:g}x{sheet.height_mm / 10:g}sm",
        custom_notes=job_in.custom_notes,
        category=JobCategory(job_in.category),
        cut_style=GuillotineCutStyle(job_in.cut_style),
    )

    out_dir = job_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(f"{OUTPUT_STEM}*"):
        try:
            old.unlink()
        except OSError:
            pass
    output_path = out_dir / f"{OUTPUT_STEM}.pdf"

    try:
        result = ImpositionEngine().run_imposition(
            back_pdf_path=None,
            dieline_pdf_path=dieline_path,
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode(req.mode),
            style=TemplateStyle(job_in.style),
            job=job,
            output_path=str(output_path),
            export_separate_files=req.export_separate_files,
            include_proof_overlay=req.include_proof_overlay,
            manual_grid=(cols, rows_n, rotation),
            variants=variants,
            ganging_strategy=GangingStrategy(req.strategy),
            max_overprint_pct=req.max_overprint_pct,
            fill_direction=GridFillDirection(req.fill_direction),
        )
    except FileNotFoundError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    except Exception as ex:
        logger.exception("Sheet imposition failed for %s", job_id)
        raise HTTPException(status_code=500, detail=f"Montaj yaratishda xatolik: {ex}")

    stamp = int(time.time())
    files: List[OutputFileSchema] = []
    seen = set()
    # Combined PDF first, then separate sides in engine order
    for fpath in [str(output_path)] + [f for f in result["generated_files"] if f != str(output_path)]:
        p = Path(fpath)
        if p.name in seen or not p.exists():
            continue
        seen.add(p.name)
        files.append(
            OutputFileSchema(
                filename=p.name,
                label=_output_label(p.name),
                url=_file_url(job_id, p.name, stamp),
                size_bytes=p.stat().st_size,
            )
        )

    pages: List[PagePreviewSchema] = []
    labels: List[str] = result.get("page_labels") or []
    doc = pymupdf.open(str(output_path))
    try:
        for i, page in enumerate(doc):
            png_name = f"{OUTPUT_STEM}_page_{i + 1}.png"
            page.get_pixmap(dpi=PREVIEW_DPI, alpha=False).save(str(out_dir / png_name))
            pages.append(
                PagePreviewSchema(
                    page_index=i,
                    label=labels[i] if i < len(labels) else f"{i + 1}",
                    url=_file_url(job_id, png_name, stamp),
                    width_mm=round(page.rect.width * PT_TO_MM, 2),
                    height_mm=round(page.rect.height * PT_TO_MM, 2),
                )
            )
    finally:
        doc.close()

    sheet_imposition_cache.update_meta(job_id, {"status": "generated", "generated_at": time.time()})

    forms = [
        _form_schema(fp, req, sheet, bg, cols, rows_n, rotation, with_cells=False)
        for fp in result.get("form_plans") or []
    ]
    return GenerateResponse(
        job_id=job_id,
        files=files,
        pages=pages,
        cols=result["cols"],
        rows=result["rows"],
        rotation=result["rotation"],
        items_per_sheet=result["items_per_sheet"],
        calculated_sheets=result["calculated_sheets"],
        has_back=bool(result.get("has_back")),
        has_dieline=bool(result.get("has_dieline")),
        forms=forms,
        generation_time_ms=int((time.time() - started) * 1000),
    )


@router.get("/{job_id}/files/{filename}")
@router.head("/{job_id}/files/{filename}")
def get_job_file(job_id: str, filename: str):
    """Serves a cached thumbnail, imposition PDF or page preview PNG."""
    try:
        file_path = sheet_imposition_cache.get_safe_file_path(job_id, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fayl topilmadi yoki kesh muddati o'tgan.")

    media_type, _ = mimetypes.guess_type(str(file_path))
    if not media_type:
        media_type = "application/pdf" if file_path.suffix.lower() == ".pdf" else "application/octet-stream"
    return FileResponse(path=str(file_path), media_type=media_type, filename=file_path.name)
