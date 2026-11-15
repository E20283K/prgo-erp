"""
Namuna PDF Fayllar Generatori: 3 xil poligrafiya namunasini yaratish
"""

import os
import io
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import CMYKColor, CMYKColorSep

MM_TO_PT = 72.0 / 25.4


def create_sample1_twins(output_path="sample1_twins_card.pdf"):
    """
    1-rasmga mos: Oldi va Orqa 2 sahifali birka dizayni.
    CMYK ranglar + rastr rasm (birida 300 DPI, ikkinchisida ogohlantirish uchun <300 DPI).
    O'lchami: 55 x 90 mm (+ 1.5 mm bleed = 58 x 93 mm).
    """
    w_pt = 58 * MM_TO_PT
    h_pt = 93 * MM_TO_PT

    # Rastr rasm yaratamiz (kichik rasm, DPI test uchun)
    img_low = Image.new("RGB", (100, 100), color=(220, 180, 160))
    img_low_bytes = io.BytesIO()
    img_low.save(img_low_bytes, format="PNG")
    img_low_bytes.seek(0)
    temp_img_path = "_temp_twins_art.png"
    img_low.save(temp_img_path)

    c = canvas.Canvas(output_path, pagesize=(w_pt, h_pt))

    # 1-sahifa: Oldi
    # Fon (sutrang/krem CMYK)
    c.setFillColor(CMYKColor(0.02, 0.05, 0.08, 0.0))
    c.rect(0, 0, w_pt, h_pt, fill=1, stroke=0)

    # Rastr rasm (30x30 mm o'lchamda joylashtiriladi -> 100px / (30/25.4)in ~= 84 DPI, Preflight DPI ogohlantirishini tekshirish uchun!)
    c.drawImage(temp_img_path, (w_pt - 30 * MM_TO_PT) / 2, h_pt * 0.55, width=30 * MM_TO_PT, height=30 * MM_TO_PT)

    # Vektor yozuv "Twins"
    c.setFillColor(CMYKColor(0.2, 0.45, 0.5, 0.2))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w_pt / 2.0, h_pt * 0.45, "Twins")

    # Pastki kichik ikonka
    c.setStrokeColor(CMYKColor(0.2, 0.45, 0.5, 0.2))
    c.setLineWidth(1)
    c.rect((w_pt - 8 * MM_TO_PT) / 2, h_pt * 0.25, 8 * MM_TO_PT, 8 * MM_TO_PT, fill=0, stroke=1)
    c.showPage()

    # 2-sahifa: Orqa
    c.setFillColor(CMYKColor(0.02, 0.05, 0.08, 0.0))
    c.rect(0, 0, w_pt, h_pt, fill=1, stroke=0)

    # Orqa tomon matnlari
    c.setFillColor(CMYKColor(0.2, 0.45, 0.5, 0.2))
    c.setFont("Helvetica", 6)
    c.drawCentredString(w_pt / 2.0, h_pt * 0.2, "www.twinsbaby.com")
    c.showPage()

    c.save()

    if os.path.exists(temp_img_path):
        os.remove(temp_img_path)
    print(f"Sample 1 yaratildi: {output_path}")


def create_sample2_rs(output_path="sample2_rs_birka.pdf"):
    """
    2-rasmga mos: 50 x 80 mm toza kesim birka dizayni.
    Pantone 280 C (to'q ko'k) va Pantone 11-0602 (sutrang) Spot ranglarida.
    Oraliq 0 mm (yakka krop) bilan montaj qilinadi.
    """
    w_pt = 50 * MM_TO_PT
    h_pt = 80 * MM_TO_PT

    c = canvas.Canvas(output_path, pagesize=(w_pt, h_pt))

    # Spot ranglar
    color_bg = CMYKColorSep(0.02, 0.04, 0.08, 0.0, spotName="PANTONE 11-0602 C", density=1.0)
    color_rs = CMYKColorSep(1.0, 0.85, 0.05, 0.35, spotName="PANTONE 280 C", density=1.0)

    # Fon
    c.setFillColor(color_bg)
    c.rect(0, 0, w_pt, h_pt, fill=1, stroke=0)

    # Markaziy "RS" logotipi va yozuvi
    c.setFillColor(color_rs)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w_pt / 2.0, h_pt * 0.5, "RS")

    c.setFont("Helvetica-Bold", 5)
    c.drawCentredString(w_pt / 2.0, h_pt * 0.43, "RAVSHAN & KOMFORT")

    c.showPage()
    c.save()
    print(f"Sample 2 yaratildi: {output_path}")


