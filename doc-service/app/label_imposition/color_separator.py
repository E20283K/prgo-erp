"""
Color Detection, Vector Color Separation, and 100% Grayscale Black Enforcement & Audit Module.

Ensures:
1. Detection of 1, 2, or more distinct colors in an input vector PDF (e.g., Black and Red).
2. Vector-level color separation into distinct plates/channels where each channel contains
   only its respective vector elements & text, converted to 100% Pure Grayscale Black (0 g / 0 G).
3. Final verification & enforcement pass guaranteeing 100% uniform Grayscale Black across the output PDF.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pymupdf


@dataclass
class DetectedColor:
    color_id: int
    name: str
    rgb: Tuple[float, float, float]  # Normalized 0.0..1.0
    hex_code: str
    object_count: int = 1


@dataclass
class GrayscaleAuditReport:
    passed: bool
    is_pure_grayscale_black: bool
    non_black_drawings_count: int
    non_black_text_spans_count: int
    remaining_rgb_cmyk_ops: int
    details: List[str] = field(default_factory=list)


def cmyk_to_rgb(c: float, m: float, y: float, k: float) -> Tuple[float, float, float]:
    r = (1.0 - min(1.0, c * (1.0 - k) + k))
    g = (1.0 - min(1.0, m * (1.0 - k) + k))
    b = (1.0 - min(1.0, y * (1.0 - k) + k))
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)))


def normalize_color_to_rgb(color: Optional[Tuple[float, ...] | int]) -> Optional[Tuple[float, float, float]]:
    """Converts PyMuPDF color tuple (Gray, RGB, CMYK) or sRGB int into (r, g, b) in 0.0..1.0."""
    if color is None:
        return None
    if isinstance(color, int):
        r = ((color >> 16) & 0xFF) / 255.0
        g = ((color >> 8) & 0xFF) / 255.0
        b = (color & 0xFF) / 255.0
        return (r, g, b)
    if len(color) == 1:
        v = float(color[0])
        return (v, v, v)
    if len(color) == 3:
        return (float(color[0]), float(color[1]), float(color[2]))
    if len(color) == 4:
        return cmyk_to_rgb(float(color[0]), float(color[1]), float(color[2]), float(color[3]))
    return None


def is_white_rgb(rgb: Optional[Tuple[float, float, float]], threshold: float = 0.96) -> bool:
    if rgb is None:
        return True
    return rgb[0] >= threshold and rgb[1] >= threshold and rgb[2] >= threshold


def is_black_rgb(rgb: Optional[Tuple[float, float, float]], threshold: float = 0.04) -> bool:
    if rgb is None:
        return False
    return rgb[0] <= threshold and rgb[1] <= threshold and rgb[2] <= threshold


def rgb_distance(c1: Tuple[float, float, float], c2: Tuple[float, float, float]) -> float:
    return math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2)


def rgb_to_hex(rgb: Tuple[float, float, float]) -> str:
    r = max(0, min(255, round(rgb[0] * 255)))
    g = max(0, min(255, round(rgb[1] * 255)))
    b = max(0, min(255, round(rgb[2] * 255)))
    return f"#{r:02X}{g:02X}{b:02X}"


def classify_color_name(rgb: Tuple[float, float, float]) -> str:
    r, g, b = rgb
    if r < 0.22 and g < 0.22 and b < 0.22:
        return "Qora (Black)"
    if abs(r - g) < 0.08 and abs(g - b) < 0.08:
        return f"Kulrang (Gray {rgb_to_hex(rgb)})"
    if r > 0.50 and g < 0.35 and b < 0.35:
        return "Qizil (Red)"
    if b > 0.45 and r < 0.35:
        return "Ko'k (Blue)"
    if g > 0.45 and r < 0.35 and b < 0.35:
        return "Yashil (Green)"
    if r > 0.60 and g > 0.50 and b < 0.25:
        return "Sariq/Olcha (Yellow/Orange)"
    return f"Rang ({rgb_to_hex(rgb)})"


def detect_design_colors(
    doc: pymupdf.Document,
    page_index: int = 0,
    cluster_tolerance: float = 0.18,
    clip_rect: Optional[pymupdf.Rect] = None,
) -> List[DetectedColor]:
    """
    Scans a vector PDF page (or a specific sticker's `clip_rect` region on a multi-sticker sheet)
    and detects all distinct non-white ink colors used in vector drawings and text spans.
    """
    page = doc[page_index]
    raw_colors: List[Tuple[float, float, float]] = []

    # 1. Check vector drawings
    for d in page.get_drawings():
        r_d = d.get("rect")
        if clip_rect is not None and r_d is not None:
            if not clip_rect.intersects(pymupdf.Rect(r_d)):
                continue
        for key in ("color", "fill"):
            rgb = normalize_color_to_rgb(d.get(key))
            if rgb is not None and not is_white_rgb(rgb):
                raw_colors.append(rgb)

    # 2. Check text spans
    text_dict = page.get_text("dict", clip=clip_rect) if clip_rect is not None else page.get_text("dict")
    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                txt = (span.get("text") or "").strip()
                if not txt:
                    continue
                rgb = normalize_color_to_rgb(span.get("color"))
                if rgb is not None and not is_white_rgb(rgb):
                    raw_colors.append(rgb)

    # 3. Also scan content stream operators in case drawings/text were inside Form XObjects
    if not raw_colors:
        stream_colors = _extract_colors_from_stream_bytes(page.read_contents())
        raw_colors.extend(stream_colors)

    # Cluster similar colors
    clusters: List[DetectedColor] = []
    for rgb in raw_colors:
        matched = False
        for cl in clusters:
            if rgb_distance(rgb, cl.rgb) <= cluster_tolerance:
                cl.object_count += 1
                matched = True
                break
        if not matched:
            cid = len(clusters) + 1
            clusters.append(
                DetectedColor(
                    color_id=cid,
                    name=classify_color_name(rgb),
                    rgb=rgb,
                    hex_code=rgb_to_hex(rgb),
                    object_count=1,
                )
            )

    # Sort so Black is first if present, then by object count descending
    clusters.sort(key=lambda c: (0 if "Qora" in c.name else 1, -c.object_count))
    for idx, cl in enumerate(clusters, start=1):
        cl.color_id = idx

    if not clusters:
        # Default fallback if page had unmarked black content
        clusters.append(
            DetectedColor(
                color_id=1,
                name="Qora (Black)",
                rgb=(0.0, 0.0, 0.0),
                hex_code="#000000",
                object_count=1,
            )
        )

    return clusters


# Regex tokenizer for PDF content stream tokens (strings, arrays, names, numbers, operators)
_TOKEN_RE = re.compile(
    r"""
    (\((?:\\.|[^\\()])*\)) |          # Literal string (...)
    (<[0-9A-Fa-f\s]*>) |              # Hex string <...>
    (\[(?:[^\[\]]|\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>)*\]) | # Array [...]
    (/[A-Za-z0-9_.\-+]+) |            # PDF Name /Name
    ([-+]?(?:\d+\.?\d*|\.\d+)) |      # Number
    ([A-Za-z*'"]+)                    # Operator
    """,
    re.VERBOSE,
)


def _is_number(tok: str) -> bool:
    try:
        float(tok)
        return True
    except ValueError:
        return False


def _extract_colors_from_stream_bytes(stream_bytes: bytes) -> List[Tuple[float, float, float]]:
    try:
        text = stream_bytes.decode("latin1")
    except Exception:
        return []
    tokens = [m.group(0) for m in _TOKEN_RE.finditer(text)]
    colors: List[Tuple[float, float, float]] = []
    operands: List[str] = []
    for tok in tokens:
        if _is_number(tok) or tok.startswith(("/", "(", "<", "[")):
            operands.append(tok)
        else:
            op = tok
            if op in ("g", "G") and len(operands) >= 1 and _is_number(operands[-1]):
                v = float(operands[-1])
                rgb = (v, v, v)
                if not is_white_rgb(rgb):
                    colors.append(rgb)
            elif op in ("rg", "RG") and len(operands) >= 3 and all(_is_number(x) for x in operands[-3:]):
                r, g, b = (float(operands[-3]), float(operands[-2]), float(operands[-1]))
                rgb = (r, g, b)
                if not is_white_rgb(rgb):
                    colors.append(rgb)
            elif op in ("k", "K") and len(operands) >= 4 and all(_is_number(x) for x in operands[-4:]):
                c, m, y, k = (float(operands[-4]), float(operands[-3]), float(operands[-2]), float(operands[-1]))
                rgb = cmyk_to_rgb(c, m, y, k)
                if not is_white_rgb(rgb):
                    colors.append(rgb)
            operands.clear()
    return colors


def _filter_and_monochromize_stream(
    stream_bytes: bytes,
    target_rgb: Optional[Tuple[float, float, float]] = None,
    tolerance: float = 0.22,
) -> bytes:
    """
    Processes a PDF content stream:
    - If `target_rgb is None`: converts all non-white colors (RGB, CMYK, Gray) to 100% Pure Grayscale Black (`0 g` / `0 G`).
    - If `target_rgb` is provided: keeps ONLY drawing and text operations whose active color matches `target_rgb`
      (within `tolerance`), converts those matching operations to 100% Pure Grayscale Black (`0 g` / `0 G`),
      and turns non-matching drawing/text painting operations into no-ops (`n` for paths, omitted for text).
    """
    try:
        text = stream_bytes.decode("latin1")
    except Exception:
        return stream_bytes

    tokens = [m.group(0) for m in _TOKEN_RE.finditer(text)]
    output_commands: List[str] = []
    operands: List[str] = []

    # Default PDF graphics state: black fill and black stroke
    default_rgb = (0.0, 0.0, 0.0)
    fill_rgb: Tuple[float, float, float] = default_rgb
    stroke_rgb: Tuple[float, float, float] = default_rgb
    state_stack: List[Tuple[Tuple[float, float, float], Tuple[float, float, float]]] = []

    def matches_target(rgb: Tuple[float, float, float]) -> bool:
        if is_white_rgb(rgb):
            return False
        if target_rgb is None:
            return True
        return rgb_distance(rgb, target_rgb) <= tolerance

    for tok in tokens:
        if _is_number(tok) or tok.startswith(("/", "(", "<", "[")):
            operands.append(tok)
            continue

        op = tok
        # Graphics state stack
        if op == "q":
            state_stack.append((fill_rgb, stroke_rgb))
            output_commands.append("q")
            operands.clear()
            continue
        if op == "Q":
            if state_stack:
                fill_rgb, stroke_rgb = state_stack.pop()
            output_commands.append("Q")
            operands.clear()
            continue

        # Color operators
        if op == "g" and len(operands) >= 1 and _is_number(operands[-1]):
            v = float(operands[-1])
            fill_rgb = (v, v, v)
            if is_white_rgb(fill_rgb):
                output_commands.append("1 g")
            else:
                output_commands.append("0 g")
            operands.clear()
            continue

        if op == "G" and len(operands) >= 1 and _is_number(operands[-1]):
            v = float(operands[-1])
            stroke_rgb = (v, v, v)
            if is_white_rgb(stroke_rgb):
                output_commands.append("1 G")
            else:
                output_commands.append("0 G")
            operands.clear()
            continue

        if op == "rg" and len(operands) >= 3 and all(_is_number(x) for x in operands[-3:]):
            fill_rgb = (float(operands[-3]), float(operands[-2]), float(operands[-1]))
            if is_white_rgb(fill_rgb):
                output_commands.append("1 g")
            else:
                output_commands.append("0 g")
            operands.clear()
            continue

        if op == "RG" and len(operands) >= 3 and all(_is_number(x) for x in operands[-3:]):
            stroke_rgb = (float(operands[-3]), float(operands[-2]), float(operands[-1]))
            if is_white_rgb(stroke_rgb):
                output_commands.append("1 G")
            else:
                output_commands.append("0 G")
            operands.clear()
            continue

        if op == "k" and len(operands) >= 4 and all(_is_number(x) for x in operands[-4:]):
            fill_rgb = cmyk_to_rgb(
                float(operands[-4]), float(operands[-3]), float(operands[-2]), float(operands[-1])
            )
            if is_white_rgb(fill_rgb):
                output_commands.append("1 g")
            else:
                output_commands.append("0 g")
            operands.clear()
            continue

        if op == "K" and len(operands) >= 4 and all(_is_number(x) for x in operands[-4:]):
            stroke_rgb = cmyk_to_rgb(
                float(operands[-4]), float(operands[-3]), float(operands[-2]), float(operands[-1])
            )
            if is_white_rgb(stroke_rgb):
                output_commands.append("1 G")
            else:
                output_commands.append("0 G")
            operands.clear()
            continue

        if op in ("cs", "CS", "sc", "SC", "scn", "SCN"):
            # If numeric operands exist, evaluate them as Gray/RGB/CMYK
            num_ops = [float(x) for x in operands if _is_number(x)]
            is_stroke = op.isupper()
            if op in ("sc", "SC", "scn", "SCN"):
                if len(num_ops) == 1:
                    c_rgb = (num_ops[0], num_ops[0], num_ops[0])
                elif len(num_ops) == 3:
                    c_rgb = (num_ops[0], num_ops[1], num_ops[2])
                elif len(num_ops) >= 4:
                    c_rgb = cmyk_to_rgb(num_ops[0], num_ops[1], num_ops[2], num_ops[3])
                else:
                    c_rgb = (0.0, 0.0, 0.0)
                if is_stroke:
                    stroke_rgb = c_rgb
                    output_commands.append("1 G" if is_white_rgb(c_rgb) else "0 G")
                else:
                    fill_rgb = c_rgb
                    output_commands.append("1 g" if is_white_rgb(c_rgb) else "0 g")
            operands.clear()
            continue

        # Path painting operators when separating by color
        if target_rgb is not None:
            if op in ("S", "s"):
                if matches_target(stroke_rgb):
                    output_commands.append(f"0 G {op}")
                else:
                    output_commands.append("n")
                operands.clear()
                continue

            if op in ("f", "F", "f*"):
                if matches_target(fill_rgb):
                    output_commands.append(f"0 g {op}")
                elif is_white_rgb(fill_rgb):
                    # Preserve white knockout fills inside paths if needed, or drop
                    output_commands.append("n")
                else:
                    output_commands.append("n")
                operands.clear()
                continue

            if op in ("B", "B*", "b", "b*"):
                f_ok = matches_target(fill_rgb)
                s_ok = matches_target(stroke_rgb)
                close_prefix = "h " if op in ("b", "b*") else ""
                fill_op = "f*" if "*" in op else "f"
                if f_ok and s_ok:
                    output_commands.append(f"0 g 0 G {op}")
                elif f_ok:
                    output_commands.append(f"{close_prefix}0 g {fill_op}")
                elif s_ok:
                    output_commands.append(f"{close_prefix}0 G S")
                else:
                    output_commands.append("n")
                operands.clear()
                continue

            if op in ("Tj", "TJ", "'", '"'):
                if matches_target(fill_rgb) or matches_target(stroke_rgb):
                    cmd_str = (" ".join(operands) + " " + op).strip()
                    output_commands.append(f"0 g 0 G {cmd_str}")
                # Otherwise omit non-matching text showing operator
                operands.clear()
                continue

        # Normal command emission
        if operands:
            output_commands.append(" ".join(operands) + " " + op)
        else:
            output_commands.append(op)
        operands.clear()

    return "\n".join(output_commands).encode("latin1")


def _process_doc_streams(
    doc: pymupdf.Document,
    target_rgb: Optional[Tuple[float, float, float]] = None,
    tolerance: float = 0.22,
) -> None:
    """Applies `_filter_and_monochromize_stream` to all pages and Form XObjects in `doc`."""
    visited_xrefs = set()

    for page in doc:
        page.clean_contents()
        for xref in page.get_contents():
            if xref not in visited_xrefs:
                visited_xrefs.add(xref)
                raw = doc.xref_stream(xref)
                if raw:
                    updated = _filter_and_monochromize_stream(raw, target_rgb=target_rgb, tolerance=tolerance)
                    doc.update_stream(xref, updated)

    # Also process any Form XObject streams across the PDF xref table
    for xref in range(1, doc.xref_length()):
        if xref in visited_xrefs:
            continue
        try:
            if not doc.xref_is_stream(xref):
                continue
            subtype = doc.xref_get_key(xref, "Subtype")
            if subtype and subtype[1] == "/Form":
                visited_xrefs.add(xref)
                raw = doc.xref_stream(xref)
                if raw:
                    updated = _filter_and_monochromize_stream(raw, target_rgb=target_rgb, tolerance=tolerance)
                    doc.update_stream(xref, updated)
        except Exception:
            continue


def create_color_separated_docs(
    source_doc: pymupdf.Document,
    detected_colors: List[DetectedColor],
    separate_colors: bool = True,
    tolerance: float = 0.22,
) -> List[Tuple[DetectedColor, pymupdf.Document]]:
    """
    Given a source PDF document and its detected colors:
    - If `separate_colors=True` and `len(detected_colors) > 1`:
      Creates one independent 100% vector PDF document per color channel,
      with all elements in that channel converted to 100% Pure Grayscale Black (`0 g / 0 G`).
    - If `separate_colors=False` or `len(detected_colors) == 1`:
      Creates a single 100% vector PDF document where all non-white colors are converted
      to 100% Pure Grayscale Black (`0 g / 0 G`).
    Caller is responsible for closing the returned documents.
    """
    pdf_bytes = source_doc.tobytes()

    if not separate_colors or len(detected_colors) <= 1:
        mono_doc = pymupdf.open("pdf", pdf_bytes)
        _process_doc_streams(mono_doc, target_rgb=None, tolerance=tolerance)
        label_color = detected_colors[0] if detected_colors else DetectedColor(
            color_id=1, name="Qora (Black)", rgb=(0.0, 0.0, 0.0), hex_code="#000000"
        )
        return [(label_color, mono_doc)]

    result: List[Tuple[DetectedColor, pymupdf.Document]] = []
    for col in detected_colors:
        chan_doc = pymupdf.open("pdf", pdf_bytes)
        _process_doc_streams(chan_doc, target_rgb=col.rgb, tolerance=tolerance)
        result.append((col, chan_doc))

    return result


def enforce_and_audit_grayscale_black(doc: pymupdf.Document) -> GrayscaleAuditReport:
    """
    Final Quality Control & Enforcement Module:
    1. Enforces 100% Pure Grayscale Black (`0 g` / `0 G` in DeviceGray) across all pages and XObjects.
    2. Audits all vector drawings, text spans, and content streams to verify that every visible
       non-white element is 100% Pure Black (0.0).
    """
    _process_doc_streams(doc, target_rgb=None)

    non_black_drawings = 0
    non_black_texts = 0
    remaining_color_ops = 0
    details: List[str] = []

    for pno, page in enumerate(doc):
        for d in page.get_drawings():
            for key in ("color", "fill"):
                rgb = normalize_color_to_rgb(d.get(key))
                if rgb is not None and not is_white_rgb(rgb) and not is_black_rgb(rgb):
                    non_black_drawings += 1
                    details.append(f"Page {pno+1}: non-black drawing {key}={rgb}")

        text_dict = page.get_text("dict")
        for b in text_dict.get("blocks", []):
            if b.get("type") != 0:
                continue
            for line in b.get("lines", []):
                for span in line.get("spans", []):
                    if not (span.get("text") or "").strip():
                        continue
                    rgb = normalize_color_to_rgb(span.get("color"))
                    if rgb is not None and not is_white_rgb(rgb) and not is_black_rgb(rgb):
                        non_black_texts += 1
                        details.append(f"Page {pno+1}: non-black text '{span.get('text')}' color={rgb}")

        # Check raw stream for any leftover rg/RG/k/K operators
        raw_stream = page.read_contents().decode("latin1", errors="ignore")
        if re.search(r"\b(rg|RG|k|K)\b", raw_stream):
            remaining_color_ops += 1

    passed = (non_black_drawings == 0) and (non_black_texts == 0) and (remaining_color_ops == 0)
    if passed:
        details.append("100% Pure Grayscale Black (DeviceGray 0.0) tasdiqlandi.")

    return GrayscaleAuditReport(
        passed=passed,
        is_pure_grayscale_black=passed,
        non_black_drawings_count=non_black_drawings,
        non_black_text_spans_count=non_black_texts,
        remaining_rgb_cmyk_ops=remaining_color_ops,
        details=details,
    )
