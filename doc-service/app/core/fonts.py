import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

DEJAVU_REGULAR_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
DEJAVU_BOLD_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]

for reg_path, bold_path in zip(DEJAVU_REGULAR_PATHS, DEJAVU_BOLD_PATHS):
    if os.path.exists(reg_path) and os.path.exists(bold_path):
        pdfmetrics.registerFont(TTFont("CustomSans", reg_path))
        pdfmetrics.registerFont(TTFont("CustomSans-Bold", bold_path))
        FONT_REGULAR = "CustomSans"
        FONT_BOLD = "CustomSans-Bold"
        break
