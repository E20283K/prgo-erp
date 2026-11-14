"""
Vector Imposition Engine: PyMuPDF Form XObject asosidagi yo'qotishsiz (lossless) montaj dvigateli
(Yakka dizayn hamda To'plam / Multi-Design va Ko'p Formali Ganged Run qo'llab-quvvatlanadi)
"""

import os
from typing import List, Optional, Tuple, Dict, Any
import pymupdf

from .models import (
    SheetConfig,
    BleedAndGutterConfig,
    PlacedItem,
    JobMetadata,
    TemplateStyle,
    ImpositionMode,
    DesignVariant,
    FormPlan,
    FormSlotAllocation,
    GangingStrategy,
    GridFillDirection,
    JobCategory,
    SheetAlignment,
)
from .calculator import LayoutCalculator
from .marks import MarksGenerator

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4


class ImpositionEngine:
    """PDF montajini to'liq vektor va original sifatda amalga oshiruvchi dvigatel."""

    def __init__(self):
        pass

    @staticmethod
    def detect_dieline_trim_mm(dieline_pdf_path: str) -> Tuple[float, float, float, float]:
        """
        Pichoq (Noj) PDF fayli ichidagi vektor chiziqlarning (konturning) haqiqiy
        kesim o'lchamini (trim_w_mm, trim_h_mm) va sahifa o'lchamini (page_w_mm, page_h_mm) aniqlaydi.
        Masalan: Sahifa 100.674x100.674 mm, ichidagi yashil pichoq 94.674x94.674 mm bo'lsa,
        (94.67, 94.67, 100.67, 100.67) qaytaradi.
        """
        doc = pymupdf.open(dieline_pdf_path)
        try:
            page = doc[0]
            p_rect = page.rect
            page_w_mm = round(p_rect.width * PT_TO_MM, 2)
            page_h_mm = round(p_rect.height * PT_TO_MM, 2)

            drawings = page.get_drawings()
            if not drawings:
                return page_w_mm, page_h_mm, page_w_mm, page_h_mm

            # Sahifa chegarasiga to'liq teng bo'lgan oq fon/ramkani e'tiborsiz qoldiramiz
            valid_rects = []
            for d in drawings:
                r = d.get("rect")
                if not r or r.is_empty or r.is_infinite:
                    continue
                # Agar chiziq deyarli butun sahifa MediaBox ga teng bo'lsa va boshqa ichki konturlar bo'lsa
                is_full_page_box = (
                    abs(r.width - p_rect.width) < 0.5 and abs(r.height - p_rect.height) < 0.5
                )
                valid_rects.append((r, is_full_page_box, d.get("width") or 0.0))

            inner_rects = [(r, sw) for (r, is_full, sw) in valid_rects if not is_full]
            target_list = inner_rects if inner_rects else [(r, sw) for (r, _, sw) in valid_rects]

            if not target_list:
                return page_w_mm, page_h_mm, page_w_mm, page_h_mm

            x0 = min(r.x0 for r, _ in target_list)
            y0 = min(r.y0 for r, _ in target_list)
            x1 = max(r.x1 for r, _ in target_list)
            y1 = max(r.y1 for r, _ in target_list)

            raw_w_mm = (x1 - x0) * PT_TO_MM
            raw_h_mm = (y1 - y0) * PT_TO_MM

            if raw_w_mm > 2.0 and raw_h_mm > 2.0:
                return round(raw_w_mm, 2), round(raw_h_mm, 2), page_w_mm, page_h_mm
            return page_w_mm, page_h_mm, page_w_mm, page_h_mm
        finally:
            doc.close()

    @staticmethod
    def build_variants_from_files(
        front_files: List[str],
        multi_page_mode: str = "pages",  # 'pages' (har bir bet alohida tur) yoki 'alternating' (1-Oldi, 2-Orqa...)
        shared_back_pdf: Optional[str] = None,
        default_quantity: int = 1000,
        start_id: int = 1
    ) -> List[DesignVariant]:
        """
        Bir yoki bir nechta PDF fayllardan (shu jumladan ko'p sahifali PDF dan)
        DesignVariant ro'yxatini avtomatik shakllantiradi.
        """
        variants: List[DesignVariant] = []
        curr_id = start_id

        back_page_count = 0
        if shared_back_pdf and os.path.exists(shared_back_pdf):
            try:
                bdoc = pymupdf.open(shared_back_pdf)
                back_page_count = len(bdoc)
                bdoc.close()
            except Exception:
                back_page_count = 0

        for fpath in front_files:
            if not fpath or not os.path.exists(fpath):
                continue
            base_name = os.path.splitext(os.path.basename(fpath))[0]
            try:
                doc = pymupdf.open(fpath)
                page_count = len(doc)
                doc.close()
            except Exception:
                continue

            if page_count == 0:
                continue

            if page_count == 1:
                b_pno = 0 if back_page_count > 0 else None
                if back_page_count > 1 and (curr_id - start_id) < back_page_count:
                    b_pno = curr_id - start_id
                variants.append(DesignVariant(
                    variant_id=curr_id,
                    name=base_name,
                    front_pdf_path=fpath,
                    front_page_num=0,
                    back_pdf_path=shared_back_pdf if back_page_count > 0 else None,
                    back_page_num=b_pno,
                    order_quantity=default_quantity
                ))
                curr_id += 1
            elif multi_page_mode == "alternating" and page_count >= 2:
                # 1-bet Oldi_1, 2-bet Orqa_1, 3-bet Oldi_2, 4-bet Orqa_2...
                pair_idx = 1
                for p in range(0, page_count, 2):
                    has_back_page = (p + 1) < page_count
                    variants.append(DesignVariant(
                        variant_id=curr_id,
                        name=f"{base_name}_#{pair_idx}",
                        front_pdf_path=fpath,
                        front_page_num=p,
                        back_pdf_path=fpath if has_back_page else (shared_back_pdf if back_page_count > 0 else None),
                        back_page_num=(p + 1) if has_back_page else (0 if back_page_count > 0 else None),
                        order_quantity=default_quantity
                    ))
                    curr_id += 1
                    pair_idx += 1
            else:
                # Har bir sahifa alohida Oldi dizayn (1-bet, 2-bet, ..., N-bet)
                for p in range(page_count):
                    if back_page_count > 0:
                        # Agar Orqa PDF da ham xuddi shuncha sahifa bo'lsa, p-betga p-bet mos keladi;
                        # aks holda 1-bet (umumiy orqa) olinadi.
                        b_pno = p if p < back_page_count else 0
                        b_path = shared_back_pdf
                    else:
                        b_pno = None
                        b_path = None

                    variants.append(DesignVariant(
                        variant_id=curr_id,
                        name=f"{base_name}_bet{p + 1}",
                        front_pdf_path=fpath,
                        front_page_num=p,
                        back_pdf_path=b_path,
                        back_page_num=b_pno,
                        order_quantity=default_quantity
                    ))
                    curr_id += 1

        return variants

    def run_imposition(
        self,
        front_pdf_path: Optional[str] = None,
        back_pdf_path: Optional[str] = None,
        dieline_pdf_path: Optional[str] = None,
        sheet: Optional[SheetConfig] = None,
        bg_config: Optional[BleedAndGutterConfig] = None,
        mode: ImpositionMode = ImpositionMode.SINGLE_SIDED,
        style: TemplateStyle = TemplateStyle.PACKAGING_DIE_CUT,
        job: Optional[JobMetadata] = None,
        output_path: Optional[str] = "montaj_natija.pdf",
        export_separate_files: bool = False,
        include_proof_overlay: bool = True,
        manual_grid: Optional[Tuple[int, int, int]] = None,  # (cols, rows, rotation)
        variants: Optional[List[DesignVariant]] = None,
        ganging_strategy: GangingStrategy = GangingStrategy.SMART_NO_SPLIT,
        max_overprint_pct: float = 10.0,
        fill_direction: GridFillDirection = GridFillDirection.COL_BY_COL,
    ) -> Dict[str, Any]:
        """
        To'liq montaj jarayonini bajaradi (Yakka dizayn yoki Ko'p turli To'plam).
        Qaytaradi: yaratilgan fayllar ro'yxati, form_plans, statistika va parametrlar.
        """
        if sheet is None:
            sheet = SheetConfig()
        if bg_config is None:
            bg_config = BleedAndGutterConfig()
        if job is None:
            job = JobMetadata()

        # 1. Grid (to'r) va sig'imni aniqlash
        if manual_grid:
            cols, rows, rotation = manual_grid
        else:
            grid_info = LayoutCalculator.calculate_optimal_grid(sheet, bg_config, allow_rotation=True)
            cols = grid_info["cols"]
            rows = grid_info["rows"]
            rotation = grid_info["rotation"]

        items_per_sheet = max(1, cols * rows)

        # Agar variants berilgan bo'lsa, To'plam (Multi-Design) oqimi ishlaydi
        if variants and len(variants) > 0:
            return self._run_multi_variant_imposition(
                variants=variants,
                shared_back_pdf_path=back_pdf_path,
                dieline_pdf_path=dieline_pdf_path,
                sheet=sheet,
                bg_config=bg_config,
                cols=cols,
                rows=rows,
                rotation=rotation,
                mode=mode,
                style=style,
                job=job,
                output_path=output_path,
                export_separate_files=export_separate_files,
                include_proof_overlay=include_proof_overlay,
                ganging_strategy=ganging_strategy,
                max_overprint_pct=max_overprint_pct,
                fill_direction=fill_direction,
            )

        # ---------------------------------------------------------------------
        # YAKKA DIZAYN REJIMI (Backward Compatible)
        # ---------------------------------------------------------------------
        if not front_pdf_path or not os.path.exists(front_pdf_path):
            raise FileNotFoundError(f"Oldi dizayn fayli topilmadi: {front_pdf_path}")

        front_doc = pymupdf.open(front_pdf_path)
        front_page_num = 0

        # Orqa tomon fayli yoki sahifasi
        back_doc = None
        back_page_num = 0
        if back_pdf_path and os.path.exists(back_pdf_path):
            back_doc = pymupdf.open(back_pdf_path)
            back_page_num = 0
        elif len(front_doc) >= 2 and mode in (ImpositionMode.SHEETWISE, ImpositionMode.WORK_AND_TURN):
            back_doc = front_doc
            back_page_num = 1

        # Pichoq (Die-cut) fayli yoki sahifasi
        die_doc = None
        die_page_num = 0
        is_die_cut_job = (
            getattr(job, "category", None) == JobCategory.DIE_CUT
            or style == TemplateStyle.PACKAGING_DIE_CUT
            or (dieline_pdf_path and os.path.exists(dieline_pdf_path))
        )
        if is_die_cut_job:
            if dieline_pdf_path and os.path.exists(dieline_pdf_path):
                die_doc = pymupdf.open(dieline_pdf_path)
                die_page_num = 0
            elif len(front_doc) >= 3 and style == TemplateStyle.PACKAGING_DIE_CUT:
                die_doc = front_doc
                die_page_num = 2

        job.calculated_sheets = LayoutCalculator.calculate_sheets_needed(
            job.order_quantity, items_per_sheet, job.waste_sheets
        )

        # Katakchalar koordinatalarini hisoblash
        front_items, back_items = LayoutCalculator.generate_layout(
            sheet=sheet,
            bg_config=bg_config,
            cols=cols,
            rows=rows,
            rotation=rotation,
            mode=mode,
            center_grid=True,
            fill_direction=fill_direction
        )

        out_combined = pymupdf.open()
        generated_files = []
        page_labels = []

        # Oldi tomon sahifasini yaratish
        front_sheet_doc = self._create_sheet_page(
            src_doc=front_doc,
            src_page_num=front_page_num,
            items=front_items,
            sheet=sheet,
            bg_config=bg_config,
            job=job,
            style=style,
            is_dieline=False,
            side_name="Oldi"
        )
        out_combined.insert_pdf(front_sheet_doc)
        page_labels.append("Oldi tomon")

        if export_separate_files and output_path:
            base, ext = os.path.splitext(output_path)
            f_path = f"{base}_oldi{ext}"
            front_sheet_doc.save(f_path)
            generated_files.append(f_path)

        # Orqa tomon sahifasini yaratish (agar mavjud bo'lsa)
        if back_items and back_doc:
            job_back = JobMetadata(
                order_number=job.order_number,
                job_name=job.job_name,
                date_str=job.date_str,
                order_quantity=job.order_quantity,
                calculated_sheets=job.calculated_sheets,
                colors=job.colors,
                side_name="Orqa",
                sheet_form_str=job.sheet_form_str,
                custom_notes=job.custom_notes
            )
            back_sheet_doc = self._create_sheet_page(
                src_doc=back_doc,
                src_page_num=back_page_num,
                items=back_items,
                sheet=sheet,
                bg_config=bg_config,
                job=job_back,
                style=style,
                is_dieline=False,
                side_name="Orqa"
            )
            out_combined.insert_pdf(back_sheet_doc)
            page_labels.append("Orqa tomon")

            if export_separate_files and output_path:
                base, ext = os.path.splitext(output_path)
                b_path = f"{base}_orqa{ext}"
                back_sheet_doc.save(b_path)
                generated_files.append(b_path)

        # Pichoq (Die-cut) montaj sahifasi (agar berilgan bo'lsa)
        if die_doc:
            job_die = JobMetadata(
                order_number=job.order_number,
                job_name=job.job_name,
                date_str=job.date_str,
                order_quantity=job.order_quantity,
                calculated_sheets=job.calculated_sheets,
                colors=job.colors,
                side_name="Pichoq (Die-cut)",
                sheet_form_str=job.sheet_form_str,
                custom_notes=job.custom_notes
            )
            die_sheet_doc = self._create_sheet_page(
                src_doc=die_doc,
                src_page_num=die_page_num,
                items=front_items,
                sheet=sheet,
                bg_config=bg_config,
                job=job_die,
                style=style,
                is_dieline=True,
                side_name="Pichoq"
            )
            out_combined.insert_pdf(die_sheet_doc)
            page_labels.append("Pichoq (Die-cut)")

            if export_separate_files and output_path:
                base, ext = os.path.splitext(output_path)
                d_path = f"{base}_pichoq{ext}"
                die_sheet_doc.save(d_path)
                generated_files.append(d_path)

            if include_proof_overlay:
                proof_sheet_doc = self._create_proof_overlay_sheet(
                    front_doc=front_doc,
                    front_pno=front_page_num,
                    die_doc=die_doc,
                    die_pno=die_page_num,
                    items=front_items,
                    sheet=sheet,
                    bg_config=bg_config,
                    job=job,
                    style=style
                )
                out_combined.insert_pdf(proof_sheet_doc)
                page_labels.append("Tekshiruv (Dizayn + Pichoq)")

        pdf_bytes = out_combined.tobytes(deflate=True)

        if output_path:
            out_combined.save(output_path, deflate=True)
            generated_files.append(output_path)

        if back_doc is not None and back_doc is not front_doc:
            back_doc.close()
        if die_doc is not None and die_doc is not front_doc:
            die_doc.close()
        front_doc.close()
        out_combined.close()

        return {
            "success": True,
            "output_path": output_path,
            "pdf_bytes": pdf_bytes,
            "generated_files": generated_files,
            "page_labels": page_labels,
            "cols": cols,
            "rows": rows,
            "rotation": rotation,
            "items_per_sheet": items_per_sheet,
            "calculated_sheets": job.calculated_sheets,
            "has_back": back_doc is not None,
            "has_dieline": die_doc is not None,
            "form_plans": [],
        }

    # -------------------------------------------------------------------------
    # KO'P TURLI TO'PLAM VA KO'P FORMALI MONTAJ (MULTI-VARIANT / GANGED RUN)
    # -------------------------------------------------------------------------

    def _run_multi_variant_imposition(
        self,
        variants: List[DesignVariant],
        shared_back_pdf_path: Optional[str],
        dieline_pdf_path: Optional[str],
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        cols: int,
        rows: int,
        rotation: int,
        mode: ImpositionMode,
        style: TemplateStyle,
        job: JobMetadata,
        output_path: Optional[str],
        export_separate_files: bool,
        include_proof_overlay: bool,
        ganging_strategy: GangingStrategy,
        max_overprint_pct: float,
        fill_direction: GridFillDirection,
    ) -> Dict[str, Any]:
        """To'plamdagi dizaynlarni 1 yoki bir nechta Formaga taqsimlab montaj qiladi."""
        items_per_sheet = max(1, cols * rows)

        # 1. Aqlli optimallashtirgich orqali FormPlan ro'yxatini olish
        form_plans = LayoutCalculator.optimize_ganged_forms(
            variants=variants,
            items_per_sheet=items_per_sheet,
            strategy=ganging_strategy,
            max_overprint_pct=max_overprint_pct,
            waste_sheets=job.waste_sheets
        )

        # 2. Barcha kerakli PDF hujjatlarni keshda ochish
        doc_cache: Dict[str, pymupdf.Document] = {}

        def get_doc(path: Optional[str]) -> Optional[pymupdf.Document]:
            if not path or not os.path.exists(path):
                return None
            abs_p = os.path.abspath(path)
            if abs_p not in doc_cache:
                doc_cache[abs_p] = pymupdf.open(abs_p)
            return doc_cache[abs_p]

        out_combined = pymupdf.open()
        generated_files: List[str] = []
        page_labels: List[str] = []

        try:
            is_die_cut_job = (
                getattr(job, "category", None) == JobCategory.DIE_CUT
                or style == TemplateStyle.PACKAGING_DIE_CUT
                or (dieline_pdf_path and os.path.exists(dieline_pdf_path))
            )
            die_doc = get_doc(dieline_pdf_path) if is_die_cut_job else None
            die_pno = 0
            shared_back_doc = get_doc(shared_back_pdf_path)

            # Orqa tomon mavjudligini aniqlash
            any_back_available = (shared_back_doc is not None) or any(
                (v.back_pdf_path and os.path.exists(v.back_pdf_path)) for v in variants
            )
            has_back = mode in (ImpositionMode.SHEETWISE, ImpositionMode.WORK_AND_TURN) and any_back_available

            total_sheets_all_forms = sum(fp.total_sheets_with_waste for fp in form_plans)
            job.calculated_sheets = total_sheets_all_forms

            num_forms = len(form_plans)

            for fp in form_plans:
                form_tag = f"Forma {fp.form_index}/{num_forms}" if num_forms > 1 else "Forma 1"
                summary_notes = fp.summary_str()
                form_order_qty = sum(a.target_qty for a in fp.allocations)

                front_items, back_items = LayoutCalculator.generate_layout(
                    sheet=sheet,
                    bg_config=bg_config,
                    cols=cols,
                    rows=rows,
                    rotation=rotation,
                    mode=mode,
                    center_grid=True,
                    fill_direction=fill_direction,
                    form_plan=fp
                )

                # Har bir katak uchun (src_doc, src_page_num) qaytaruvchi funksiya (Oldi)
                def resolve_front_source(item: PlacedItem) -> Tuple[pymupdf.Document, int]:
                    v_idx = max(0, min(item.variant_index, len(variants) - 1))
                    var = variants[v_idx]
                    d = get_doc(var.front_pdf_path)
                    if d is None:
                        raise FileNotFoundError(f"Oldi PDF topilmadi: {var.front_pdf_path}")
                    pno = max(0, min(var.front_page_num, len(d) - 1))
                    return d, pno

                # Oldi sahifa
                side_front_label = f"Oldi ({form_tag})" if num_forms > 1 else "Oldi"
                job_front = JobMetadata(
                    order_number=job.order_number,
                    job_name=job.job_name,
                    date_str=job.date_str,
                    order_quantity=form_order_qty,
                    waste_sheets=job.waste_sheets,
                    calculated_sheets=fp.total_sheets_with_waste,
                    colors=job.colors,
                    side_name=side_front_label,
                    sheet_form_str=job.sheet_form_str,
                    custom_notes=summary_notes
                )
                front_sheet_doc = self._create_multi_sheet_page(
                    source_resolver=resolve_front_source,
                    items=front_items,
                    sheet=sheet,
                    bg_config=bg_config,
                    job=job_front,
                    style=style,
                    is_dieline=False
                )
                out_combined.insert_pdf(front_sheet_doc)
                page_labels.append(f"{form_tag} - Oldi ({fp.total_sheets_with_waste} list)")

                if export_separate_files and output_path:
                    base, ext = os.path.splitext(output_path)
                    suffix = f"_forma{fp.form_index}_oldi" if num_forms > 1 else "_oldi"
                    f_path = f"{base}{suffix}{ext}"
                    front_sheet_doc.save(f_path)
                    generated_files.append(f_path)
                front_sheet_doc.close()

                # Orqa sahifa (agar mavjud bo'lsa)
                if has_back and back_items:
                    def resolve_back_source(item: PlacedItem) -> Tuple[pymupdf.Document, int]:
                        v_idx = max(0, min(item.variant_index, len(variants) - 1))
                        var = variants[v_idx]
                        if var.back_pdf_path and os.path.exists(var.back_pdf_path):
                            bd = get_doc(var.back_pdf_path)
                            bpno = var.back_page_num if var.back_page_num is not None else 0
                            bpno = max(0, min(bpno, len(bd) - 1))
                            return bd, bpno
                        if shared_back_doc is not None:
                            return shared_back_doc, 0
                        # Fallback: agar turning front_pdf_path da 2-bet bo'lsa
                        fd = get_doc(var.front_pdf_path)
                        if len(fd) >= 2:
                            return fd, 1
                        return fd, 0

                    side_back_label = f"Orqa ({form_tag})" if num_forms > 1 else "Orqa"
                    job_back = JobMetadata(
                        order_number=job.order_number,
                        job_name=job.job_name,
                        date_str=job.date_str,
                        order_quantity=form_order_qty,
                        waste_sheets=job.waste_sheets,
                        calculated_sheets=fp.total_sheets_with_waste,
                        colors=job.colors,
                        side_name=side_back_label,
                        sheet_form_str=job.sheet_form_str,
                        custom_notes=summary_notes
                    )
                    back_sheet_doc = self._create_multi_sheet_page(
                        source_resolver=resolve_back_source,
                        items=back_items,
                        sheet=sheet,
                        bg_config=bg_config,
                        job=job_back,
                        style=style,
                        is_dieline=False
                    )
                    out_combined.insert_pdf(back_sheet_doc)
                    page_labels.append(f"{form_tag} - Orqa ({fp.total_sheets_with_waste} list)")

                    if export_separate_files and output_path:
                        base, ext = os.path.splitext(output_path)
                        suffix = f"_forma{fp.form_index}_orqa" if num_forms > 1 else "_orqa"
                        b_path = f"{base}{suffix}{ext}"
                        back_sheet_doc.save(b_path)
                        generated_files.append(b_path)
                    back_sheet_doc.close()

                # Pichoq va Proof sahifalari
                if die_doc is not None:
                    # Pichoq hamma formaga bir xil bo'lgani uchun 1-formada (yoki har bir formada)
                    if fp.form_index == 1:
                        job_die = JobMetadata(
                            order_number=job.order_number,
                            job_name=job.job_name,
                            date_str=job.date_str,
                            order_quantity=job.order_quantity,
                            calculated_sheets=total_sheets_all_forms,
                            colors=job.colors,
                            side_name="Pichoq (Die-cut)",
                            sheet_form_str=job.sheet_form_str,
                            custom_notes=summary_notes
                        )
                        die_sheet_doc = self._create_sheet_page(
                            src_doc=die_doc,
                            src_page_num=die_pno,
                            items=front_items,
                            sheet=sheet,
                            bg_config=bg_config,
                            job=job_die,
                            style=style,
                            is_dieline=True,
                            side_name="Pichoq"
                        )
                        out_combined.insert_pdf(die_sheet_doc)
                        page_labels.append("Pichoq (Die-cut)")

                        if export_separate_files and output_path:
                            base, ext = os.path.splitext(output_path)
                            d_path = f"{base}_pichoq{ext}"
                            die_sheet_doc.save(d_path)
                            generated_files.append(d_path)
                        die_sheet_doc.close()

                    if include_proof_overlay:
                        proof_sheet_doc = self._create_multi_proof_overlay_sheet(
                            source_resolver=resolve_front_source,
                            die_doc=die_doc,
                            die_pno=die_pno,
                            items=front_items,
                            sheet=sheet,
                            bg_config=bg_config,
                            job=job_front,
                            style=style,
                            form_tag=form_tag if num_forms > 1 else ""
                        )
                        out_combined.insert_pdf(proof_sheet_doc)
                        page_labels.append(f"{form_tag} - Tekshiruv (Dizayn + Pichoq)")
                        proof_sheet_doc.close()

            pdf_bytes = out_combined.tobytes(deflate=True)
            if output_path:
                out_combined.save(output_path, deflate=True)
                generated_files.append(output_path)

            return {
                "success": True,
                "output_path": output_path,
                "pdf_bytes": pdf_bytes,
                "generated_files": generated_files,
                "page_labels": page_labels,
                "cols": cols,
                "rows": rows,
                "rotation": rotation,
                "items_per_sheet": items_per_sheet,
                "calculated_sheets": total_sheets_all_forms,
                "has_back": has_back,
                "has_dieline": die_doc is not None,
                "form_plans": form_plans,
            }
        finally:
            out_combined.close()
            for d in doc_cache.values():
                try:
                    d.close()
                except Exception:
                    pass

    @staticmethod
    def _place_pdf_page_1to1(
        sheet_page: pymupdf.Page,
        src_doc: pymupdf.Document,
        src_page_num: int,
        item: PlacedItem,
        nom_w: float,
        nom_h: float,
        bleed_left: float,
        bleed_right: float,
        bleed_top: float,
        bleed_bottom: float,
        is_dieline_overlay: bool = False
    ):
        """
        Manba PDF sahifasini (Dizayn yoki Pichoq) montaj katagiga QAT'IY 1:1 (100%)
        masshtabda, markaz bo'yicha ideal moslashtirib joylashtiradi.
        Hech qachon dizaynni cho'zmaydi yoki pichoqni kichraytirmaydi!
        """
        src_page = src_doc[src_page_num]
        src_rect = src_page.rect
        src_cx = (src_rect.x0 + src_rect.x1) / 2.0
        src_cy = (src_rect.y0 + src_rect.y1) / 2.0

        # Manba sahifadagi toza kesim (Trim) chegaralari (markazga nisbatan)
        trim_x0 = src_cx - nom_w / 2.0
        trim_x1 = src_cx + nom_w / 2.0
        trim_y0 = src_cy - nom_h / 2.0
        trim_y1 = src_cy + nom_h / 2.0

        # Agar bu pichoq (dieline) bo'lsa, chiziq qalinligi (kontur) kesilib qolmasligi uchun
        # kamida 1.0 mm (yoki bleed qancha bo'lsa shuncha) hoshiya qoldiramiz
        if is_dieline_overlay:
            min_die_pad = 1.0 * MM_TO_PT
            b_left = max(bleed_left, min_die_pad)
            b_right = max(bleed_right, min_die_pad)
            b_top = max(bleed_top, min_die_pad)
            b_bottom = max(bleed_bottom, min_die_pad)
        else:
            b_left, b_right, b_top, b_bottom = bleed_left, bleed_right, bleed_top, bleed_bottom

        rot = item.rotation % 360
        # PyMuPDF da show_pdf_page(..., rotate=angle) bo'yicha yo'nalishlar:
        # rot == 0:   Target TOP = Src TOP,    Target RIGHT = Src RIGHT,  Target BOTTOM = Src BOTTOM, Target LEFT = Src LEFT
        # rot == 90:  Target TOP = Src RIGHT,  Target RIGHT = Src BOTTOM, Target BOTTOM = Src LEFT,   Target LEFT = Src TOP
        # rot == 180: Target TOP = Src BOTTOM, Target RIGHT = Src LEFT,   Target BOTTOM = Src TOP,    Target LEFT = Src RIGHT
        # rot == 270: Target TOP = Src LEFT,   Target RIGHT = Src TOP,    Target BOTTOM = Src RIGHT,  Target LEFT = Src BOTTOM
        if rot == 0:
            c_top = b_top
            c_right = b_right
            c_bottom = b_bottom
            c_left = b_left
        elif rot == 90:
            c_top = b_left
            c_right = b_top
            c_bottom = b_right
            c_left = b_bottom
        elif rot == 180:
            c_top = b_bottom
            c_right = b_left
            c_bottom = b_top
            c_left = b_right
        else:  # 270
            c_top = b_right
            c_right = b_bottom
            c_bottom = b_left
            c_left = b_top

        # Manba sahifadan qirqib olinadigan haqiqiy (mavjud) clip_rect
        clip_x0 = max(src_rect.x0, trim_x0 - c_left)
        clip_y0 = max(src_rect.y0, trim_y0 - c_top)
        clip_x1 = min(src_rect.x1, trim_x1 + c_right)
        clip_y1 = min(src_rect.y1, trim_y1 + c_bottom)
        clip_rect = pymupdf.Rect(clip_x0, clip_y0, clip_x1, clip_y1)

        # Manbada haqiqatan mavjud bo'lgan bleed miqdori (pt):
        # Bu target_rect va clip_rect 100% bir xil 1:1 o'lchamda bo'lishini kafolatlaydi!
        act_c_left = trim_x0 - clip_x0
        act_c_right = clip_x1 - trim_x1
        act_c_top = trim_y0 - clip_y0
        act_c_bottom = clip_y1 - trim_y1

        if rot == 0:
            act_b_top = act_c_top
            act_b_right = act_c_right
            act_b_bottom = act_c_bottom
            act_b_left = act_c_left
        elif rot == 90:
            act_b_top = act_c_right
            act_b_right = act_c_bottom
            act_b_bottom = act_c_left
            act_b_left = act_c_top
        elif rot == 180:
            act_b_top = act_c_bottom
            act_b_right = act_c_left
            act_b_bottom = act_c_top
            act_b_left = act_c_right
        else:  # 270
            act_b_top = act_c_left
            act_b_right = act_c_top
            act_b_bottom = act_c_right
            act_b_left = act_c_bottom

        target_rect = pymupdf.Rect(
            item.trim_x - act_b_left,
            item.trim_y - act_b_top,
            item.trim_x + item.trim_w + act_b_right,
            item.trim_y + item.trim_h + act_b_bottom
        )

        sheet_page.show_pdf_page(
            target_rect,
            src_doc,
            src_page_num,
            rotate=item.rotation,
            clip=clip_rect,
            keep_proportion=False
        )

    def _create_multi_sheet_page(
        self,
        source_resolver,
        items: List[PlacedItem],
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        job: JobMetadata,
        style: TemplateStyle,
        is_dieline: bool,
    ) -> pymupdf.Document:
        """Har bir katakka o'zining (src_doc, src_page_num) sahifasini vektor joylashtiradi."""
        page_doc = pymupdf.open()
        sheet_page = page_doc.new_page(width=sheet.width_pt, height=sheet.height_pt)

        if not items:
            return page_doc

        max_col = max(it.col for it in items)
        max_row = max(it.row for it in items)
        nom_w = bg_config.trim_width_pt
        nom_h = bg_config.trim_height_pt

        for item in items:
            src_doc, src_page_num = source_resolver(item)

            bleed_left = bg_config.outer_bleed_pt if item.col == 0 else min(bg_config.inner_bleed_pt, bg_config.gutter_x_pt / 2.0)
            bleed_right = bg_config.outer_bleed_pt if item.col == max_col else min(bg_config.inner_bleed_pt, bg_config.gutter_x_pt / 2.0)
            bleed_top = bg_config.outer_bleed_pt if item.row == 0 else min(bg_config.inner_bleed_pt, bg_config.gutter_y_pt / 2.0)
            bleed_bottom = bg_config.outer_bleed_pt if item.row == max_row else min(bg_config.inner_bleed_pt, bg_config.gutter_y_pt / 2.0)

            self._place_pdf_page_1to1(
                sheet_page=sheet_page,
                src_doc=src_doc,
                src_page_num=src_page_num,
                item=item,
                nom_w=nom_w,
                nom_h=nom_h,
                bleed_left=bleed_left,
                bleed_right=bleed_right,
                bleed_top=bleed_top,
                bleed_bottom=bleed_bottom,
                is_dieline_overlay=is_dieline
            )

        marks_pdf_bytes = MarksGenerator.create_marks_pdf_bytes(
            sheet=sheet,
            bg_config=bg_config,
            items=items,
            job=job,
            style=style,
            is_dieline_sheet=is_dieline
        )
        marks_doc = pymupdf.open(stream=marks_pdf_bytes, filetype="pdf")
        sheet_page.show_pdf_page(sheet_page.rect, marks_doc, 0)
        marks_doc.close()

        return page_doc

    def _create_multi_proof_overlay_sheet(
        self,
        source_resolver,
        die_doc: pymupdf.Document,
        die_pno: int,
        items: List[PlacedItem],
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        job: JobMetadata,
        style: TemplateStyle,
        form_tag: str = ""
    ) -> pymupdf.Document:
        """To'plam dizaynlari ustiga Pichoqni qo'yib Proof sahifa yaratadi."""
        page_doc = pymupdf.open()
        sheet_page = page_doc.new_page(width=sheet.width_pt, height=sheet.height_pt)

        max_col = max(it.col for it in items)
        max_row = max(it.row for it in items)
        nom_w = bg_config.trim_width_pt
        nom_h = bg_config.trim_height_pt

        for item in items:
            front_doc, front_pno = source_resolver(item)

            bleed_left = bg_config.outer_bleed_pt if item.col == 0 else min(bg_config.inner_bleed_pt, bg_config.gutter_x_pt / 2.0)
            bleed_right = bg_config.outer_bleed_pt if item.col == max_col else min(bg_config.inner_bleed_pt, bg_config.gutter_x_pt / 2.0)
            bleed_top = bg_config.outer_bleed_pt if item.row == 0 else min(bg_config.inner_bleed_pt, bg_config.gutter_y_pt / 2.0)
            bleed_bottom = bg_config.outer_bleed_pt if item.row == max_row else min(bg_config.inner_bleed_pt, bg_config.gutter_y_pt / 2.0)

            # 1. Pastki qatlam: Dizayn (1:1 masshtabda, bleed bilan)
            self._place_pdf_page_1to1(
                sheet_page=sheet_page,
                src_doc=front_doc,
                src_page_num=front_pno,
                item=item,
                nom_w=nom_w,
                nom_h=nom_h,
                bleed_left=bleed_left,
                bleed_right=bleed_right,
                bleed_top=bleed_top,
                bleed_bottom=bleed_bottom,
                is_dieline_overlay=False
            )

            # 2. Ustki qatlam: Pichoq (1:1 masshtabda, aynan markaz bo'yicha ustma-ust!)
            self._place_pdf_page_1to1(
                sheet_page=sheet_page,
                src_doc=die_doc,
                src_page_num=die_pno,
                item=item,
                nom_w=nom_w,
                nom_h=nom_h,
                bleed_left=bleed_left,
                bleed_right=bleed_right,
                bleed_top=bleed_top,
                bleed_bottom=bleed_bottom,
                is_dieline_overlay=True
            )

        side_title = f"PROOF ({form_tag})" if form_tag else "PROOF (Dizayn + Pichoq)"
        job_proof = JobMetadata(
            order_number=job.order_number,
            job_name=job.job_name,
            date_str=job.date_str,
            order_quantity=job.order_quantity,
            calculated_sheets=job.calculated_sheets,
            colors=job.colors,
            side_name=side_title,
            sheet_form_str=job.sheet_form_str,
            custom_notes=job.custom_notes
        )
        marks_bytes = MarksGenerator.create_marks_pdf_bytes(
            sheet=sheet,
            bg_config=bg_config,
            items=items,
            job=job_proof,
            style=style,
            is_dieline_sheet=False
        )
        marks_doc = pymupdf.open(stream=marks_bytes, filetype="pdf")
        sheet_page.show_pdf_page(sheet_page.rect, marks_doc, 0)
        marks_doc.close()

        return page_doc

    def _create_sheet_page(
        self,
        src_doc: pymupdf.Document,
        src_page_num: int,
        items: List[PlacedItem],
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        job: JobMetadata,
        style: TemplateStyle,
        is_dieline: bool,
        side_name: str
    ) -> pymupdf.Document:
        """Bitta montaj sahifasini (oldi, orqa yoki pichoq) yaratadi."""
        return self._create_multi_sheet_page(
            source_resolver=lambda _item: (src_doc, src_page_num),
            items=items,
            sheet=sheet,
            bg_config=bg_config,
            job=job,
            style=style,
            is_dieline=is_dieline
        )

    def _create_proof_overlay_sheet(
        self,
        front_doc: pymupdf.Document,
        front_pno: int,
        die_doc: pymupdf.Document,
        die_pno: int,
        items: List[PlacedItem],
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        job: JobMetadata,
        style: TemplateStyle
    ) -> pymupdf.Document:
        """Dizayn va Pichoqni bitta montaj listida ustma-ust ko'rsatuvchi Proof sahifa."""
        return self._create_multi_proof_overlay_sheet(
            source_resolver=lambda _item: (front_doc, front_pno),
            die_doc=die_doc,
            die_pno=die_pno,
            items=items,
            sheet=sheet,
            bg_config=bg_config,
            job=job,
            style=style
        )
