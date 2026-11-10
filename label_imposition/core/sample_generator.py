"""Generates realistic vector PDF sticker samples for testing and demonstration."""

from __future__ import annotations

from pathlib import Path
from typing import List

import pymupdf

from core.pdf_inspector import mm_to_pt


def create_sample_80x15_reserved(output_path: Path | str, with_border: bool = True) -> Path:
    """
    Creates the 15.00 mm x 80.00 mm 'RESERVED / S' vector PDF sticker shown in the user's diagram.
    Matches Gear 59 (Printing length = 159.93 mm, Film length = 150.63 mm, N = 2).
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    w_pt = mm_to_pt(15.0)
    h_pt = mm_to_pt(80.0)

    doc = pymupdf.open()
    page = doc.new_page(width=w_pt, height=h_pt)

    # Outer border (dizayn hoshiyasi)
    if with_border:
        page.draw_rect(
            pymupdf.Rect(0.25, 0.25, w_pt - 0.25, h_pt - 0.25),
            color=(0.0, 0.0, 0.0),
            width=0.5,
        )

    # Vertical text "RESERVED" and "S" centered in the 15x80mm label (rotated 270 deg)
    center_x = w_pt / 2.0
    center_y = h_pt / 2.0

    page.insert_text(
        pymupdf.Point(center_x + 2.0, center_y - 18.0),
        "RESERVED",
        fontsize=7.5,
        fontname="helv",
        rotate=270,
        color=(0.0, 0.0, 0.0),
    )
    # Small divider line next to RESERVED
    page.draw_line(
        pymupdf.Point(center_x - 2.0, center_y - 4.0),
        pymupdf.Point(center_x - 2.0, center_y + 4.0),
        color=(0.0, 0.0, 0.0),
        width=0.5,
    )
    page.insert_text(
        pymupdf.Point(center_x - 4.5, center_y - 1.5),
        "S",
        fontsize=4.5,
        fontname="helv",
        rotate=270,
        color=(0.0, 0.0, 0.0),
    )

    doc.save(out)
    doc.close()
    return out


def create_sample_60x20_two_color(output_path: Path | str, with_border: bool = True) -> Path:
    """
    Creates the 20.00 mm x 60.00 mm 2-color (Black + Red) vector PDF sticker.
    Matches Gear 45 (Printing length = 121.98 mm, Film length = 112.68 mm, N = 2).
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    w_pt = mm_to_pt(20.0)
    h_pt = mm_to_pt(60.0)

    doc = pymupdf.open()
    page = doc.new_page(width=w_pt, height=h_pt)

    # Outer border (dizayn hoshiyasi)
    if with_border:
        page.draw_rect(
            pymupdf.Rect(0.25, 0.25, w_pt - 0.25, h_pt - 0.25),
            color=(0.0, 0.0, 0.0),
            width=0.5,
        )

    # RED vector graphic (diamond logo + RED accent text)
    red_rgb = (0.90, 0.05, 0.05)
    cx = w_pt / 2.0
    cy_logo = mm_to_pt(18.0)
    r_logo = mm_to_pt(4.5)
    shape = page.new_shape()
    shape.draw_polyline(
        [
            pymupdf.Point(cx, cy_logo - r_logo),
            pymupdf.Point(cx + r_logo, cy_logo),
            pymupdf.Point(cx, cy_logo + r_logo),
            pymupdf.Point(cx - r_logo, cy_logo),
            pymupdf.Point(cx, cy_logo - r_logo),
        ]
    )
    shape.finish(color=red_rgb, fill=red_rgb, width=0.6)
    shape.commit()

    page.insert_text(
        pymupdf.Point(mm_to_pt(4.0), mm_to_pt(28.0)),
        "PREMIUM",
        fontsize=8.0,
        fontname="helv",
        color=red_rgb,
    )

    # BLACK vector text & decorative lines
    black_rgb = (0.0, 0.0, 0.0)
    page.draw_line(
        pymupdf.Point(mm_to_pt(3.0), mm_to_pt(31.5)),
        pymupdf.Point(mm_to_pt(17.0), mm_to_pt(31.5)),
        color=black_rgb,
        width=0.7,
    )
    page.insert_text(
        pymupdf.Point(mm_to_pt(3.5), mm_to_pt(38.0)),
        "100% SATIN",
        fontsize=6.5,
        fontname="helv",
        color=black_rgb,
    )
    page.insert_text(
        pymupdf.Point(mm_to_pt(4.5), mm_to_pt(45.0)),
        "MADE IN UZ",
        fontsize=6.0,
        fontname="helv",
        color=black_rgb,
    )

    doc.save(out)
    doc.close()
    return out


