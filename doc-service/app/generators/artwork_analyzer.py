import io
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import pymupdf as fitz
from PIL import Image as PILImage

from app.generators.job_ticket import get_raw_artwork
from app.schemas.documents import ArtworkAnalysisRequest, ArtworkAnalysisResponse, SideColorAnalysis

# Non-printing technical dieline / finishing spot color names
TECHNICAL_SPOT_KEYWORDS: Set[str] = {
    "cutcontour",
    "cut_contour",
    "cut-contour",
    "dieline",
    "die_line",
    "die-line",
    "crease",
    "creasing",
    "knife",
    "pichoq",
    "through-cut",
    "through_cut",
    "kiss-cut",
    "kiss_cut",
    "perforate",
    "perforation",
    "score",
    "fold",
    "varnish",
    "lak",
    "foil",
    "folga",
    "emboss",
    "braille",
    "bleed",
    "slug",
    "registration",
}


def _is_technical_spot_color(name: str) -> bool:
    clean = re.sub(r"[^a-z0-9]", "", name.lower())
    for kw in TECHNICAL_SPOT_KEYWORDS:
        if kw in clean:
            return True
    return False


def _extract_pdf_spot_colors(doc: fitz.Document) -> Tuple[List[str], List[str]]:
    """Scans PDF xref dictionaries to extract Spot (Separation) and DeviceN color names."""
    commercial_spots: Set[str] = set()
    technical_dielines: Set[str] = set()

    for x in range(1, doc.xref_length()):
        try:
            txt = doc.xref_object(x)
            if not txt:
                continue

            # 1. [/Separation /SpotName ...]
            for m in re.finditer(r"/Separation\s*/([^\s/\[\]<>]+)", txt):
                raw_name = m.group(1)
                name = re.sub(r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), raw_name).strip()
                if name and name not in ("All", "None", "Cyan", "Magenta", "Yellow", "Black"):
                    if _is_technical_spot_color(name):
                        technical_dielines.add(name)
                    else:
                        commercial_spots.add(name)

            # 2. [/DeviceN [/Name1 /Name2 ...] ...]
            for m in re.finditer(r"/DeviceN\s*\[\s*([^\s\]]+(?:\s+[^\s\]]+)*)\s*\]", txt):
                names_str = m.group(1)
                for n in re.findall(r"/([^\s/\[\]<>]+)", names_str):
                    name = re.sub(r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), n).strip()
                    if name and name not in ("All", "None", "Cyan", "Magenta", "Yellow", "Black"):
                        if _is_technical_spot_color(name):
                            technical_dielines.add(name)
                        else:
                            commercial_spots.add(name)
        except Exception:
            continue

    return sorted(commercial_spots), sorted(technical_dielines)


def _analyze_pdf_page_colors(
    page: fitz.Page,
    spot_colors: List[str],
) -> SideColorAnalysis:
    """Renders page in DeviceCMYK colorspace to detect exact physical ink channel occupancy."""
    # Render at 72 DPI for rapid and accurate color density scanning
    pix = page.get_pixmap(colorspace=fitz.csCMYK, dpi=72)
    samples = pix.samples
    stride = 4  # C, M, Y, K

    max_c, max_m, max_y, max_k = 0, 0, 0, 0
    # Step by 8 bytes (every 2nd pixel) for lightning fast raster scanning
    for i in range(0, len(samples), 8):
        c, m, y, k = samples[i], samples[i + 1], samples[i + 2], samples[i + 3]
        if c > max_c:
            max_c = c
        if m > max_m:
            max_m = m
        if y > max_y:
            max_y = y
        if k > max_k:
            max_k = k

    # Noise threshold: ignore values <= 10 (anti-aliasing and JPEG compression artifacts)
    INK_THRESHOLD = 10
    has_content = max(max_c, max_m, max_y, max_k) > INK_THRESHOLD

    if not has_content:
        return SideColorAnalysis(
            hasContent=False,
            c=False,
            m=False,
            y=False,
            k=False,
            spotColors=[],
            colorCount=0,
            formula="0",
        )

    # Grayscale / 1-color K check: No C, M, Y chromatic inks present
    is_k_only = max_c <= INK_THRESHOLD and max_m <= INK_THRESHOLD and max_y <= INK_THRESHOLD and max_k > INK_THRESHOLD

    if is_k_only:
        c_active, m_active, y_active, k_active = False, False, False, True
    else:
        c_active = max_c > INK_THRESHOLD
        m_active = max_m > INK_THRESHOLD
        y_active = max_y > INK_THRESHOLD
        k_active = max_k > INK_THRESHOLD

    proc_count = (1 if c_active else 0) + (1 if m_active else 0) + (1 if y_active else 0) + (1 if k_active else 0)
    total_count = proc_count + len(spot_colors)

    return SideColorAnalysis(
        hasContent=True,
        c=c_active,
        m=m_active,
        y=y_active,
        k=k_active,
        spotColors=spot_colors,
        colorCount=total_count,
        formula=f"{total_count}",
    )


