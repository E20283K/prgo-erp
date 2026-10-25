import io
import math
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional

import pymupdf as fitz
from fastapi.responses import StreamingResponse
from PIL import Image as PILImage
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Group
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from svglib.svglib import svg2rlg

from app.core.fonts import FONT_BOLD, FONT_REGULAR
from app.core.s3 import upload_buffer_to_s3
from app.generators.job_ticket import get_raw_artwork, probe_artwork_url
from app.schemas.documents import ImpositionCellData, ImpositionPageData, ImpositionPdfRequest

# Prepress Industrial Spot & Registration Separations
SPOT_CUT_CONTOUR = colors.CMYKColorSep(0.0, 1.0, 0.0, 0.0, spotName="CutContour", density=1.0)
SPOT_CREASE = colors.CMYKColorSep(1.0, 0.0, 1.0, 0.0, spotName="Crease", density=1.0)
COLOR_REGISTRATION = colors.CMYKColor(1.0, 1.0, 1.0, 1.0)
COLOR_BLEED_GUIDE = colors.CMYKColor(0.0, 0.45, 0.75, 0.0)


def _hex_to_rgb_floats(hex_str: str):
    clean = (hex_str or "").replace("#", "").strip()
    if len(clean) == 6:
        try:
            r = int(clean[0:2], 16) / 255.0
            g = int(clean[2:4], 16) / 255.0
            b = int(clean[4:6], 16) / 255.0
            return (r, g, b)
        except Exception:
            pass
    return (0.86, 0.92, 0.99)


def _apply_spot_to_drawing(node: Any, spot_color: Any, stroke_w: float):
    if isinstance(node, Group):
        for child in node.contents:
            _apply_spot_to_drawing(child, spot_color, stroke_w)
    else:
        if hasattr(node, "Contents") or hasattr(node, "contents"):
            for child in getattr(node, "contents", []):
                _apply_spot_to_drawing(child, spot_color, stroke_w)
        try:
            node.strokeColor = spot_color
            node.fillColor = None
            node.strokeWidth = stroke_w
        except Exception:
            pass


def _build_master_svg_dieline(req: ImpositionPdfRequest):
    """Builds a normalized ReportLab Drawing from SpecificationsTab SVG contour."""
    if req.shapeType != "custom_die" or req.customShape != "vector_svg":
        return None

    try:
        if req.parsedSvgPathD and req.parsedSvgViewBox:
            vb_x = float(req.parsedSvgViewBox.get("x", 0.0))
            vb_y = float(req.parsedSvgViewBox.get("y", 0.0))
            vb_w = max(0.1, float(req.parsedSvgViewBox.get("width", req.prodW or 50.0)))
            vb_h = max(0.1, float(req.parsedSvgViewBox.get("height", req.prodH or 90.0)))
            svg_xml = (
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb_w}pt" height="{vb_h}pt" '
                f'viewBox="0 0 {vb_w} {vb_h}">'
                f'<g transform="translate({-vb_x}, {-vb_y})">'
                f'<path d="{req.parsedSvgPathD}" fill="none" stroke="#ec008c" stroke-width="0.5"/>'
                f"</g></svg>"
            )
            return svg2rlg(io.BytesIO(svg_xml.encode("utf-8")))

        if req.customSvgPath:
            raw = req.customSvgPath.strip()
            if "<svg" in raw.lower():
                return svg2rlg(io.BytesIO(raw.encode("utf-8")))
            else:
                vb_w = max(0.1, float(req.prodW or 50.0))
                vb_h = max(0.1, float(req.prodH or 90.0))
                svg_xml = (
                    f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb_w}pt" height="{vb_h}pt" '
                    f'viewBox="0 0 {vb_w} {vb_h}">'
                    f'<path d="{raw}" fill="none" stroke="#ec008c" stroke-width="0.5"/>'
                    f"</svg>"
                )
                return svg2rlg(io.BytesIO(svg_xml.encode("utf-8")))
    except Exception as e:
        print(f"[imposition] Failed to parse customSvgPath: {e}", flush=True)
    return None


