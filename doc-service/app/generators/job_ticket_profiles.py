"""
Technology profiles of the work order passport (Ish pasporti).

The passport frame (header, requisites, drawings, route page, signatures) is shared;
what the shop floor needs to read differs by technology. Each profile here turns the
order into the page-1 rows that change between technologies:

- kpis:       the four figures under the requisites
- spec_rows:  the spec panel beside the drawings
- ready_rows: the readiness table (keys match the order's checks)
- captions:   the labels under the three drawings

`technology` comes from the ERP (utils/orderTechnology.ts), the same rule the order's
Specifications tab uses. Only values the order holds are printed; a missing one shows "—".
"""
import math
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

OFFSET = "offset"
FLEXO_STICKER = "flexo_sticker"
FLEXO_RIBBON = "flexo_ribbon"
TERMO = "termo"
JACQUARD = "jacquard"
TECHNOLOGIES = {OFFSET, FLEXO_STICKER, FLEXO_RIBBON, TERMO, JACQUARD}
# Roll-fed jobs: counted in metres, wound on cores, no press sheet
ROLL_TECHS = {FLEXO_STICKER, FLEXO_RIBBON, TERMO}
# Flexo presses print with photopolymer plates on a geared cylinder
CYLINDER_TECHS = {FLEXO_STICKER, FLEXO_RIBBON}

# JR-1521 gears (lib/flexo/masterData.ts): printing length = teeth × circular pitch
GEAR_PITCH_MM = 2.7107

FOOTER_TITLES = {
    OFFSET: "MAHSULOT PASPORTI VA SPETSIFIKATSIYASI",
    FLEXO_STICKER: "FLEKSO ETIKETKA PASPORTI",
    FLEXO_RIBBON: "FLEKSO LENTA PASPORTI",
    TERMO: "TERMO ETIKETKA PASPORTI",
    JACQUARD: "MAHSULOT PASPORTI VA SPETSIFIKATSIYASI",
}

MATERIAL_LABELS = {
    "bopp_white": "BOPP oq",
    "bopp_clear": "BOPP shaffof",
    "semi_gloss": "Yarim yaltiroq",
    "semi_gloss_paper": "Yarim yaltiroq qog'oz",
    "thermal_eco": "Termo EKO",
    "thermal_top": "Termo TOP",
    "pp_silver": "PP kumush",
    "self_adhesive_pp": "O'ziyelimli PP",
    "nylon_taffeta": "Neylon taffeta",
    "polyester_satin_white": "Oq satin",
    "polyester_satin_black": "Qora satin",
    "cotton_tape": "Paxta lenta",
}
WINDING_LABELS = {
    "out_top": "Tashqariga, boshi yuqori",
    "out_bottom": "Tashqariga, boshi past",
    "in_top": "Ichkariga, boshi yuqori",
    "in_bottom": "Ichkariga, boshi past",
}
FOLD_LABELS = {
    "center_fold": "Markazdan buklama",
    "end_fold": "Ikki chekkadan buklama",
    "straight_cut": "To'g'ri kesim",
    "manhattan_fold": "Kitobcha buklama",
    "mitre_fold": "Manjetli buklama",
    "roll": "Rulonda, kesilmagan",
}
CUT_LABELS = {
    "none": "Kesilmaydi",
    "ultrasonic": "Ultrasonik",
    "hot_knife": "Issiq pichoq",
    "cold_knife": "Sovuq pichoq",
    "laser": "Lazer",
}
EDGE_LABELS = {
    "woven_edge": "To'qilgan qirra",
    "hot_slit": "Issiq kesilgan",
    "ultrasonic_slit": "Ultrasonik kesilgan",
}
WASH_LABELS = {
    "40c": "40°C",
    "60c": "60°C",
    "90c_boil": "90°C, qaynatish",
    "dry_clean": "Kimyoviy tozalash",
}


def technology(od: Dict[str, Any]) -> str:
    t = str(od.get("technology") or "").strip().lower()
    return t if t in TECHNOLOGIES else OFFSET


