"""
FastAPI router for Flexo Label Imposition microservice endpoints.
Provides:
- GET /imposition/gears : list of print cylinder gears and availability
- POST /imposition/analyze : analyzes uploaded sticker PDF, detects designs, colors, optimal gear/N
- GET /imposition/{job_id}/files/{filename} : serves source preview PNGs, output film PDFs and previews
- POST /imposition/{job_id}/generate : executes imposition, generates film PDFs and preview images
"""

from __future__ import annotations

import logging
import mimetypes
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pymupdf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.imposition_cache import imposition_cache
from app.label_imposition.gear_manager import GearManager
from app.label_imposition.imposition_engine import ImpositionConfig, ImpositionEngine
from app.label_imposition.pdf_inspector import prepare_borderless_source_doc
from app.schemas.imposition import (
    AnalyzeResponse,
    AuditReportSchema,
    DesignAnalysisSchema,
    DetectedColorSchema,
    GenerateRequest,
    GenerateResponse,
    GenerateResultItemSchema,
    GearItemSchema,
    OutputFileSchema,
)

logger = logging.getLogger("imposition.router")

router = APIRouter(prefix="/imposition", tags=["Flexo Imposition"])


@router.get("/gears", response_model=List[GearItemSchema])
def list_gears():
    """Returns the list of all available and inactive print cylinder gears from gears.json."""
    gm = GearManager()
    return [
        GearItemSchema(
            gear=g.gear,
            pitch_diameter=g.pitch_diameter,
            plate_thickness=g.plate_thickness,
            cylinder_diameter=g.cylinder_diameter,
            film_length=g.film_length,
            printing_length=g.printing_length,
            available=g.available,
        )
        for g in gm.gears
    ]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_sticker_pdf(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    job_id: Optional[str] = Form(None),
):
    """
    Uploads vector PDF(s) (single sticker, multiple SKU PDFs, or multi-sticker sheet e.g. 26 designs),
    stores them in temporary cache, analyzes dimensions, outer borders, colors, and calculates
    the optimal Gear and repeat copies (N).
    If job_id is provided, reuses/restores that job ID.
    """
    upload_list: List[UploadFile] = []
    if files:
        for f in files:
            if f and f.filename and f.filename.strip():
                upload_list.append(f)
    if file and file.filename and file.filename.strip():
        if not any(f.filename == file.filename for f in upload_list):
            upload_list.append(file)

    if not upload_list:
        raise HTTPException(status_code=400, detail="Kamida bitta PDF fayl yuklanishi shart.")

    files_payload: List[Tuple[str, bytes]] = []
    for f in upload_list:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Faqat PDF vektor fayllari qabul qilinadi: {f.filename}")
        b = await f.read()
        if not b:
            raise HTTPException(status_code=400, detail=f"Bo'sh fayl yuklandi: {f.filename}")
        files_payload.append((f.filename, b))

    job_id, saved_paths = imposition_cache.create_job_multi(files_payload, job_id=job_id)
    job_dir = imposition_cache.get_job_dir(job_id)
    previews_dir = job_dir / "source_previews"

    gm = GearManager()
    engine = ImpositionEngine(gm)

    all_designs = []
    for p in saved_paths:
        try:
            d_list = engine.expand_pdf_designs(p)
            all_designs.extend(d_list)
        except Exception as ex:
            logger.warning(f"Failed to expand designs from {p.name}: {ex}")

    if not all_designs:
        raise HTTPException(status_code=422, detail="Yuklangan PDF fayl(lar)da stiker dizayni topilmadi.")

    analyzed_designs: List[DesignAnalysisSchema] = []

    # Open document to render high-res preview of each detected sticker design
    open_docs: Dict[Path, pymupdf.Document] = {}
    try:
        for idx, d in enumerate(all_designs, start=1):
            info, match, colors = engine.analyze_design_info(d, remove_outer_border=True)

            # Generate original preview PNG
            preview_filename = f"source_{info.output_stem}.png"
            preview_path = previews_dir / preview_filename
            try:
                if d.file_path not in open_docs:
                    open_docs[d.file_path] = pymupdf.open(d.file_path)
                src_doc = open_docs[d.file_path]
                page = src_doc[info.page_index]
                pix = page.get_pixmap(dpi=150, alpha=False, clip=info.design_rect_pt)
                pix.save(str(preview_path))
            except Exception as ex:
                logger.warning(f"Could not render preview for {info.display_name}: {ex}")

            # Generate sliced standalone vector PDF
            pdf_filename = f"source_{info.output_stem}.pdf"
            pdf_path = previews_dir / pdf_filename
            try:
                iso_doc, _ = prepare_borderless_source_doc(d.file_path, info=info, remove_border=False)
                iso_doc.save(str(pdf_path), garbage=4, deflate=True)
                iso_doc.close()
            except Exception as ex:
                logger.warning(f"Could not generate isolated vector PDF for {info.display_name}: {ex}")

            analyzed_designs.append(
                DesignAnalysisSchema(
                    item_key=info.item_key,
                    display_name=info.display_name,
                    output_stem=info.output_stem,
                    page_index=info.page_index,
                    sub_index=info.sub_index,
                    total_sub_designs=info.total_sub_designs,
                    width_mm=round(info.width_mm, 2),
                    length_mm=round(info.length_mm, 2),
                    has_outer_border=info.has_outer_border,
                    border_stroke_width_pt=round(info.border_stroke_width_pt, 2),
                    vector_paths_count=info.vector_paths_count,
                    text_blocks_count=info.text_blocks_count,
                    suggested_gear=match.gear,
                    suggested_copies=match.copies_count,
                    printing_length_mm=round(match.printing_length_mm, 2),
                    film_length_mm=round(match.film_length_mm, 2),
                    slot_printing_length_mm=round(match.slot_printing_length_mm, 3),
                    slot_film_length_mm=round(match.slot_film_length_mm, 3),
                    per_copy_diff_mm=round(match.per_copy_diff_mm, 3),
                    total_diff_mm=round(match.total_diff_mm, 3),
                    compression_ratio=round(match.gear_data.compression_ratio, 6),
                    colors=[
                        DetectedColorSchema(
                            color_id=c.color_id,
                            name=c.name,
                            rgb=[round(val, 3) for val in c.rgb],
                            hex_code=c.hex_code,
                            object_count=c.object_count,
                        )
                        for c in colors
                    ],
                    source_preview_url=f"/api/flexo-imposition/{job_id}/files/{preview_filename}",
                    source_pdf_url=f"/api/flexo-imposition/{job_id}/files/{pdf_filename}",
                    source_pdf_filename=pdf_filename,
                )
            )
    finally:
        for doc in open_docs.values():
            try:
                doc.close()
            except Exception:
                pass

    summary_filename = (
        files_payload[0][0]
        if len(files_payload) == 1
        else (", ".join([fp[0] for fp in files_payload]) if len(files_payload) <= 3 else f"{len(files_payload)} ta fayl")
    )

    imposition_cache.update_meta(
        job_id,
        {
            "design_count": len(analyzed_designs),
            "designs": [d.dict() for d in analyzed_designs],
        },
    )

    return AnalyzeResponse(
        job_id=job_id,
        filename=summary_filename,
        design_count=len(analyzed_designs),
        designs=analyzed_designs,
    )