def _draw_cell_dieline_spot(
    c: canvas.Canvas,
    req: ImpositionPdfRequest,
    px_mm: float,
    py_mm: float,
    pw_mm: float,
    ph_mm: float,
    sheet_h_mm: float,
    master_svg_drawing: Any = None,
):
    """Draws the exact physical dieline knife in Spot Color 'CutContour' (100% Magenta, Overprint)."""
    def y_pt(top_mm: float) -> float:
        return (sheet_h_mm - top_mm) * mm

    c.saveState()
    c.setStrokeOverprint(True)
    c.setFillOverprint(False)
    c.setStrokeColor(SPOT_CUT_CONTOUR)
    c.setLineWidth(0.5)
    c.setDash([])

    is_rotated = (
        req.prodW > 0
        and req.prodH > 0
        and ((pw_mm > ph_mm and req.prodW < req.prodH) or (pw_mm < ph_mm and req.prodW > req.prodH))
    )

    if is_rotated:
        cx_pt = (px_mm + pw_mm / 2.0) * mm
        cy_pt = y_pt(py_mm + ph_mm / 2.0)
        c.translate(cx_pt, cy_pt)
        c.rotate(-90)
        c.translate(-cx_pt, -cy_pt)

        draw_pw_mm = ph_mm
        draw_ph_mm = pw_mm
        draw_px_mm = (px_mm + pw_mm / 2.0) - draw_pw_mm / 2.0
        draw_py_mm = (py_mm + ph_mm / 2.0) - draw_ph_mm / 2.0
    else:
        draw_px_mm = px_mm
        draw_py_mm = py_mm
        draw_pw_mm = pw_mm
        draw_ph_mm = ph_mm

    x0_pt = draw_px_mm * mm
    y0_pt = y_pt(draw_py_mm + draw_ph_mm)  # bottom-left in PDF points
    y1_pt = y_pt(draw_py_mm)               # top-left in PDF points
    w_pt = draw_pw_mm * mm
    h_pt = draw_ph_mm * mm

    shape_type = (req.shapeType or "rectangle").lower()
    custom_shape = (req.customShape or "").lower()
    corner_type = (req.cornerType or "").lower()

    # 1. Custom Vector SVG Dieline from SpecificationsTab
    if shape_type == "custom_die" and custom_shape == "vector_svg" and master_svg_drawing is not None:
        d_copy = deepcopy(master_svg_drawing)
        orig_w = max(0.1, float(d_copy.width))
        orig_h = max(0.1, float(d_copy.height))
        sx = w_pt / orig_w
        sy = h_pt / orig_h
        scale = min(sx, sy)
        avg_scale = max(0.01, scale)
        _apply_spot_to_drawing(d_copy, SPOT_CUT_CONTOUR, 0.5 / avg_scale)
        d_copy.scale(scale, scale)
        rendered_w = orig_w * scale
        rendered_h = orig_h * scale
        ox = x0_pt + (w_pt - rendered_w) / 2.0
        oy = y0_pt + (h_pt - rendered_h) / 2.0
        renderPDF.draw(d_copy, c, ox, oy)

    # 2. Arch Tag Dieline
    elif shape_type == "custom_die" and custom_shape == "arch":
        r_pt = min(w_pt / 2.0, h_pt * 0.45)
        p = c.beginPath()
        p.moveTo(x0_pt, y0_pt)
        p.lineTo(x0_pt + w_pt, y0_pt)
        p.lineTo(x0_pt + w_pt, y1_pt - r_pt)
        p.arcTo(x0_pt, y1_pt - 2 * r_pt, x0_pt + w_pt, y1_pt, startAng=0, extent=180)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

    # 3. Ticket / Pillow Notch Dieline
    elif shape_type == "custom_die" and custom_shape in ("ticket", "pillow"):
        notch_r = min(w_pt, h_pt) * 0.12
        cy_pt = y0_pt + h_pt / 2.0
        p = c.beginPath()
        p.moveTo(x0_pt, y1_pt)
        p.lineTo(x0_pt + w_pt, y1_pt)
        p.lineTo(x0_pt + w_pt, cy_pt + notch_r)
        p.arcTo(
            x0_pt + w_pt - notch_r,
            cy_pt - notch_r,
            x0_pt + w_pt + notch_r,
            cy_pt + notch_r,
            startAng=90,
            extent=180,
        )
        p.lineTo(x0_pt + w_pt, y0_pt)
        p.lineTo(x0_pt, y0_pt)
        p.lineTo(x0_pt, cy_pt - notch_r)
        p.arcTo(
            x0_pt - notch_r,
            cy_pt - notch_r,
            x0_pt + notch_r,
            cy_pt + notch_r,
            startAng=-90,
            extent=180,
        )
        p.close()
        c.drawPath(p, stroke=1, fill=0)

    # 4. Star Dieline
    elif shape_type == "custom_die" and custom_shape == "star":
        cx = x0_pt + w_pt / 2.0
        cy = y0_pt + h_pt / 2.0
        r_out = min(w_pt, h_pt) / 2.0
        r_in = r_out * 0.45
        p = c.beginPath()
        for idx in range(10):
            rad = (idx * math.pi) / 5.0 + math.pi / 2.0
            dist = r_out if idx % 2 == 0 else r_in
            vx = cx + dist * math.cos(rad)
            vy = cy + dist * math.sin(rad)
            if idx == 0:
                p.moveTo(vx, vy)
            else:
                p.lineTo(vx, vy)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

    # 5. Circle Dieline
    elif shape_type == "circle":
        c.circle(x0_pt + w_pt / 2.0, y0_pt + h_pt / 2.0, min(w_pt, h_pt) / 2.0, stroke=1, fill=0)

    # 6. Oval Dieline
    elif shape_type == "oval":
        c.ellipse(x0_pt, y0_pt, x0_pt + w_pt, y1_pt, stroke=1, fill=0)

    # 7. Folded Hangtag / Booklet (CutContour + Crease line)
    elif shape_type == "folded":
        c.rect(x0_pt, y0_pt, w_pt, h_pt, stroke=1, fill=0)
        c.setStrokeColor(SPOT_CREASE)
        c.setDash([3, 2])
        if pw_mm >= ph_mm:
            c.line(x0_pt + w_pt / 2.0, y0_pt, x0_pt + w_pt / 2.0, y1_pt)
        else:
            c.line(x0_pt, y0_pt + h_pt / 2.0, x0_pt + w_pt, y0_pt + h_pt / 2.0)
        c.setStrokeColor(SPOT_CUT_CONTOUR)
        c.setDash([])

    # 8. Chamfered Top Corners (Kesik burchakli birka)
    elif "chamfer" in corner_type:
        ch_pt = min(6.0 * mm, w_pt * 0.22, h_pt * 0.22)
        p = c.beginPath()
        p.moveTo(x0_pt, y0_pt)
        p.lineTo(x0_pt + w_pt, y0_pt)
        p.lineTo(x0_pt + w_pt, y1_pt - ch_pt)
        p.lineTo(x0_pt + w_pt - ch_pt, y1_pt)
        p.lineTo(x0_pt + ch_pt, y1_pt)
        p.lineTo(x0_pt, y1_pt - ch_pt)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

    # 9. Rounded Corners (R3 / R5)
    elif "round" in corner_type or "radius" in corner_type:
        rad_mm = 5.0 if "r5" in corner_type else 3.0
        c.roundRect(x0_pt, y0_pt, w_pt, h_pt, rad_mm * mm, stroke=1, fill=0)

    # 10. Standard Rectangle CutContour
    else:
        c.rect(x0_pt, y0_pt, w_pt, h_pt, stroke=1, fill=0)

    # 11. Hangtag Drill / Punch Hole in CutContour
    hole_d_mm = float(req.holeSize or 0.0)
    hole_pos = (req.holePosition or "none").lower()
    hole_off_mm = float(req.holeOffset if req.holeOffset is not None else 6.0)
    if hole_d_mm > 0 and hole_pos != "none" and shape_type != "carton_box":
        hr_pt = (hole_d_mm / 2.0) * mm
        off_pt = hole_off_mm * mm
        if hole_pos == "top-left":
            h_cx = x0_pt + off_pt
            h_cy = y1_pt - off_pt
        elif hole_pos == "top-right":
            h_cx = x0_pt + w_pt - off_pt
            h_cy = y1_pt - off_pt
        elif hole_pos == "left-center":
            h_cx = x0_pt + off_pt
            h_cy = y0_pt + h_pt / 2.0
        else:  # top-center default
            h_cx = x0_pt + w_pt / 2.0
            h_cy = y1_pt - off_pt
        c.circle(h_cx, h_cy, hr_pt, stroke=1, fill=0)

    c.restoreState()