def _num(v: Any) -> float:
    """Numbers stored as text too ("76 mm" from the product spec screen)."""
    if isinstance(v, (int, float)):
        return float(v)
    digits = "".join(ch for ch in str(v or "") if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def _fmt_int(n: float) -> str:
    return f"{int(round(n)):,}".replace(",", " ")


def _join(*parts: Any) -> str:
    return " • ".join(str(p) for p in parts if p)


def winding_code(od: Dict[str, Any]) -> str:
    code = str(od.get("flexoOrientation") or "").strip()
    return code if code in WINDING_LABELS else ""


def roll_metrics(od: Dict[str, Any], net_qty: int, height: float) -> SimpleNamespace:
    """Web, lanes, metres and cylinder figures of a roll-fed job."""
    lanes = max(1, int(_num(od.get("flexoLanes")) or 1))
    gap_x = _num(od.get("flexoGapX")) if od.get("flexoGapX") is not None else 3.0
    gap_y = _num(od.get("flexoGapY")) if od.get("flexoGapY") is not None else 3.0
    web = _num(od.get("flexoWebWidth"))
    pitch = height + gap_y
    # The same plan the route prints (countingProfile.ts piecesPerMetre)
    per_metre = lanes * 1000.0 / pitch if pitch > 0 else 0.0
    metres = math.ceil(net_qty / per_metre) if per_metre > 0 and net_qty > 0 else 0
    teeth = int(_num(od.get("flexoCylinderTeeth")))
    repeat_mm = teeth * GEAR_PITCH_MM if teeth else 0.0
    around = int(repeat_mm // pitch) if repeat_mm and pitch > 0 else 0
    return SimpleNamespace(
        lanes=lanes, gap_x=gap_x, gap_y=gap_y, web=web, pitch=pitch, metres=metres,
        teeth=teeth, repeat_mm=repeat_mm, around=around,
        rolls=int(_num(od.get("flexoRollsCount"))),
        per_roll=int(_num(od.get("flexoLabelsPerRoll"))),
        core=_num(od.get("flexoCoreDiameter")),
        plate_mm=_num(od.get("flexoPlateThickness")),
    )


def _material(od: Dict[str, Any]) -> str:
    code = str(od.get("labelMaterialType") or "").strip()
    return MATERIAL_LABELS.get(code, code)


PROCESS_INKS = [("c", "C", "#00aeef"), ("m", "M", "#ec008c"), ("y", "Y", "#fff200"), ("k", "K", "#231f20")]
UNKNOWN_SPOT_HEX = "#9ca3af"


def _short_spot(name: str) -> str:
    """"PANTONE 286 C" → "P 286 C": the chip keeps the part the ink can be told apart by."""
    n = " ".join(str(name).split())
    for prefix in ("PANTONE ", "Pantone ", "PMS "):
        if n.startswith(prefix):
            return "P " + n[len(prefix):]
    return n


def ink_sides(tech: str, od: Dict[str, Any], back_printed: bool) -> List[Dict[str, Any]]:
    """Inks per side for the passport's ink block: process channels as one chip, each
    spot ink as its own chip (a "both" spot on both sides). Empty for unprinted jobs."""
    if tech == TERMO:
        return []
    spot_list = od.get("spotColorItems") or [{"name": n, "side": "front"} for n in (od.get("spotColors") or [])]
    sides = []
    for key, label, colors_key in (("front", "OLDI", "frontColors"), ("back", "ORQA", "backColors")):
        ch = od.get(colors_key) or {}
        process = [(letter, hx) for k, letter, hx in PROCESS_INKS if ch.get(k)]
        spots = [
            {"name": _short_spot(s.get("name")), "hex": str(s.get("hex") or "") or UNKNOWN_SPOT_HEX,
             "note": str(s.get("note") or "").strip()}
            for s in spot_list
            if isinstance(s, dict) and s.get("name") and (s.get("side") or "front") in (key, "both")
        ]
        sides.append({"label": label, "process": process, "spots": spots, "count": len(process) + len(spots),
                      "printed": bool(process or spots) or (key == "back" and back_printed)})
    return sides


def ink_formula(sides: List[Dict[str, Any]]) -> str:
    """"4+1" from the inks themselves, so it always matches the press units the job takes."""
    return "+".join(str(s["count"]) for s in sides) if sides else ""


# ─── KPIs ────────────────────────────────────────────────────────────────────

def kpis(tech: str, x: SimpleNamespace) -> List[Tuple[str, str, str]]:
    net_label = x.L["netRun"] + (f" • +{x.sample_qty} namuna" if x.sample_on and x.sample_qty else "")
    net_val = f"{_fmt_int(x.net_qty)} {x.unit}" if x.net_qty else "—"
    schedule = (x.L["scheduleWindow"], f"{x.start_date} → {x.deadline}", "#0f172a")
    if tech not in ROLL_TECHS:
        return [
            (net_label, net_val, "#1d4ed8"),
            (x.L["grossSheets"], f"{_fmt_int(x.gross_sheets)} varaq" if x.gross_sheets else "—", "#0f172a"),
            (x.L["impositionYield"], f"{x.yield_per_sheet} dona / varaq" if x.yield_per_sheet else "—", "#047857"),
            schedule,
        ]
    r = x.roll
    rolls = f"{_fmt_int(r.rolls)} rulon × {_fmt_int(r.per_roll)}" if r.rolls and r.per_roll else ""
    across = f"{r.lanes} qator" + (f" × {r.around} aylanish" if r.around else "")
    return [
        (net_label, net_val, "#1d4ed8"),
        ("Metraj", f"{_fmt_int(r.metres)} m" if r.metres else "—", "#0f172a"),
        ("Rulonlar" if rolls else "Joylashuv", rolls or across, "#047857"),
        schedule,
    ]


# ─── Spec panel ──────────────────────────────────────────────────────────────

def spec_rows(tech: str, x: SimpleNamespace) -> List[Tuple[str, str]]:
    od, L = x.od, x.L
    size = f"{x.width:g} × {x.height:g} {x.dim_unit}"
    hole = (f"Ø{x.hole_size:g} mm • {x.hole_pos}" + (f" • {x.hole_offset:g} mm" if x.hole_offset else "")) if x.hole_on else "—"
    finish = _join(x.coating, "" if x.emb.lower() in ("", "none") else x.emb)

    if tech not in ROLL_TECHS:
        return [
            (L["trimDimensions"], size),
            ("Bleed", f"{x.bleed:g} {x.dim_unit}" if x.bleed else "yo'q"),
            ("Shakl", str(od.get("shapeType") or "rectangle")),
            (L["cornerCut"], str(od.get("cornerType") or "—")),
            (L["holeEyelet"], hole),
            ("Shtamp", x.die_text),
            ("Klishe", x.cliche_text),
            ("Qog'oz turi / GSM", x.paper_spec or "—"),
            ("Ombordagi qog'oz", str(od.get("paperStock") or "tanlanmagan")),
            ("Laminatsiya", x.lam_full or "—"),
            ("Lak / pardoz", finish or "—"),
            ("Kashirovka", x.kash_mode.capitalize() + f" • {len(x.kash_layers)} qatlam" if x.kash_on else "yo'q"),
            ("Bosma varaq", f"{x.press_sheet_w:g} × {x.press_sheet_h:g} mm" if x.press_sheet_w and x.press_sheet_h else "—"),
        ]

    r = x.roll
    winding = WINDING_LABELS.get(winding_code(od), "—")
    stock = str(od.get("paperStock") or "tanlanmagan")
    cylinder = _join(f"{r.teeth}T", f"{r.repeat_mm:.1f} mm",
                     f"{r.around} nusxa / aylanish" if r.around else "") if r.teeth else "—"
    plates = _join(f"{r.plate_mm:g} mm" if r.plate_mm else "", x.plate_tools_text) or (
        "biriktirilmagan" if tech in CYLINDER_TECHS else "—")
    rolls = _join(f"{_fmt_int(r.rolls)} rulon" if r.rolls else "",
                  f"{_fmt_int(r.per_roll)} dona / rulon" if r.per_roll else "") or "—"

    if tech == FLEXO_RIBBON:
        sides = {"1s": "1 tomon", "2s": "2 tomon"}.get(str(od.get("labelPrintSides") or ""), "")
        margin = od.get("labelSewingMarginMm")
        return [
            ("Lenta eni × uzunlik", size),
            ("Material", _material(od) or "—"),
            ("Ombordagi material", stock),
            ("Buklash", FOLD_LABELS.get(str(od.get("labelFoldType") or ""), "—")),
            ("Kesish", CUT_LABELS.get(str(od.get("labelCutType") or ""), "—")),
            ("Qirra", EDGE_LABELS.get(str(od.get("labelEdgeType") or ""), "—")),
            ("Tikuv zapasi", f"{_num(margin):g} mm" if margin is not None else "—"),
            ("Yuvish", WASH_LABELS.get(str(od.get("labelWashResistance") or ""), "—")),
            ("Bosma tomon", sides or "—"),
            ("Silindr", cylinder),
            ("Klishe", plates),
        ]

    rows = [
        (L["trimDimensions"], size),
        ("Shakl / burchak", _join(str(od.get("shapeType") or "rectangle"),
                                  f"R{_num(od.get('termoCornerRadius')):g}" if _num(od.get("termoCornerRadius")) else
                                  str(od.get("cornerType") or ""))),
        ("Material", _material(od) or "—"),
        ("Ombordagi material", stock),
        ("Rulon eni", f"{r.web:g} mm" if r.web else "—"),
        ("Oraliq X / Y", f"{r.gap_x:g} / {r.gap_y:g} mm"),
        ("Qator", f"{r.lanes}"),
        ("Rulonlar", rolls),
        ("Gilza", f"{r.core:g} mm" if r.core else "—"),
        ("O'rash", winding),
        ("Shtans", x.die_text),
    ]
    if tech == TERMO:
        return rows
    return rows + [
        ("Silindr", cylinder),
        ("Klishe", plates),
        ("Laminatsiya / lak", _join(x.lam_full, finish) or "—"),
    ]


# ─── Readiness ───────────────────────────────────────────────────────────────

def ready_rows(tech: str, x: SimpleNamespace) -> List[Tuple[Optional[str], str, str]]:
    sample = [("__sample__", "Namuna", x.sample_detail)] if x.sample_on else []
    machines = (None, "Uskunalar", ", ".join(x.machine_names) or "Mashrut kiritilmagan")
    if tech not in ROLL_TECHS:
        return sample + [
            ("designReady", "Dizayn / maket", x.design_detail),
            ("paperReady", "Qog'oz / material", x.paper_detail),
            ("platesReady", "Bosma formalar", x.plates_detail),
            ("toolingReady", "Shtamp / asbob", x.tooling_detail),
            machines,
        ]

    r = x.roll
    od = x.od
    mats = x.mats_count_detail
    roll_material = _join(
        str(od.get("paperStock") or "") or (_material(od) + " (ombordan tanlanmagan)" if _material(od) else ""),
        f"{r.web:g} mm" if r.web else "",
        f"{_fmt_int(r.metres)} m" if r.metres else "",
        mats,
    ) or "—"
    rows = sample + [
        ("designReady", "Dizayn / maket", x.design_detail),
        ("paperReady", "Rulon material", roll_material),
    ]
    if tech in CYLINDER_TECHS:
        n_colors = x.ink_sides[0]["count"] if x.ink_sides else 0
        rows.append(("platesReady", "Fotopolimer klishe", _join(
            f"{n_colors} rang" if n_colors else "",
            f"silindr {r.teeth}T" if r.teeth else "",
            x.plate_tools_text,
        ) or "Klishe biriktirilmagan"))
    if tech == FLEXO_RIBBON:
        cut = CUT_LABELS.get(str(od.get("labelCutType") or ""), "")
        rows.append(("toolingReady", "Kesish / buklash", _join(
            cut, FOLD_LABELS.get(str(od.get("labelFoldType") or ""), "")) or "—"))
    else:
        rows.append(("toolingReady", "Shtans", x.die_text))
    return rows + [machines]


def captions(show_winding: bool, has_die_file: bool) -> List[str]:
    return ["OLDI", "O'RASH" if show_winding else "ORQA", "SHTANS" if has_die_file else "KESIM KONTURI"]