def _analyze_raster_image_colors(raw_bytes: bytes) -> SideColorAnalysis:
    """Analyzes a standard raster image (PNG, JPEG, TIFF) for monochrome vs CMYK saturation."""
    try:
        pil_img = PILImage.open(io.BytesIO(raw_bytes))
        pil_img.thumbnail((300, 300))  # downsample for fast histogram inspection

        if pil_img.mode in ("1", "L"):
            return SideColorAnalysis(
                hasContent=True,
                c=False,
                m=False,
                y=False,
                k=True,
                spotColors=[],
                colorCount=1,
                formula="1",
            )

        rgb = pil_img.convert("RGB")
        data = rgb.getdata()

        max_saturation = 0
        has_content = False
        for r, g, b in data:
            if r < 250 or g < 250 or b < 250:
                has_content = True
            diff = max(abs(r - g), abs(r - b), abs(g - b))
            if diff > max_saturation:
                max_saturation = diff
                if max_saturation > 18:
                    break

        if not has_content:
            return SideColorAnalysis(hasContent=False, colorCount=0, formula="0")

        # If max color diff across all pixels is <= 10, it is pure black/grayscale
        if max_saturation <= 10:
            return SideColorAnalysis(
                hasContent=True,
                c=False,
                m=False,
                y=False,
                k=True,
                spotColors=[],
                colorCount=1,
                formula="1",
            )

        # Chromatic full color -> 4 colors (CMYK)
        return SideColorAnalysis(
            hasContent=True,
            c=True,
            m=True,
            y=True,
            k=True,
            spotColors=[],
            colorCount=4,
            formula="4",
        )
    except Exception as e:
        print(f"[artwork_analyzer] Error analyzing raster image: {e}", flush=True)
        return SideColorAnalysis(hasContent=True, c=False, m=False, y=False, k=True, colorCount=1, formula="1")


def analyze_artwork_payload(req: ArtworkAnalysisRequest) -> ArtworkAnalysisResponse:
    """Main entrypoint for artwork color, separation, and front/back page analysis."""
    front_raw = get_raw_artwork(req.url or req.dataUrl)
    back_raw = get_raw_artwork(req.backUrl or req.backDataUrl) if (req.backUrl or req.backDataUrl) else None

    if not front_raw:
        return ArtworkAnalysisResponse(
            success=False,
            front=SideColorAnalysis(hasContent=False),
            back=None,
            hasBackSide=False,
            notes="No readable front artwork payload found",
        )

    # ── CASE 1: VECTOR PDF ARTWORK ──
    if front_raw["kind"] == "pdf":
        doc = fitz.open(stream=front_raw["bytes"], filetype="pdf")
        page_count = len(doc)
        if page_count == 0:
            return ArtworkAnalysisResponse(
                success=False,
                front=SideColorAnalysis(hasContent=False),
                notes="PDF contains 0 pages",
            )

        p1 = doc[0]
        pt_per_mm = 72.0 / 25.4
        w_mm = round(p1.rect.width / pt_per_mm, 1)
        h_mm = round(p1.rect.height / pt_per_mm, 1)

        commercial_spots, technical_dielines = _extract_pdf_spot_colors(doc)

        front_analysis = _analyze_pdf_page_colors(p1, commercial_spots)

        back_analysis: Optional[SideColorAnalysis] = None
        has_back_side = False

        # If PDF has 2 or more pages: Page 2 is the back side
        if page_count >= 2:
            p2 = doc[1]
            back_analysis = _analyze_pdf_page_colors(p2, commercial_spots)
            has_back_side = back_analysis.hasContent
        elif back_raw is not None:
            # Separate back artwork file provided
            if back_raw["kind"] == "pdf":
                doc_b = fitz.open(stream=back_raw["bytes"], filetype="pdf")
                if len(doc_b) > 0:
                    b_spots, b_dies = _extract_pdf_spot_colors(doc_b)
                    back_analysis = _analyze_pdf_page_colors(doc_b[0], b_spots)
                    has_back_side = back_analysis.hasContent
                    for s in b_spots:
                        if s not in commercial_spots:
                            commercial_spots.append(s)
                    for d in b_dies:
                        if d not in technical_dielines:
                            technical_dielines.append(d)
                doc_b.close()
            else:
                back_analysis = _analyze_raster_image_colors(back_raw["bytes"])
                has_back_side = back_analysis.hasContent

        doc.close()

        f_count = front_analysis.colorCount
        b_count = back_analysis.colorCount if (back_analysis and has_back_side) else 0
        detected_formula = f"{f_count}+{b_count}"

        return ArtworkAnalysisResponse(
            success=True,
            front=front_analysis,
            back=back_analysis if has_back_side else None,
            hasBackSide=has_back_side,
            technicalDielines=technical_dielines,
            commercialSpotColors=commercial_spots,
            detectedFormula=detected_formula,
            pageCount=page_count,
            widthMm=w_mm,
            heightMm=h_mm,
        )

    # ── CASE 2: RASTER IMAGE (PNG/JPG) ARTWORK ──
    front_analysis = _analyze_raster_image_colors(front_raw["bytes"])
    back_analysis: Optional[SideColorAnalysis] = None
    has_back_side = False

    if back_raw is not None:
        back_analysis = _analyze_raster_image_colors(back_raw["bytes"])
        has_back_side = back_analysis.hasContent

    f_count = front_analysis.colorCount
    b_count = back_analysis.colorCount if (back_analysis and has_back_side) else 0

    return ArtworkAnalysisResponse(
        success=True,
        front=front_analysis,
        back=back_analysis if has_back_side else None,
        hasBackSide=has_back_side,
        technicalDielines=[],
        commercialSpotColors=[],
        detectedFormula=f"{f_count}+{b_count}",
        pageCount=1,
    )
