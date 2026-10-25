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
    doc: fitz.Document,
    page: fitz.Page,
    doc_commercial_spots: List[str],
    doc_technical_dies: List[str],
) -> SideColorAnalysis:
    """Prepress-grade analysis of PDF content streams and embedded XObjects.
    Does NOT rely on rasterization (which would erroneously convert Pantone spot colors to CMYK)."""

    # 1. Collect all content streams for this page (page content + all Form XObjects on page)
    streams: List[bytes] = []
    try:
        streams.append(page.read_contents())
    except Exception:
        pass

    for xo in page.get_xobjects():
        try:
            xref = xo[0]
            obj_txt = doc.xref_object(xref)
            if "/Subtype /Form" in obj_txt or "/Subtype/Form" in obj_txt:
                s = doc.xref_stream(xref)
                if s:
                    streams.append(s)
        except Exception:
            pass

    stream_text = b" ".join(streams).decode("latin1", errors="ignore")

    # 2. Resolve page-level ColorSpace resource aliases (e.g. /CS0 -> PANTONE 186 C)
    page_txt = doc.xref_object(page.xref)
    cs_map: Dict[str, str] = {}
    for entry in re.finditer(
        r"/([A-Za-z0-9_\-\.\#]+)\s+(?:(\d+)\s+0\s+R|\[\s*/Separation\s*/([^\s/\[\]<>]+))",
        page_txt,
    ):
        alias = entry.group(1)
        if entry.group(2):
            try:
                target_obj = doc.xref_object(int(entry.group(2)))
                m_sep = re.search(r"/Separation\s*/([^\s/\[\]<>]+)", target_obj)
                if m_sep:
                    cs_map[alias] = re.sub(
                        r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), m_sep.group(1)
                    ).strip()
                elif "/DeviceCMYK" in target_obj:
                    cs_map[alias] = "DeviceCMYK"
                elif "/DeviceGray" in target_obj:
                    cs_map[alias] = "DeviceGray"
                elif "/DeviceRGB" in target_obj:
                    cs_map[alias] = "DeviceRGB"
            except Exception:
                pass
        elif entry.group(3):
            cs_map[alias] = re.sub(
                r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), entry.group(3)
            ).strip()

    # 3. Parse stream tokens for genuine process ink commands vs spot colors
    has_c, has_m, has_y, has_k = False, False, False, False
    page_spots: Set[str] = set()
    page_dies: Set[str] = set()

    tokens = re.findall(r"/[A-Za-z0-9_\-\.\#]+|[-+]?\d*\.?\d+|[A-Za-z]+|\S", stream_text)
    current_cs_fill: Optional[str] = None
    current_cs_stroke: Optional[str] = None

    i = 0
    while i < len(tokens):
        tok = tokens[i]

        # DeviceCMYK direct operators: c m y k k / K
        if tok in ("k", "K") and i >= 4:
            try:
                c, m_val, y, k = (
                    float(tokens[i - 4]),
                    float(tokens[i - 3]),
                    float(tokens[i - 2]),
                    float(tokens[i - 1]),
                )
                if c > 0.01:
                    has_c = True
                if m_val > 0.01:
                    has_m = True
                if y > 0.01:
                    has_y = True
                if k > 0.01:
                    has_k = True
            except ValueError:
                pass

        # DeviceGray direct operators: g / G
        elif tok in ("g", "G") and i >= 1:
            try:
                if float(tokens[i - 1]) < 0.99:  # non-white
                    has_k = True
            except ValueError:
                pass

        # DeviceRGB direct operators: r g b rg / RG
        elif tok in ("rg", "RG") and i >= 3:
            try:
                r, g, b = float(tokens[i - 3]), float(tokens[i - 2]), float(tokens[i - 1])
                if abs(r - g) > 0.02 or abs(r - b) > 0.02 or abs(g - b) > 0.02:
                    has_c, has_m, has_y = True, True, True
                elif r < 0.99:
                    has_k = True
            except ValueError:
                pass

        # ColorSpace selection: /CSname cs / CS
        elif tok == "cs" and i >= 1 and tokens[i - 1].startswith("/"):
            current_cs_fill = tokens[i - 1][1:]
        elif tok == "CS" and i >= 1 and tokens[i - 1].startswith("/"):
            current_cs_stroke = tokens[i - 1][1:]

        # Fill color in current ColorSpace: sc / scn
        elif tok in ("sc", "scn") and current_cs_fill:
            canonical = cs_map.get(
                current_cs_fill,
                re.sub(r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), current_cs_fill),
            )
            if canonical in doc_commercial_spots:
                page_spots.add(canonical)
            elif canonical in doc_technical_dies:
                page_dies.add(canonical)
            elif "cmyk" in canonical.lower() and i >= 4:
                try:
                    c, m_val, y, k = (
                        float(tokens[i - 4]),
                        float(tokens[i - 3]),
                        float(tokens[i - 2]),
                        float(tokens[i - 1]),
                    )
                    if c > 0.01:
                        has_c = True
                    if m_val > 0.01:
                        has_m = True
                    if y > 0.01:
                        has_y = True
                    if k > 0.01:
                        has_k = True
                except ValueError:
                    pass
            elif "gray" in canonical.lower() and i >= 1:
                try:
                    if float(tokens[i - 1]) < 0.99:
                        has_k = True
                except ValueError:
                    pass

        # Stroke color in current ColorSpace: SC / SCN
        elif tok in ("SC", "SCN") and current_cs_stroke:
            canonical = cs_map.get(
                current_cs_stroke,
                re.sub(r"#([0-9A-Fa-f]{2})", lambda h: chr(int(h.group(1), 16)), current_cs_stroke),
            )
            if canonical in doc_commercial_spots:
                page_spots.add(canonical)
            elif canonical in doc_technical_dies:
                page_dies.add(canonical)
            elif "cmyk" in canonical.lower() and i >= 4:
                try:
                    c, m_val, y, k = (
                        float(tokens[i - 4]),
                        float(tokens[i - 3]),
                        float(tokens[i - 2]),
                        float(tokens[i - 1]),
                    )
                    if c > 0.01:
                        has_c = True
                    if m_val > 0.01:
                        has_m = True
                    if y > 0.01:
                        has_y = True
                    if k > 0.01:
                        has_k = True
                except ValueError:
                    pass
            elif "gray" in canonical.lower() and i >= 1:
                try:
                    if float(tokens[i - 1]) < 0.99:
                        has_k = True
                except ValueError:
                    pass

        i += 1

    # 4. Check embedded raster images on page
    for img in page.get_images():
        cs = str(img[5]).lower()
        if "cmyk" in cs or "rgb" in cs:
            # Check if image has chromatic saturation or is pure grayscale
            try:
                img_xref = img[0]
                base_img = doc.extract_image(img_xref)
                if base_img:
                    pil_i = PILImage.open(io.BytesIO(base_img["image"])).convert("RGB")
                    pil_i.thumbnail((150, 150))
                    data = pil_i.getdata()
                    is_chromatic = False
                    for r, g, b in data:
                        if max(abs(r - g), abs(r - b), abs(g - b)) > 15:
                            is_chromatic = True
                            break
                    if is_chromatic:
                        has_c, has_m, has_y, has_k = True, True, True, True
                    else:
                        has_k = True
                else:
                    has_c, has_m, has_y, has_k = True, True, True, True
            except Exception:
                has_c, has_m, has_y, has_k = True, True, True, True
        elif "gray" in cs or img[4] == 1:
            has_k = True

    # 5. Check if document spot colors were referenced directly by name in stream
    for s in doc_commercial_spots:
        s_esc = s.replace(" ", "#20")
        if s in stream_text or s_esc in stream_text:
            page_spots.add(s)

    for d in doc_technical_dies:
        d_esc = d.replace(" ", "#20")
        if d in stream_text or d_esc in stream_text:
            page_dies.add(d)

    # 6. Has content determination
    has_content = has_c or has_m or has_y or has_k or bool(page_spots) or bool(page_dies)
    if not has_content and (len(page.get_drawings()) > 0 or len(page.get_text().strip()) > 0):
        # Default PDF initial graphics state fill color is Black (0 0 0 in DeviceGray)
        has_content = True
        has_k = True

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

    sorted_spots = sorted(page_spots)
    proc_count = (1 if has_c else 0) + (1 if has_m else 0) + (1 if has_y else 0) + (1 if has_k else 0)
    total_count = proc_count + len(sorted_spots)

    return SideColorAnalysis(
        hasContent=True,
        c=has_c,
        m=has_m,
        y=has_y,
        k=has_k,
        spotColors=sorted_spots,
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

        front_analysis = _analyze_pdf_page_colors(doc, p1, commercial_spots, technical_dielines)

        back_analysis: Optional[SideColorAnalysis] = None
        has_back_side = False

        # If PDF has 2 or more pages: Page 2 is the back side
        if page_count >= 2:
            p2 = doc[1]
            back_analysis = _analyze_pdf_page_colors(doc, p2, commercial_spots, technical_dielines)
            has_back_side = back_analysis.hasContent
        elif back_raw is not None:
            # Separate back artwork file provided
            if back_raw["kind"] == "pdf":
                doc_b = fitz.open(stream=back_raw["bytes"], filetype="pdf")
                if len(doc_b) > 0:
                    b_spots, b_dies = _extract_pdf_spot_colors(doc_b)
                    for s in b_spots:
                        if s not in commercial_spots:
                            commercial_spots.append(s)
                    for d in b_dies:
                        if d not in technical_dielines:
                            technical_dielines.append(d)
                    back_analysis = _analyze_pdf_page_colors(doc_b, doc_b[0], commercial_spots, technical_dielines)
                    has_back_side = back_analysis.hasContent
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
            technicalDielines=sorted(technical_dielines),
            commercialSpotColors=sorted(commercial_spots),
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