@router.get("/{job_id}/files/{filename}")
@router.head("/{job_id}/files/{filename}")
def get_job_file(job_id: str, filename: str):
    """Safely retrieves a cached source preview, generated film PDF, or preview PNG."""
    try:
        file_path = imposition_cache.get_safe_file_path(job_id, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fayl topilmadi yoki kesh muddati o'tgan.")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    media_type, _ = mimetypes.guess_type(str(file_path))
    if not media_type:
        if file_path.suffix.lower() == ".pdf":
            media_type = "application/pdf"
        elif file_path.suffix.lower() == ".png":
            media_type = "image/png"
        elif file_path.suffix.lower() == ".svg":
            media_type = "image/svg+xml"
        elif file_path.suffix.lower() == ".eps":
            media_type = "application/postscript"
        else:
            media_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


@router.post("/{job_id}/generate", response_model=GenerateResponse)
def generate_imposed_film(job_id: str, req: GenerateRequest):
    """
    Executes the vector imposition pipeline on the cached source PDF:
    - Removes outer borders while preserving interior cut/stitch marks and barcodes.
    - Performs vector color separation into 100% Grayscale Black channels.
    - Scales along cylinder circumference into target slot & applies Film Length compression.
    - Places regmarks (T-shaped).
    - Enforces & audits 100% Pure Black (DeviceGray 0.0).
    - Stores output PDFs and renders preview PNGs in the job cache.
    """
    try:
        source_pdf_paths = imposition_cache.get_source_pdf_paths(job_id)
        job_dir = imposition_cache.get_job_dir(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Ish topilmadi yoki muddati o'tgan. Qaytadan tahlil qiling.")

    out_dir = job_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    config = ImpositionConfig(
        remove_outer_border=req.remove_outer_border,
        separate_colors=req.separate_colors,
        color_output_mode=req.color_output_mode,
        regmark_enabled=req.regmark_enabled,
        regmark_stroke_mm=req.regmark_stroke_mm,
        regmark_tick_mm=req.regmark_tick_mm,
        regmark_custom_width_mm=req.regmark_custom_width_mm,
        column_gap_mm=req.column_gap_mm,
        max_cylinder_width_mm=req.max_cylinder_width_mm,
        export_svg=False,
        export_eps=False,
    )

    gm = GearManager()
    engine = ImpositionEngine(gm)

    designs = []
    for p in source_pdf_paths:
        try:
            designs.extend(engine.expand_pdf_designs(p))
        except Exception as ex:
            logger.warning(f"Could not expand designs from {p.name}: {ex}")

    if not designs:
        raise HTTPException(status_code=422, detail="Stiker dizaynlari topilmadi.")

    overrides_map: Dict[str, Tuple[Optional[int], Optional[int]]] = {}
    if req.overrides:
        for ov in req.overrides:
            overrides_map[ov.item_key] = (ov.custom_gear, ov.custom_copies)

    try:
        if req.combine_same_gear:
            results = engine.process_batch_combined_by_gear(
                designs,
                output_dir=out_dir,
                config=config,
                overrides=overrides_map,
            )
        else:
            results = []
            for d in designs:
                c_gear, c_copies = overrides_map.get(d.item_key, (None, None))
                res = engine.process_design_info(
                    d,
                    output_dir=out_dir,
                    config=config,
                    custom_gear=c_gear,
                    custom_copies=c_copies,
                )
                results.append(res)
    except Exception as ex:
        logger.exception("Imposition generation failed")
        raise HTTPException(status_code=500, detail=f"Montaj faylini yaratishda xatolik: {str(ex)}")

    # For every generated PDF, render high-res preview PNG (150 DPI)
    all_unique_files: Dict[str, OutputFileSchema] = {}
    for res in results:
        for out_file in res.output_files:
            if out_file.suffix.lower() == ".pdf" and out_file.exists():
                preview_name = f"{out_file.stem}_preview.png"
                preview_path = out_dir / preview_name
                if not preview_path.exists():
                    try:
                        p_doc = pymupdf.open(out_file)
                        pix = p_doc[0].get_pixmap(dpi=150, alpha=False)
                        pix.save(str(preview_path))
                        p_doc.close()
                    except Exception as ex:
                        logger.warning(f"Could not render preview for {out_file.name}: {ex}")

                preview_url = (
                    f"/api/flexo-imposition/{job_id}/files/{preview_name}"
                    if preview_path.exists()
                    else None
                )
                all_unique_files[out_file.name] = OutputFileSchema(
                    filename=out_file.name,
                    file_type="pdf",
                    size_bytes=out_file.stat().st_size,
                    download_url=f"/api/flexo-imposition/{job_id}/files/{out_file.name}",
                    preview_url=preview_url,
                )

    result_items: List[GenerateResultItemSchema] = []
    for res in results:
        res_output_files: List[OutputFileSchema] = []
        for f in res.output_files:
            if f.name in all_unique_files:
                res_output_files.append(all_unique_files[f.name])

        audit_schema = None
        if res.audit_report:
            audit_schema = AuditReportSchema(
                passed=res.audit_report.passed,
                is_pure_grayscale_black=res.audit_report.is_pure_grayscale_black,
                non_black_drawings_count=res.audit_report.non_black_drawings_count,
                non_black_text_spans_count=res.audit_report.non_black_text_spans_count,
                details=res.audit_report.details,
            )

        result_items.append(
            GenerateResultItemSchema(
                design_key=res.design_info.item_key,
                display_name=res.design_info.display_name,
                gear=res.gear_match.gear,
                copies=res.gear_match.copies_count,
                printing_length_mm=round(res.gear_match.printing_length_mm, 2),
                film_length_mm=round(res.gear_match.film_length_mm, 2),
                colors=[c.name for c in res.detected_colors],
                output_files=res_output_files,
                audit=audit_schema,
            )
        )

    response_payload = GenerateResponse(
        job_id=job_id,
        items=result_items,
        all_files=list(all_unique_files.values()),
        created_at=time.time(),
    )

    imposition_cache.update_meta(
        job_id,
        {
            "status": "generated",
            "all_files": [f.dict() for f in all_unique_files.values()],
        },
    )

    return response_payload