def _draw_color_control_strip(
    c: canvas.Canvas,
    sheet_w_mm: float,
    sheet_h_mm: float,
    gripper_edge: str,
):
    """Draws a Prepress CMYK + CutContour densitometric calibration strip on the non-gripper edge."""
    patch_w = 5.0 * mm
    patch_h = 3.2 * mm

    # Place on opposite edge from gripper with clean clearance from the slug text line
    if gripper_edge == "Top":
        strip_y = 3.8 * mm
    else:
        strip_y = (sheet_h_mm - 7.0) * mm

    patches = [
        ("C100", colors.CMYKColor(1, 0, 0, 0)),
        ("M100", colors.CMYKColor(0, 1, 0, 0)),
        ("Y100", colors.CMYKColor(0, 0, 1, 0)),
        ("K100", colors.CMYKColor(0, 0, 0, 1)),
        ("C50", colors.CMYKColor(0.5, 0, 0, 0)),
        ("M50", colors.CMYKColor(0, 0.5, 0, 0)),
        ("Y50", colors.CMYKColor(0, 0, 0.5, 0)),
        ("K50", colors.CMYKColor(0, 0, 0, 0.5)),
        ("C+M", colors.CMYKColor(1, 1, 0, 0)),
        ("M+Y", colors.CMYKColor(0, 1, 1, 0)),
        ("C+Y", colors.CMYKColor(1, 0, 1, 0)),
        ("CMY", colors.CMYKColor(1, 1, 1, 0)),
        ("DIE", SPOT_CUT_CONTOUR),
    ]

    total_patches = max(len(patches), min(48, int((sheet_w_mm - 40.0) / 5.2)))
    total_strip_w = total_patches * (patch_w + 0.4 * mm)
    start_x = (sheet_w_mm * mm - total_strip_w) / 2.0

    c.saveState()
    for i in range(total_patches):
        label, col = patches[i % len(patches)]
        px = start_x + i * (patch_w + 0.4 * mm)
        c.setFillColor(col)
        c.setStrokeColor(colors.CMYKColor(0, 0, 0, 0.35))
        c.setLineWidth(0.2)
        c.rect(px, strip_y, patch_w, patch_h, stroke=1, fill=1)
    c.restoreState()


