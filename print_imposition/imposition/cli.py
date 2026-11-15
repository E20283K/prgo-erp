"""
Command Line Interface (CLI): Poligrafiya montaji, To'plam (Ganged Run) va Preflight uchun konsol buyruqlari
"""

import argparse
import sys
import os
from typing import Tuple, List

from imposition.models import (
    SheetConfig,
    BleedAndGutterConfig,
    JobMetadata,
    ImpositionMode,
    TemplateStyle,
    ColorChannel,
    GangingStrategy,
    GridFillDirection,
)
from imposition.preflight import PreflightChecker
from imposition.engine import ImpositionEngine
from imposition.calculator import LayoutCalculator


def parse_size_str(s: str) -> Tuple[float, float]:
    """Masalan '500x350' yoki '100x75' ni (w, h) float ga aylantiradi."""
    parts = s.lower().replace("mm", "").split("x")
    if len(parts) != 2:
        raise ValueError(f"Noto'g'ri o'lcham formati: '{s}'. Masalan: '500x350' yoki '100x75'")
    return float(parts[0].strip()), float(parts[1].strip())


def main():
    parser = argparse.ArgumentParser(
        description="Poligrafiya Vektorli Montaj (Imposition), To'plam va Preflight dasturi"
    )

    # Fayllar (bitta yoki bir nechta PDF fayl qabul qiladi)
    parser.add_argument("--front", "-f", nargs="+", required=True, help="Oldi dizayn PDF fayli (yoki to'plam fayllari) yo'li")
    parser.add_argument("--back", "-b", default=None, help="Orqa dizayn PDF fayli yo'li (ixtiyoriy / umumiy)")
    parser.add_argument("--dieline", "-d", default=None, help="Pichoq (Die-cut) PDF fayli yo'li (ixtiyoriy)")
    parser.add_argument("--output", "-o", default="montaj_tayyor.pdf", help="Chiquvchi montaj PDF fayli")

    # To'plam (Multi-Design / Ganged Run) opsiyalari
    parser.add_argument("--multi", action="store_true", help="To'plam (Multi-dizayn) rejimini faollashtirish")
    parser.add_argument("--multi-mode", choices=["pages", "alternating"], default="pages",
                        help="Ko'p betli PDF tartibi: pages (har bet alohida Oldi), alternating (1-Oldi, 2-Orqa...)")
    parser.add_argument("--quantities", default=None,
                        help="Har bir tur uchun tirajlar ro'yxati, vergul bilan (masalan: 1000,2000,1000,3000)")
    parser.add_argument("--strategy", choices=["smart", "split", "single"], default="smart",
                        help="To'plam taqsimlash strategiyasi: smart (1 tur 1 formada), split (formalar orasida bo'lish), single (1 formaga majburlash)")
    parser.add_argument("--max-overprint", type=float, default=10.0,
                        help="Ruxsat etilgan maksimal ortiqcha tiraj (perepechatka %)")
    parser.add_argument("--fill-dir", choices=["col", "row"], default="col",
                        help="Kataklarni to'ldirish yo'nalishi: col (ustun bo'yicha), row (qator bo'yicha)")

    # Qog'oz va O'lchamlar
    parser.add_argument("--sheet", default="500x350", help="Montaj qog'ozi o'lchami mm (masalan 500x350, 700x500)")
    parser.add_argument("--trim", default="100x75", help="Mahsulot toza kesim o'lchami mm (masalan 100x75)")
    parser.add_argument("--bleed", type=float, default=1.5, help="Standart kesish zahirasi mm")
    parser.add_argument("--inner-bleed", type=float, default=1.5, help="Ichki mahsulotlar foni mm (standart 1.5 mm)")
    parser.add_argument("--outer-bleed", type=float, default=3.0, help="Montaj tashqi 4 taraf foni mm (standart 3.0 mm)")
    parser.add_argument("--crop-gap", type=float, default=1.0, help="Krop chizig'ining tashqi fondan narida boshlanishi mm (standart 1.0 mm)")
    parser.add_argument("--gutter", type=float, default=3.0, help="Mahsulotlar orasidagi bo'shliq mm (standart 3.0 mm)")
    parser.add_argument("--gripper", type=float, default=15.0, help="Klapan (gripper margin) mm (standart 15 mm)")

    # Buyurtma pasporti
    parser.add_argument("--order", default="№1045", help="Buyurtma raqami")
    parser.add_argument("--job-name", default=None, help="Ish / Fayl nomi")
    parser.add_argument("--qty", type=int, default=100000, help="Buyurtma soni (dona)")
    parser.add_argument("--date", default=None, help="Sana (DD.MM.YYYY)")
    parser.add_argument("--waste", type=int, default=0, help="Brak/Priladka uchun qo'shimcha listlar")

    # Rejim va Shablon
    parser.add_argument("--mode", choices=["single", "sheetwise", "turn"], default="single",
                        help="Bosma rejimi: single (bir tomonlama), sheetwise (oldi-orqa alohida), turn (svoj)")
    parser.add_argument("--style", choices=["packaging", "compact", "standard"], default="packaging",
                        help="Texnik shablon uslubi: packaging (3-rasm), compact (2-rasm), standard (1-rasm)")

    # Qo'shimcha opsiyalar
    parser.add_argument("--separate", action="store_true", help="Oldi, Orqa va Pichoqni alohida PDF fayllarga saqlash")
    parser.add_argument("--preflight-json", default=None, help="Preflight hisobotini JSON faylga eksport qilish yo'li")
    parser.add_argument("--strict", action="store_true", help="Preflight'da xatolik bo'lsa montajni to'xtatish")

    args = parser.parse_args()

    print("=" * 65)
    print("  POLIGRAFIYA VEKTORLI MONTAJ & PREFLIGHT TIZIMI")
    print("=" * 65)

    sheet_w, sheet_h = parse_size_str(args.sheet)
    trim_w, trim_h = parse_size_str(args.trim)

    front_files: List[str] = args.front
    is_multi = args.multi or len(front_files) > 1 or (args.quantities is not None)

    variants = None
    checker = PreflightChecker(target_dpi=300.0)

    if is_multi:
        variants = ImpositionEngine.build_variants_from_files(
            front_files=front_files,
            multi_page_mode=args.multi_mode,
            shared_back_pdf=args.back,
            default_quantity=args.qty
        )
        if args.quantities:
            q_parts = [int(x.strip()) for x in args.quantities.split(",") if x.strip()]
            for i, v in enumerate(variants):
                if i < len(q_parts):
                    v.order_quantity = q_parts[i]

        print(f"\n[1/3] To'plam Preflight tahlili ({len(variants)} xil dizayn) ...")
        report = checker.check_multi_variants(variants, expected_trim_mm=(trim_w, trim_h))
    else:
        print(f"\n[1/3] Preflight tahlili: {front_files[0]} ...")
        report = checker.check_pdf(front_files[0], expected_trim_mm=(trim_w, trim_h))

    print(f"  * Sahifalar soni: {report.page_count}")
    print(f"  * Aniqlangan MediaBox: {report.media_box_mm[0]}x{report.media_box_mm[1]} mm")
    print(f"  * Kutilayotgan TrimBox: {trim_w}x{trim_h} mm")
    print(f"  * Aniqlangan Bleed: {report.detected_bleed_mm} mm")
    print(f"  * Rastr rasmlar soni: {len(report.images)}")
    print(f"  * Aniqlangan ranglar: {', '.join([c.name for c in report.colors])}")
    if report.fonts:
        print(f"  * Matnli shriftlar: {len(set(report.fonts))} ta aniqlandi")

    print("\nPreflight natijalari:")
    for issue in report.issues:
        prefix = f"[{issue.severity}]"
        print(f"  {prefix:<10} ({issue.category}) {issue.message}")

    if args.preflight_json:
        checker.export_report_json(report, args.preflight_json)
        print(f"  -> Hisobot saqlandi: {args.preflight_json}")

    if args.strict and report.error_count > 0:
        print("\n[XATOLIK] Preflight tekshiruvida xatoliklar aniqlandi. Montaj to'xtatildi!")
        sys.exit(1)

    print("\n[2/3] Montaj parametrlarini hisoblash ...")
    sheet_cfg = SheetConfig(
        width_mm=sheet_w,
        height_mm=sheet_h,
        margin_bottom_mm=args.gripper
    )
    bg_cfg = BleedAndGutterConfig(
        trim_width_mm=trim_w,
        trim_height_mm=trim_h,
        bleed_mm=args.bleed,
        inner_bleed_mm=args.inner_bleed,
        outer_bleed_mm=args.outer_bleed,
        crop_gap_mm=args.crop_gap,
        gutter_x_mm=args.gutter,
        gutter_y_mm=args.gutter
    )

    mode_map = {
        "single": ImpositionMode.SINGLE_SIDED,
        "sheetwise": ImpositionMode.SHEETWISE,
        "turn": ImpositionMode.WORK_AND_TURN,
    }
    style_map = {
        "packaging": TemplateStyle.PACKAGING_DIE_CUT,
        "compact": TemplateStyle.COMPACT_SIDE_INFO,
        "standard": TemplateStyle.STANDARD_COLORBAR,
    }
    strat_map = {
        "smart": GangingStrategy.SMART_NO_SPLIT,
        "split": GangingStrategy.MAX_ECONOMY_SPLIT,
        "single": GangingStrategy.SINGLE_FORM_PROPORTIONAL,
    }
    fill_map = {
        "col": GridFillDirection.COL_BY_COL,
        "row": GridFillDirection.ROW_BY_ROW,
    }

    job_name = args.job_name or os.path.basename(front_files[0])
    import datetime
    today_str = args.date or datetime.date.today().strftime("%d.%m.%Y")

    total_qty = sum(v.order_quantity for v in variants) if variants else args.qty
    job_meta = JobMetadata(
        order_number=args.order,
        job_name=job_name,
        date_str=today_str,
        order_quantity=total_qty,
        waste_sheets=args.waste,
        colors=report.colors,
        sheet_form_str=f"{int(sheet_w/10)}x{int(sheet_h/10)}sm"
    )

    print("\n[3/3] Vektorli montaj bajarilmoqda ...")
    engine = ImpositionEngine()
    result = engine.run_imposition(
        front_pdf_path=front_files[0] if not variants else None,
        back_pdf_path=args.back,
        dieline_pdf_path=args.dieline,
        sheet=sheet_cfg,
        bg_config=bg_cfg,
        mode=mode_map[args.mode],
        style=style_map[args.style],
        job=job_meta,
        output_path=args.output,
        export_separate_files=args.separate,
        variants=variants,
        ganging_strategy=strat_map[args.strategy],
        max_overprint_pct=args.max_overprint,
        fill_direction=fill_map[args.fill_dir]
    )

    print("\n" + "=" * 65)
    print("  MONTAJ MUVAFFAQIYATLI YAKUNLANDI!")
    print("=" * 65)
    print(f"  * Qolip: {result['cols']} ustun x {result['rows']} qator ({result['items_per_sheet']} dona/list)")
    print(f"  * Aylantirish: {result['rotation']}°")
    print(f"  * Jami buyurtma soni: {total_qty:,} dona")
    if result.get("form_plans"):
        print(f"  * Formalar soni: {len(result['form_plans'])} ta")
        for fp in result["form_plans"]:
            print(f"    - Forma {fp.form_index}: {fp.total_sheets_with_waste:,} list | {fp.summary_str()}")
    print(f"  * Jami bosilishi kerak bo'lgan listlar: {result['calculated_sheets']:,} list")
    print(f"  * Yaratilgan fayllar:")
    for f in result["generated_files"]:
        print(f"    -> {f}")
    print("=" * 65)


if __name__ == "__main__":
    main()
