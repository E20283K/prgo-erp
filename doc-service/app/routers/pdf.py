from fastapi import APIRouter
from app.schemas.documents import (
    FlexoPdfRequest,
    JobTicketPdfRequest,
    PalletPassportPdfRequest,
    BoxLabelsPdfRequest,
    ImpositionPdfRequest,
)
from app.generators.flexo_spec import generate_flexo_pdf
from app.generators.job_ticket import generate_job_ticket_pdf
from app.generators.pallet_passport import generate_pallet_passport_pdf
from app.generators.box_labels import generate_box_labels_pdf
from app.generators.imposition import generate_imposition_pdf

router = APIRouter(prefix="/generate/pdf", tags=["PDF Generation"])

@router.post("/flexo-spec")
def flexo_spec_endpoint(req: FlexoPdfRequest):
    return generate_flexo_pdf(req)

@router.post("/job-ticket")
def job_ticket_endpoint(req: JobTicketPdfRequest):
    return generate_job_ticket_pdf(req)

@router.post("/pallet-passport")
def pallet_passport_endpoint(req: PalletPassportPdfRequest):
    return generate_pallet_passport_pdf(req)

@router.post("/box-labels")
def box_labels_endpoint(req: BoxLabelsPdfRequest):
    return generate_box_labels_pdf(req)

@router.post("/imposition")
def imposition_endpoint(req: ImpositionPdfRequest):
    return generate_imposition_pdf(req)