def _draw_registration_target(c: canvas.Canvas, cx_pt: float, cy_pt: float):
    """Draws a standard 4-color Registration Crosshair target."""
    c.saveState()
    c.setStrokeColor(COLOR_REGISTRATION)
    c.setLineWidth(0.25)
    c.circle(cx_pt, cy_pt, 1.8 * mm, stroke=1, fill=0)
    c.circle(cx_pt, cy_pt, 0.7 * mm, stroke=1, fill=0)
    c.line(cx_pt - 3.0 * mm, cy_pt, cx_pt + 3.0 * mm, cy_pt)
    c.line(cx_pt, cy_pt - 3.0 * mm, cx_pt, cy_pt + 3.0 * mm)
    c.restoreState()


def generate_imposition_pdf(req: ImpositionPdfRequest):
    sheet_w_mm = max(50.0, float(req.sheetW))
    sheet_h_mm = max(50.0, float(req.sheetH))
    page_size_pt = (sheet_w_mm * mm, sheet_h_mm * mm)
    pt_per_mm = 72.0 / 25.4

    def y_pt(top_mm: float) -> float:
        return (sheet_h_mm - top_mm) * mm

    master_svg_dieline = _build_master_svg_dieline(req)
    artwork_cache: Dict[str, Optional[Dict[str, Any]]] = {}

    def resolve_cell_artwork(cell: ImpositionCellData) -> Optional[Dict[str, Any]]:
        candidates = [c for c in [cell.rawArtworkUrl, cell.artworkUrl] if c]
        for src in candidates:
            if src not in artwork_cache:
                artwork_cache[src] = get_raw_artwork(src)
            if artwork_cache[src] is not None:
                return artwork_cache[src]

        # Probe by docNo + sizeCode + side if explicit URL was not populated
        s_code = cell.sizeCode or cell.label
        side_key = "back" if (cell.sideBadge or "").upper() == "BACK" else "front"
        probed = probe_artwork_url(req.docNo, s_code, side=side_key, sku_id=cell.sizeId)
        if probed:
            if probed not in artwork_cache:
                artwork_cache[probed] = get_raw_artwork(probed)
            return artwork_cache[probed]
        return None

    base_buf = io.BytesIO()
    overlay_buf = io.BytesIO()

    base_c = canvas.Canvas(base_buf, pagesize=page_size_pt)
    overlay_c = canvas.Canvas(overlay_buf, pagesize=page_size_pt)

    # Track vector PDF overlays per page index
    pdf_vector_placements: List[Dict[str, Any]] = []

    pages_to_render: List[ImpositionPageData] = req.pages or [
        ImpositionPageData(plateName="Forma 1", plateIndex=0, totalPlates=1, sideLabel="OLDI", requiredSheets=100, cells=[])
    ]

    for page_idx, page_data in enumerate(pages_to_render):
        # ── 1. BASE LAYER: Sheet Background & Gripper Zone ──
        base_c.setFillColor(colors.white)
        base_c.rect(0, 0, sheet_w_mm * mm, sheet_h_mm * mm, stroke=0, fill=1)

        gripper_mm = max(0.0, float(req.gripper or 0.0))
        g_edge = req.activeGripperEdge or "Bottom"
        if gripper_mm > 0:
            if g_edge == "Top":
                gx, gy, gw, gh = 0.0, 0.0, sheet_w_mm, gripper_mm
            elif g_edge == "Left":
                gx, gy, gw, gh = 0.0, 0.0, gripper_mm, sheet_h_mm
            elif g_edge == "Right":
                gx, gy, gw, gh = sheet_w_mm - gripper_mm, 0.0, gripper_mm, sheet_h_mm
            else:  # Bottom
                gx, gy, gw, gh = 0.0, sheet_h_mm - gripper_mm, sheet_w_mm, gripper_mm

            base_c.saveState()
            base_c.setFillColor(colors.HexColor("#f8fafc"))
            base_c.setStrokeColor(colors.HexColor("#cbd5e1"))
            base_c.setLineWidth(0.35)
            base_c.setDash([3, 2])
            base_c.rect(gx * mm, y_pt(gy + gh), gw * mm, gh * mm, stroke=1, fill=1)
            base_c.setDash([])
            base_c.setFillColor(colors.HexColor("#475569"))
            base_c.setFont(FONT_BOLD, 5.5)
            gripper_title = (
                f"KLAPAN / GRIPPER ({gripper_mm:g} mm)  •  {req.docNo}  •  "
                f"{page_data.plateName} [{page_data.sideLabel}]  •  "
                f"List: {sheet_w_mm:g}×{sheet_h_mm:g} mm  •  Tiraj: {page_data.requiredSheets} list"
            )
            if g_edge in ("Bottom", "Top"):
                base_c.drawCentredString((sheet_w_mm / 2.0) * mm, y_pt(gy + gh / 2.0 + 0.8), gripper_title)
            base_c.restoreState()

        # ── 2. CELLS: Base Artwork / Schematic + Overlay Dielines ──
        bleed_mm = max(0.0, float(req.bleed or 0.0))

        for cell in page_data.cells:
            cx_mm = float(cell.x)
            cy_mm = float(cell.y)
            cw_mm = float(cell.itemW)
            ch_mm = float(cell.itemH)

            px_mm = cx_mm + bleed_mm
            py_mm = cy_mm + bleed_mm
            pw_mm = max(1.0, cw_mm - 2.0 * bleed_mm)
            ph_mm = max(1.0, ch_mm - 2.0 * bleed_mm)

            is_empty = cell.sizeId == "empty"
            if is_empty:
                base_c.saveState()
                base_c.setStrokeColor(colors.HexColor("#d4d4d8"))
                base_c.setLineWidth(0.3)
                base_c.setDash([2, 2])
                base_c.rect(px_mm * mm, y_pt(py_mm + ph_mm), pw_mm * mm, ph_mm * mm, stroke=1, fill=0)
                base_c.restoreState()
                continue

            raw_art = resolve_cell_artwork(cell)
            is_cell_rotated = (
                req.prodW > 0
                and req.prodH > 0
                and ((pw_mm > ph_mm and req.prodW < req.prodH) or (pw_mm < ph_mm and req.prodW > req.prodH))
            )

            if raw_art is not None:
                if raw_art["kind"] == "pdf":
                    pdf_vector_placements.append(
                        {
                            "page_idx": page_idx,
                            "pdf_bytes": raw_art["bytes"],
                            "bleed_box_mm": (cx_mm, cy_mm, cw_mm, ch_mm),
                            "trim_box_mm": (px_mm, py_mm, pw_mm, ph_mm),
                            "bleed_mm": bleed_mm,
                        }
                    )
                elif raw_art["kind"] == "svg":
                    try:
                        svg_d = svg2rlg(io.BytesIO(raw_art["bytes"]))
                        if svg_d:
                            base_c.saveState()
                            if is_cell_rotated:
                                cx_pt = (px_mm + pw_mm / 2.0) * mm
                                cy_pt = y_pt(py_mm + ph_mm / 2.0)
                                base_c.translate(cx_pt, cy_pt)
                                base_c.rotate(-90)
                                base_c.translate(-cx_pt, -cy_pt)
                                draw_pw = ph_mm
                                draw_ph = pw_mm
                                draw_px = (px_mm + pw_mm / 2.0) - draw_pw / 2.0
                                draw_py = (py_mm + ph_mm / 2.0) - draw_ph / 2.0
                            else:
                                draw_px = px_mm
                                draw_py = py_mm
                                draw_pw = pw_mm
                                draw_ph = ph_mm

                            sx = (draw_pw * mm) / max(1.0, float(svg_d.width))
                            sy = (draw_ph * mm) / max(1.0, float(svg_d.height))
                            sc = min(sx, sy)
                            svg_d.scale(sc, sc)
                            rw = float(svg_d.width) * sc
                            rh = float(svg_d.height) * sc
                            ox = draw_px * mm + (draw_pw * mm - rw) / 2.0
                            oy = y_pt(draw_py + draw_ph) + (draw_ph * mm - rh) / 2.0
                            renderPDF.draw(svg_d, base_c, ox, oy)
                            base_c.restoreState()
                    except Exception as e:
                        print(f"[imposition] SVG cell render error: {e}", flush=True)
                elif raw_art["kind"] == "image":
                    try:
                        pil_img = PILImage.open(io.BytesIO(raw_art["bytes"]))
                        img_buf = io.BytesIO()
                        pil_img.convert("RGB").save(img_buf, format="JPEG", quality=95)
                        img_buf.seek(0)
                        base_c.saveState()
                        if is_cell_rotated:
                            cx_pt = (px_mm + pw_mm / 2.0) * mm
                            cy_pt = y_pt(py_mm + ph_mm / 2.0)
                            base_c.translate(cx_pt, cy_pt)
                            base_c.rotate(-90)
                            base_c.translate(-cx_pt, -cy_pt)
                            draw_pw = ph_mm
                            draw_ph = pw_mm
                            draw_px = (px_mm + pw_mm / 2.0) - draw_pw / 2.0
                            draw_py = (py_mm + ph_mm / 2.0) - draw_ph / 2.0
                        else:
                            draw_px = px_mm
                            draw_py = py_mm
                            draw_pw = pw_mm
                            draw_ph = ph_mm

                        base_c.drawImage(
                            ImageReader(img_buf),
                            draw_px * mm,
                            y_pt(draw_py + draw_ph),
                            draw_pw * mm,
                            draw_ph * mm,
                            preserveAspectRatio=True,
                        )
                        base_c.restoreState()
                    except Exception as e:
                        print(f"[imposition] Raster cell render error: {e}", flush=True)
            else:
                # No artwork uploaded for this SKU -> Draw clean schematic block & centered SKU code
                r, g, b = _hex_to_rgb_floats(cell.color)
                base_c.saveState()
                base_c.setFillColorRGB(r, g, b)
                base_c.setStrokeColor(colors.HexColor("#93c5fd"))
                base_c.setLineWidth(0.25)
                base_c.rect(cx_mm * mm, y_pt(cy_mm + ch_mm), cw_mm * mm, ch_mm * mm, stroke=1, fill=1)

                display_label = cell.sizeCode or cell.label
                if display_label:
                    font_pt = max(6.0, min(pw_mm * 0.45, ph_mm * 0.35, 16.0))
                    base_c.setFillColor(colors.HexColor("#0f172a"))
                    base_c.setFont(FONT_BOLD, font_pt)
                    base_c.drawCentredString(
                        (cx_mm + cw_mm / 2.0) * mm,
                        y_pt(cy_mm + ch_mm / 2.0) - font_pt * 0.32,
                        str(display_label),
                    )
                base_c.restoreState()

            # ── OVERLAY LAYER: Bleed Box + Spot CutContour Dieline + Micro Trim Tag ──
            if bleed_mm > 0:
                overlay_c.saveState()
                overlay_c.setStrokeOverprint(True)
                overlay_c.setStrokeColor(COLOR_BLEED_GUIDE)
                overlay_c.setLineWidth(0.2)
                overlay_c.setDash([1.5, 1.5])
                overlay_c.rect(cx_mm * mm, y_pt(cy_mm + ch_mm), cw_mm * mm, ch_mm * mm, stroke=1, fill=0)
                overlay_c.restoreState()

            # Draw Real Dieline Knife in CutContour Spot Color
            _draw_cell_dieline_spot(
                overlay_c,
                req,
                px_mm,
                py_mm,
                pw_mm,
                ph_mm,
                sheet_h_mm,
                master_svg_drawing=master_svg_dieline,
            )

            # Micro Slot/SKU Tag in the outer waste/bleed zone (never touches product area)
            sku_tag = f"#{cell.index + 1} {cell.sizeCode or cell.label}".strip()
            overlay_c.saveState()
            overlay_c.setFillColor(colors.CMYKColor(0, 0, 0, 0.65))
            overlay_c.setFont(FONT_REGULAR, 3.2)
            tag_y_mm = cy_mm + 1.1 if bleed_mm >= 1.2 else max(0.8, py_mm - 0.4)
            overlay_c.drawString((cx_mm + 0.6) * mm, y_pt(tag_y_mm), sku_tag)
            overlay_c.restoreState()

        # ── 3. OVERLAY LAYER: Outer Trim Marks, Registration Targets, Color Strip & Slug ──
        overlay_c.saveState()
        overlay_c.setStrokeColor(COLOR_REGISTRATION)
        overlay_c.setLineWidth(0.25)
        for seg in req.outerTrimMarks:
            x1 = float(seg.get("x1", 0.0)) * mm
            y1 = y_pt(float(seg.get("y1", 0.0)))
            x2 = float(seg.get("x2", 0.0)) * mm
            y2 = y_pt(float(seg.get("y2", 0.0)))
            overlay_c.line(x1, y1, x2, y2)
        overlay_c.restoreState()

        # Split Cut Axis (Work-and-Turn / Kashirovka)
        if req.splitCutAxisX is not None:
            sx_mm = float(req.splitCutAxisX)
            overlay_c.saveState()
            overlay_c.setStrokeOverprint(True)
            overlay_c.setStrokeColor(SPOT_CREASE)
            overlay_c.setLineWidth(0.4)
            overlay_c.setDash([4, 2])
            overlay_c.line(sx_mm * mm, 4.0 * mm, sx_mm * mm, (sheet_h_mm - 4.0) * mm)
            overlay_c.setDash([])
            if req.splitAxisLabel:
                overlay_c.setFillColor(SPOT_CREASE)
                overlay_c.setFont(FONT_BOLD, 5.0)
                overlay_c.saveState()
                overlay_c.translate((sx_mm - 1.2) * mm, (sheet_h_mm / 2.0) * mm)
                overlay_c.rotate(90)
                overlay_c.drawCentredString(0, 0, str(req.splitAxisLabel))
                overlay_c.restoreState()
            overlay_c.restoreState()

        # 4 Corner Registration Crosshairs
        grid_l = float(req.gridLeft)
        grid_t = float(req.gridTop)
        grid_r = grid_l + req.cols * float(req.itemW) + max(0, req.cols - 1) * float(req.gap)
        grid_b = grid_t + req.rows * float(req.itemH) + max(0, req.rows - 1) * float(req.gap)

        reg_coords = [
            (max(4.5, grid_l - 4.0), max(4.5, grid_t - 4.0)),
            (min(sheet_w_mm - 4.5, grid_r + 4.0), max(4.5, grid_t - 4.0)),
            (max(4.5, grid_l - 4.0), min(sheet_h_mm - 4.5, grid_b + 4.0)),
            (min(sheet_w_mm - 4.5, grid_r + 4.0), min(sheet_h_mm - 4.5, grid_b + 4.0)),
        ]
        for r_x, r_y in reg_coords:
            _draw_registration_target(overlay_c, r_x * mm, y_pt(r_y))

        # CMYK + CutContour Densitometric Color Control Strip
        _draw_color_control_strip(overlay_c, sheet_w_mm, sheet_h_mm, g_edge)

        # Prepress Technical Slug Info Line
        overlay_c.saveState()
        overlay_c.setFillColor(colors.CMYKColor(0, 0, 0, 0.85))
        overlay_c.setFont(FONT_REGULAR, 4.5)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        slug_left = (
            f"PRINTGOO PREPRESS MASTER  |  {req.docNo} — {req.orderName}  |  "
            f"{page_data.plateName} ({page_data.sideLabel})  |  "
            f"Mahsulot: {req.prodW:g}×{req.prodH:g} mm (Bleed {req.bleed:g} mm, Gap {req.gap:g} mm)"
        )
        slug_right = (
            f"Stanok: {req.pressMachine}  |  Qog'oz: {req.paperStock}  |  "
            f"SEP: CMYK + Spot [CutContour 100%M Overprint]  |  {now_str}"
        )
        slug_y_mm = 2.3 if g_edge != "Top" else sheet_h_mm - 1.5
        overlay_c.drawString(6.0 * mm, y_pt(slug_y_mm), slug_left)
        overlay_c.drawRightString((sheet_w_mm - 6.0) * mm, y_pt(slug_y_mm), slug_right)
        overlay_c.restoreState()

        base_c.showPage()
        overlay_c.showPage()

    base_c.save()
    overlay_c.save()

    # ── 4. PYMUPDF VECTOR ASSEMBLY: Embed Raw Artwork PDFs + Top Dieline Overlay ──
    base_doc = fitz.open(stream=base_buf.getvalue(), filetype="pdf")
    overlay_doc = fitz.open(stream=overlay_buf.getvalue(), filetype="pdf")
    src_pdf_cache: Dict[int, fitz.Document] = {}

    try:
        for placement in pdf_vector_placements:
            p_idx = placement["page_idx"]
            if p_idx >= len(base_doc):
                continue
            target_page = base_doc[p_idx]
            pdf_bytes = placement["pdf_bytes"]
            cache_key = id(pdf_bytes)
            if cache_key not in src_pdf_cache:
                src_pdf_cache[cache_key] = fitz.open(stream=pdf_bytes, filetype="pdf")
            src_doc = src_pdf_cache[cache_key]
            if len(src_doc) == 0:
                continue

            src_page = src_doc[0]
            src_w_mm = src_page.rect.width / pt_per_mm
            src_h_mm = src_page.rect.height / pt_per_mm

            bx, by, bw, bh = placement["bleed_box_mm"]
            tx, ty, tw, th = placement["trim_box_mm"]
            bleed_val = placement["bleed_mm"]

            # Check if cell slot is landscape vs portrait and detect rotation
            is_slot_landscape = tw > th
            is_src_landscape = src_w_mm > src_h_mm
            is_rotated = is_slot_landscape != is_src_landscape

            effective_src_w = src_h_mm if is_rotated else src_w_mm
            effective_src_h = src_w_mm if is_rotated else src_h_mm

            # Auto-detect whether uploaded PDF already includes bleed or matches net trim size
            if bleed_val > 0 and abs(effective_src_w - bw) < abs(effective_src_w - tw):
                rx, ry, rw, rh = bx, by, bw, bh
            else:
                rx, ry, rw, rh = tx, ty, tw, th

            target_rect = fitz.Rect(
                rx * pt_per_mm,
                ry * pt_per_mm,
                (rx + rw) * pt_per_mm,
                (ry + rh) * pt_per_mm,
            )

            # Prepress standard rotation:
            # Slot is landscape & src is portrait -> rotate=270 (clockwise in PDF coordinates, moves top to right)
            # Slot is portrait & src is landscape -> rotate=90
            rot_angle = 270 if (is_slot_landscape and not is_src_landscape) else (90 if (not is_slot_landscape and is_src_landscape) else 0)

            target_page.show_pdf_page(target_rect, src_doc, pno=0, rotate=rot_angle, keep_proportion=True)

        # Place the ReportLab Spot Color Dieline & Registration Overlay on the TOP layer
        full_rect = fitz.Rect(0, 0, sheet_w_mm * pt_per_mm, sheet_h_mm * pt_per_mm)
        for p_idx in range(len(base_doc)):
            if p_idx < len(overlay_doc):
                base_doc[p_idx].show_pdf_page(full_rect, overlay_doc, pno=p_idx)

        meta = base_doc.metadata or {}
        meta["title"] = f"{req.docNo}_Production_Imposition.pdf"
        meta["creator"] = "PrintGoo ERP Prepress Engine (ReportLab + PyMuPDF)"
        meta["producer"] = "PrintGoo CTP & DieCut Master Generator"
        base_doc.set_metadata(meta)

        final_pdf_bytes = base_doc.tobytes(garbage=3, deflate=True)
    finally:
        for d in src_pdf_cache.values():
            d.close()
        overlay_doc.close()
        base_doc.close()

    filename = f"{req.docNo}_Montaj_CTP.pdf"
    if req.saveToS3:
        key = req.s3Key or f"imposition/{datetime.now().strftime('%Y/%m')}/{filename}"
        url = upload_buffer_to_s3(final_pdf_bytes, key, "application/pdf")
        return {"status": "saved", "s3Key": key, "url": url}

    return StreamingResponse(
        io.BytesIO(final_pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
