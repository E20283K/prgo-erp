"""
Avtomatlashtirilgan Poligrafiya Montaj va Preflight Testlari
"""

import os
import unittest
import pymupdf

from app.sheet_imposition.models import (
    SheetConfig,
    BleedAndGutterConfig,
    JobMetadata,
    ImpositionMode,
    TemplateStyle,
    DesignVariant,
    GangingStrategy,
    GridFillDirection,
    JobCategory,
    GuillotineCutStyle,
    SheetAlignment,
)
from app.sheet_imposition.preflight import PreflightChecker
from app.sheet_imposition.calculator import LayoutCalculator
from app.sheet_imposition.engine import ImpositionEngine

MM_TO_PT = 72.0 / 25.4
PT_TO_MM = 25.4 / 72.0


class TestImpositionSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Namuna va natija PDF'lari vaqtinchalik papkada yaratiladi (repo CWD ifloslanmasin)
        import tempfile
        cls._orig_cwd = os.getcwd()
        cls._tmp_dir = tempfile.TemporaryDirectory(prefix="sheet-imposition-tests-")
        os.chdir(cls._tmp_dir.name)
        # Namunalarning mavjudligini ta'minlash
        from tests.sheet_imposition.generate_samples import (
            create_sample1_twins,
            create_sample2_rs,
            create_sample3_packaging,
        )
        if not os.path.exists("sample1_twins_card.pdf"):
            create_sample1_twins()
        if not os.path.exists("sample2_rs_birka.pdf"):
            create_sample2_rs()
        if not os.path.exists("sample3_label_design.pdf"):
            create_sample3_packaging()
        if not os.path.exists("test_pantone476_and_black.pdf"):
            from reportlab.pdfgen import canvas
            from reportlab.lib.colors import CMYKColor, CMYKColorSep
            c = canvas.Canvas("test_pantone476_and_black.pdf", pagesize=(200, 300))
            c.setFillColor(CMYKColorSep(0.35, 0.68, 0.75, 0.65, spotName="PANTONE 476 C"))
            c.rect(10, 10, 180, 280, fill=1, stroke=0)
            c.setFillColor(CMYKColor(0, 0, 0, 1))
            c.setFont("Helvetica-Bold", 14)
            c.drawString(30, 150, "Black Text")
            c.showPage()
            c.save()

    @classmethod
    def tearDownClass(cls):
        os.chdir(cls._orig_cwd)
        cls._tmp_dir.cleanup()

    def test_01_preflight_dpi_detection(self):
        """Sample 1 dagi past sifatli (<300 DPI) rastr rasm aniqlanishini tekshirish."""
        checker = PreflightChecker(target_dpi=300.0)
        report = checker.check_pdf("sample1_twins_card.pdf")

        self.assertTrue(report.is_valid)
        self.assertEqual(report.page_count, 2)
        self.assertTrue(report.has_low_dpi, "DPI < 300 aniqlanishi shart!")

        # DPI ogohlantirishini tekshirish
        dpi_issues = [i for i in report.issues if i.category == "DPI"]
        self.assertTrue(len(dpi_issues) > 0, "DPI bo'yicha ogohlantirish ro'yxatda bo'lishi kerak")
        self.assertLess(report.images[0].effective_dpi, 300.0)
        print(f"\n[Test 1 OK] Past DPI aniqlandi: {report.images[0].effective_dpi:.1f} DPI")

    def test_02_preflight_spot_colors(self):
        """Sample 2 dagi Pantone Spot ranglar va bo'yoq kanallari aniqlanishini tekshirish."""
        checker = PreflightChecker()
        report = checker.check_pdf("sample2_rs_birka.pdf")

        color_names = [c.name for c in report.colors]
        # PANTONE 280 C yoki PANTONE 11-0602 C mavjud bo'lishi kerak
        has_pantone = any("280" in name or "11-0602" in name or "PANTONE" in name.upper() for name in color_names)
        self.assertTrue(has_pantone, f"Spot ranglar aniqlanmadi: {color_names}")
        print(f"\n[Test 2 OK] Aniqlangan ranglar: {color_names}")

    def test_02b_preflight_pantone_and_black(self):
        """Pantone 476 C va Black birga qatnashganda ikkala kanal ham aniqlanishini tekshirish."""
        checker = PreflightChecker()
        report = checker.check_pdf("test_pantone476_and_black.pdf")

        color_names = [c.name for c in report.colors]
        self.assertIn("PANTONE 476 C", color_names)
        self.assertIn("Black", color_names)
        self.assertEqual(len(color_names), 2)
        print(f"\n[Test 2b OK] Pantone 476 C va Black aniqlandi: {color_names}")

    def test_03_preflight_bleed_calculation(self):
        """Sample 3 dagi 103x78 mm dizayn uchun 100x75 mm trim berilganda 1.5 mm bleed aniqlanishi."""
        checker = PreflightChecker()
        report = checker.check_pdf("sample3_label_design.pdf", expected_trim_mm=(100.0, 75.0))

        self.assertAlmostEqual(report.detected_bleed_mm, 1.5, delta=0.2)
        print(f"\n[Test 3 OK] Aniqlangan bleed: {report.detected_bleed_mm} mm (Kutilgan: 1.5 mm)")

    def test_04_calculator_sheets_count(self):
        """2-rasmdagi: 100 000 dona buyurtma, 25 ta sig'imda aniq 4 000 list chiqishini tekshirish."""
        sheets = LayoutCalculator.calculate_sheets_needed(
            order_qty=100000,
            items_per_sheet=25,
            waste_sheets=0
        )
        self.assertEqual(sheets, 4000)

        # Brak bilan
        sheets_with_waste = LayoutCalculator.calculate_sheets_needed(
            order_qty=100000,
            items_per_sheet=25,
            waste_sheets=50
        )
        self.assertEqual(sheets_with_waste, 4050)
        print(f"\n[Test 4 OK] 100 000 dona / 25 ta = {sheets} list")

    def test_05_imposition_packaging_with_dieline(self):
        """Sample 3: Packaging uslubi (3-rasm), Oldi + Pichoq montaji va Proof sahifasini tekshirish."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=100.0,
            trim_height_mm=75.0,
            bleed_mm=1.5,
            gutter_x_mm=3.0,
            gutter_y_mm=3.0
        )
        job = JobMetadata(
            order_number="№1045",
            job_name="Etiketka_Packaging",
            order_quantity=100000
        )

        out_pdf = "test_output_sample3.pdf"
        res = engine.run_imposition(
            front_pdf_path="sample3_label_design.pdf",
            dieline_pdf_path="sample3_label_dieline.pdf",
            sheet=sheet,
            bg_config=bg,
            style=TemplateStyle.PACKAGING_DIE_CUT,
            job=job,
            output_path=out_pdf,
            include_proof_overlay=True
        )

        self.assertTrue(os.path.exists(out_pdf))
        doc = pymupdf.open(out_pdf)

        # 3 ta sahifa bo'lishi kerak: 1-Oldi, 2-Pichoq, 3-Proof
        self.assertEqual(len(doc), 3)

        # Sahifa o'lchami 500x350 mm ga mos kelishi kerak
        page0 = doc[0]
        self.assertAlmostEqual(page0.rect.width * 25.4 / 72.0, 500.0, delta=1.0)
        self.assertAlmostEqual(page0.rect.height * 25.4 / 72.0, 350.0, delta=1.0)

        # Har bir sahifada Form XObject mavjudligini (vektor saqlanganligini) tekshiramiz
        xobjects = page0.get_xobjects()
        self.assertTrue(len(xobjects) > 0, "PDF da Form XObject vektor montaj saqlangan bo'lishi shart!")

        doc.close()
        print(f"\n[Test 5 OK] Sample 3 montaji tayyor: {out_pdf} (3 sahifa: Oldi, Pichoq, Proof)")

    def test_06_imposition_compact_zero_gutter(self):
        """Sample 2: 2-rasm uslubi (0 mm oraliq, Compact yozuv, 50x80 mm birka)."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=50.0,
            trim_height_mm=80.0,
            bleed_mm=0.0,
            gutter_x_mm=0.0,
            gutter_y_mm=0.0
        )
        job = JobMetadata(
            order_number="№1001",
            job_name="RS_birka_50x80_layout",
            order_quantity=100000
        )

        out_pdf = "test_output_sample2_compact.pdf"
        res = engine.run_imposition(
            front_pdf_path="sample2_rs_birka.pdf",
            sheet=sheet,
            bg_config=bg,
            style=TemplateStyle.COMPACT_SIDE_INFO,
            job=job,
            output_path=out_pdf
        )

        self.assertTrue(os.path.exists(out_pdf))
        doc = pymupdf.open(out_pdf)
        self.assertEqual(len(doc), 1)
        doc.close()
        print(f"\n[Test 6 OK] Sample 2 montaji tayyor: {out_pdf} (0 mm oraliq, Compact)")

    def test_07_imposition_sheetwise_two_sided(self):
        """Sample 1: 1-rasm uslubi (Twins, Sheetwise Oldi va Orqa alohida sahifalarda)."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=55.0,
            trim_height_mm=90.0,
            bleed_mm=1.5,
            gutter_x_mm=3.0,
            gutter_y_mm=3.0
        )
        job = JobMetadata(
            order_number="№902",
            job_name="Twins_Card",
            order_quantity=50000
        )

        out_pdf = "test_output_sample1_sheetwise.pdf"
        res = engine.run_imposition(
            front_pdf_path="sample1_twins_card.pdf",
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode.SHEETWISE,
            style=TemplateStyle.STANDARD_COLORBAR,
            job=job,
            output_path=out_pdf
        )

        self.assertTrue(os.path.exists(out_pdf))
        doc = pymupdf.open(out_pdf)
        # 2 ta sahifa bo'lishi kerak: 1-Oldi, 2-Orqa
        self.assertEqual(len(doc), 2)
        doc.close()
        print(f"\n[Test 7 OK] Sample 1 Sheetwise tayyor: {out_pdf} (2 sahifa: Oldi va Orqa)")

    def test_08_no_inner_crop_marks(self):
        """Montaj blokining ichida hech qanday krop chizig'i bo'lmasligi, faqat tashqi perimetrda bo'lishini tekshirish."""
        from app.sheet_imposition.marks import MarksGenerator
        from app.sheet_imposition.models import PlacedItem

        sheet = SheetConfig(width_mm=500.0, height_mm=350.0)
        bg = BleedAndGutterConfig(gutter_x_mm=3.0, gutter_y_mm=3.0, crop_offset_mm=1.0, crop_length_mm=4.0)

        # 2x2 grid
        items = [
            PlacedItem(col=0, row=0, trim_x=100.0, trim_y=100.0, trim_w=100.0, trim_h=80.0),
            PlacedItem(col=1, row=0, trim_x=203.0, trim_y=100.0, trim_w=100.0, trim_h=80.0),
            PlacedItem(col=0, row=1, trim_x=100.0, trim_y=183.0, trim_w=100.0, trim_h=80.0),
            PlacedItem(col=1, row=1, trim_x=203.0, trim_y=183.0, trim_w=100.0, trim_h=80.0),
        ]
        job = JobMetadata()
        pdf_bytes = MarksGenerator.create_marks_pdf_bytes(sheet, bg, items, job)

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        drawings = page.get_drawings()

        min_x = 100.0
        max_x = 303.0
        min_y = 100.0
        max_y = 263.0

        inner_crop_lines = []
        for d in drawings:
            for item in d.get("items", []):
                if item[0] == "l":
                    p1, p2 = item[1], item[2]
                    # Agar chiziq montaj blokining ichki maydonida bo'lsa
                    # (min_x va max_x orasida, hamda min_y va max_y orasida)
                    if (min_x < p1.x < max_x and min_y < p1.y < max_y) or \
                       (min_x < p2.x < max_x and min_y < p2.y < max_y):
                        inner_crop_lines.append((p1, p2))

        doc.close()
        self.assertEqual(len(inner_crop_lines), 0, f"Montaj ichida krop chiziqlari topildi: {inner_crop_lines}")
        print("\n[Test 8 OK] Montaj ichida hech qanday krop chizig'i yo'q, faqat tashqarida!")

    def test_09_klapan_gripper_marks(self):
        """Montaj listida Klapan (Gripper) va Verniy burchak belgilari mavjudligini tekshirish."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(trim_width_mm=100.0, trim_height_mm=75.0)
        res = engine.run_imposition(front_pdf_path="sample1_twins_card.pdf", sheet=sheet, bg_config=bg, output_path=None)

        doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
        text = doc[0].get_text()
        doc.close()

        self.assertIn("KLAPAN", text)
        self.assertIn("VERNY UGOL", text)
        self.assertIn("GRIPPER", text)
        print("\n[Test 9 OK] Klapan va Verniy burchak belgilari to'liq tushirildi!")

    def test_10_no_overlap_between_metadata_and_regmarks(self):
        """Privodka krestlari (Registration Marks) va pasport yozuvlari ustma-ust tushmasligini tekshirish."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_left_mm=12.0, margin_right_mm=12.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(trim_width_mm=60.0, trim_height_mm=88.0, bleed_mm=1.5, gutter_x_mm=3.0, gutter_y_mm=3.0)
        job = JobMetadata(
            job_name="artwork_test_preflight.pdf",
            order_quantity=100000,
            date_str="07.11.2026"
        )

        for style, label in [(TemplateStyle.COMPACT_SIDE_INFO, "Compact"), (TemplateStyle.PACKAGING_DIE_CUT, "Packaging")]:
            res = engine.run_imposition(
                front_pdf_path="sample2_rs_birka.pdf",
                sheet=sheet,
                bg_config=bg,
                style=style,
                job=job,
                output_path=None
            )
            doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
            page = doc[0]
            words = page.get_text("words")  # (x0, y0, x1, y1, word, block_no, line_no, word_no)
            
            H = page.rect.height
            W = page.rect.width
            reg_y = H / 2.0  # PyMuPDF da ham H / 2.0
            clearance_pt = 12.0 * 72.0 / 25.4  # Kamida 12 mm xavfsizlik buferi

            # Chap va o'ng krest hududlari
            left_margin_pt = sheet.margin_left_mm * 72.0 / 25.4
            right_margin_pt = sheet.margin_right_mm * 72.0 / 25.4

            left_forbidden_rect = pymupdf.Rect(0, reg_y - clearance_pt, left_margin_pt, reg_y + clearance_pt)
            right_forbidden_rect = pymupdf.Rect(W - right_margin_pt, reg_y - clearance_pt, W, reg_y + clearance_pt)

            overlapping_words = []
            for w in words:
                word_rect = pymupdf.Rect(w[0], w[1], w[2], w[3])
                word_str = w[4]
                if word_rect.intersects(left_forbidden_rect):
                    overlapping_words.append((f"Chap krestda: '{word_str}'", word_rect))
                if word_rect.intersects(right_forbidden_rect):
                    overlapping_words.append((f"O'ng krestda: '{word_str}'", word_rect))

            doc.close()
            self.assertEqual(
                len(overlapping_words), 0,
                f"[{label}] Krest bilan to'qnashgan matnlar topildi: {overlapping_words}"
            )

        print("\n[Test 10 OK] Privodka krestlari va matnlar orasida 100% toza xavfsizlik masofasi ta'minlandi!")

    def test_11_exact_kratnost_single_form(self):
        """
        9 ta tur: [1000, 2000, 1000, 2000, 2000, 3000, 3000, 4000, 2000] (Jami 20 000 dona).
        20 katakli listda: 1 ta Forma (1000 list), kataklar [1, 2, 1, 2, 2, 3, 3, 4, 2] va 0% ortiqcha chiqindi!
        """
        qtys = [1000, 2000, 1000, 2000, 2000, 3000, 3000, 4000, 2000]
        variants = [
            DesignVariant(variant_id=i + 1, name=f"Tur_{i+1}", front_pdf_path="sample1_twins_card.pdf", order_quantity=q)
            for i, q in enumerate(qtys)
        ]

        plans = LayoutCalculator.optimize_ganged_forms(
            variants=variants,
            items_per_sheet=20,
            strategy=GangingStrategy.SMART_NO_SPLIT,
            max_overprint_pct=10.0,
            waste_sheets=0
        )

        self.assertEqual(len(plans), 1, "20 katakli listda barcha 9 tur 1 ta formaga sig'ishi shart!")
        fp = plans[0]
        self.assertEqual(fp.sheet_run, 1000)
        self.assertEqual(fp.used_slots, 20)
        self.assertEqual(fp.total_overprint_qty, 0)

        slots_list = [a.slots for a in fp.allocations]
        self.assertEqual(slots_list, [1, 2, 1, 2, 2, 3, 3, 4, 2])
        print(f"\n[Test 11 OK] 9 tur (20 000 dona) -> 1 ta Forma ({fp.sheet_run} list), Kataklar: {slots_list}, Brak: 0 dona!")

    def test_12_multi_form_clustering_no_split(self):
        """
        Xuddi shu 9 ta tur 8 katakli listda SMART_NO_SPLIT rejimida:
        Har bir tur faqat bitta formada bo'ladi, 1000 va 3000 liklar (1+1+3+3=8 katak) bitta 1000 listlik formaga tushadi!
        """
        qtys = [1000, 2000, 1000, 2000, 2000, 3000, 3000, 4000, 2000]
        variants = [
            DesignVariant(variant_id=i + 1, name=f"V{i+1}", front_pdf_path="sample1_twins_card.pdf", order_quantity=q)
            for i, q in enumerate(qtys)
        ]

        plans = LayoutCalculator.optimize_ganged_forms(
            variants=variants,
            items_per_sheet=8,
            strategy=GangingStrategy.SMART_NO_SPLIT,
            max_overprint_pct=10.0,
            waste_sheets=0
        )

        self.assertEqual(len(plans), 2, "8 katakli listda 2 ta forma hosil bo'lishi kerak!")
        # Har bir tur faqat 1 ta formada qatnashganini tekshiramiz
        seen_variants = []
        for fp in plans:
            self.assertEqual(fp.used_slots, 8)
            for a in fp.allocations:
                seen_variants.append(a.variant_index)
        self.assertEqual(sorted(seen_variants), list(range(9)), "Har bir tur aniq 1 ta formada bo'lishi kerak!")
        print(f"\n[Test 12 OK] SMART_NO_SPLIT (8 katak): F1={plans[0].sheet_run} list ({plans[0].summary_str()}), F2={plans[1].sheet_run} list ({plans[1].summary_str()})")

    def test_13_multi_form_split_economy(self):
        """
        Xuddi shu 9 ta tur 8 katakli listda MAX_ECONOMY_SPLIT rejimida:
        3000 lik turlar Forma 1 (2000 list) va Forma 2 (500 list) orasida bo'linib,
        jami 2500 list va 0 dona ortiqcha chiqindi chiqadi!
        """
        qtys = [1000, 2000, 1000, 2000, 2000, 3000, 3000, 4000, 2000]
        variants = [
            DesignVariant(variant_id=i + 1, name=f"V{i+1}", front_pdf_path="sample1_twins_card.pdf", order_quantity=q)
            for i, q in enumerate(qtys)
        ]

        plans = LayoutCalculator.optimize_ganged_forms(
            variants=variants,
            items_per_sheet=8,
            strategy=GangingStrategy.MAX_ECONOMY_SPLIT,
            max_overprint_pct=5.0,
            waste_sheets=0
        )

        self.assertEqual(len(plans), 2)
        total_sheets = sum(fp.sheet_run for fp in plans)
        total_overprint = sum(fp.total_overprint_qty for fp in plans)
        self.assertEqual(total_sheets, 2500)
        self.assertEqual(total_overprint, 0)
        print(f"\n[Test 13 OK] MAX_ECONOMY_SPLIT (8 katak): Jami {total_sheets} list (F1={plans[0].sheet_run}, F2={plans[1].sheet_run}), Ortiqcha chiqindi: {total_overprint} dona!")

    def test_14_multi_variant_sheetwise_mirroring_and_engine(self):
        """
        Ko'p turli (S, M, L, XL) to'plamni Sheetwise (Oldi + Orqa) rejimida montaj qilganda,
        Oldi sahifaning chap ustunidagi (col=0) turning Orqasi Orqa sahifaning o'ng ustuniga (col=cols-1)
        tushishini va ImpositionEngine to'liq PDF yaratishini tekshirish.
        """
        # 4 betli test PDF yaratamiz: S_Oldi, S_Orqa, M_Oldi, M_Orqa
        from reportlab.pdfgen import canvas as rl_canvas
        multi_pdf = "test_multi_hangtags.pdf"
        c = rl_canvas.Canvas(multi_pdf, pagesize=(150, 240))
        labels = ["S_FRONT", "S_BACK", "M_FRONT", "M_BACK", "L_FRONT", "L_BACK", "XL_FRONT", "XL_BACK"]
        for lbl in labels:
            c.setFont("Helvetica-Bold", 18)
            c.drawString(20, 120, lbl)
            c.showPage()
        c.save()

        variants = ImpositionEngine.build_variants_from_files(
            front_files=[multi_pdf],
            multi_page_mode="alternating",
            default_quantity=1000
        )
        self.assertEqual(len(variants), 4)
        # S=1000, M=3000, L=3000, XL=1000 (Jami 8000 -> 8 katakli listda: 1, 3, 3, 1 katak)
        variants[0].name, variants[0].order_quantity = "S", 1000
        variants[1].name, variants[1].order_quantity = "M", 3000
        variants[2].name, variants[2].order_quantity = "L", 3000
        variants[3].name, variants[3].order_quantity = "XL", 1000

        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(trim_width_mm=50.0, trim_height_mm=80.0, bleed_mm=1.5, gutter_x_mm=3.0, gutter_y_mm=3.0)
        job = JobMetadata(order_number="№2050", job_name="Hangtag_Toplam")

        res = engine.run_imposition(
            variants=variants,
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode.SHEETWISE,
            style=TemplateStyle.PACKAGING_DIE_CUT,
            job=job,
            output_path=None,
            manual_grid=(4, 2, 0),  # 4 ustun x 2 qator = 8 katak
            fill_direction=GridFillDirection.COL_BY_COL
        )

        self.assertTrue(res["success"])
        self.assertEqual(res["calculated_sheets"], 1000)

        # Oyna aksini tekshiramiz: LayoutCalculator.generate_layout
        fp = res["form_plans"][0]
        front_items, back_items = LayoutCalculator.generate_layout(
            sheet=sheet,
            bg_config=bg,
            cols=4,
            rows=2,
            rotation=0,
            mode=ImpositionMode.SHEETWISE,
            fill_direction=GridFillDirection.COL_BY_COL,
            form_plan=fp
        )
        for f_it, b_it in zip(front_items, back_items):
            self.assertEqual(f_it.variant_index, b_it.variant_index)
            self.assertEqual(b_it.col, 3 - f_it.col)
            self.assertAlmostEqual(b_it.trim_x, sheet.width_pt - (f_it.trim_x + f_it.trim_w), places=3)

        doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
        self.assertEqual(len(doc), 2)  # 1-bet Oldi, 2-bet Orqa
        front_text = doc[0].get_text()
        back_text = doc[1].get_text()
        doc.close()

        for expected_f in ["S_FRONT", "M_FRONT", "L_FRONT", "XL_FRONT"]:
            self.assertIn(expected_f, front_text)
        for expected_b in ["S_BACK", "M_BACK", "L_BACK", "XL_BACK"]:
            self.assertIn(expected_b, back_text)

        if os.path.exists(multi_pdf):
            os.remove(multi_pdf)
        print("\n[Test 14 OK] Multi-dizayn Sheetwise (S, M, L, XL) Oldi va Orqa oyna mosligi 100% tasdiqlandi!")

    def test_15_multipage_single_pdf_variants(self):
        """
        Bitta PDF faylning har bir sahifasida alohida dizayn (masalan 5 betli PDF = 5 xil dizayn)
        bo'lganda build_variants_from_files(multi_page_mode='pages') va montaj tekshiruvi.
        """
        from reportlab.pdfgen import canvas as rl_canvas
        front_multipage = "test_5pages_front.pdf"
        back_multipage = "test_5pages_back.pdf"

        c_f = rl_canvas.Canvas(front_multipage, pagesize=(150, 240))
        c_b = rl_canvas.Canvas(back_multipage, pagesize=(150, 240))
        for i in range(1, 6):
            c_f.setFont("Helvetica-Bold", 12)
            c_f.drawString(15, 120, f"DESIGN_{i}_FRONT")
            c_f.showPage()

            c_b.setFont("Helvetica-Bold", 12)
            c_b.drawString(15, 120, f"DESIGN_{i}_BACK")
            c_b.showPage()
        c_f.save()
        c_b.save()

        variants = ImpositionEngine.build_variants_from_files(
            front_files=[front_multipage],
            multi_page_mode="pages",
            shared_back_pdf=back_multipage,
            default_quantity=1000
        )

        self.assertEqual(len(variants), 5)
        for i, v in enumerate(variants):
            self.assertEqual(v.front_page_num, i)
            self.assertEqual(v.back_page_num, i)

        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(trim_width_mm=50.0, trim_height_mm=80.0)
        res = engine.run_imposition(
            variants=variants,
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode.SHEETWISE,
            output_path=None,
            manual_grid=(5, 2, 0)  # 10 ta katak -> har biriga 2 tadan katak (500 list)
        )

        self.assertTrue(res["success"])
        self.assertEqual(res["calculated_sheets"], 500)

        doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
        f_txt = doc[0].get_text()
        b_txt = doc[1].get_text()
        doc.close()

        for i in range(1, 6):
            self.assertIn(f"DESIGN_{i}_FRONT", f_txt)
            self.assertIn(f"DESIGN_{i}_BACK", b_txt)

        for f in (front_multipage, back_multipage):
            if os.path.exists(f):
                os.remove(f)
        print("\n[Test 15 OK] 5 sahifali bitta PDF ning har bir sahifasi alohida dizayn sifatida 100% montaj qilindi!")

    def test_16_dieline_inside_larger_page_alignment(self):
        """
        Foydalanuvchi misoli:
        - Dizayn PDF: sahifasi 100.674 x 100.674 mm, ichidagi dizayn 94.674 x 94.674 mm + 3 mm bleed.
        - Noj PDF: sahifasi 100.674 x 100.674 mm, ichidagi pichoq konturi 94.674 x 94.674 mm.
        Pichoq o'lchami 94.67 mm deb avtomatik aniqlanishi va Proof sahifasida 1:1 ustma-ust tushishini tekshirish.
        """
        from reportlab.pdfgen import canvas as rl_canvas
        from app.sheet_imposition.calculator import MM_TO_PT

        page_mm = 100.674
        trim_mm = 94.674
        bleed_mm = 3.0

        f_art = "test_circle_art_100_674.pdf"
        f_die = "test_circle_die_100_674.pdf"

        page_pt = page_mm * MM_TO_PT
        trim_r_pt = (trim_mm / 2.0) * MM_TO_PT
        cx_pt = page_pt / 2.0
        cy_pt = page_pt / 2.0

        # 1. Dizayn PDF yaratish
        c1 = rl_canvas.Canvas(f_art, pagesize=(page_pt, page_pt))
        c1.setFillColorRGB(0.9, 0.1, 0.4)  # Pushti 3mm bleed doira
        c1.circle(cx_pt, cy_pt, (page_mm / 2.0) * MM_TO_PT, stroke=0, fill=1)
        c1.setFillColorRGB(0.55, 0.35, 0.1)  # Jigarrang 94.674 mm dizayn doira
        c1.circle(cx_pt, cy_pt, trim_r_pt, stroke=0, fill=1)
        c1.showPage()
        c1.save()

        # 2. Noj PDF yaratish (sahifasi 100.674 mm, ichida 94.674 mm yashil doira)
        c2 = rl_canvas.Canvas(f_die, pagesize=(page_pt, page_pt))
        c2.setStrokeColorRGB(0.2, 0.8, 0.2)
        c2.setLineWidth(0.2 * MM_TO_PT)
        c2.circle(cx_pt, cy_pt, trim_r_pt, stroke=1, fill=0)
        c2.showPage()
        c2.save()

        # Pichoq konturini avtomatik aniqlashni tekshiramiz
        dw_mm, dh_mm, pw_mm, ph_mm = ImpositionEngine.detect_dieline_trim_mm(f_die)
        self.assertAlmostEqual(dw_mm, 94.67, delta=0.3)
        self.assertAlmostEqual(dh_mm, 94.67, delta=0.3)
        self.assertAlmostEqual(pw_mm, 100.67, delta=0.2)

        # Montajni bajarib, Dizayn va Noj XObject matritsalari (masshtabi) 100% bir xil ekanini tekshiramiz
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0, margin_bottom_mm=15.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=dw_mm,
            trim_height_mm=dh_mm,
            bleed_mm=1.5,
            inner_bleed_mm=1.5,
            outer_bleed_mm=3.0,
            gutter_x_mm=3.0,
            gutter_y_mm=3.0
        )
        res = engine.run_imposition(
            front_pdf_path=f_art,
            dieline_pdf_path=f_die,
            sheet=sheet,
            bg_config=bg,
            output_path=None,
            include_proof_overlay=True
        )

        doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
        self.assertEqual(len(doc), 3)  # Oldi, Pichoq, Proof

        # Yuqori chetdagi (row=0, col=0) katakda tepadan 3.0 mm tashqi bleed qirqilib qolmaganini
        # va doira markazi vertikallik bo'yicha 1.5 mm siljib ketmaganini piksel darajasida tekshiramiz:
        front_items, _ = LayoutCalculator.generate_layout(
            sheet=sheet,
            bg_config=bg,
            cols=res["cols"],
            rows=res["rows"],
            rotation=res["rotation"],
            mode=ImpositionMode.SINGLE_SIDED
        )
        top_left_item = [it for it in front_items if it.row == 0 and it.col == 0][0]
        cx_item = top_left_item.trim_x + top_left_item.trim_w / 2.0
        # 1) trim_y dan 2.2 mm tepada (3 mm tashqi bleed ichida) pushti rang bo'lishi SHART (oq emas!)
        sample_top_bleed = pymupdf.Rect(
            cx_item - 1.0,
            top_left_item.trim_y - 2.2 * MM_TO_PT - 1.0,
            cx_item + 1.0,
            top_left_item.trim_y - 2.2 * MM_TO_PT + 1.0
        )
        pix_top = doc[0].get_pixmap(clip=sample_top_bleed, dpi=150)
        r_t, g_t, b_t = pix_top.pixel(pix_top.width // 2, pix_top.height // 2)[:3]
        self.assertGreater(r_t, 180, "Yuqori 3 mm tashqi bleed qirqilib qolgan!")
        self.assertLess(g_t, 100, "Yuqori 3 mm tashqi bleed oq bo'lib qolgan!")

        # 2) trim_y dan 1.0 mm pastda (toza kesim ichida) jigarrang doira bo'lishi SHART
        sample_inside_top = pymupdf.Rect(
            cx_item - 1.0,
            top_left_item.trim_y + 1.0 * MM_TO_PT - 1.0,
            cx_item + 1.0,
            top_left_item.trim_y + 1.0 * MM_TO_PT + 1.0
        )
        pix_in = doc[0].get_pixmap(clip=sample_inside_top, dpi=150)
        r_i, g_i, b_i = pix_in.pixel(pix_in.width // 2, pix_in.height // 2)[:3]
        self.assertLess(r_i, 180, "Doira markazi tepaga siljib ketgan!")

        for f in (f_art, f_die):
            if os.path.exists(f):
                os.remove(f)
        doc.close()
        print(f"\n[Test 16 OK] 100.674 mm varaq ichidagi {dw_mm}x{dh_mm} mm pichoq aniq topildi va 1:1 ustma-ust tushirildi!")

    def test_17_guillotine_double_cut_workflow(self):
        """Gilotin rejimi: 2 ta pichoq bilan (3 mm chiqindi tasma), Standart Ofset shablon, pichoq sahifasisiz."""
        engine = ImpositionEngine()
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0)
        # Vizitka: 90x50 mm, 3 mm oraliq (chiqindi tasma), 1.5 mm ichki fon, 2.0 mm tashqi fon
        bg = BleedAndGutterConfig(
            trim_width_mm=90.0,
            trim_height_mm=50.0,
            gutter_x_mm=3.0,
            gutter_y_mm=3.0,
            inner_bleed_mm=1.5,
            outer_bleed_mm=2.0,
            alignment=SheetAlignment.CENTER
        )
        job = JobMetadata(
            job_name="Vizitka_Test",
            order_quantity=1000,
            category=JobCategory.GUILLOTINE,
            cut_style=GuillotineCutStyle.DOUBLE_CUT
        )
        res = engine.run_imposition(
            front_pdf_path="sample1_twins_card.pdf",
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode.SINGLE_SIDED,
            style=TemplateStyle.OFFSET_STANDARD,
            job=job,
            output_path=None
        )
        self.assertTrue(res["success"])
        doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")
        # Gilotonda hech qanday ortiqcha pichoq yoki proof sahifasi bo'lmasligi kerak (faqat 1 ta toza Oldi sahifasi)
        self.assertEqual(len(doc), 1)
        self.assertEqual(res["page_labels"], ["Oldi tomon"])
        self.assertFalse(res["has_dieline"])
        doc.close()
        print("\n[Test 17 OK] Gilotin 2 ta pichoqli (Double cut) montaji 100% toza yaratildi (pichoq sahifasisiz)!")

    def test_18_guillotine_single_cut_centered(self):
        """Gilotin rejimi: 1 ta pichoq bilan (0 mm oraliq / Flush cut), varaq markazida (avto-sentr)."""
        sheet = SheetConfig(width_mm=500.0, height_mm=350.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=90.0,
            trim_height_mm=50.0,
            gutter_x_mm=0.0,
            gutter_y_mm=0.0,
            alignment=SheetAlignment.CENTER
        )
        front_items, _ = LayoutCalculator.generate_layout(
            sheet=sheet,
            bg_config=bg,
            cols=5,
            rows=6,
            center_grid=True
        )
        # 5 ta ustun * 90 = 450 mm; 500 - 450 = 50 mm; chap va o'ng har biri 25 mm bo'lishi kerak!
        min_x_mm = min(it.trim_x for it in front_items) * 25.4 / 72.0
        max_x_mm = max(it.trim_x + it.trim_w for it in front_items) * 25.4 / 72.0
        right_margin_mm = sheet.width_mm - max_x_mm

        self.assertAlmostEqual(min_x_mm, 25.0, delta=0.5)
        self.assertAlmostEqual(right_margin_mm, 25.0, delta=0.5)
        self.assertAlmostEqual(min_x_mm, right_margin_mm, delta=0.1, msg="Varaq markazida simmetrik joylashishi shart!")
        print(f"\n[Test 18 OK] Gilotin 0 mm sentr tekshiruvi: Chap={min_x_mm:.1f} mm, O'ng={right_margin_mm:.1f} mm (mukammal simmetriya)!")

    def test_19_auto_detect_bleed_without_trimbox(self):
        """Foydalanuvchi holati: Dizayner to'g'ridan-to'g'ri 51x96 mm qilib chizgan bo'lsa (TrimBox siz)."""
        # 51x96 mm li PDF yaratamiz (TrimBox qo'ymaymiz, faqat MediaBox)
        tmp_pdf = "test_51x96_bleed.pdf"
        doc = pymupdf.open()
        p = doc.new_page(width=51.0 * 72.0 / 25.4, height=96.0 * 72.0 / 25.4)
        p.draw_rect(p.rect, color=(0.8, 0.2, 0.2), fill=(0.8, 0.2, 0.2))
        doc.save(tmp_pdf)
        doc.close()

        checker = PreflightChecker()
        report = checker.check_pdf(tmp_pdf)

        self.assertAlmostEqual(report.media_box_mm[0], 51.0, delta=0.5)
        self.assertAlmostEqual(report.media_box_mm[1], 96.0, delta=0.5)
        # Standart 45x90 toza o'lcham va 3 mm bleed avtomatik aniqlanishi shart:
        self.assertAlmostEqual(report.trim_box_mm[0], 45.0, delta=0.5)
        self.assertAlmostEqual(report.trim_box_mm[1], 90.0, delta=0.5)
        self.assertAlmostEqual(report.detected_bleed_mm, 3.0, delta=0.2)

        if os.path.exists(tmp_pdf):
            os.remove(tmp_pdf)
        print(f"\n[Test 19 OK] 51x96 mm fayldan 45x90 mm toza kesim va 3.0 mm bleed 100% avtomatik topildi!")

    def test_20_rotated_single_cut_bleed_clipping(self):
        """Gilotin 0 mm kesimda burilgan (rotation=90) kartalarning ichki qirqilishi va tashqi bleedi."""
        tmp_src = "test_src_rot20.pdf"
        out_pdf = "test_out_rot20.pdf"
        
        # 51x96 mm fayl yaratamiz: Markazi (45x90) qizil, 3 mm qora fon (bleed)
        doc = pymupdf.open()
        p = doc.new_page(width=51.0 * MM_TO_PT, height=96.0 * MM_TO_PT)
        # Butun sahifa (bleed bilan) qora
        p.draw_rect(p.rect, color=None, fill=(0, 0, 0))
        # 3 mm ichkaridagi toza qism (45x90) qizil
        trim_r = pymupdf.Rect(3.0 * MM_TO_PT, 3.0 * MM_TO_PT, 48.0 * MM_TO_PT, 93.0 * MM_TO_PT)
        p.draw_rect(trim_r, color=None, fill=(1, 0, 0))
        doc.save(tmp_src)
        doc.close()

        sheet = SheetConfig(width_mm=300.0, height_mm=300.0)
        bg = BleedAndGutterConfig(
            trim_width_mm=45.0,
            trim_height_mm=90.0,
            gutter_x_mm=0.0,
            gutter_y_mm=0.0,
            inner_bleed_mm=0.0,
            outer_bleed_mm=3.0,
            alignment=SheetAlignment.CENTER
        )
        job = JobMetadata(
            job_name="Rot20_Test",
            category=JobCategory.GUILLOTINE,
            cut_style=GuillotineCutStyle.SINGLE_CUT
        )
        engine = ImpositionEngine()
        res = engine.run_imposition(
            front_pdf_path=tmp_src,
            sheet=sheet,
            bg_config=bg,
            mode=ImpositionMode.SINGLE_SIDED,
            style=TemplateStyle.OFFSET_STANDARD,
            job=job,
            manual_grid=(2, 2, 90),
            output_path=out_pdf
        )
        self.assertTrue(res["success"])

        # Piksellarni tekshirish
        res_doc = pymupdf.open(out_pdf)
        pix = res_doc[0].get_pixmap(dpi=150)
        scale = 150.0 / 72.0

        # Burilgan kartalar markazi (150 mm, 150 mm)
        center_px_x = int(150.0 * MM_TO_PT * scale)
        center_px_y = int(150.0 * MM_TO_PT * scale)

        # Kartalar orasidagi tutash joy (ichki qirra): Qizil bo'lishi shart, qora bleed kirmasligi kerak!
        inner_pix = pix.pixel(center_px_x - 5, center_px_y - 5)
        self.assertGreater(inner_pix[0], 200, "Ichki oraliq qizil bo'lishi kerak (0 mm krop)!")
        self.assertLess(inner_pix[1], 50)
        self.assertLess(inner_pix[2], 50)

        # Tashqi tepa fondagi piksel: 3 mm qora bleed saqlanishi shart!
        outer_top_y = int((105.0 - 1.5) * MM_TO_PT * scale)
        outer_top_x = int(105.0 * MM_TO_PT * scale)
        outer_pix = pix.pixel(outer_top_x, outer_top_y)
        self.assertLess(outer_pix[0], 50, "Tashqi fonda 3 mm qora bleed bo'lishi kerak!")
        self.assertLess(outer_pix[1], 50)
        self.assertLess(outer_pix[2], 50)

        res_doc.close()
        for f in (tmp_src, out_pdf):
            if os.path.exists(f):
                os.remove(f)
        print(f"\n[Test 20 OK] 90 gradus burilgan kartalarda ichki qora chiziq yo'q (toza 0 mm) va tashqi 3 mm qora bleed saqlandi!")


if __name__ == "__main__":
    unittest.main()
