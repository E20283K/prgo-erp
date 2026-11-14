"""
Preflight Moduli: Poligrafiya talablari bo'yicha kiruvchi PDF fayllarni tekshirish
"""

import math
import os
import json
from typing import List, Dict, Any, Optional, Tuple
import pymupdf

from .models import (
    PreflightReport,
    PreflightIssue,
    ImagePreflightInfo,
    ColorChannel,
    DesignVariant,
)

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4


class PreflightChecker:
    """PDF fayllarni poligrafiya talablariga muvofiqligini tekshiruvchi sinf."""

    def __init__(self, target_dpi: float = 300.0, min_line_width_pt: float = 0.15):
        self.target_dpi = target_dpi
        self.min_line_width_pt = min_line_width_pt

    @staticmethod
    def match_standard_trim_with_bleed(w_mm: float, h_mm: float) -> Optional[Tuple[float, float, float]]:
        """
        Agar PDF sahifasi standart format + bleed (1.5mm, 2mm, 3mm, 5mm) bo'lsa,
        (toza_w, toza_h, bleed_mm) ni qaytaradi.
        Masalan: 51x96 mm -> (45.0, 90.0, 3.0); 94x54 mm -> (90.0, 50.0, 2.0)
        """
        STANDARD_SIZES = [
            (90.0, 50.0),
            (45.0, 90.0),
            (85.0, 55.0),
            (105.0, 148.0),
            (148.0, 210.0),
            (210.0, 297.0),
            (100.0, 100.0),
        ]
        for sw, sh in STANDARD_SIZES:
            for b in (3.0, 2.0, 1.5, 2.5, 4.0, 5.0):
                # 0 gradus
                if abs(w_mm - (sw + 2 * b)) < 0.6 and abs(h_mm - (sh + 2 * b)) < 0.6:
                    return (sw, sh, b)
                # 90 gradus burilgan
                if abs(w_mm - (sh + 2 * b)) < 0.6 and abs(h_mm - (sw + 2 * b)) < 0.6:
                    return (sh, sw, b)
        return None

    def check_pdf(self, pdf_path: str, expected_trim_mm: Optional[Tuple[float, float]] = None) -> PreflightReport:
        if not os.path.exists(pdf_path):
            report = PreflightReport(file_path=pdf_path, page_count=0, is_valid=False)
            report.issues.append(PreflightIssue(
                severity="ERROR",
                category="FILE",
                message=f"Fayl topilmadi: {pdf_path}",
                page_num=0
            ))
            return report

        try:
            doc = pymupdf.open(pdf_path)
        except Exception as e:
            report = PreflightReport(file_path=pdf_path, page_count=0, is_valid=False)
            report.issues.append(PreflightIssue(
                severity="ERROR",
                category="FILE",
                message=f"PDF faylni ochishda xatolik: {str(e)}",
                page_num=0
            ))
            return report

        page_count = len(doc)
        report = PreflightReport(file_path=pdf_path, page_count=page_count, is_valid=True)

        if page_count == 0:
            report.is_valid = False
            report.issues.append(PreflightIssue(
                severity="ERROR",
                category="PAGE",
                message="PDF fayl bo'sh (hech qanday sahifa yo'q).",
                page_num=0
            ))
            doc.close()
            return report

        # 1. Sahifa o'lchamlari va Boxlarni tahlil qilish (1-bet namunasi bo'yicha)
        page0 = doc[0]
        media_box = page0.mediabox
        report.media_box_mm = (round(media_box.width * PT_TO_MM, 2), round(media_box.height * PT_TO_MM, 2))

        # Agar PDF ichida alohida TrimBox belgilangan bo'lsa, uni olamiz
        pdf_trim = page0.trimbox
        if pdf_trim and not pdf_trim.is_empty and (
            abs(pdf_trim.width - media_box.width) > 0.5 or abs(pdf_trim.height - media_box.height) > 0.5
        ):
            trim_box = pdf_trim
            report.trim_box_mm = (round(trim_box.width * PT_TO_MM, 2), round(trim_box.height * PT_TO_MM, 2))
            bw = (report.media_box_mm[0] - report.trim_box_mm[0]) / 2.0
            bh = (report.media_box_mm[1] - report.trim_box_mm[1]) / 2.0
            report.detected_bleed_mm = round(max(0.0, min(bw, bh)), 1)
        else:
            # Standart format + bleed solishtirish (agar dizayner to'g'ridan-to'g'ri bleed bilan chizgan bo'lsa)
            matched = PreflightChecker.match_standard_trim_with_bleed(report.media_box_mm[0], report.media_box_mm[1])
            if matched:
                sw, sh, b = matched
                report.trim_box_mm = (sw, sh)
                report.detected_bleed_mm = b
                report.issues.append(PreflightIssue(
                    severity="INFO",
                    category="BLEED",
                    message=f"Standart format aniqlandi: {sw}x{sh} mm toza kesim + har tomondan {b:.1f} mm bleed.",
                    details=f"MediaBox: {report.media_box_mm[0]}x{report.media_box_mm[1]} mm",
                    page_num=1
                ))
            else:
                trim_box = page0.rect
                report.trim_box_mm = (round(trim_box.width * PT_TO_MM, 2), round(trim_box.height * PT_TO_MM, 2))

        # Agar expected_trim_mm berilgan bo'lsa, bleedni hisoblaymiz
        if expected_trim_mm:
            exp_w, exp_h = expected_trim_mm
            # burilishni inobatga olamiz
            w_diff = abs(report.media_box_mm[0] - exp_w)
            h_diff = abs(report.media_box_mm[1] - exp_h)
            
            # Agar 90 gradus burilgan bo'lsa
            w_diff_rot = abs(report.media_box_mm[0] - exp_h)
            h_diff_rot = abs(report.media_box_mm[1] - exp_w)
            
            if (w_diff_rot + h_diff_rot) < (w_diff + h_diff):
                bleed_w = (report.media_box_mm[0] - exp_h) / 2.0
                bleed_h = (report.media_box_mm[1] - exp_w) / 2.0
            else:
                bleed_w = (report.media_box_mm[0] - exp_w) / 2.0
                bleed_h = (report.media_box_mm[1] - exp_h) / 2.0
            
            detected_bleed = round(max(0.0, min(bleed_w, bleed_h)), 2)
            report.detected_bleed_mm = detected_bleed

            if detected_bleed < 1.0:
                report.issues.append(PreflightIssue(
                    severity="WARNING",
                    category="BLEED",
                    message=f"Dizaynda bleed (kesish zahirasi) yetarli emas: {detected_bleed} mm (kamida 1.5 - 2 mm bo'lishi tavsiya etiladi).",
                    details=f"MediaBox: {report.media_box_mm[0]}x{report.media_box_mm[1]} mm, Trim: {exp_w}x{exp_h} mm",
                    page_num=1
                ))
            else:
                report.issues.append(PreflightIssue(
                    severity="INFO",
                    category="BLEED",
                    message=f"Aniqlangan bleed zahirasi: har tomondan ~{detected_bleed} mm.",
                    details=f"MediaBox: {report.media_box_mm[0]}x{report.media_box_mm[1]} mm",
                    page_num=1
                ))

        # 2. Rang kanallari va Bo'yoqlar tahlili
        has_rgb_elements = False
        has_spot_colors = False

        cmyk_defaults = {
            "Cyan": (1.0, 0.0, 0.0, 0.0),
            "Magenta": (0.0, 1.0, 0.0, 0.0),
            "Yellow": (0.0, 0.0, 1.0, 0.0),
            "Black": (0.0, 0.0, 0.0, 1.0),
        }

        # PDF strukturasidagi Shriftlar, Rasmlar va Hairline tahlili
        for pno in range(page_count):
            page = doc[pno]
            
            # Shriftlar tahlili
            try:
                fonts = page.get_fonts(full=True)
                for f in fonts:
                    # f format: (xref, ext, type, basefont, name, encoding, is_embedded)
                    fname = f[3] if len(f) > 3 else "UnknownFont"
                    report.fonts.append(fname)
                    # Tekshiramiz: embeddedmi?
                    # Agar xref > 0 va f[1] ('ttf', 'cff', 'type1' va h.k.) mavjud bo'lsa embedded
                    if len(f) > 1 and not f[1]:
                        report.unembedded_fonts.append(fname)
            except Exception:
                pass

            # Rastr rasmlar va DPI tahlili
            try:
                images = page.get_image_info(xrefs=True)
                for img in images:
                    xref = img.get("xref", 0)
                    w_px = img.get("width", 0)
                    h_px = img.get("height", 0)
                    bbox = img.get("bbox", (0, 0, 0, 0))
                    
                    # Joylashgan o'lchami pt larda
                    disp_w_pt = max(1.0, bbox[2] - bbox[0])
                    disp_h_pt = max(1.0, bbox[3] - bbox[1])
                    
                    disp_w_in = disp_w_pt / 72.0
                    disp_h_in = disp_h_pt / 72.0
                    
                    dpi_x = round(w_px / disp_w_in, 1) if disp_w_in > 0 else 0
                    dpi_y = round(h_px / disp_h_in, 1) if disp_h_in > 0 else 0
                    eff_dpi = min(dpi_x, dpi_y)
                    
                    # Colorspace va bpc
                    cs_name = img.get("colorspace", "Unknown")
                    bpc = img.get("bpc", 8)

                    # Agar extract_image qila olsak, haqiqiy CS ni bilamiz
                    if xref > 0:
                        try:
                            ext_img = doc.extract_image(xref)
                            if ext_img:
                                cs_name = ext_img.get("colorspace", cs_name)
                        except Exception:
                            pass

                    disp_w_mm = round(disp_w_pt * PT_TO_MM, 1)
                    disp_h_mm = round(disp_h_pt * PT_TO_MM, 1)

                    img_info = ImagePreflightInfo(
                        xref=xref,
                        page_num=pno + 1,
                        width_px=w_px,
                        height_px=h_px,
                        display_w_mm=disp_w_mm,
                        display_h_mm=disp_h_mm,
                        dpi_x=dpi_x,
                        dpi_y=dpi_y,
                        effective_dpi=eff_dpi,
                        colorspace=str(cs_name),
                        bpc=bpc
                    )
                    report.images.append(img_info)

                    # DPI tekshiruvi
                    if eff_dpi < 150:
                        report.has_low_dpi = True
                        report.issues.append(PreflightIssue(
                            severity="ERROR",
                            category="DPI",
                            message=f"Rastr rasm sifati juda past: {eff_dpi:.0f} DPI (< 150 DPI). Chop etilganda xira (piksel) chiqadi!",
                            details=f"O'lchami: {w_px}x{h_px} px, sahifadagi joyi: {disp_w_mm}x{disp_h_mm} mm (Sahifa {pno + 1})",
                            page_num=pno + 1
                        ))
                    elif eff_dpi < self.target_dpi:
                        report.has_low_dpi = True
                        report.issues.append(PreflightIssue(
                            severity="WARNING",
                            category="BLEED" if eff_dpi < 200 else "DPI",
                            message=f"Rastr rasm DPI 300 dan past: {eff_dpi:.0f} DPI (Standart 300 DPI talab etiladi).",
                            details=f"O'lchami: {w_px}x{h_px} px, sahifada: {disp_w_mm}x{disp_h_mm} mm (Sahifa {pno + 1})",
                            page_num=pno + 1
                        ))

                    # Rasm rang makoni RGB bo'lsa
                    if "RGB" in str(cs_name).upper():
                        has_rgb_elements = True
                        report.issues.append(PreflightIssue(
                            severity="WARNING",
                            category="COLOR",
                            message=f"Rastr rasm RGB rang makonida aniqlandi ({cs_name}). Bosmaxonada ranglar o'zgarishi mumkin!",
                            details=f"XRef: {xref}, Sahifa {pno + 1}",
                            page_num=pno + 1
                        ))
            except Exception as e:
                pass

            # Hairline tekshiruvi (chiziq qalinligi < 0.15 pt)
            try:
                drawings = page.get_drawings()
                hairline_count = 0
                for d in drawings:
                    width = d.get("width", 1.0)
                    if 0 < width < self.min_line_width_pt:
                        hairline_count += 1
                if hairline_count > 0:
                    report.issues.append(PreflightIssue(
                        severity="WARNING",
                        category="HAIRLINE",
                        message=f"{hairline_count} ta o'ta ingichka chiziq (hairline < {self.min_line_width_pt} pt) aniqlandi. Chop etishda ko'rinmay qolishi mumkin!",
                        details=f"Sahifa {pno + 1}",
                        page_num=pno + 1
                    ))
            except Exception:
                pass

        # Shriftlar bo'yicha yakuniy ogohlantirish
        if report.fonts:
            unique_fonts = list(set(report.fonts))
            report.issues.append(PreflightIssue(
                severity="WARNING" if report.unembedded_fonts else "INFO",
                category="FONT",
                message=f"Dizaynda {len(unique_fonts)} ta matnli shrift mavjud (krivoyga o'girilmagan)." + 
                        (" Shriftlar to'liq joylanmagan!" if report.unembedded_fonts else " Barcha shriftlar ichiga biriktirilgan (embedded)."),
                details=", ".join(unique_fonts[:10]) + ("..." if len(unique_fonts) > 10 else ""),
                page_num=1
            ))

        # Spot ranglarni va CMYK/Gray jarayon bo'yoqlarini to'liq va aniq tahlil qilish
        import re

        found_spots: Dict[str, Optional[Tuple[float, float, float, float]]] = {}
        used_cmyk = set()

        # 1. Spot (Separation) ranglarini PDF xref obyektlaridan izlash va TintTransform CMYK sini olish
        for xref in range(1, doc.xref_length()):
            try:
                obj_str = doc.xref_object(xref)
                if "/Separation" in obj_str:
                    # [ /Separation /Name /DeviceCMYK func_ref 0 R ]
                    matches = re.findall(r'\[\s*/Separation\s*/([^\s/\]]+)\s*/?([^\s/\]]+)?\s*([0-9]+)?', obj_str)
                    for item in matches:
                        raw_name = item[0]
                        clean_name = raw_name.replace("#20", " ").replace("\\040", " ").replace("_", " ")
                        if clean_name.upper() not in ("ALL", "NONE", "DEVICECMYK", "DEVICERGB", "DEVICEGRAY"):
                            func_ref = int(item[2]) if len(item) > 2 and item[2] else None
                            cmyk_val = None
                            if func_ref:
                                try:
                                    f_obj = doc.xref_object(func_ref)
                                    c1_m = re.search(r'/C1\s*\[\s*([0-9\.\s]+)\s*\]', f_obj)
                                    if c1_m:
                                        parts = [float(x) for x in c1_m.group(1).split()]
                                        if len(parts) == 4:
                                            cmyk_val = tuple(parts)
                                    if not cmyk_val:
                                        s_bytes = doc.xref_stream(func_ref)
                                        if s_bytes:
                                            stext = s_bytes.decode("latin1", errors="ignore")
                                            nums = re.findall(r'([0-9\.]+)\s+mul', stext)
                                            if len(nums) >= 3:
                                                f_nums = [float(x) for x in nums]
                                                c_m = re.search(r'pop\s+([0-9\.]+)', stext)
                                                k_val = float(c_m.group(1)) if c_m else 0.0
                                                if len(f_nums) == 3:
                                                    cmyk_val = (f_nums[0], f_nums[1], f_nums[2], k_val)
                                                elif len(f_nums) >= 4:
                                                    cmyk_val = (f_nums[0], f_nums[1], f_nums[2], f_nums[3])
                                except Exception:
                                    pass
                            found_spots[clean_name] = cmyk_val
            except Exception:
                pass

        # Qo'shimcha: xom baytlardan qidirish (agar xref orqali o'tkazib yuborilgan bo'lsa)
        raw_doc_text = ""
        try:
            with open(pdf_path, "rb") as f:
                raw_bytes = f.read(1024 * 1024 * 5)
                raw_doc_text = raw_bytes.decode("latin1", errors="ignore")
        except Exception:
            pass

        if raw_doc_text:
            m2 = re.findall(r'/Separation\s*/(PANTONE[a-zA-Z0-9_\-#\\]+|DieLine|Pichoq|Cut|Crease|Varnish|Lak|Gold|Silver|Foil|Kley)', raw_doc_text, re.IGNORECASE)
            for name in m2:
                clean_name = name.replace("#20", " ").replace("\\040", " ").replace("_", " ")
                if clean_name not in found_spots and clean_name.upper() not in ("ALL", "NONE"):
                    found_spots[clean_name] = None

        # 2. Content stream larni tekshirish (Sahifalar va Form XObject lar)
        streams = []
        for pno in range(page_count):
            try:
                streams.append(doc[pno].read_contents().decode("latin1", errors="ignore"))
            except Exception:
                pass
        for xref in range(1, doc.xref_length()):
            try:
                subtype = doc.xref_get_key(xref, "Subtype")
                if subtype and "Form" in subtype[1]:
                    s = doc.xref_stream(xref)
                    if s:
                        streams.append(s.decode("latin1", errors="ignore"))
            except Exception:
                pass
        full_stream = "\n".join(streams)

        # CMYK k / K operatorlari (masalan: 0 0 0 1 k)
        for c, m, y, k, op in re.findall(r'(?<![0-9\.\-])([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([kK])(?![a-zA-Z])', full_stream):
            if float(c) > 0.001:
                used_cmyk.add("Cyan")
            if float(m) > 0.001:
                used_cmyk.add("Magenta")
            if float(y) > 0.001:
                used_cmyk.add("Yellow")
            if float(k) > 0.001:
                used_cmyk.add("Black")

        # Gray g / G operatorlari (0 g - qora rang)
        for val, op in re.findall(r'(?<![0-9\.\-])([0-9\.]+)\s+([gG])(?![a-zA-Z])', full_stream):
            if float(val) < 0.999:  # Oq rang emas, demak qora bo'yoq
                used_cmyk.add("Black")

        # RGB rg / RG operatorlari
        rgb_matches = re.findall(r'(?<![0-9\.\-])([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+(rg|RG)(?![a-zA-Z])', full_stream)
        if rgb_matches:
            has_rgb_elements = True
            for r, g, b, op in rgb_matches:
                fr, fg, fb = float(r), float(g), float(b)
                if fr < 0.999 or fg < 0.999 or fb < 0.999:
                    if fr == fg == fb:
                        used_cmyk.add("Black")
                    else:
                        used_cmyk.update(["Cyan", "Magenta", "Yellow", "Black"])

        # Rastr rasmlar orqali kanallarni aniqlash
        for img_info in report.images:
            cs_upper = str(img_info.colorspace).upper()
            if "GRAY" in cs_upper or cs_upper == "1":
                used_cmyk.add("Black")
            elif "CMYK" in cs_upper or cs_upper == "4":
                used_cmyk.update(["Cyan", "Magenta", "Yellow", "Black"])
            elif "RGB" in cs_upper or cs_upper == "3":
                has_rgb_elements = True
                used_cmyk.update(["Cyan", "Magenta", "Yellow", "Black"])

        # Shriftli matnlarni tekshirish (agar matn bo'lsa va qora rangda bo'lsa)
        if report.fonts and "Black" not in used_cmyk:
            for pno in range(page_count):
                text_d = doc[pno].get_text("dict")
                for b in text_d.get("blocks", []):
                    for l in b.get("lines", []):
                        for s in l.get("spans", []):
                            if s.get("text", "").strip() and s.get("color") == 0:
                                used_cmyk.add("Black")

        # 3. Yakuniy ranglar ro'yxatini shakllantirish
        detected_colors_map: Dict[str, ColorChannel] = {}

        # a) Spot ranglarni qo'shish
        for p_name, cmyk_val in sorted(found_spots.items()):
            if not cmyk_val:
                # Pantone ekvivalent taxminiy rangini belgilash
                p_lower = p_name.lower()
                if "476" in p_lower:
                    cmyk_val = (0.35, 0.68, 0.75, 0.65)  # To'q jigarrang
                elif "280" in p_lower:
                    cmyk_val = (1.0, 0.85, 0.05, 0.35)  # To'q ko'k
                elif "1655" in p_lower:
                    cmyk_val = (0.0, 0.65, 1.0, 0.0)   # To'q sariq (Orange)
                elif "11-0602" in p_lower:
                    cmyk_val = (0.02, 0.04, 0.08, 0.0) # Sutrang
                else:
                    cmyk_val = (0.0, 0.0, 0.0, 1.0)

            detected_colors_map[p_name] = ColorChannel(
                name=p_name,
                is_spot=True,
                cmyk=cmyk_val
            )

        # b) Ishlatilgan CMYK kanallarini (shu jumladan Qora/Black) qo'shish
        cmyk_order = ["Cyan", "Magenta", "Yellow", "Black"]
        if found_spots:
            for cname in cmyk_order:
                if cname in used_cmyk:
                    detected_colors_map[cname] = ColorChannel(
                        name=cname,
                        is_spot=False,
                        cmyk=cmyk_defaults[cname]
                    )
            report.issues.append(PreflightIssue(
                severity="INFO",
                category="COLOR",
                message=f"Spot bo'yoq kanallari aniqlandi: {', '.join(sorted(found_spots.keys()))}",
                page_num=1
            ))
        else:
            if used_cmyk:
                for cname in cmyk_order:
                    if cname in used_cmyk:
                        detected_colors_map[cname] = ColorChannel(
                            name=cname,
                            is_spot=False,
                            cmyk=cmyk_defaults[cname]
                        )
            else:
                for cname in cmyk_order:
                    detected_colors_map[cname] = ColorChannel(
                        name=cname,
                        is_spot=False,
                        cmyk=cmyk_defaults[cname]
                    )

        report.colors = list(detected_colors_map.values())
        report.has_rgb = has_rgb_elements

        if has_rgb_elements:
            report.issues.append(PreflightIssue(
                severity="WARNING",
                category="COLOR",
                message="Faylda RGB rangdagi obyektlar aniqlandi. Poligrafik bosmada faqat CMYK / Spot tavsiya etiladi!",
                page_num=1
            ))

        doc.close()
        return report

    def check_multi_variants(
        self,
        variants: List[DesignVariant],
        expected_trim_mm: Optional[Tuple[float, float]] = None
    ) -> PreflightReport:
        """
        To'plamdagi barcha turlarning PDF fayllarini tekshirib, umumiy PreflightReport
        va birlashtirilgan rang kanallari (CMYK + Spot/Pantone) ro'yxatini qaytaradi.
        """
        if not variants:
            return PreflightReport(file_path="", page_count=0, is_valid=False)

        checked_files: Dict[str, PreflightReport] = {}
        combined_issues: List[PreflightIssue] = []
        combined_images: List[ImagePreflightInfo] = []
        combined_fonts: List[str] = []
        combined_unembedded: List[str] = []
        spot_colors_map: Dict[str, ColorChannel] = {}
        cmyk_colors_map: Dict[str, ColorChannel] = {}

        first_report: Optional[PreflightReport] = None
        total_pages = 0
        has_rgb = False
        has_low_dpi = False

        for var in variants:
            for path in (var.front_pdf_path, var.back_pdf_path):
                if not path or not os.path.exists(path):
                    continue
                if path not in checked_files:
                    rep = self.check_pdf(path, expected_trim_mm=expected_trim_mm)
                    checked_files[path] = rep
                    if first_report is None:
                        first_report = rep
                    total_pages += rep.page_count
                    has_rgb = has_rgb or rep.has_rgb
                    has_low_dpi = has_low_dpi or rep.has_low_dpi
                    combined_fonts.extend(rep.fonts)
                    combined_unembedded.extend(rep.unembedded_fonts)
                    combined_images.extend(rep.images)

                    fname_short = os.path.basename(path)
                    for iss in rep.issues:
                        combined_issues.append(PreflightIssue(
                            severity=iss.severity,
                            category=iss.category,
                            message=f"[{fname_short}] {iss.message}",
                            details=iss.details,
                            page_num=iss.page_num
                        ))

                    for col in rep.colors:
                        if col.is_spot:
                            if col.name not in spot_colors_map:
                                spot_colors_map[col.name] = col
                        else:
                            if col.name not in cmyk_colors_map:
                                cmyk_colors_map[col.name] = col

        if first_report is None:
            return PreflightReport(file_path=variants[0].front_pdf_path, page_count=0, is_valid=False)

        # Ranglarni tartiblash: avval Spot ranglar, keyin Cyan, Magenta, Yellow, Black
        merged_colors: List[ColorChannel] = []
        for s_name in sorted(spot_colors_map.keys()):
            merged_colors.append(spot_colors_map[s_name])
        for c_name in ["Cyan", "Magenta", "Yellow", "Black"]:
            if c_name in cmyk_colors_map:
                merged_colors.append(cmyk_colors_map[c_name])

        summary_report = PreflightReport(
            file_path=f"To'plam ({len(variants)} xil dizayn, {len(checked_files)} ta PDF)",
            page_count=total_pages,
            is_valid=all(r.is_valid for r in checked_files.values()),
            issues=combined_issues,
            images=combined_images,
            colors=merged_colors,
            fonts=list(set(combined_fonts)),
            unembedded_fonts=list(set(combined_unembedded)),
            has_rgb=has_rgb,
            has_low_dpi=has_low_dpi,
            detected_bleed_mm=first_report.detected_bleed_mm,
            trim_box_mm=first_report.trim_box_mm,
            media_box_mm=first_report.media_box_mm,
        )
        return summary_report

    def export_report_json(self, report: PreflightReport, json_path: str):
        """Preflight hisobotini JSON faylga eksport qilish."""
        data = {
            "file_path": report.file_path,
            "page_count": report.page_count,
            "is_valid": report.is_valid,
            "warning_count": report.warning_count,
            "error_count": report.error_count,
            "media_box_mm": report.media_box_mm,
            "trim_box_mm": report.trim_box_mm,
            "detected_bleed_mm": report.detected_bleed_mm,
            "has_rgb": report.has_rgb,
            "has_low_dpi": report.has_low_dpi,
            "fonts": list(set(report.fonts)),
            "unembedded_fonts": report.unembedded_fonts,
            "colors": [{"name": c.name, "is_spot": c.is_spot, "cmyk": list(c.cmyk)} for c in report.colors],
            "issues": [
                {
                    "severity": i.severity,
                    "category": i.category,
                    "message": i.message,
                    "details": i.details,
                    "page_num": i.page_num
                } for i in report.issues
            ],
            "images": [
                {
                    "xref": img.xref,
                    "page": img.page_num,
                    "size_px": f"{img.width_px}x{img.height_px}",
                    "effective_dpi": img.effective_dpi,
                    "colorspace": img.colorspace
                } for img in report.images
            ]
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