def create_sample3_packaging(
    design_output="sample3_label_design.pdf",
    dieline_output="sample3_label_dieline.pdf"
):
    """
    3-rasmga mos: 100 x 75 mm toza kesim mahsulot + 1.5 mm bleed = 103 x 78 mm dizayn.
    Rang: PANTONE 1655 C Spot rangi (to'q to'q sariq).
    Alohida Pichoq (Die-cut) fayli bilan: qizil kesish to'g'ri to'rtburchagi, yashil buklash chizig'i, 2 ta teshik.
    """
    # 1. Dizayn fayli (103 x 78 mm)
    w_des_pt = 103 * MM_TO_PT
    h_des_pt = 78 * MM_TO_PT

    c_des = canvas.Canvas(design_output, pagesize=(w_des_pt, h_des_pt))
    color_orange = CMYKColorSep(0.0, 0.65, 1.0, 0.0, spotName="PANTONE 1655 C", density=1.0)

    # Oq fon
    c_des.setFillColor(CMYKColor(0, 0, 0, 0))
    c_des.rect(0, 0, w_des_pt, h_des_pt, fill=1, stroke=0)

    # Yuqori-o'ng burchakdagi to'q sariq chorak doira (bleed chetigacha chiqadi)
    c_des.setFillColor(color_orange)
    c_des.setStrokeColor(color_orange)
    radius_pt = 32 * MM_TO_PT
    c_des.circle(w_des_pt, h_des_pt, radius_pt, fill=1, stroke=0)

    # 3 ta nuqta
    dot_r = 2.0 * MM_TO_PT
    c_des.circle(12 * MM_TO_PT, h_des_pt - 15 * MM_TO_PT, dot_r, fill=1, stroke=0)
    c_des.circle(12 * MM_TO_PT, h_des_pt - 21 * MM_TO_PT, dot_r, fill=1, stroke=0)
    c_des.circle(12 * MM_TO_PT, h_des_pt - 27 * MM_TO_PT, dot_r, fill=1, stroke=0)

    # Matn "L-XL (48-50)"
    c_des.setFont("Helvetica-Bold", 8)
    c_des.drawRightString(w_des_pt - 18 * MM_TO_PT, 20 * MM_TO_PT, "L-XL")
    c_des.setFont("Helvetica", 6)
    c_des.drawRightString(w_des_pt - 18 * MM_TO_PT, 12 * MM_TO_PT, "(48-50)")

    c_des.showPage()
    c_des.save()
    print(f"Sample 3 Dizayn yaratildi: {design_output}")

    # 2. Pichoq (Die-line) fayli (100 x 75 mm toza o'lchamda)
    w_die_pt = 100 * MM_TO_PT
    h_die_pt = 75 * MM_TO_PT

    c_die = canvas.Canvas(dieline_output, pagesize=(w_die_pt, h_die_pt))

    # Kesish chizig'i (Cut / DieLine - Qizil/Magenta Spot yoki CMYK M=1, Y=1)
    color_cut = CMYKColorSep(0.0, 1.0, 1.0, 0.0, spotName="DieLine_Cut", density=1.0)
    c_die.setStrokeColor(color_cut)
    c_die.setLineWidth(0.7) # 0.25 mm
    c_die.rect(0.5, 0.5, w_die_pt - 1, h_die_pt - 1, fill=0, stroke=1)

    # O'rtadagi buklash (Crease - Yashil Spot yoki CMYK C=1, Y=1)
    color_crease = CMYKColorSep(1.0, 0.0, 1.0, 0.0, spotName="DieLine_Crease", density=1.0)
    c_die.setStrokeColor(color_crease)
    c_die.setLineWidth(0.5)
    c_die.line(0, h_die_pt / 2.0, w_die_pt, h_die_pt / 2.0)

    # Chap qirradagi 2 ta teshik (Holes / Punches)
    hole_r = 1.5 * MM_TO_PT
    c_die.setStrokeColor(color_cut)
    c_die.circle(5 * MM_TO_PT, (h_die_pt / 2.0) + 4 * MM_TO_PT, hole_r, fill=0, stroke=1)
    c_die.circle(5 * MM_TO_PT, (h_die_pt / 2.0) - 4 * MM_TO_PT, hole_r, fill=0, stroke=1)

    c_die.showPage()
    c_die.save()
    print(f"Sample 3 Pichoq yaratildi: {dieline_output}")


if __name__ == "__main__":
    create_sample1_twins()
    create_sample2_rs()
    create_sample3_packaging()
