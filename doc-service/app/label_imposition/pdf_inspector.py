"""
Vector PDF inspection and surgical per-sticker vector isolation:
- Supports single-sticker PDFs, multi-page PDFs, and multi-sticker grid sheets
  (e.g., 26 individual stickers on a single CorelDRAW/Illustrator PDF page).
- Physically removes all vectors and text outside each sticker's bounding box AND
  physically removes the outer border rectangle (both `re S` and CorelDRAW's `m l l l h s/S`)
  WITHOUT using `re W n` clipping masks (which CorelDRAW imports as visible borders/ghost objects).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import pymupdf

PT_PER_MM = 72.0 / 25.4
MM_PER_PT = 25.4 / 72.0


def mm_to_pt(mm: float) -> float:
    return mm * PT_PER_MM


def pt_to_mm(pt: float) -> float:
    return pt * MM_PER_PT


@dataclass
class PDFDesignInfo:
    file_path: Path
    page_rect_pt: pymupdf.Rect
    design_rect_pt: pymupdf.Rect  # Bounding box of this sticker design in original page coordinates
    width_mm: float
    length_mm: float
    has_outer_border: bool
    border_stroke_width_pt: float
    interior_rect_pt: Optional[pymupdf.Rect]
    vector_paths_count: int
    text_blocks_count: int
    page_index: int = 0
    sub_index: int = 1
    total_sub_designs: int = 1

    @property
    def item_key(self) -> str:
        if self.total_sub_designs > 1:
            return f"{self.file_path}::p{self.page_index}_s{self.sub_index}"
        return str(self.file_path)

    @property
    def display_name(self) -> str:
        if self.total_sub_designs > 1:
            return f"{self.file_path.stem} [#{self.sub_index:02d}/{self.total_sub_designs}]"
        return self.file_path.name

    @property
    def output_stem(self) -> str:
        if self.total_sub_designs > 1:
            return f"{self.file_path.stem}_{self.sub_index:02d}"
        return self.file_path.stem


def _is_white_or_none(color: Optional[Tuple[float, ...]]) -> bool:
    if color is None:
        return True
    if len(color) == 1:
        return color[0] >= 0.98
    if len(color) == 3:
        return all(c >= 0.98 for c in color)
    if len(color) == 4:
        return all(c <= 0.02 for c in color)
    return False


def _is_rectangular_path(drawing: dict, tol_pt: float = 0.75) -> bool:
    """Checks if a PyMuPDF drawing dictionary represents an unfilled (or white-filled) outer rectangle."""
    fill = drawing.get("fill")
    stroke = drawing.get("color")
    if stroke is None and not _is_white_or_none(fill):
        return False
    if not _is_white_or_none(fill):
        return False

    rect: pymupdf.Rect = drawing.get("rect")
    if rect is None or rect.is_empty:
        return False

    if pt_to_mm(rect.width) < 5.0 or pt_to_mm(rect.height) < 12.0:
        return False

    items = drawing.get("items", [])
    if not items:
        return False

    if len(items) == 1 and items[0][0] in ("re", "qu"):
        return True

    lines = [it for it in items if it[0] == "l"]
    curves = [it for it in items if it[0] in ("c",)]
    if curves:
        return False

    if len(lines) == 4:
        for _, p1, p2 in lines:
            on_x = (abs(p1.x - rect.x0) <= tol_pt or abs(p1.x - rect.x1) <= tol_pt) and (
                abs(p2.x - rect.x0) <= tol_pt or abs(p2.x - rect.x1) <= tol_pt
            )
            on_y = (abs(p1.y - rect.y0) <= tol_pt or abs(p1.y - rect.y1) <= tol_pt) and (
                abs(p2.y - rect.y0) <= tol_pt or abs(p2.y - rect.y1) <= tol_pt
            )
            if not (on_x and on_y):
                return False
        return True

    return False


def _rect_contains(outer: pymupdf.Rect, inner: pymupdf.Rect, tol_pt: float = 1.5) -> bool:
    return (
        outer.x0 <= inner.x0 + tol_pt
        and outer.y0 <= inner.y0 + tol_pt
        and outer.x1 >= inner.x1 - tol_pt
        and outer.y1 >= inner.y1 - tol_pt
    )


def _rect_nearly_equal(r1: pymupdf.Rect, r2: pymupdf.Rect, tol_pt: float = 1.5) -> bool:
    return (
        abs(r1.x0 - r2.x0) <= tol_pt
        and abs(r1.y0 - r2.y0) <= tol_pt
        and abs(r1.x1 - r2.x1) <= tol_pt
        and abs(r1.y1 - r2.y1) <= tol_pt
    )


def _find_sticker_borders_on_page(drawings: List[dict]) -> List[Tuple[int, dict, pymupdf.Rect]]:
    """
    Detects one or multiple (e.g. 26) individual sticker border rectangles on a single PDF page.
    """
    raw_candidates: List[Tuple[int, dict, pymupdf.Rect]] = []
    for idx, d in enumerate(drawings):
        if _is_rectangular_path(d):
            r = pymupdf.Rect(d["rect"])
            if any(_rect_nearly_equal(r, existing_r) for _, _, existing_r in raw_candidates):
                continue
            raw_candidates.append((idx, d, r))

    if not raw_candidates:
        return []

    filtered_sheet: List[Tuple[int, dict, pymupdf.Rect]] = []
    for idx_a, d_a, r_a in raw_candidates:
        children = [
            r_b
            for idx_b, _, r_b in raw_candidates
            if idx_b != idx_a and _rect_contains(r_a, r_b) and (r_b.width * r_b.height) < (r_a.width * r_a.height * 0.85)
        ]
        disjoint_children = 0
        used_rects: List[pymupdf.Rect] = []
        for ch in children:
            if not any(ch.intersects(u) for u in used_rects):
                disjoint_children += 1
                used_rects.append(ch)
        if disjoint_children >= 2:
            continue
        filtered_sheet.append((idx_a, d_a, r_a))

    top_level: List[Tuple[int, dict, pymupdf.Rect]] = []
    for idx_a, d_a, r_a in filtered_sheet:
        is_inside_another = False
        for idx_b, _, r_b in filtered_sheet:
            if idx_a == idx_b:
                continue
            if _rect_contains(r_b, r_a) and (r_b.width * r_b.height) > (r_a.width * r_a.height * 1.05):
                is_inside_another = True
                break
        if not is_inside_another:
            top_level.append((idx_a, d_a, r_a))

    if len(top_level) > 1:
        areas = sorted(r.width * r.height for _, _, r in top_level)
        median_area = areas[len(areas) // 2]
        top_level = [
            item
            for item in top_level
            if (0.35 * median_area) <= (item[2].width * item[2].height) <= (2.8 * median_area)
        ]

    if len(top_level) > 1:
        avg_h = sum(r.height for _, _, r in top_level) / len(top_level)
        row_tol = max(avg_h * 0.35, 10.0)
        top_level.sort(key=lambda item: (round(item[2].y0 / row_tol), item[2].x0))

    return top_level


def inspect_pdf_designs(pdf_path: Path | str) -> List[PDFDesignInfo]:
    """
    Inspects a vector PDF file and returns a list of `PDFDesignInfo` objects
    (1 for single-sticker PDFs, or N for multi-sticker sheets / multi-page PDFs).
    """
    path = Path(pdf_path)
    doc = pymupdf.open(path)
    results: List[PDFDesignInfo] = []
    try:
        for pno in range(len(doc)):
            page = doc[pno]
            page_rect = page.cropbox if not page.cropbox.is_empty else page.rect
            drawings = page.get_drawings()
            text_dict = page.get_text("dict")
            text_blocks = [b for b in text_dict.get("blocks", []) if b.get("type") == 0]

            sticker_borders = _find_sticker_borders_on_page(drawings)

            if len(sticker_borders) > 1:
                for border_idx, border_d, border_rect in sticker_borders:
                    border_stroke_pt = float(border_d.get("width") or 0.5)
                    interior_rects: List[pymupdf.Rect] = []
                    sub_drawings_count = 0
                    for idx, d in enumerate(drawings):
                        if idx == border_idx:
                            continue
                        r = d.get("rect")
                        if r is not None and not r.is_empty and _rect_contains(border_rect, pymupdf.Rect(r), tol_pt=2.0):
                            interior_rects.append(pymupdf.Rect(r))
                            sub_drawings_count += 1
                    sub_texts_count = 0
                    for b in text_blocks:
                        bbox = b.get("bbox")
                        if bbox and _rect_contains(border_rect, pymupdf.Rect(bbox), tol_pt=2.0):
                            interior_rects.append(pymupdf.Rect(bbox))
                            sub_texts_count += 1

                    interior_union: Optional[pymupdf.Rect] = None
                    if interior_rects:
                        interior_union = pymupdf.Rect(interior_rects[0])
                        for r in interior_rects[1:]:
                            interior_union |= r

                    results.append(
                        PDFDesignInfo(
                            file_path=path,
                            page_rect_pt=page_rect,
                            design_rect_pt=border_rect,
                            width_mm=round(pt_to_mm(border_rect.width), 3),
                            length_mm=round(pt_to_mm(border_rect.height), 3),
                            has_outer_border=True,
                            border_stroke_width_pt=border_stroke_pt,
                            interior_rect_pt=interior_union,
                            vector_paths_count=sub_drawings_count + 1,
                            text_blocks_count=sub_texts_count,
                            page_index=pno,
                        )
                    )
            else:
                has_outer_border = False
                border_stroke_pt = 0.0
                design_rect = pymupdf.Rect(page_rect)
                interior_rect: Optional[pymupdf.Rect] = None

                if len(sticker_borders) == 1 and (len(drawings) > 1 or len(text_blocks) > 0):
                    border_idx, border_d, border_rect = sticker_borders[0]
                    has_outer_border = True
                    border_stroke_pt = float(border_d.get("width") or 0.5)
                    edge_tol = max(border_stroke_pt * 1.5, 1.0)
                    if (
                        abs(border_rect.x0 - page_rect.x0) <= edge_tol
                        and abs(border_rect.y0 - page_rect.y0) <= edge_tol
                        and abs(border_rect.x1 - page_rect.x1) <= edge_tol
                        and abs(border_rect.y1 - page_rect.y1) <= edge_tol
                    ):
                        design_rect = pymupdf.Rect(page_rect)
                    else:
                        design_rect = border_rect

                    interior_rects = []
                    for idx, d in enumerate(drawings):
                        if idx == border_idx:
                            continue
                        r = d.get("rect")
                        if r is not None and not r.is_empty:
                            interior_rects.append(pymupdf.Rect(r))
                    for b in text_blocks:
                        bbox = b.get("bbox")
                        if bbox:
                            interior_rects.append(pymupdf.Rect(bbox))
                    if interior_rects:
                        interior_rect = pymupdf.Rect(interior_rects[0])
                        for r in interior_rects[1:]:
                            interior_rect |= r

                results.append(
                    PDFDesignInfo(
                        file_path=path,
                        page_rect_pt=page_rect,
                        design_rect_pt=design_rect,
                        width_mm=round(pt_to_mm(design_rect.width), 3),
                        length_mm=round(pt_to_mm(design_rect.height), 3),
                        has_outer_border=has_outer_border,
                        border_stroke_width_pt=border_stroke_pt,
                        interior_rect_pt=interior_rect,
                        vector_paths_count=len(drawings),
                        text_blocks_count=len(text_blocks),
                        page_index=pno,
                    )
                )

        total = len(results)
        for idx, item in enumerate(results, start=1):
            item.sub_index = idx
            item.total_sub_designs = total

        return results
    finally:
        doc.close()


def inspect_pdf_design(pdf_path: Path | str, page_index: int = 0) -> PDFDesignInfo:
    """Inspects the first (or specified) sticker design in a PDF file."""
    designs = inspect_pdf_designs(pdf_path)
    for d in designs:
        if d.page_index == page_index:
            return d
    return designs[0]


# Tokenizer for PDF content stream parsing
_STREAM_TOKEN_RE = re.compile(
    r"""
    (\((?:\\.|[^\\()])*\)) |                                    # Literal string (...)
    (<[0-9A-Fa-f\s]*>) |                                        # Hex string <...>
    (\[(?:[^\[\]]|\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>)*\]) |  # Array [...]
    (/[A-Za-z0-9_.\-+]+) |                                      # Name /Name
    ([-+]?(?:\d+\.?\d*|\.\d+)) |                                # Number
    ([A-Za-z*'"]+)                                              # Operator
    """,
    re.VERBOSE,
)


def _is_num(tok: str) -> bool:
    try:
        float(tok)
        return True
    except ValueError:
        return False


def _isolate_sticker_and_remove_border_from_stream(
    stream_bytes: bytes,
    target_pdf_rect: Tuple[float, float, float, float],
    remove_border: bool = True,
) -> bytes:
    """
    Surgically filters a PDF content stream in PDF user space `target_pdf_rect = (x0, y0, x1, y1)`:
    1. Tracks the Current Transformation Matrix (`cm` / `q` / `Q`).
    2. Physically deletes all `BT ... ET` text blocks located outside `target_pdf_rect`.
    3. Physically deletes all vector paths (`m`, `l`, `c`, `v`, `y`, `re`, `h` + painting op)
       located outside `target_pdf_rect`.
    4. Physically deletes the outer border rectangle (`re S` or CorelDRAW's `m l l l h S/s`)
       matching `target_pdf_rect` when `remove_border=True`.
    5. Translates all remaining content by `(-x0, -y0)` so the sticker sits cleanly at `(0, 0, w, h)`
       with ZERO `re W n` clipping masks!
    """
    try:
        text = stream_bytes.decode("latin1")
    except Exception:
        return stream_bytes

    tx0, ty0, tx1, ty1 = target_pdf_rect
    outside_tol = 2.5
    border_tol = 2.2

    tokens = [m.group(0) for m in _STREAM_TOKEN_RE.finditer(text)]
    out_cmds: List[str] = []
    operands: List[str] = []

    ctm = pymupdf.Matrix(1, 0, 0, 1, 0, 0)
    ctm_stack: List[pymupdf.Matrix] = []

    # Text block buffering state
    in_bt = False
    bt_cmds: List[str] = []
    tm = pymupdf.Matrix(1, 0, 0, 1, 0, 0)
    tlm = pymupdf.Matrix(1, 0, 0, 1, 0, 0)
    bt_points: List[pymupdf.Point] = []

    # Path construction buffering state
    path_cmds: List[str] = []
    path_points: List[pymupdf.Point] = []
    path_has_curves = False
    path_seg_count = 0

    def point_in_target(pt: pymupdf.Point, tol: float = outside_tol) -> bool:
        return (tx0 - tol) <= pt.x <= (tx1 + tol) and (ty0 - tol) <= pt.y <= (ty1 + tol)

    for tok in tokens:
        if _is_num(tok) or tok.startswith(("/", "(", "<", "[")):
            operands.append(tok)
            continue

        op = tok
        cmd_str = (" ".join(operands) + " " + op).strip()

        # Inside a BT ... ET text object
        if in_bt:
            bt_cmds.append(cmd_str)
            if op == "Tm" and len(operands) >= 6 and all(_is_num(x) for x in operands[-6:]):
                vals = [float(x) for x in operands[-6:]]
                tm = pymupdf.Matrix(*vals)
                tlm = pymupdf.Matrix(*vals)
            elif op in ("Td", "TD") and len(operands) >= 2 and all(_is_num(x) for x in operands[-2:]):
                dx, dy = float(operands[-2]), float(operands[-1])
                tlm = pymupdf.Matrix(1, 0, 0, 1, dx, dy) * tlm
                tm = pymupdf.Matrix(tlm)
            elif op in ("Tj", "TJ", "'", '"'):
                bt_points.append(pymupdf.Point(tm.e, tm.f) * ctm)
            elif op == "ET":
                in_bt = False
                # Keep BT..ET only if its text position falls inside target_pdf_rect
                if not bt_points or any(point_in_target(p, tol=3.5) for p in bt_points):
                    out_cmds.extend(bt_cmds)
                bt_cmds.clear()
                bt_points.clear()
            operands.clear()
            continue

        if op == "BT":
            in_bt = True
            bt_cmds = ["BT"]
            tm = pymupdf.Matrix(1, 0, 0, 1, 0, 0)
            tlm = pymupdf.Matrix(1, 0, 0, 1, 0, 0)
            bt_points.clear()
            operands.clear()
            continue

        # Path construction operators
        if op == "m" and len(operands) >= 2 and all(_is_num(x) for x in operands[-2:]):
            x, y = float(operands[-2]), float(operands[-1])
            path_points.append(pymupdf.Point(x, y) * ctm)
            path_cmds.append(cmd_str)
            operands.clear()
            continue

        if op == "l" and len(operands) >= 2 and all(_is_num(x) for x in operands[-2:]):
            x, y = float(operands[-2]), float(operands[-1])
            path_points.append(pymupdf.Point(x, y) * ctm)
            path_seg_count += 1
            path_cmds.append(cmd_str)
            operands.clear()
            continue

        if op == "c" and len(operands) >= 6 and all(_is_num(x) for x in operands[-6:]):
            vals = [float(x) for x in operands[-6:]]
            path_points.append(pymupdf.Point(vals[0], vals[1]) * ctm)
            path_points.append(pymupdf.Point(vals[2], vals[3]) * ctm)
            path_points.append(pymupdf.Point(vals[4], vals[5]) * ctm)
            path_has_curves = True
            path_seg_count += 1
            path_cmds.append(cmd_str)
            operands.clear()
            continue

        if op in ("v", "y") and len(operands) >= 4 and all(_is_num(x) for x in operands[-4:]):
            vals = [float(x) for x in operands[-4:]]
            path_points.append(pymupdf.Point(vals[0], vals[1]) * ctm)
            path_points.append(pymupdf.Point(vals[2], vals[3]) * ctm)
            path_has_curves = True
            path_seg_count += 1
            path_cmds.append(cmd_str)
            operands.clear()
            continue

        if op == "re" and len(operands) >= 4 and all(_is_num(x) for x in operands[-4:]):
            x, y, w, h = (float(operands[-4]), float(operands[-3]), float(operands[-2]), float(operands[-1]))
            path_points.append(pymupdf.Point(x, y) * ctm)
            path_points.append(pymupdf.Point(x + w, y + h) * ctm)
            path_seg_count += 1
            path_cmds.append(cmd_str)
            operands.clear()
            continue

        if op == "h" and not operands:
            path_cmds.append("h")
            operands.clear()
            continue

        # Clipping path operators: drop clipping operator if path is outside or matches sticker/page box
        if op in ("W", "W*") and not operands:
            path_cmds.append(op)
            operands.clear()
            continue

        # Path painting / ending operators
        if op in ("S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n") and not operands:
            if path_points:
                min_x = min(p.x for p in path_points)
                max_x = max(p.x for p in path_points)
                min_y = min(p.y for p in path_points)
                max_y = max(p.y for p in path_points)

                inside = (
                    min_x >= (tx0 - outside_tol)
                    and max_x <= (tx1 + outside_tol)
                    and min_y >= (ty0 - outside_tol)
                    and max_y <= (ty1 + outside_tol)
                )

                is_outer_border = False
                if (
                    remove_border
                    and op in ("S", "s", "B", "B*", "b", "b*")
                    and not path_has_curves
                    and path_seg_count <= 6
                ):
                    if (
                        abs(min_x - tx0) <= border_tol
                        and abs(max_x - tx1) <= border_tol
                        and abs(min_y - ty0) <= border_tol
                        and abs(max_y - ty1) <= border_tol
                    ):
                        is_outer_border = True

                # Also drop any `W n` clipping rectangle so CorelDRAW doesn't import clip boxes as borders
                has_clip_op = any(c in ("W", "W*") for c in path_cmds)

                if inside and not is_outer_border and not (op == "n" and has_clip_op):
                    out_cmds.extend(path_cmds)
                    out_cmds.append(op)

            path_cmds.clear()
            path_points.clear()
            path_has_curves = False
            path_seg_count = 0
            operands.clear()
            continue

        # Graphics state stack & CTM
        if op == "q" and not operands:
            ctm_stack.append(pymupdf.Matrix(ctm))
            out_cmds.append("q")
            operands.clear()
            continue

        if op == "Q" and not operands:
            if ctm_stack:
                ctm = ctm_stack.pop()
            out_cmds.append("Q")
            operands.clear()
            continue

        if op == "cm" and len(operands) >= 6 and all(_is_num(x) for x in operands[-6:]):
            vals = [float(x) for x in operands[-6:]]
            ctm = pymupdf.Matrix(*vals) * ctm
            out_cmds.append(cmd_str)
            operands.clear()
            continue

        out_cmds.append(cmd_str)
        operands.clear()

    # Translate sticker origin from (tx0, ty0) to (0, 0) in PDF user space
    translate_prefix = f"q 1 0 0 1 {-tx0:.4f} {-ty0:.4f} cm\n"
    translate_suffix = "\nQ\n"
    body = _prune_empty_graphics_states("\n".join(out_cmds))
    return (translate_prefix + body + translate_suffix).encode("latin1")


_PAINT_OR_TEXT_RE = re.compile(r"\b(BT|ET|Tj|TJ|S|s|f|F|f\*|B|B\*|b|b\*|Do|BI|sh)\b")


def _prune_empty_graphics_states(stream_text: str) -> str:
    """
    Removes empty `q ... Q` blocks (blocks that contain no path painting or text operators
    after other stickers' paths/texts were removed) and deduplicates consecutive orphan
    `/Corel_OTF ... DP` property markers.
    """
    # Remove orphan `/Corel_OTF /OTF1 DP` lines not followed by BT
    lines = stream_text.splitlines()
    cleaned_lines: List[str] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if line.endswith(" DP") and "/Corel_OTF" in line:
            # Look ahead to see if BT appears before another DP or Q
            j = i + 1
            found_bt = False
            while j < min(n, i + 5):
                nxt = lines[j].strip()
                if nxt == "BT":
                    found_bt = True
                    break
                if nxt.endswith(" DP") or nxt in ("q", "Q"):
                    break
                j += 1
            if not found_bt:
                # Also drop immediately preceding `/GS... gs` if it was only for this dropped BT
                if cleaned_lines and cleaned_lines[-1].endswith(" gs"):
                    cleaned_lines.pop()
                i += 1
                continue
        cleaned_lines.append(line)
        i += 1

    # Prune empty `q ... Q` scopes using a stack
    frames: List[Tuple[List[str], bool]] = [([], True)]
    for line in cleaned_lines:
        if line == "q":
            frames.append((["q"], False))
        elif line == "Q" and len(frames) > 1:
            frame_lines, has_paint = frames.pop()
            if has_paint:
                frame_lines.append("Q")
                parent_lines, _ = frames[-1]
                parent_lines.extend(frame_lines)
                frames[-1] = (parent_lines, True)
        else:
            curr_lines, has_paint = frames[-1]
            curr_lines.append(line)
            if not has_paint and _PAINT_OR_TEXT_RE.search(line):
                frames[-1] = (curr_lines, True)

    result_lines: List[str] = []
    for frame_lines, _ in frames:
        result_lines.extend(frame_lines)
    return "\n".join(result_lines)


def prepare_borderless_source_doc(
    pdf_path: Path | str,
    info: Optional[PDFDesignInfo] = None,
    remove_border: bool = True,
    page_index: int = 0,
) -> Tuple[pymupdf.Document, pymupdf.Rect]:
    """
    Opens the source PDF and creates a pure, isolated 1-page vector PDF for `info`
    with exact dimensions `(0, 0, width_pt, height_pt)`:
    - Physically deletes all vectors and text belonging to other stickers on a multi-sticker sheet.
    - Physically deletes the outer border rectangle (`hoshiya`) without using `re W n` clipping masks.
    Returns `(isolated_doc, normalized_rect_pt)`. Caller is responsible for closing `isolated_doc`.
    """
    if info is None:
        info = inspect_pdf_design(pdf_path, page_index=page_index)

    src_doc = pymupdf.open(pdf_path)
    try:
        design_rect = pymupdf.Rect(info.design_rect_pt)

        doc = pymupdf.open()
        doc.insert_pdf(src_doc, from_page=info.page_index, to_page=info.page_index)
        page = doc[0]
        page.clean_contents()

        xrefs = page.get_contents()
        if xrefs:
            raw_stream = page.read_contents()
            inv_mat = ~page.transformation_matrix
            p0 = pymupdf.Point(design_rect.x0, design_rect.y0) * inv_mat
            p1 = pymupdf.Point(design_rect.x1, design_rect.y1) * inv_mat
            target_pdf_rect = (
                min(p0.x, p1.x),
                min(p0.y, p1.y),
                max(p0.x, p1.x),
                max(p0.y, p1.y),
            )

            isolated_stream = _isolate_sticker_and_remove_border_from_stream(
                raw_stream,
                target_pdf_rect=target_pdf_rect,
                remove_border=remove_border and info.has_outer_border,
            )
            doc.update_stream(xrefs[0], isolated_stream)

            # Prune unused font references from page Resources/Font so multi-megabyte unused fonts
            # from other stickers on a sheet are garbage-collected upon save
            try:
                stream_str = isolated_stream.decode("latin1", errors="ignore")
                used_fonts = set(re.findall(r"/([A-Za-z0-9_.\-+]+)\s+[-+]?\d*\.?\d+\s+Tf\b", stream_str))
                fdict_type, fdict_val = doc.xref_get_key(page.xref, "Resources/Font")
                if fdict_type == "dict" and fdict_val:
                    kept = [
                        m.group(0)
                        for m in re.finditer(r"/([A-Za-z0-9_.\-+]+)\s+\d+\s+0\s+R", fdict_val)
                        if m.group(1) in used_fonts
                    ]
                    doc.xref_set_key(page.xref, "Resources/Font", "<<" + " ".join(kept) + ">>")
            except Exception:
                pass

        norm_rect = pymupdf.Rect(0.0, 0.0, design_rect.width, design_rect.height)
        page.set_mediabox(norm_rect)
        page.set_cropbox(norm_rect)

        return doc, norm_rect
    finally:
        src_doc.close()
