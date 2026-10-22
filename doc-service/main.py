from datetime import datetime
from fastapi import FastAPI
from app.core.fonts import FONT_REGULAR
from app.routers import pdf, office

app = FastAPI(
    title="PrintGoo Document Generation Service",
    description="Microservice for generating PDF (ReportLab), DOCX, XLSX, QR codes, and Barcodes",
    version="2.0.0",
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "printgoo-doc-service",
        "font": FONT_REGULAR,
        "timestamp": datetime.utcnow().isoformat(),
    }

# Register Routers
app.include_router(pdf.router)
app.include_router(office.router)
