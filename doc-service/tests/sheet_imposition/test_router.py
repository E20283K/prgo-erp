"""
HTTP-level tests for /sheet-imposition (router mounted on a bare FastAPI app,
cache redirected to a temp directory).
"""

import io
import json
import tempfile
import unittest
from pathlib import Path

import pymupdf
from fastapi import FastAPI
from fastapi.testclient import TestClient
from reportlab.lib.colors import CMYKColor, CMYKColorSep
from reportlab.pdfgen import canvas

from app.imposition_cache import ImpositionCache
from app.routers import sheet_imposition as router_mod

MM = 72.0 / 25.4


def _card_pdf(label: str, w_mm: float = 96.0, h_mm: float = 56.0, pages: int = 1) -> bytes:
    """Business card with 3 mm bleed (90x50 trim), CMYK + one spot colour."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w_mm * MM, h_mm * MM))
    for p in range(pages):
        c.setFillColor(CMYKColor(0.8, 0.1, 0, 0))
        c.rect(0, 0, w_mm * MM, h_mm * MM, fill=1, stroke=0)
        c.setFillColor(CMYKColorSep(0, 0.9, 0.9, 0, spotName="PANTONE 485 C"))
        c.rect(10 * MM, 10 * MM, 20 * MM, 10 * MM, fill=1, stroke=0)
        c.setFillColor(CMYKColor(0, 0, 0, 1))
        c.drawString(12 * MM, 30 * MM, f"{label} p{p + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


BASE_PARAMS = {
    "sheet": {"width_mm": 450, "height_mm": 320, "margin_bottom_mm": 12},
    "bleed": {"trim_width_mm": 90, "trim_height_mm": 50},
    "mode": "single_sided",
    "strategy": "smart_no_split",
    "max_overprint_pct": 10,
}


class TestSheetImpositionRouter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory(prefix="sheet-imp-router-")
        cls._orig_cache = router_mod.sheet_imposition_cache
        router_mod.sheet_imposition_cache = ImpositionCache(base_dir=Path(cls._tmp.name))
        app = FastAPI()
        app.include_router(router_mod.router)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        router_mod.sheet_imposition_cache = cls._orig_cache
        cls._tmp.cleanup()

    def test_calculate_single_variant(self):
        body = {**BASE_PARAMS, "variants": [{"name": "Vizitka", "quantity": 5000}]}
        r = self.client.post("/sheet-imposition/calculate", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertGreater(data["items_per_sheet"], 1)
        self.assertEqual(len(data["forms"]), 1)
        form = data["forms"][0]
        self.assertEqual(len(form["front_cells"]), data["items_per_sheet"])
        self.assertEqual(form["back_cells"], [])
        self.assertGreaterEqual(form["total_produced_qty"], 5000)
        # Every cell lies on the sheet
        for cell in form["front_cells"]:
            self.assertGreaterEqual(cell["x_mm"], 0)
            self.assertLessEqual(cell["x_mm"] + cell["w_mm"], 450 + 1e-6)

    def test_calculate_ganging_and_sheetwise(self):
        body = {
            **BASE_PARAMS,
            "mode": "sheetwise",
            "variants": [
                {"name": "S", "quantity": 1000},
                {"name": "M", "quantity": 2000},
                {"name": "L", "quantity": 1000},
            ],
        }
        r = self.client.post("/sheet-imposition/calculate", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        names = {a["variant_name"] for f in data["forms"] for a in f["allocations"]}
        self.assertEqual(names, {"S", "M", "L"})
        form = data["forms"][0]
        self.assertEqual(len(form["back_cells"]), len(form["front_cells"]))

    def test_calculate_manual_grid(self):
        body = {**BASE_PARAMS, "manual_grid": {"cols": 2, "rows": 3, "rotation": 0}, "variants": [{"name": "A", "quantity": 600}]}
        data = self.client.post("/sheet-imposition/calculate", json=body).json()
        self.assertEqual((data["cols"], data["rows"], data["items_per_sheet"]), (2, 3, 6))
        self.assertEqual(data["total_sheets"], 100)

    def test_calculate_forced_rotation(self):
        base = {**BASE_PARAMS, "variants": [{"name": "A", "quantity": 1000}]}
        r0 = self.client.post("/sheet-imposition/calculate", json={**base, "rotation": 0}).json()
        r90 = self.client.post("/sheet-imposition/calculate", json={**base, "rotation": 90}).json()
        self.assertEqual(r0["rotation"], 0)
        self.assertEqual(r90["rotation"], 90)
        self.assertEqual((r90["item_w_mm"], r90["item_h_mm"]), (50, 90))
        cell = r90["forms"][0]["front_cells"][0]
        self.assertAlmostEqual(cell["w_mm"], 50, delta=0.01)
        self.assertAlmostEqual(cell["h_mm"], 90, delta=0.01)

    def test_calculate_validation(self):
        r = self.client.post("/sheet-imposition/calculate", json={**BASE_PARAMS, "variants": []})
        self.assertEqual(r.status_code, 422)

    def test_analyze_generate_and_serve(self):
        files = [
            ("files", ("front_a.pdf", _card_pdf("A"), "application/pdf")),
            ("files", ("front_b.pdf", _card_pdf("B"), "application/pdf")),
            ("files", ("back.pdf", _card_pdf("BACK"), "application/pdf")),
        ]
        manifest = [
            {"name": "A", "sku_id": "sku-a", "quantity": 1500, "front_file": 0, "back_file": 2},
            {"name": "B", "sku_id": "sku-b", "quantity": 3000, "front_file": 1, "back_file": 2},
        ]
        r = self.client.post(
            "/sheet-imposition/analyze",
            files=files,
            data={"manifest": json.dumps(manifest), "expected_trim_w": "90", "expected_trim_h": "50"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        an = r.json()
        job_id = an["job_id"]
        self.assertEqual([v["name"] for v in an["variants"]], ["A", "B"])
        self.assertTrue(an["variants"][0]["thumbnail_url"].startswith(f"/api/sheet-imposition/{job_id}/files/"))
        color_names = [c["name"] for c in an["preflight"]["colors"]]
        self.assertTrue(any("485" in n for n in color_names), color_names)

        gen_body = {
            **BASE_PARAMS,
            "mode": "sheetwise",
            "variants": [{"name": "A", "quantity": 1500}, {"name": "B", "quantity": 3000}],
            "job": {"order_number": "WO-TEST", "job_name": "Vizitka", "style": "offset_standard"},
        }
        r = self.client.post(f"/sheet-imposition/{job_id}/generate", json=gen_body)
        self.assertEqual(r.status_code, 200, r.text)
        gen = r.json()
        self.assertTrue(gen["has_back"])
        self.assertEqual(gen["files"][0]["filename"], "montaj.pdf")
        self.assertEqual(gen["files"][0]["label"], "Montaj")
        self.assertTrue(any(f["label"].startswith("Orqa") for f in gen["files"]))
        self.assertGreaterEqual(len(gen["pages"]), 2)

        pdf = self.client.get(f"/sheet-imposition/{job_id}/files/montaj.pdf")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.headers["content-type"], "application/pdf")
        doc = pymupdf.open(stream=pdf.content, filetype="pdf")
        self.assertEqual(len(doc), len(gen["pages"]))
        self.assertAlmostEqual(doc[0].rect.width / MM, 450, delta=0.5)
        doc.close()

        png = self.client.get(f"/sheet-imposition/{job_id}/files/montaj_page_1.png")
        self.assertEqual(png.status_code, 200)
        self.assertEqual(png.headers["content-type"], "image/png")

    def test_svg_dieline_analyze_and_generate(self):
        # 90x50 trim, R3 corners, Ø4 hole; page = trim + 2 mm each side (as the ERP generates it)
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="94mm" height="54mm" viewBox="0 0 94 54">'
            '<path d="M5 2 H89 A3 3 0 0 1 92 5 V49 A3 3 0 0 1 89 52 H5 A3 3 0 0 1 2 49 V5 A3 3 0 0 1 5 2 Z" '
            'fill="none" stroke="#ff00ff" stroke-width="0.25"/>'
            '<circle cx="47" cy="8" r="2" fill="none" stroke="#ff00ff" stroke-width="0.25"/></svg>'
        ).encode()
        files = [
            ("files", ("card.pdf", _card_pdf("A"), "application/pdf")),
            ("files", ("pichoq.svg", svg, "image/svg+xml")),
        ]
        manifest = [{"name": "A", "quantity": 2000, "front_file": 0}]
        r = self.client.post(
            "/sheet-imposition/analyze",
            files=files,
            data={"manifest": json.dumps(manifest), "dieline_file": "1"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        an = r.json()
        self.assertAlmostEqual(an["dieline"]["trim_w_mm"], 90, delta=0.5)
        self.assertAlmostEqual(an["dieline"]["trim_h_mm"], 50, delta=0.5)
        self.assertAlmostEqual(an["dieline"]["page_w_mm"], 94, delta=0.5)

        gen = self.client.post(
            f"/sheet-imposition/{an['job_id']}/generate",
            json={**BASE_PARAMS, "job": {"category": "diecut", "style": "packaging"}},
        )
        self.assertEqual(gen.status_code, 200, gen.text)
        data = gen.json()
        self.assertTrue(data["has_dieline"])
        self.assertTrue(any(f["label"] == "Pichoq" for f in data["files"]), data["files"])

    def test_svg_rejected_as_artwork(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"/>'
        r = self.client.post("/sheet-imposition/analyze", files=[("files", ("art.svg", svg, "image/svg+xml"))])
        self.assertEqual(r.status_code, 400)
        r = self.client.post(
            "/sheet-imposition/analyze",
            files=[("files", ("bad.svg", b"not an svg", "image/svg+xml"))],
            data={"dieline_file": "0"},
        )
        self.assertEqual(r.status_code, 400)

    def test_analyze_without_manifest_splits_pages(self):
        r = self.client.post(
            "/sheet-imposition/analyze",
            files=[("files", ("multi.pdf", _card_pdf("M", pages=3), "application/pdf"))],
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(r.json()["variants"]), 3)

    def test_errors(self):
        r = self.client.post("/sheet-imposition/analyze", files=[("files", ("x.png", b"123", "image/png"))])
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/sheet-imposition/job-missing/generate", json=BASE_PARAMS)
        self.assertEqual(r.status_code, 404)
        r = self.client.get("/sheet-imposition/job-missing/files/montaj.pdf")
        self.assertEqual(r.status_code, 404)
        r = self.client.get("/sheet-imposition/..%2F..%2Fetc/files/passwd")
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
