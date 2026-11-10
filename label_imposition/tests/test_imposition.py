"""Comprehensive unit and integration tests for the Sticker/Label Imposition system."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

import pymupdf

from core.color_separator import enforce_and_audit_grayscale_black
from core.gear_manager import GearManager
from core.imposition_engine import ImpositionConfig, ImpositionEngine
from core.pdf_inspector import inspect_pdf_design, inspect_pdf_designs, pt_to_mm
from core.sample_generator import (
    create_sample_26_stickers_sheet,
    create_sample_60x20_two_color,
    create_sample_80x12_care_label,
    create_sample_80x15_reserved,
)


class TestLabelImposition(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="label_imp_test_"))
        self.gear_manager = GearManager()
        self.engine = ImpositionEngine(self.gear_manager)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_available_yellow_gears_count_and_values(self) -> None:
        avail = self.gear_manager.get_available_gears()
        avail_nums = [g.gear for g in avail]
        expected_yellow = [41, 43, 44, 45, 47, 50, 52, 55, 56, 57, 59, 62, 64, 66, 78]
        self.assertEqual(avail_nums, expected_yellow)

    def test_80mm_matches_gear_59(self) -> None:
        match = self.gear_manager.find_best_gear(80.0)
        self.assertEqual(match.gear, 59)
        self.assertEqual(match.copies_count, 2)
        self.assertAlmostEqual(match.printing_length_mm, 159.93, places=2)
        self.assertAlmostEqual(match.film_length_mm, 150.63, places=2)
        self.assertAlmostEqual(match.slot_printing_length_mm, 79.965, places=3)
        self.assertAlmostEqual(match.slot_film_length_mm, 75.315, places=3)

    def test_60mm_matches_gear_45(self) -> None:
        match = self.gear_manager.find_best_gear(60.0)
        self.assertEqual(match.gear, 45)
        self.assertEqual(match.copies_count, 2)
        self.assertAlmostEqual(match.printing_length_mm, 121.98, places=2)
        self.assertAlmostEqual(match.film_length_mm, 112.68, places=2)
        self.assertAlmostEqual(match.slot_printing_length_mm, 60.99, places=2)
        self.assertAlmostEqual(match.slot_film_length_mm, 56.34, places=2)

    def test_80x15_reserved_single_imposition_vector_and_regmarks(self) -> None:
        sample_pdf = create_sample_80x15_reserved(self.temp_dir / "80x15.pdf", with_border=True)
        info = inspect_pdf_design(sample_pdf)
        self.assertTrue(info.has_outer_border)
        self.assertAlmostEqual(info.width_mm, 15.0, delta=0.3)
        self.assertAlmostEqual(info.length_mm, 80.0, delta=0.3)

        cfg = ImpositionConfig(
            remove_outer_border=True,
            separate_colors=True,
            regmark_enabled=True,
            regmark_stroke_mm=0.2,
            regmark_tick_mm=0.7,
            export_svg=True,
            export_eps=True,
        )
        res = self.engine.process_single_file(sample_pdf, self.temp_dir / "out", config=cfg)
        self.assertEqual(res.gear_match.gear, 59)
        self.assertTrue(res.audit_report is not None and res.audit_report.passed)
        # PDF + SVG + EPS
        self.assertEqual(len(res.output_files), 3)

        out_pdf = res.output_files[0]
        doc = pymupdf.open(out_pdf)
        try:
            page = doc[0]
            trim = page.trimbox
            self.assertAlmostEqual(pt_to_mm(trim.width), info.width_mm, delta=0.05)
            self.assertAlmostEqual(pt_to_mm(trim.height), 150.63, delta=0.05)

            # Verify 100% vector text is preserved and repeated 2 times
            txt = page.get_text()
            self.assertEqual(txt.count("RESERVED"), 2)

            # Verify final grayscale black audit on the saved file
            audit = enforce_and_audit_grayscale_black(doc)
            self.assertTrue(audit.passed)
        finally:
            doc.close()

    def test_60x20_two_color_separation_and_pure_grayscale_black(self) -> None:
        sample_pdf = create_sample_60x20_two_color(self.temp_dir / "60x20_2col.pdf", with_border=True)

        # 1. Test separate_files mode so we can inspect each color plate individually
        cfg_sep = ImpositionConfig(
            remove_outer_border=True,
            separate_colors=True,
            color_output_mode="separate_files",
        )
        res_sep = self.engine.process_single_file(sample_pdf, self.temp_dir / "out_sep", config=cfg_sep)
        self.assertEqual(res_sep.gear_match.gear, 45)
        self.assertEqual(len(res_sep.detected_colors), 2)
        self.assertEqual(len(res_sep.output_files), 2)

        # Verify Plate 1 (Black) has "100% SATIN" twice and NOT "PREMIUM"
        # Verify Plate 2 (Red) has "PREMIUM" twice and NOT "100% SATIN"
        plate_texts = []
        for f in res_sep.output_files:
            d = pymupdf.open(f)
            try:
                plate_texts.append(d[0].get_text())
                audit = enforce_and_audit_grayscale_black(d)
                self.assertTrue(audit.passed, f"Grayscale audit failed on {f}: {audit.details}")
            finally:
                d.close()

        combined_check = "\n---\n".join(plate_texts)
        self.assertIn("100% SATIN", combined_check)
        self.assertIn("PREMIUM", combined_check)
        # Ensure separation actually isolated the two texts onto different plates
        for pt in plate_texts:
            self.assertFalse("100% SATIN" in pt and "PREMIUM" in pt)

        # 2. Test side_by_side mode (both color plates placed side-by-side on 1 page)
        cfg_sbs = ImpositionConfig(
            remove_outer_border=True,
            separate_colors=True,
            color_output_mode="side_by_side",
            column_gap_mm=5.0,
        )
        res_sbs = self.engine.process_single_file(sample_pdf, self.temp_dir / "out_sbs", config=cfg_sbs)
        self.assertEqual(len(res_sbs.output_files), 1)
        d_sbs = pymupdf.open(res_sbs.output_files[0])
        try:
            trim = d_sbs[0].trimbox
            # 2 columns of ~20mm + 5mm gap = ~45mm width, height = 112.68mm (Gear 45 Film length)
            self.assertAlmostEqual(pt_to_mm(trim.width), res_sbs.design_info.width_mm * 2 + 5.0, delta=0.1)
            self.assertAlmostEqual(pt_to_mm(trim.height), 112.68, delta=0.05)
            audit_sbs = enforce_and_audit_grayscale_black(d_sbs)
            self.assertTrue(audit_sbs.passed)
        finally:
            d_sbs.close()

    def test_multi_file_same_gear_combination(self) -> None:
        f1 = create_sample_80x15_reserved(self.temp_dir / "d1_80x15.pdf")
        f2 = create_sample_80x12_care_label(self.temp_dir / "d2_80x12.pdf")

        cfg = ImpositionConfig(column_gap_mm=5.0)
        results = self.engine.process_batch_combined_by_gear([f1, f2], self.temp_dir / "out_comb", config=cfg)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].output_files, results[1].output_files)

        comb_pdf = results[0].output_files[0]
        doc = pymupdf.open(comb_pdf)
        try:
            page = doc[0]
            txt = page.get_text()
            self.assertEqual(txt.count("RESERVED"), 2)
            self.assertEqual(txt.count("100% COTTON"), 2)
            expected_w = results[0].design_info.width_mm + results[1].design_info.width_mm + 5.0
            self.assertAlmostEqual(pt_to_mm(page.trimbox.width), expected_w, delta=0.1)
            self.assertAlmostEqual(pt_to_mm(page.trimbox.height), 150.63, delta=0.05)
        finally:
            doc.close()

    def test_26_stickers_in_single_pdf_split_and_imposed(self) -> None:
        sheet_pdf = create_sample_26_stickers_sheet(self.temp_dir / "sela_26_sheet.pdf")
        designs = inspect_pdf_designs(sheet_pdf)
        self.assertEqual(len(designs), 26)
        for d in designs:
            self.assertAlmostEqual(d.width_mm, 20.0, delta=0.2)
            self.assertAlmostEqual(d.length_mm, 60.0, delta=0.2)
            self.assertTrue(d.has_outer_border)

        results = self.engine.process_all_designs_in_file(sheet_pdf, self.temp_dir / "out_26")
        self.assertEqual(len(results), 26)

        # Verify sticker #01 ("CARE #01") and sticker #26 ("SL7805-26") are separated and each repeated 2x on Gear 45
        d1 = pymupdf.open(results[0].output_files[0])
        d26 = pymupdf.open(results[25].output_files[0])
        try:
            t1 = d1[0].get_text()
            t26 = d26[0].get_text()
            self.assertEqual(t1.count("CARE #01"), 2)
            self.assertNotIn("SL7805-26", t1)
            self.assertEqual(t26.count("SL7805-26"), 2)
            self.assertNotIn("CARE #01", t26)
        finally:
            d1.close()
            d26.close()

    def test_filled_and_stroked_border_removal(self) -> None:
        """Verifies that outer borders with white fill and black outline (CorelDRAW 'b' operator) are removed."""
        pdf_path = self.temp_dir / "filled_stroke_border.pdf"
        doc = pymupdf.open()
        page = doc.new_page(width=100, height=200)
        # Emulate CorelDRAW's white filled + black stroked rectangle (operator 'b')
        stream = (
            b"0.5669 w\n"
            b"0.0 0.0 0.0 1.0 K\n"  # black stroke
            b"0.0 0.0 0.0 0.0 k\n"  # white fill
            b"10 180 m 90 180 l 90 20 l 10 20 l h b\n"  # outer border with fill & stroke
            b"BT /Helv 10 Tf 20 100 Td (LABEL TEST) Tj ET\n"
        )
        page.clean_contents()
        doc.update_stream(page.get_contents()[0], stream)
        doc.save(pdf_path)
        doc.close()

        designs = inspect_pdf_designs(pdf_path)
        self.assertEqual(len(designs), 1)
        self.assertTrue(designs[0].has_outer_border)

        res = self.engine.process_single_file(pdf_path, self.temp_dir / "out_fs")
        out_doc = pymupdf.open(res.output_files[0])
        try:
            big_borders = [d for d in out_doc[0].get_drawings() if d["rect"].width > 50 and d["rect"].height > 100]
            self.assertEqual(len(big_borders), 0)
        finally:
            out_doc.close()


if __name__ == "__main__":
    unittest.main()
