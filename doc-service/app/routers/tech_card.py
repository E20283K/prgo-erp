from fastapi import APIRouter, Response
from app.schemas.documents import TechCardRequest
from app.generators.tech_card import generate_tech_card_png

router = APIRouter(prefix="/api/pdf", tags=["Tech Card Generation"])

@router.post("/generate-tech-card")
def generate_tech_card_endpoint(req: TechCardRequest):
    png_bytes = generate_tech_card_png(req)
    return Response(content=png_bytes, media_type="image/png")
