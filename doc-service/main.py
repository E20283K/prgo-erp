from datetime import datetime
from fastapi import FastAPI
from app.core.fonts import FONT_REGULAR
from app.routers import pdf, office
from app.schemas.documents import ArtworkAnalysisRequest, ArtworkAnalysisResponse
from app.generators.artwork_analyzer import analyze_artwork_payload

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

@app.post("/api/pdf/analyze-artwork", response_model=ArtworkAnalysisResponse)
def direct_analyze_artwork(req: ArtworkAnalysisRequest):
    return analyze_artwork_payload(req)

# Register Routers
app.include_router(pdf.router)
app.include_router(office.router)
