"""
Korxona rang shkalasini (Prinect/FOGRA 4 Dipco 2.1, Format 74) CorelDRAW SVG eksportidan
bosma uchun CMYK vektor PDF ga o'giradi.

CorelDRAW SVG ga ranglarni RGB qilib yozadi. Bosma shkalasi esa toza separatsiyalarda
bo'lishi shart (C100 — faqat Cyan qolipida), shuning uchun har bir RGB qiymat quyidagi
jadval bo'yicha asl CMYK foiziga qaytariladi. Jadvalda yo'q rang uchraganda skript to'xtaydi.

Ishga tushirish (doc-service papkasidan):
    python scripts/build_color_bar.py [manba.svg]

Natija: app/sheet_imposition/assets/color_bar.pdf va color_bar.json
"""

import json
import re
import sys
from pathlib import Path

from reportlab.lib.colors import CMYKColor
from reportlab.pdfgen import canvas

ASSETS = Path(__file__).resolve().parent.parent / "app" / "sheet_imposition" / "assets"
SRC_SVG = ASSETS / "color_bar_source.svg"

C, M, Y, K = "c", "m", "y", "k"


def ink(**pct: float):
    return tuple(pct.get(ch, 0) / 100.0 for ch in (C, M, Y, K))


# Corel RGB -> asl CMYK (foiz)
CMYK_MAP = {
    "#FFFFFF": ink(), "#FEFEFE": ink(),                       # qog'oz (knockout)
    "#1C1B17": ink(c=100, m=100, y=100, k=100),               # privodka belgisi (Registration)
    "#3A3A39": ink(c=100, m=100, y=100),                      # CMY ustma-ust solid
    "#6A6A6A": ink(c=65, m=55, y=55),                         # CMY kulrang balansi (taxminiy)
    # Solidlar
    "#00A0E3": ink(c=100), "#E5097F": ink(m=100), "#FFED00": ink(y=100), "#2B2A29": ink(k=100),
    # 40% / 80% tonlar
    "#A2D9F7": ink(c=40), "#00B1EB": ink(c=80),
    "#F5B5D2": ink(m=40), "#EA5699": ink(m=80),
    "#FFF7B2": ink(y=40), "#FFEF47": ink(y=80),
    "#B2B3B3": ink(k=40), "#5B5B5B": ink(k=80),
    # Ikki rang ustma-ust (MY, CY, CM)
    "#E31E24": ink(m=100, y=100), "#009846": ink(c=100, y=100), "#393185": ink(c=100, m=100),
    # Yozuvlar: rang + qora (har qolipda o'qiladi)
    "#03222C": ink(c=100, k=100), "#31161C": ink(m=100, k=100), "#2A2B17": ink(y=100, k=100),
    # Dipco nuqta o'sishi pog'onalari: 50/55/60/65/70 %
    "#9D9E9E": ink(k=50), "#919191": ink(k=55), "#828281": ink(k=60), "#747474": ink(k=65), "#676766": ink(k=70),
    "#83D0F4": ink(c=50), "#6ECAF3": ink(c=55), "#4EC2F0": ink(c=60), "#26BCEF": ink(c=65), "#00B6ED": ink(c=70),
    "#F29FC4": ink(m=50), "#F092BC": ink(m=55), "#EF81B2": ink(m=60), "#ED73A9": ink(m=65), "#EB64A0": ink(m=70),
    "#FFF59B": ink(y=50), "#FFF48D": ink(y=55), "#FFF27B": ink(y=60), "#FFF16A": ink(y=65), "#FFF058": ink(y=70),
    # Yorug'lik nuqtalari: 2/3/4/5 %
    "#FBFBFB": ink(k=2), "#F9F9F9": ink(k=3), "#F7F7F7": ink(k=4), "#F5F5F5": ink(k=5),
    "#FAFDFE": ink(c=2), "#F8FCFE": ink(c=3), "#F6FBFE": ink(c=4), "#F4FAFE": ink(c=5),
    "#FEFBFD": ink(m=2), "#FEF9FC": ink(m=3), "#FDF8FB": ink(m=4), "#FDF6FA": ink(m=5),
    "#FEFEFB": ink(y=2), "#FFFEF9": ink(y=3), "#FFFEF8": ink(y=4), "#FFFDF6": ink(y=5),
}
NAMED = {"whitesmoke": "#F5F5F5", "white": "#FFFFFF", "black": "#000000"}

NUM = r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"


def _cmyk(value: str):
    v = NAMED.get(value.strip().lower(), value.strip()).upper()
    if v not in CMYK_MAP:
        raise SystemExit(f"Jadvalda yo'q rang: {value} — CMYK_MAP ga qo'shing")
    return CMYK_MAP[v]


def _parse_styles(svg: str):
    fills, strokes = {}, {}
    for name, body in re.findall(r"\.([\w-]+)\s*\{([^}]*)\}", svg):
        props = dict(
            (k.strip(), v.strip()) for k, v in (p.split(":", 1) for p in body.split(";") if ":" in p)
        )
        if "fill" in props:
            fills[name] = props["fill"]
        if "stroke" in props:
            strokes[name] = (props["stroke"], float(props.get("stroke-width", "1")))
    return fills, strokes


