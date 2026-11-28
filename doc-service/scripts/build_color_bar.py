"""
Korxona rang shkalasini (CorelDRAW'dan 1:1 CMYK PDF eksporti) montaj uchun tayyorlaydi.

PDF o'zgartirilmasdan assets/color_bar.pdf ga ko'chiriladi (ranglar asl CMYK qiymatlarida qoladi),
undan esa joylashtirish uchun o'lchamlar olinadi:
  - bosma markazi uchburchagi (▲) uchi — list markaziga to'g'rilanadi;
  - bo'yoq zonalari qadami (zona belgilari orasidagi masofa) — shkala dizayn kengligiga
    takrorlanganda nusxalar zonalar to'riga mos tushishi uchun.

Ishga tushirish (doc-service papkasidan):
    python scripts/build_color_bar.py "<shkala>.pdf"

Natija: app/sheet_imposition/assets/color_bar.pdf, color_bar.json
        ../public/imposition/color-bar.svg (montaj sxemasidagi ko'rinish uchun)
"""

import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "app" / "sheet_imposition" / "assets"
PUBLIC_SVG = ROOT.parent / "public" / "imposition" / "color-bar.svg"
PT_TO_MM = 25.4 / 72.0


def _vertical_line_xs(drawing) -> list:
    return [it[1].x for it in drawing["items"] if it[0] == "l" and abs(it[1].x - it[2].x) < 1e-3]


def analyze(page: pymupdf.Page) -> dict:
    drawings = page.get_drawings()

    # ▲: uchta chiziqdan iborat yopiq kontur, uchi — eng yuqori nuqta
    apex_x = None
    for dr in drawings:
        lines = [it for it in dr["items"] if it[0] == "l"]
        if len(lines) == 3 and len(dr["items"]) == 3:
            pts = [it[1] for it in lines] + [it[2] for it in lines]
            apex_x = min(pts, key=lambda p: p.y).x
    if apex_x is None:
        raise SystemExit("Bosma markazi uchburchagi (▲) topilmadi")

    # Zona belgilari: bitta konturdagi ko'p vertikal chiziqlar, teng qadam bilan
    pitch = None
    for dr in drawings:
        xs = sorted(_vertical_line_xs(dr))
        if len(xs) >= 5:
            steps = [b - a for a, b in zip(xs, xs[1:])]
            if max(steps) - min(steps) < 0.05:
                pitch = sum(steps) / len(steps)
                break
    if pitch is None:
        raise SystemExit("Bo'yoq zonalari belgilari topilmadi")

    width = page.rect.width
    zones = max(1, round(width / pitch))
    return {
        "width_mm": round(width * PT_TO_MM, 3),
        "height_mm": round(page.rect.height * PT_TO_MM, 3),
        "press_center_mm": round(apex_x * PT_TO_MM, 3),
        "zone_pitch_mm": round(pitch * PT_TO_MM, 3),
        "zones": zones,
        # Takrorlash qadami — butun zonalar soni, shunda keyingi nusxa zonalar to'rida davom etadi
        "period_mm": round(zones * pitch * PT_TO_MM, 3),
    }


def build(src: Path):
    with pymupdf.open(src) as doc:
        if doc.page_count != 1:
            raise SystemExit("Shkala PDF bitta sahifadan iborat bo'lishi kerak")
        page = doc[0]
        title = (doc.metadata.get("title") or "").strip()
        name = title if title and not title.lower().startswith("untitled") else src.stem
        meta = {"name": name, **analyze(page)}
        svg = page.get_svg_image(text_as_path=True)
        ASSETS.mkdir(parents=True, exist_ok=True)
        # Kontent o'zgarmaydi (CMYK operatorlari aynan qoladi). PDF/X ICC profili (OutputIntent)
        # list sahifasiga muhrlanganda baribir o'tmaydi — faylni og'irlashtirmasligi uchun olib tashlanadi.
        cat = doc.pdf_catalog()
        doc.xref_set_key(cat, "OutputIntents", "null")
        doc.xref_set_key(cat, "Metadata", "null")
        doc.save(ASSETS / "color_bar.pdf", garbage=4, deflate=True, clean=False)

    (ASSETS / "color_bar.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    PUBLIC_SVG.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_SVG.write_text(svg, encoding="utf-8")
    print(json.dumps(meta, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]))
