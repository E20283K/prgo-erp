import io
import os
import base64
import requests
from typing import Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
from app.schemas.documents import TechCardRequest

def _get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    font_paths = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    try:
        return ImageFont.load_default()
    except Exception:
        return None

def _load_image(url_or_b64: Optional[str]) -> Optional[Image.Image]:
    if not url_or_b64 or not url_or_b64.strip():
        return None
    val = url_or_b64.strip()
    try:
        if val.startswith("data:image"):
            b64_data = val.split(",", 1)[1]
            raw_bytes = base64.b64decode(b64_data)
            return Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
        elif val.startswith("http://") or val.startswith("https://"):
            res = requests.get(val, timeout=5)
            if res.ok:
                return Image.open(io.BytesIO(res.content)).convert("RGBA")
        elif os.path.exists(val):
            return Image.open(val).convert("RGBA")
    except Exception as e:
        print(f"[_load_image] Warning: could not load image: {e}")
    return None

def _create_hangtag_mask(
    w: int,
    h: int,
    shape_type: str = "chamfer",
    corner_cut: int = 35,
    hole_radius: int = 14,
    has_hole: bool = True
) -> Image.Image:
    """Creates an alpha mask for a hangtag / label with chamfered top corners and optional top punch hole."""
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    if shape_type == "chamfer":
        # Chamfered cut corners at top-left and top-right
        c = min(corner_cut, w // 3, h // 4)
        polygon = [
            (c, 0),
            (w - c, 0),
            (w, c),
            (w, h),
            (0, h),
            (0, c),
        ]
        draw.polygon(polygon, fill=255)
    elif shape_type == "rounded":
        r = min(corner_cut, w // 4, h // 4)
        draw.rounded_rectangle([0, 0, w, h], radius=r, fill=255)
    else:
        # Standard rectangle
        draw.rectangle([0, 0, w, h], fill=255)

    if has_hole and hole_radius > 0:
        # Punch hole at top center
        hole_x = w // 2
        hole_y = min(c + hole_radius + 5 if shape_type == "chamfer" else 40, h // 6)
        draw.ellipse(
            [hole_x - hole_radius, hole_y - hole_radius, hole_x + hole_radius, hole_y + hole_radius],
            fill=0
        )

    return mask

def generate_tech_card_png(req: TechCardRequest) -> bytes:
    """Generates an industrial, high-resolution specification tech-card PNG image."""
    canvas_w = 1100
    canvas_h = 1450
    bg_color = (255, 255, 255)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), bg_color)
    draw = ImageDraw.Draw(canvas)

    # Fonts
    font_client = _get_font(34, bold=True)
    font_order = _get_font(32, bold=True)
    font_side_tag = _get_font(26, bold=True)
    font_uv = _get_font(24, bold=True)
    font_spec_title = _get_font(30, bold=True)
    font_spec_body = _get_font(26, bold=True)
    font_spec_highlight = _get_font(30, bold=True)

    # 1. Header
    client_text = f"* {req.clientName.strip().upper()} *"
    order_text = f"{req.orderNo.strip().upper()}"
    if "ZAKAZ" not in order_text and "WO-" not in order_text:
        order_text += " ZAKAZ"

    draw.text((canvas_w // 2, 50), client_text, fill=(30, 58, 138), font=font_client, anchor="mt")
    draw.text((canvas_w // 2, 105), order_text, fill=(17, 24, 39), font=font_order, anchor="mt")

    # 2. Hangtags Geometry
    tag_w = 260
    tag_h = 580
    tag_spacing = 80
    total_tags_w = (tag_w * 2) + tag_spacing
    start_x = (canvas_w - total_tags_w) // 2
    top_y = 180

    left_x = start_x
    right_x = start_x + tag_w + tag_spacing

    corner_cut_px = int(max(15, min(tag_w * 0.16, (req.cornerCutMm / 50.0) * tag_w if req.cornerCutMm else 40)))
    hole_radius_px = int(max(8, min(18, (req.holeDiameterMm / 2.0) * 4.0 if req.holeDiameterMm else 12)))

    mask = _create_hangtag_mask(
        tag_w, tag_h,
        shape_type=req.shapeType or "chamfer",
        corner_cut=corner_cut_px,
        hole_radius=hole_radius_px,
        has_hole=req.hasHole
    )

    # Load front and back artwork images
    front_img = _load_image(req.frontImageBase64 or req.frontImageUrl)
    back_img = _load_image(req.backImageBase64 or req.backImageUrl)

    def render_tag_item(x: int, y: int, art: Optional[Image.Image], side_label: str):
        # Create tag surface
        tag_surf = Image.new("RGBA", (tag_w, tag_h), (255, 255, 255, 0))
        
        if art:
            # Scale artwork to cover or fit
            art_fitted = art.resize((tag_w, tag_h), Image.Resampling.LANCZOS)
            tag_surf.paste(art_fitted, (0, 0))
        else:
            # Elegant default dark mockup substrate (#212529)
            dark_sub = Image.new("RGBA", (tag_w, tag_h), (33, 37, 41, 255))
            sub_draw = ImageDraw.Draw(dark_sub)
            
            # Subtle vertical typography or mock design
            f_mock = _get_font(32, bold=True)
            if side_label == "OLDI":
                sub_draw.text((tag_w // 2, tag_h // 2), "SQUAD\nBLACK", fill=(55, 65, 81), font=f_mock, anchor="mm", align="center")
            tag_surf.paste(dark_sub, (0, 0))

        # Apply mask
        tag_surf.putalpha(mask)

        # Composite onto canvas
        canvas.paste(tag_surf, (x, y), tag_surf)

        # Draw outer contour stroke
        stroke_color = (24, 24, 27)
        c = corner_cut_px
        if req.shapeType == "chamfer":
            pts = [
                (x + c, y),
                (x + tag_w - c, y),
                (x + tag_w, y + c),
                (x + tag_w, y + tag_h),
                (x, y + tag_h),
                (x, y + c),
                (x + c, y),
            ]
            draw.line(pts, fill=stroke_color, width=2)
        else:
            draw.rectangle([x, y, x + tag_w, y + tag_h], outline=stroke_color, width=2)

        # Punch hole outline
        if req.hasHole:
            hole_x = x + tag_w // 2
            hole_y = y + min(c + hole_radius_px + 5 if req.shapeType == "chamfer" else 40, tag_h // 6)
            draw.ellipse(
                [hole_x - hole_radius_px, hole_y - hole_radius_px, hole_x + hole_radius_px, hole_y + hole_radius_px],
                fill=(255, 255, 255),
                outline=stroke_color,
                width=2
            )

    # Render Oldi and Orqa tags
    render_tag_item(left_x, top_y, front_img, "OLDI")
    render_tag_item(right_x, top_y, back_img, "ORQA")

    # Labels below tags
    draw.text((left_x + tag_w // 2, top_y + tag_h + 30), "OLDI", fill=(220, 38, 38), font=font_side_tag, anchor="mt")
    draw.text((right_x + tag_w // 2, top_y + tag_h + 30), "ORQA", fill=(220, 38, 38), font=font_side_tag, anchor="mt")

    # UV callout line on the left
    uv_y = top_y + int(tag_h * 0.58)
    draw.line([(left_x - 70, uv_y), (left_x + 10, uv_y)], fill=(220, 38, 38), width=2)
    draw.line([(left_x - 70, uv_y), (left_x - 70, uv_y - 25)], fill=(220, 38, 38), width=2)
    draw.text((left_x - 70, uv_y - 32), "UV", fill=(220, 38, 38), font=font_uv, anchor="mb")

    # 3. Bottom Specification Details
    specs_y = top_y + tag_h + 100

    product_name = (req.productName or "KARTON ETIKETKA").strip().upper()
    paper_stock = (req.paperStock or "400 GRAM FANTAZI").strip().upper()
    finishing = (req.finishing or "OLDI EMBOSS LAK").strip().upper()

    w_val = req.widthMm
    h_val = req.heightMm
    # If dimensions given in mm, e.g. 50x125mm -> 12.5 X 5 CM or mm
    if w_val and h_val:
        w_cm = f"{w_val / 10.0:g}" if w_val > 10 else f"{w_val:g}"
        h_cm = f"{h_val / 10.0:g}" if h_val > 10 else f"{h_val:g}"
        dim_str = f"RAZMERI : {h_cm} X {w_cm} CM"
    else:
        dim_str = "RAZMERI : 12.5 X 5 CM"

    qty_str = f"SONI : {req.quantity or '39.553'}"

    draw.text((canvas_w // 2, specs_y), product_name, fill=(24, 24, 27), font=font_spec_title, anchor="mt")
    draw.text((canvas_w // 2, specs_y + 48), paper_stock, fill=(24, 24, 27), font=font_spec_body, anchor="mt")
    draw.text((canvas_w // 2, specs_y + 96), finishing, fill=(24, 24, 27), font=font_spec_body, anchor="mt")

    draw.text((canvas_w // 2, specs_y + 175), dim_str, fill=(220, 38, 38), font=font_spec_highlight, anchor="mt")
    draw.text((canvas_w // 2, specs_y + 245), qty_str, fill=(220, 38, 38), font=font_spec_highlight, anchor="mt")

    # Output buffer
    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()
