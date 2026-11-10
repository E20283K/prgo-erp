"""
Core Vector Imposition Engine for Sticker / Textile Labels (Nylon, Satin, etc.).

Implements:
- Single-sticker PDF, multi-page PDF, and multi-sticker sheet (e.g., 26 stickers in 1 PDF) automatic splitting.
- Automatic or manual Gear & Copy-Count (N) matching.
- Outer border removal while preserving 100% vector quality (including interior stitch lines and barcodes).
- Color detection & vector color separation (1, 2, or more colors -> separate plates).
- Slot placement (centering if L <= Slot, scaling if L > Slot) and Film Length vertical compression.
- Regmark drawing (horizontal line + 0.7mm downward vertical tick, 0.2mm stroke width).
- 100% Grayscale Black enforcement and audit (`DeviceGray 0.0`).
- Single-file, batch multi-file, and side-by-side (same-gear) combined output in Vector PDF, SVG, and EPS.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import pymupdf
from PIL import Image

from .color_separator import (
    DetectedColor,
    GrayscaleAuditReport,
    create_color_separated_docs,
    detect_design_colors,
    enforce_and_audit_grayscale_black,
)
from .gear_manager import GearManager, GearMatch
from .pdf_inspector import (
    PDFDesignInfo,
    inspect_pdf_design,
    inspect_pdf_designs,
    mm_to_pt,
    prepare_borderless_source_doc,
)


@dataclass
class ImpositionConfig:
    remove_outer_border: bool = True
    separate_colors: bool = True
    # "side_by_side" (plates as columns on one page) or "separate_files" (one PDF per color plate)
    color_output_mode: str = "side_by_side"
    # Regmark parameters
    regmark_enabled: bool = True
    regmark_stroke_mm: float = 0.2
    regmark_tick_mm: float = 0.7
    # If None or <= 0, horizontal regmark width equals sticker width (e.g. 15mm, 10mm, 20mm)
    regmark_custom_width_mm: Optional[float] = None
    # Side-by-side spacing between columns (mm)
    column_gap_mm: float = 5.0
    max_cylinder_width_mm: float = 0.0  # 0.0 means unlimited
    # Also export SVG / EPS alongside PDF
    export_svg: bool = False
    export_eps: bool = False


@dataclass
class StripColumnSpec:
    """Represents one vertical strip column to be placed on an output cylinder plate."""
    title: str
    source_doc: pymupdf.Document
    source_clip_rect_pt: pymupdf.Rect
    width_mm: float
    orig_length_mm: float
    gear_match: GearMatch
    color_info: DetectedColor


@dataclass
class ImpositionItemResult:
    input_path: Path
    design_info: PDFDesignInfo
    gear_match: GearMatch
    detected_colors: List[DetectedColor]
    output_files: List[Path] = field(default_factory=list)
    audit_report: Optional[GrayscaleAuditReport] = None


def _draw_regmark_on_page(
    page: pymupdf.Page,
    col_x0_mm: float,
    col_width_mm: float,
    y_mm: float,
    config: ImpositionConfig,
) -> None:
    """
    Draws a T-shaped regmark at vertical position `y_mm`:
    - Horizontal line of width `col_width_mm` (or `config.regmark_custom_width_mm`), thickness `0.2 mm`.
    - Vertical tick at horizontal center pointing DOWN by `0.7 mm`, thickness `0.2 mm`.
    - Drawn in 100% Grayscale Black (`color=(0,)`).
    """
    if not config.regmark_enabled:
        return

    stroke_pt = mm_to_pt(config.regmark_stroke_mm)
    tick_pt = mm_to_pt(config.regmark_tick_mm)

    if config.regmark_custom_width_mm and config.regmark_custom_width_mm > 0:
        horiz_w_mm = config.regmark_custom_width_mm
    else:
        horiz_w_mm = col_width_mm

    center_x_mm = col_x0_mm + (col_width_mm / 2.0)
    x0_pt = mm_to_pt(center_x_mm - horiz_w_mm / 2.0)
    x1_pt = mm_to_pt(center_x_mm + horiz_w_mm / 2.0)
    xm_pt = mm_to_pt(center_x_mm)
    y_pt = mm_to_pt(y_mm)

    shape = page.new_shape()
    shape.draw_line(pymupdf.Point(x0_pt, y_pt), pymupdf.Point(x1_pt, y_pt))
    shape.draw_line(pymupdf.Point(xm_pt, y_pt), pymupdf.Point(xm_pt, y_pt + tick_pt))
    shape.finish(color=(0.0,), width=stroke_pt, lineCap=0)
    shape.commit(overlay=True)


def build_imposed_pdf_from_columns(
    columns: List[StripColumnSpec],
    config: ImpositionConfig,
) -> Tuple[pymupdf.Document, GrayscaleAuditReport]:
    """
    Places one or more vertical strip columns (each sharing the same Gear / Film length)
    side-by-side onto a new 100% vector PDF document, applies Film Length scaling,
    draws regmarks, and runs the 100% Grayscale Black enforcement & audit module.
    """
    if not columns:
        raise ValueError("At least one StripColumnSpec is required.")

    film_length_mm = columns[0].gear_match.film_length_mm
    gap_mm = config.column_gap_mm if len(columns) > 1 else 0.0
    total_width_mm = sum(c.width_mm for c in columns) + gap_mm * (len(columns) - 1)

    top_pad_mm = 0.0
    bottom_pad_mm = config.regmark_tick_mm + config.regmark_stroke_mm if config.regmark_enabled else 0.0

    page_w_pt = mm_to_pt(total_width_mm)
    film_h_pt = mm_to_pt(film_length_mm)
    page_h_pt = mm_to_pt(film_length_mm + top_pad_mm + bottom_pad_mm)

    out_doc = pymupdf.open()
    out_page = out_doc.new_page(width=page_w_pt, height=page_h_pt)

    try:
        out_page.set_trimbox(
            pymupdf.Rect(
                0,
                0,
                out_page.mediabox.width,
                min(film_h_pt, out_page.mediabox.height),
            )
        )
    except Exception:
        pass

    cursor_x_mm = 0.0
    for col in columns:
        gm = col.gear_match
        n_copies = gm.copies_count
        slot_print_mm = gm.slot_printing_length_mm
        slot_film_mm = gm.slot_film_length_mm
        comp_ratio = gm.gear_data.compression_ratio

        if col.orig_length_mm <= slot_print_mm:
            offset_print_mm = (slot_print_mm - col.orig_length_mm) / 2.0
            design_print_h_mm = col.orig_length_mm
        else:
            offset_print_mm = 0.0
            design_print_h_mm = slot_print_mm

        offset_film_mm = offset_print_mm * comp_ratio
        design_film_h_mm = design_print_h_mm * comp_ratio

        col_x0_pt = mm_to_pt(cursor_x_mm)
        col_x1_pt = mm_to_pt(cursor_x_mm + col.width_mm)

        for i in range(n_copies):
            slot_y0_mm = top_pad_mm + (i * slot_film_mm)
            design_y0_mm = slot_y0_mm + offset_film_mm
            design_y1_mm = design_y0_mm + design_film_h_mm

            target_rect = pymupdf.Rect(
                col_x0_pt,
                mm_to_pt(design_y0_mm),
                col_x1_pt,
                mm_to_pt(design_y1_mm),
            )
            out_page.show_pdf_page(
                target_rect,
                col.source_doc,
                0,
                keep_proportion=False,
                overlay=True,
            )

        for i in range(n_copies + 1):
            boundary_y_mm = top_pad_mm + (i * slot_film_mm)
            _draw_regmark_on_page(
                out_page,
                col_x0_mm=cursor_x_mm,
                col_width_mm=col.width_mm,
                y_mm=boundary_y_mm,
                config=config,
            )

        cursor_x_mm += col.width_mm + gap_mm

    audit_report = enforce_and_audit_grayscale_black(out_doc)
    return out_doc, audit_report


def save_output_formats(
    doc: pymupdf.Document,
    pdf_output_path: Path,
    export_svg: bool = False,
    export_eps: bool = False,
) -> List[Path]:
    """Saves the imposed vector PDF and optionally exports vector SVG and EPS files."""
    pdf_output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(pdf_output_path, garbage=4, deflate=True)
    saved: List[Path] = [pdf_output_path]

    if export_svg:
        svg_path = pdf_output_path.with_suffix(".svg")
        svg_text = doc[0].get_svg_image()
        svg_path.write_text(svg_text, encoding="utf-8")
        saved.append(svg_path)

    if export_eps:
        eps_path = pdf_output_path.with_suffix(".eps")
        _export_page_to_eps(doc[0], eps_path)
        saved.append(eps_path)

    return saved


def _export_page_to_eps(page: pymupdf.Page, eps_path: Path) -> None:
    """Exports vector paths of the page to a clean encapsulated PostScript (.eps) file."""
    rect = page.rect
    w_pt = rect.width
    h_pt = rect.height
    lines = [
        "%!PS-Adobe-3.0 EPSF-3.0",
        f"%%BoundingBox: 0 0 {int(round(w_pt))} {int(round(h_pt))}",
        f"%%HiResBoundingBox: 0.0 0.0 {w_pt:.4f} {h_pt:.4f}",
        "%%LanguageLevel: 2",
        "%%Pages: 1",
        "%%EndComments",
        "gsave",
        "0 setgray",
    ]
    for d in page.get_drawings():
        width = d.get("width") or 0.5
        lines.append(f"{width:.4f} setlinewidth")
        lines.append("newpath")
        for item in d.get("items", []):
            kind = item[0]
            if kind == "l":
                p1, p2 = item[1], item[2]
                lines.append(f"{p1.x:.4f} {h_pt - p1.y:.4f} moveto {p2.x:.4f} {h_pt - p2.y:.4f} lineto")
            elif kind == "re":
                r = item[1]
                lines.append(
                    f"{r.x0:.4f} {h_pt - r.y1:.4f} {r.width:.4f} {r.height:.4f} rectstroke"
                )
            elif kind == "c":
                p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
                lines.append(
                    f"{p1.x:.4f} {h_pt - p1.y:.4f} moveto "
                    f"{p2.x:.4f} {h_pt - p2.y:.4f} {p3.x:.4f} {h_pt - p3.y:.4f} {p4.x:.4f} {h_pt - p4.y:.4f} curveto"
                )
        if d.get("fill") is not None and d.get("color") is not None:
            lines.append("gsave fill grestore stroke")
        elif d.get("fill") is not None:
            lines.append("fill")
        else:
            lines.append("stroke")
    lines.append("grestore")
    lines.append("%%EOF")
    eps_path.write_text("\n".join(lines), encoding="ascii")


class ImpositionEngine:
    """High-level orchestrator for single-file, multi-sticker sheet, batch, and combined same-gear imposition."""

    def __init__(self, gear_manager: Optional[GearManager] = None) -> None:
        self.gear_manager = gear_manager or GearManager()

    def expand_pdf_designs(self, pdf_path: Path | str) -> List[PDFDesignInfo]:
        """Returns all individual sticker designs found inside `pdf_path` (1 or N, e.g. 26)."""
        return inspect_pdf_designs(pdf_path)

    def analyze_design_info(
        self,
        info: PDFDesignInfo,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
        remove_outer_border: bool = True,
    ) -> Tuple[PDFDesignInfo, GearMatch, List[DetectedColor]]:
        gear_match = self.gear_manager.find_best_gear(
            design_length_mm=info.length_mm,
            custom_copies=custom_copies,
            custom_gear=custom_gear,
        )
        clean_doc, clip_rect = prepare_borderless_source_doc(
            info.file_path, info=info, remove_border=remove_outer_border
        )
        try:
            colors = detect_design_colors(clean_doc, clip_rect=clip_rect)
        finally:
            clean_doc.close()
        return info, gear_match, colors

    def analyze_file(
        self,
        pdf_path: Path | str,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
        remove_outer_border: bool = True,
    ) -> Tuple[PDFDesignInfo, GearMatch, List[DetectedColor]]:
        info = inspect_pdf_design(pdf_path)
        return self.analyze_design_info(
            info,
            custom_gear=custom_gear,
            custom_copies=custom_copies,
            remove_outer_border=remove_outer_border,
        )

    def process_design_info(
        self,
        info: PDFDesignInfo,
        output_dir: Path | str,
        config: Optional[ImpositionConfig] = None,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
    ) -> ImpositionItemResult:
        """Processes a single `PDFDesignInfo` (either a standalone file or 1 of N stickers on a sheet)."""
        cfg = config or ImpositionConfig()
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        gear_match = self.gear_manager.find_best_gear(
            design_length_mm=info.length_mm,
            custom_copies=custom_copies,
            custom_gear=custom_gear,
        )

        clean_doc, clip_rect = prepare_borderless_source_doc(
            info.file_path, info=info, remove_border=cfg.remove_outer_border
        )
        try:
            detected_colors = detect_design_colors(clean_doc, clip_rect=clip_rect)
            separated_docs = create_color_separated_docs(
                clean_doc,
                detected_colors=detected_colors,
                separate_colors=cfg.separate_colors,
            )
            try:
                saved_files: List[Path] = []
                last_audit: Optional[GrayscaleAuditReport] = None
                stem = info.output_stem

                if cfg.color_output_mode == "separate_files" and len(separated_docs) > 1:
                    for col_info, col_doc in separated_docs:
                        safe_col = col_info.name.split()[0].lower()
                        col_spec = StripColumnSpec(
                            title=f"{stem}_{safe_col}",
                            source_doc=col_doc,
                            source_clip_rect_pt=clip_rect,
                            width_mm=info.width_mm,
                            orig_length_mm=info.length_mm,
                            gear_match=gear_match,
                            color_info=col_info,
                        )
                        imposed_doc, audit = build_imposed_pdf_from_columns([col_spec], cfg)
                        try:
                            out_pdf = out_dir / f"{stem}_val{gear_match.gear}_film{gear_match.film_length_mm:.2f}mm_rang{col_info.color_id}_{safe_col}.pdf"
                            saved_files.extend(
                                save_output_formats(
                                    imposed_doc,
                                    out_pdf,
                                    export_svg=cfg.export_svg,
                                    export_eps=cfg.export_eps,
                                )
                            )
                            last_audit = audit
                        finally:
                            imposed_doc.close()
                else:
                    columns = [
                        StripColumnSpec(
                            title=f"{stem}_{col_info.name}",
                            source_doc=col_doc,
                            source_clip_rect_pt=clip_rect,
                            width_mm=info.width_mm,
                            orig_length_mm=info.length_mm,
                            gear_match=gear_match,
                            color_info=col_info,
                        )
                        for col_info, col_doc in separated_docs
                    ]
                    imposed_doc, audit = build_imposed_pdf_from_columns(columns, cfg)
                    try:
                        color_tag = f"_{len(separated_docs)}rang" if len(separated_docs) > 1 else ""
                        out_pdf = out_dir / f"{stem}_val{gear_match.gear}_film{gear_match.film_length_mm:.2f}mm{color_tag}.pdf"
                        saved_files.extend(
                            save_output_formats(
                                imposed_doc,
                                out_pdf,
                                export_svg=cfg.export_svg,
                                export_eps=cfg.export_eps,
                            )
                        )
                        last_audit = audit
                    finally:
                        imposed_doc.close()

                return ImpositionItemResult(
                    input_path=info.file_path,
                    design_info=info,
                    gear_match=gear_match,
                    detected_colors=detected_colors,
                    output_files=saved_files,
                    audit_report=last_audit,
                )
            finally:
                for _, d in separated_docs:
                    d.close()
        finally:
            clean_doc.close()

    def process_single_file(
        self,
        pdf_path: Path | str,
        output_dir: Path | str,
        config: Optional[ImpositionConfig] = None,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
    ) -> ImpositionItemResult:
        """
        Processes a file. If the file contains multiple stickers on a sheet, processes all of them
        and returns a combined summary result (or use `process_all_designs_in_file` for per-sticker results).
        """
        designs = inspect_pdf_designs(pdf_path)
        if len(designs) == 1:
            return self.process_design_info(
                designs[0],
                output_dir=output_dir,
                config=config,
                custom_gear=custom_gear,
                custom_copies=custom_copies,
            )

        all_results = self.process_all_designs_in_file(
            pdf_path,
            output_dir=output_dir,
            config=config,
            custom_gear=custom_gear,
            custom_copies=custom_copies,
        )
        merged = all_results[0]
        for r in all_results[1:]:
            merged.output_files.extend(r.output_files)
        return merged

    def process_all_designs_in_file(
        self,
        pdf_path: Path | str,
        output_dir: Path | str,
        config: Optional[ImpositionConfig] = None,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
    ) -> List[ImpositionItemResult]:
        designs = inspect_pdf_designs(pdf_path)
        return [
            self.process_design_info(
                d,
                output_dir=output_dir,
                config=config,
                custom_gear=custom_gear,
                custom_copies=custom_copies,
            )
            for d in designs
        ]

    def process_batch_combined_by_gear(
        self,
        items_or_paths: List[PDFDesignInfo | Path | str],
        output_dir: Path | str,
        config: Optional[ImpositionConfig] = None,
        overrides: Optional[Dict[str, Tuple[Optional[int], Optional[int]]]] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> List[ImpositionItemResult]:
        """
        Groups multiple sticker designs (across multiple files OR 26 stickers extracted from 1 sheet)
        that match the SAME Gear (val) and places their columns side-by-side onto combined cylinder PDF(s).
        """
        cfg = config or ImpositionConfig()
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        overrides = overrides or {}

        design_infos: List[PDFDesignInfo] = []
        for entry in items_or_paths:
            if isinstance(entry, PDFDesignInfo):
                design_infos.append(entry)
            else:
                design_infos.extend(inspect_pdf_designs(entry))

        total_items = max(1, len(design_infos))
        total_steps = total_items * 2 + 1
        current_step = 0

        def report(msg: str) -> None:
            if progress_callback is not None:
                progress_callback(min(current_step, total_steps), total_steps, msg)

        grouped: Dict[int, List[Tuple[PDFDesignInfo, GearMatch, List[DetectedColor]]]] = {}
        results_map: Dict[str, ImpositionItemResult] = {}

        for idx, info in enumerate(design_infos, start=1):
            current_step += 1
            report(f"[{idx}/{total_items}] Tahlil qilinmoqda: {info.display_name}...")
            key = info.item_key
            c_gear, c_copies = overrides.get(key, overrides.get(str(info.file_path), (None, None)))
            _, match, cols = self.analyze_design_info(
                info,
                custom_gear=c_gear,
                custom_copies=c_copies,
                remove_outer_border=cfg.remove_outer_border,
            )
            grouped.setdefault(match.gear, []).append((info, match, cols))
            results_map[key] = ImpositionItemResult(
                input_path=info.file_path,
                design_info=info,
                gear_match=match,
                detected_colors=cols,
            )

        for gear_num, group_items in grouped.items():
            open_docs: List[pymupdf.Document] = []
            try:
                all_cols_with_owner: List[Tuple[str, StripColumnSpec]] = []
                for info, match, cols in group_items:
                    current_step += 1
                    report(f"{gear_num} val uchun rang va hoshiya tayyorlanmoqda: {info.display_name}...")
                    clean_doc, clip_rect = prepare_borderless_source_doc(
                        info.file_path, info=info, remove_border=cfg.remove_outer_border
                    )
                    open_docs.append(clean_doc)
                    sep_docs = create_color_separated_docs(
                        clean_doc, detected_colors=cols, separate_colors=cfg.separate_colors
                    )
                    for col_info, col_doc in sep_docs:
                        open_docs.append(col_doc)
                        all_cols_with_owner.append(
                            (
                                info.item_key,
                                StripColumnSpec(
                                    title=f"{info.output_stem}_{col_info.name}",
                                    source_doc=col_doc,
                                    source_clip_rect_pt=clip_rect,
                                    width_mm=info.width_mm,
                                    orig_length_mm=info.length_mm,
                                    gear_match=match,
                                    color_info=col_info,
                                ),
                            )
                        )

                batches: List[List[Tuple[str, StripColumnSpec]]] = []
                current_batch: List[Tuple[str, StripColumnSpec]] = []
                current_width = 0.0

                for owner_key, spec in all_cols_with_owner:
                    added_w = spec.width_mm if not current_batch else (cfg.column_gap_mm + spec.width_mm)
                    if (
                        cfg.max_cylinder_width_mm > 0
                        and current_batch
                        and (current_width + added_w) > cfg.max_cylinder_width_mm
                    ):
                        batches.append(current_batch)
                        current_batch = [(owner_key, spec)]
                        current_width = spec.width_mm
                    else:
                        current_batch.append((owner_key, spec))
                        current_width += added_w
                if current_batch:
                    batches.append(current_batch)

                film_len = group_items[0][1].film_length_mm
                for b_idx, batch in enumerate(batches, start=1):
                    report(f"{gear_num} val ({b_idx}/{len(batches)}) umumiy PDF va Grayscale Audit bajarilmoqda...")
                    batch_specs = [s for _, s in batch]
                    imposed_doc, audit = build_imposed_pdf_from_columns(batch_specs, cfg)
                    try:
                        suffix = f"_part{b_idx}" if len(batches) > 1 else ""
                        names_tag = "_".join(
                            dict.fromkeys(results_map[k].design_info.output_stem for k, _ in batch)
                        )[:40]
                        out_pdf = out_dir / f"combined_val{gear_num}_film{film_len:.2f}mm_{names_tag}{suffix}.pdf"
                        saved = save_output_formats(
                            imposed_doc,
                            out_pdf,
                            export_svg=cfg.export_svg,
                            export_eps=cfg.export_eps,
                        )
                        for owner_key, _ in batch:
                            res = results_map[owner_key]
                            for sf in saved:
                                if sf not in res.output_files:
                                    res.output_files.append(sf)
                            res.audit_report = audit
                    finally:
                        imposed_doc.close()
            finally:
                for d in open_docs:
                    try:
                        d.close()
                    except Exception:
                        pass

        current_step = total_steps
        report("Barcha fayllar muvaffaqiyatli yakunlandi!")
        return list(results_map.values())

    def render_preview_images(
        self,
        design_or_path: PDFDesignInfo | Path | str,
        config: Optional[ImpositionConfig] = None,
        custom_gear: Optional[int] = None,
        custom_copies: Optional[int] = None,
        dpi: int = 180,
    ) -> Tuple[Image.Image, Image.Image, PDFDesignInfo, GearMatch, List[DetectedColor], GrayscaleAuditReport]:
        """
        Renders (original_pil_image, imposed_pil_image, info, gear_match, detected_colors, audit_report)
        for live visual preview in the GUI. Works for both single-sticker files and individual stickers
        extracted from a 26-sticker sheet.
        """
        cfg = config or ImpositionConfig()
        info = design_or_path if isinstance(design_or_path, PDFDesignInfo) else inspect_pdf_design(design_or_path)
        gear_match = self.gear_manager.find_best_gear(
            design_length_mm=info.length_mm,
            custom_copies=custom_copies,
            custom_gear=custom_gear,
        )

        # Render original sticker region
        orig_doc = pymupdf.open(info.file_path)
        try:
            orig_pix = orig_doc[info.page_index].get_pixmap(
                dpi=dpi, alpha=False, clip=info.design_rect_pt
            )
            orig_img = Image.open(BytesIO(orig_pix.tobytes("png")))
        finally:
            orig_doc.close()

        clean_doc, clip_rect = prepare_borderless_source_doc(
            info.file_path, info=info, remove_border=cfg.remove_outer_border
        )
        try:
            detected_colors = detect_design_colors(clean_doc, clip_rect=clip_rect)
            sep_docs = create_color_separated_docs(
                clean_doc, detected_colors=detected_colors, separate_colors=cfg.separate_colors
            )
            try:
                columns = [
                    StripColumnSpec(
                        title=f"{info.output_stem}_{col_info.name}",
                        source_doc=col_doc,
                        source_clip_rect_pt=clip_rect,
                        width_mm=info.width_mm,
                        orig_length_mm=info.length_mm,
                        gear_match=gear_match,
                        color_info=col_info,
                    )
                    for col_info, col_doc in sep_docs
                ]
                imposed_doc, audit = build_imposed_pdf_from_columns(columns, cfg)
                try:
                    imp_pix = imposed_doc[0].get_pixmap(dpi=dpi, alpha=False)
                    imp_img = Image.open(BytesIO(imp_pix.tobytes("png")))
                finally:
                    imposed_doc.close()
            finally:
                for _, d in sep_docs:
                    d.close()
        finally:
            clean_doc.close()

        return orig_img, imp_img, info, gear_match, detected_colors, audit