def create_sample_80x12_care_label(output_path: Path | str, with_border: bool = True) -> Path:
    """
    Creates a second 80.00 mm length design (12.00 mm x 80.00 mm) that also matches Gear 59,
    useful for demonstrating side-by-side multi-file imposition on the same gear.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    w_pt = mm_to_pt(12.0)
    h_pt = mm_to_pt(80.0)

    doc = pymupdf.open()
    page = doc.new_page(width=w_pt, height=h_pt)

    if with_border:
        page.draw_rect(
            pymupdf.Rect(0.25, 0.25, w_pt - 0.25, h_pt - 0.25),
            color=(0.0, 0.0, 0.0),
            width=0.5,
        )

    cx = w_pt / 2.0
    page.insert_text(
        pymupdf.Point(cx + 1.5, mm_to_pt(22.0)),
        "100% COTTON",
        fontsize=6.0,
        fontname="helv",
        rotate=270,
        color=(0.0, 0.0, 0.0),
    )
    page.draw_circle(
        pymupdf.Point(cx, mm_to_pt(55.0)),
        mm_to_pt(3.0),
        color=(0.0, 0.0, 0.0),
        width=0.6,
    )

    doc.save(out)
    doc.close()
    return out


def create_sample_26_stickers_sheet(output_path: Path | str) -> Path:
    """
    Creates a single PDF page containing 26 individual stickers arranged in a grid
    (Row 1: 6 care/composition labels; Rows 2-5: 4x5 = 20 'sela. EAC' barcode labels,
    each 20.00 mm x 60.00 mm with its own outer border and interior stitch line),
    matching the user's 26-sticker sheet screenshot.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    sticker_w_mm = 20.0
    sticker_h_mm = 60.0
    gap_x_mm = 6.0
    gap_y_mm = 6.0
    margin_mm = 10.0

    # 6 columns in row 0, 5 columns in rows 1..4 -> total 26 stickers
    sheet_w_pt = mm_to_pt(margin_mm * 2 + 6 * sticker_w_mm + 5 * gap_x_mm)
    sheet_h_pt = mm_to_pt(margin_mm * 2 + 5 * sticker_h_mm + 4 * gap_y_mm)

    doc = pymupdf.open()
    page = doc.new_page(width=sheet_w_pt, height=sheet_h_pt)

    idx = 0
    for row in range(5):
        cols_in_row = 6 if row == 0 else 5
        for col in range(cols_in_row):
            idx += 1
            x0_mm = margin_mm + col * (sticker_w_mm + gap_x_mm)
            y0_mm = margin_mm + row * (sticker_h_mm + gap_y_mm)
            r = pymupdf.Rect(
                mm_to_pt(x0_mm),
                mm_to_pt(y0_mm),
                mm_to_pt(x0_mm + sticker_w_mm),
                mm_to_pt(y0_mm + sticker_h_mm),
            )
            # Outer rectangle border for this sticker
            page.draw_rect(r, color=(0.0, 0.0, 0.0), width=0.5)

            # Interior horizontal stitch line 6mm from the top (must be preserved!)
            stitch_y = mm_to_pt(y0_mm + 6.0)
            page.draw_line(
                pymupdf.Point(r.x0 + 1.0, stitch_y),
                pymupdf.Point(r.x1 - 1.0, stitch_y),
                color=(0.0, 0.0, 0.0),
                width=0.4,
            )

            if row == 0:
                page.insert_text(
                    pymupdf.Point(r.x0 + mm_to_pt(3.0), r.y0 + mm_to_pt(18.0)),
                    f"CARE #{idx:02d}",
                    fontsize=6.5,
                    fontname="helv",
                    color=(0.0, 0.0, 0.0),
                )
                page.insert_text(
                    pymupdf.Point(r.x0 + mm_to_pt(3.0), r.y0 + mm_to_pt(28.0)),
                    "Cotton 100%",
                    fontsize=5.5,
                    fontname="helv",
                    color=(0.0, 0.0, 0.0),
                )
            else:
                page.insert_text(
                    pymupdf.Point(r.x0 + mm_to_pt(2.5), r.y0 + mm_to_pt(16.0)),
                    "sela. EAC",
                    fontsize=7.0,
                    fontname="helv",
                    color=(0.0, 0.0, 0.0),
                )
                page.insert_text(
                    pymupdf.Point(r.x0 + mm_to_pt(2.5), r.y0 + mm_to_pt(23.0)),
                    f"SL7805-{idx:02d}",
                    fontsize=5.5,
                    fontname="helv",
                    color=(0.0, 0.0, 0.0),
                )
                # Simulated vector barcode bars inside the sticker
                for b_i in range(8):
                    bx = r.x0 + mm_to_pt(3.0 + b_i * 1.7)
                    bw = mm_to_pt(0.7 if b_i % 2 == 0 else 0.35)
                    bar_rect = pymupdf.Rect(bx, r.y0 + mm_to_pt(32.0), bx + bw, r.y0 + mm_to_pt(52.0))
                    page.draw_rect(bar_rect, color=(0.0, 0.0, 0.0), fill=(0.0, 0.0, 0.0), width=0.1)

    doc.save(out)
    doc.close()
    return out


def generate_all_samples(target_dir: Path | str) -> List[Path]:
    d = Path(target_dir)
    d.mkdir(parents=True, exist_ok=True)
    return [
        create_sample_80x15_reserved(d / "namuna_15x80mm_RESERVED.pdf"),
        create_sample_60x20_two_color(d / "namuna_20x60mm_Qora_Qizil.pdf"),
        create_sample_80x12_care_label(d / "namuna_12x80mm_COTTON.pdf"),
        create_sample_26_stickers_sheet(d / "namuna_26ta_stiker_sela_varaq.pdf"),
    ]