def _path_ops(d: str):
    """SVG path d -> [(op, pts)] absolyut koordinatalarda (M, L, C, Z)."""
    tokens = re.findall(rf"[MmLlHhVvCcZz]|{NUM}", d)
    ops, i, cmd = [], 0, None
    x = y = sx = sy = 0.0

    def nums(n):
        nonlocal i
        vals = [float(t) for t in tokens[i:i + n]]
        i += n
        return vals

    while i < len(tokens):
        t = tokens[i]
        if re.fullmatch(r"[A-Za-z]", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                ops.append(("Z", []))
                x, y = sx, sy
                continue
        rel = cmd.islower()
        c = cmd.upper()
        if c == "M":
            dx, dy = nums(2)
            x, y = (x + dx, y + dy) if rel else (dx, dy)
            sx, sy = x, y
            ops.append(("M", [(x, y)]))
            cmd = "l" if rel else "L"   # keyingi juftliklar — chiziq
        elif c == "L":
            dx, dy = nums(2)
            x, y = (x + dx, y + dy) if rel else (dx, dy)
            ops.append(("L", [(x, y)]))
        elif c == "H":
            (dx,) = nums(1)
            x = x + dx if rel else dx
            ops.append(("L", [(x, y)]))
        elif c == "V":
            (dy,) = nums(1)
            y = y + dy if rel else dy
            ops.append(("L", [(x, y)]))
        elif c == "C":
            v = nums(6)
            if rel:
                v = [v[0] + x, v[1] + y, v[2] + x, v[3] + y, v[4] + x, v[5] + y]
            ops.append(("C", [(v[0], v[1]), (v[2], v[3]), (v[4], v[5])]))
            x, y = v[4], v[5]
        else:
            raise SystemExit(f"Qo'llab-quvvatlanmagan path buyrug'i: {cmd}")
    return ops


def build(src: Path):
    svg = src.read_text(encoding="utf-8")
    if "transform=" in svg:
        raise SystemExit("SVG da transform bor — Corel eksportida 'transform' siz saqlang")

    root = re.search(r"<svg\b[^>]*>", svg).group(0)
    width_in = float(re.search(r'width="([\d.]+)in"', root).group(1))
    height_in = float(re.search(r'height="([\d.]+)in"', root).group(1))
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', root).group(1).split()]
    w_pt, h_pt = width_in * 72.0, height_in * 72.0
    sx, sy = w_pt / vb[2], h_pt / vb[3]

    fills, strokes = _parse_styles(svg)
    out_pdf = ASSETS / "color_bar.pdf"
    canv = canvas.Canvas(str(out_pdf), pagesize=(w_pt, h_pt))
    canv.setTitle("Prinect/FOGRA 4 Dipco 2.1 Format 74")

    def tx(p):
        return ((p[0] - vb[0]) * sx, h_pt - (p[1] - vb[1]) * sy)

    center_x = None
    for tag, attrs in re.findall(r"<(path|polygon)\b([^>]*)/?>", svg):
        classes = re.search(r'class="([^"]*)"', attrs).group(1).split()
        fill = next((fills[c] for c in classes if c in fills), "black")
        stroke = next((strokes[c] for c in classes if c in strokes), None)

        if tag == "polygon":
            pts = [tuple(map(float, q.split(","))) for q in re.search(r'points="([^"]+)"', attrs).group(1).split()]
            ops = [("M", [pts[0]])] + [("L", [p]) for p in pts[1:]] + [("Z", [])]
            if fill == "none" and len(pts) == 3:
                # Bosma markazi uchburchagi (▲): uchi — mashina o'qi
                center_x = (max(pts, key=lambda p: -p[1])[0] - vb[0]) * sx
        else:
            ops = _path_ops(re.search(r'd="([^"]+)"', attrs).group(1))

        path = canv.beginPath()
        for op, pts in ops:
            if op == "M":
                path.moveTo(*tx(pts[0]))
            elif op == "L":
                path.lineTo(*tx(pts[0]))
            elif op == "C":
                path.curveTo(*tx(pts[0]), *tx(pts[1]), *tx(pts[2]))
            else:
                path.close()

        do_fill = fill != "none"
        if do_fill:
            canv.setFillColor(CMYKColor(*_cmyk(fill)))
        if stroke:
            canv.setStrokeColor(CMYKColor(*_cmyk(stroke[0])))
            canv.setLineWidth(stroke[1] * sx)
        canv.drawPath(path, fill=1 if do_fill else 0, stroke=1 if stroke else 0, fillMode=1)

    canv.showPage()
    canv.save()

    if center_x is None:
        raise SystemExit("Bosma markazi uchburchagi topilmadi")
    meta = {
        "name": "Prinect/FOGRA 4 Dipco 2.1 Format 74",
        "width_mm": round(w_pt * 25.4 / 72.0, 3),
        "height_mm": round(h_pt * 25.4 / 72.0, 3),
        "press_center_mm": round(center_x * 25.4 / 72.0, 3),
    }
    (ASSETS / "color_bar.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(out_pdf, meta)


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else SRC_SVG)
