from fastapi import APIRouter
from app.schemas.documents import TableExportRequest
from app.generators.office_export import generate_xlsx, generate_docx

router = APIRouter(prefix="/generate", tags=["Office Exports"])

@router.post("/xlsx")
def export_xlsx_endpoint(req: TableExportRequest):
    return generate_xlsx(req)

@router.post("/docx")
def export_docx_endpoint(req: TableExportRequest):
    return generate_docx(req)
