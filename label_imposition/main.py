"""
Main entry point for the Sticker / Textile Label Imposition Application.

Usage:
  1. Launch Desktop GUI (default):
       python main.py

  2. Command-Line Interface (CLI) for single or multiple PDF files:
       python main.py --input design1.pdf design2.pdf --output output/
       python main.py --input design1.pdf design2.pdf --output output/ --combine-same-gear
       python main.py --generate-samples samples/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List

from core.gear_manager import GearManager
from core.imposition_engine import ImpositionConfig, ImpositionEngine
from core.sample_generator import generate_all_samples


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Neylon va Satin stiker dizaynlarini mos valga (Gear) joylashtiruvchi 100% Vektor PDF Imposition dasturi."
    )
    parser.add_argument(
        "-i",
        "--input",
        nargs="+",
        help="Bitta yoki bir nechta kiruvchi vektor PDF fayllar (yoki papka) manzili.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="output",
        help="Chiquvchi tayyor fayllar saqlanadigan papka (standart: output/).",
    )
    parser.add_argument(
        "--gear",
        type=int,
        default=None,
        help="Valni (Gear) majburiy ko'rsatish (masalan: 59 yoki 45). Ko'rsatilmasa avtomatik topiladi.",
    )
    parser.add_argument(
        "--copies",
        type=int,
        default=None,
        help="Nusxalar sonini (N) majburiy ko'rsatish (masalan: 2). Ko'rsatilmasa avtomatik topiladi.",
    )
    parser.add_argument(
        "--combine-same-gear",
        action="store_true",
        help="Bir xil valga (Gear) tushadigan fayllarni bitta sahifada yonma-yon terish.",
    )
    parser.add_argument(
        "--color-mode",
        choices=["side_by_side", "separate_files"],
        default="side_by_side",
        help="Ko'p rangli dizaynlarni ranglarga ajratganda joylashtirish usuli.",
    )
    parser.add_argument(
        "--no-color-separation",
        action="store_true",
        help="Ranglarga ajratmasdan barchasini bitta 100%% Grayscale Qora qatlam qilish.",
    )
    parser.add_argument(
        "--keep-border",
        action="store_true",
        help="Dizaynning tashqi hoshiyasini (ramkasini) o'chirmaslik.",
    )
    parser.add_argument(
        "--regmark-stroke",
        type=float,
        default=0.2,
        help="Regmark chiziq qalinligi mm da (standart: 0.2 mm).",
    )
    parser.add_argument(
        "--regmark-tick",
        type=float,
        default=0.7,
        help="Regmark vertikal chiziqchasi uzunligi mm da (standart: 0.7 mm).",
    )
    parser.add_argument(
        "--regmark-width",
        type=float,
        default=0.0,
        help="Regmark gorizontal eni mm da (0 = stiker eniga mos).",
    )
    parser.add_argument(
        "--gap",
        type=float,
        default=5.0,
        help="Yonma-yon ustunlar orasidagi masofa mm da (standart: 5.0 mm).",
    )
    parser.add_argument(
        "--max-width",
        type=float,
        default=0.0,
        help="Valning maksimal eni mm da (0 = cheklanmagan).",
    )
    parser.add_argument(
        "--svg",
        action="store_true",
        help="Qo'shimcha SVG vektor formatda ham saqlash.",
    )
    parser.add_argument(
        "--eps",
        action="store_true",
        help="Qo'shimcha EPS vektor formatda ham saqlash.",
    )
    parser.add_argument(
        "--generate-samples",
        metavar="DIR",
        help="Namuna PDF fayllarni (80x15mm va 60x20mm) ko'rsatilgan papkaga yaratish.",
    )
    return parser.parse_args(argv)


def run_cli(args: argparse.Namespace) -> int:
    if args.generate_samples:
        files = generate_all_samples(args.generate_samples)
        print("Namuna PDF fayllar yaratildi:")
        for f in files:
            print(f"  - {f}")
        if not args.input:
            return 0

    input_files: List[Path] = []
    for item in args.input or []:
        p = Path(item)
        if p.is_dir():
            input_files.extend(sorted(p.glob("*.pdf")))
        elif p.is_file():
            input_files.append(p)
        else:
            print(f"Ogohlantirish: Fayl topilmadi: {p}", file=sys.stderr)

    if not input_files:
        print("Xato: Kiruvchi PDF fayllar topilmadi.", file=sys.stderr)
        return 1

    config = ImpositionConfig(
        remove_outer_border=not args.keep_border,
        separate_colors=not args.no_color_separation,
        color_output_mode=args.color_mode,
        regmark_enabled=True,
        regmark_stroke_mm=args.regmark_stroke,
        regmark_tick_mm=args.regmark_tick,
        regmark_custom_width_mm=args.regmark_width if args.regmark_width > 0 else None,
        column_gap_mm=args.gap,
        max_cylinder_width_mm=args.max_width,
        export_svg=args.svg,
        export_eps=args.eps,
    )

    engine = ImpositionEngine(GearManager())
    out_dir = Path(args.output)

    if args.combine_same_gear:
        overrides = {str(p): (args.gear, args.copies) for p in input_files}
        results = engine.process_batch_combined_by_gear(
            input_files, output_dir=out_dir, config=config, overrides=overrides
        )
    else:
        results = []
        for p in input_files:
            results.extend(
                engine.process_all_designs_in_file(
                    p,
                    output_dir=out_dir,
                    config=config,
                    custom_gear=args.gear,
                    custom_copies=args.copies,
                )
            )

    for res in results:
        print("=" * 72)
        print(f"Dizayn         : {res.design_info.display_name}")
        print(f"Asl o'lchami   : {res.design_info.width_mm:.2f} mm × {res.design_info.length_mm:.2f} mm")
        print(f"Tashqi hoshiya : {'Bor (Olib tashlandi)' if res.design_info.has_outer_border else 'Yo`q'}")
        print(
            f"Tanlangan Val  : {res.gear_match.gear} val | Nusxa: {res.gear_match.copies_count}x "
            f"| Printing: {res.gear_match.printing_length_mm:.2f} mm -> Film: {res.gear_match.film_length_mm:.2f} mm"
        )
        print(f"Ranglar ({len(res.detected_colors)} ta) : {', '.join(c.name for c in res.detected_colors)}")
        if res.audit_report:
            print(f"Grayscale Audit: {'PASSED (100% Pure Black)' if res.audit_report.passed else 'WARNING'}")
        for out_f in res.output_files:
            print(f"Saqlandi       : {out_f}")
    print("=" * 72)
    return 0


def main() -> None:
    if len(sys.argv) > 1:
        args = parse_args(sys.argv[1:])
        sys.exit(run_cli(args))
    else:
        from ui.app_gui import LabelImpositionApp

        app = LabelImpositionApp()
        app.mainloop()


if __name__ == "__main__":
    main()
