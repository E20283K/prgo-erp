from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class PositionItem(BaseModel):
    x: float
    y: float
    width: float
    height: float

class MarkItem(BaseModel):
    type: str
    x: float
    y: float
    width: float
    height: float

class ColorItem(BaseModel):
    name: str
    hex: Optional[str] = None

class FlexoPdfRequest(BaseModel):
    docNo: str = "CO-FLEXO"
    orderName: str = "Flexo Order"
    customer: str = "General Client"
    productName: str = "Flexo Printed Label"
    machineName: str = "Flexo Press"
    materialName: str = "Satin"
    webWidth: float
    usablePrintWidth: float
    sideWasteWidth: float = 0
    productWidth: float
    productHeight: float
    orientation: str = "normal"
    gearTeeth: int
    cylinderDiameter: float
    plateThickness: float
    printingLength: float
    filmLength: float
    pitchCircleDiameter: float
    acrossCount: int
    aroundCount: int
    requiredQuantity: int
    overproductionValue: float = 0
    overproductionMode: str = "percent"
    productionTargetQuantity: int
    actualYieldQuantity: int
    repeatCount: int
    materialConsumptionMeters: float
    materialConsumptionSqM: float
    yieldPercent: float
    wasteSqM: float
    colors: List[ColorItem] = Field(default_factory=list)
    positions: List[PositionItem] = Field(default_factory=list)
    marks: List[MarkItem] = Field(default_factory=list)
    qrData: Optional[str] = None
    barcodeData: Optional[str] = None
    saveToS3: bool = False
    s3Key: Optional[str] = None

class TechCardRequest(BaseModel):
    clientName: str = "BIRYUZA GROUP"
    orderNo: str = "1470 ZAKAZ"
    productName: Optional[str] = "KARTON ETIKETKA"
    frontImageUrl: Optional[str] = None
    backImageUrl: Optional[str] = None
    frontImageBase64: Optional[str] = None
    backImageBase64: Optional[str] = None
    shapeType: str = "chamfer"  # "chamfer", "rectangle", "rounded"
    widthMm: float = 50.0
    heightMm: float = 125.0
    cornerCutMm: float = 8.0
    holeDiameterMm: float = 4.0
    hasHole: bool = True
    embellishments: List[str] = Field(default_factory=list)
    paperStock: Optional[str] = None
    finishing: Optional[str] = None
    quantity: Optional[str] = None
class TableExportRequest(BaseModel):
    title: str = "PrintGoo ERP Report"
    subtitle: Optional[str] = None
    headers: List[str]
    rows: List[List[Any]]
    saveToS3: bool = False
    s3Key: Optional[str] = None

class JobTicketOperationItem(BaseModel):
    id: Optional[str] = None
    stepNumber: int = 10
    name: str
    machine: str = "—"
    operator: str = "—"
    duration: float = 0
    qtyCompleted: Optional[str] = None
    status: str = "Queued"
    # The step's plan in its own counting unit (sheets, metres or pieces), for the output report.
    plannedQty: Optional[float] = None
    planUnit: Optional[str] = None

class PalletPassportItemData(BaseModel):
    id: Optional[str] = None
    palletNumber: int
    palletCode: str
    totalPallets: int
    plannedSheets: int

class PalletPassportPdfRequest(BaseModel):
    workOrderNo: str = "WO-00772"
    clientOrderNo: Optional[str] = None
    customer: str = "—"
    product: str = "—"
    department: str = "Offset"
    deadline: Optional[str] = "—"
    paperStock: str = "—"
    pressSheetW: Optional[float] = None
    pressSheetH: Optional[float] = None
    colorsConfig: Optional[str] = "4+0"
    totalQuantity: int = 5000
    pallets: List[PalletPassportItemData] = Field(default_factory=list)
    operations: List[JobTicketOperationItem] = Field(default_factory=list)
    saveToS3: bool = False
    s3Key: Optional[str] = None

class BoxLabelItemData(BaseModel):
    id: Optional[str] = None
    boxNumber: int
    boxCode: str
    model: Optional[str] = None
    sizeCode: Optional[str] = None
    quantity: int = 0
    grossWeightKg: Optional[float] = None
    packerName: Optional[str] = None
    packedAt: Optional[str] = None
    barcode: Optional[str] = None
    notes: Optional[str] = None

class BoxLabelsPdfRequest(BaseModel):
    workOrderNo: str = "WO-00351"
    clientOrderNo: Optional[str] = None
    customer: str = "—"
    product: str = "—"
    totalBoxes: int = 1
    boxes: List[BoxLabelItemData] = Field(default_factory=list)
    saveToS3: bool = False
    s3Key: Optional[str] = None

class ImpositionCellData(BaseModel):
    index: int = 0
    row: int = 0
    col: int = 0
    x: float
    y: float
    itemW: float
    itemH: float
    label: str = ""
    model: Optional[str] = None
    sizeCode: Optional[str] = None
    color: str = "#dbeafe"
    sizeId: str = "empty"
    sideBadge: Optional[str] = "FRONT"
    artworkUrl: Optional[str] = None
    rawArtworkUrl: Optional[str] = None

class ImpositionPageData(BaseModel):
    plateName: str = "Forma 1"
    plateIndex: int = 0
    totalPlates: int = 1
    sideLabel: str = "OLDI"
    requiredSheets: int = 100
    cells: List[ImpositionCellData] = Field(default_factory=list)

class ImpositionPdfRequest(BaseModel):
    docNo: str = "WOOF-26-0001"
    orderName: str = "Client Order"
    pressMachine: str = "Offset Press"
    paperStock: str = "300 g/m²"
    sheetW: float = 500.0
    sheetH: float = 350.0
    prodW: float = 50.0
    prodH: float = 90.0
    bleed: float = 2.0
    gap: float = 4.0
    gripper: float = 10.0
    activeGripperEdge: str = "Bottom"
    gridLeft: float = 10.0
    gridTop: float = 10.0
    cols: int = 1
    rows: int = 1
    itemW: float = 54.0
    itemH: float = 94.0
    shapeType: Optional[str] = "rectangle"
    customShape: Optional[str] = None
    customSvgPath: Optional[str] = None
    parsedSvgPathD: Optional[str] = None
    parsedSvgViewBox: Optional[Dict[str, float]] = None
    cornerType: Optional[str] = None
    holeSize: Optional[float] = None
    holePosition: Optional[str] = None
    holeOffset: Optional[float] = None
    splitCutAxisX: Optional[float] = None
    splitAxisLabel: Optional[str] = None
    outerTrimMarks: List[Dict[str, float]] = Field(default_factory=list)
    pages: List[ImpositionPageData] = Field(default_factory=list)
    saveToS3: bool = False
    s3Key: Optional[str] = None




class SideColorAnalysis(BaseModel):
    hasContent: bool = False
    c: bool = False
    m: bool = False
    y: bool = False
    k: bool = False
    spotColors: List[str] = Field(default_factory=list)
    colorCount: int = 0
    formula: str = "0"


class ArtworkAnalysisRequest(BaseModel):
    url: Optional[str] = None
    dataUrl: Optional[str] = None
    backUrl: Optional[str] = None
    backDataUrl: Optional[str] = None


class ArtworkAnalysisResponse(BaseModel):
    success: bool = True
    front: SideColorAnalysis
    back: Optional[SideColorAnalysis] = None
    hasBackSide: bool = False
    technicalDielines: List[str] = Field(default_factory=list)
    commercialSpotColors: List[str] = Field(default_factory=list)
    detectedFormula: str = "1+0"
    pageCount: int = 1
    widthMm: Optional[float] = None
    heightMm: Optional[float] = None
    bleedMm: Optional[float] = None
    # Full page (MediaBox) size and where widthMm/heightMm came from: "trimbox" | "standard" | "page"
    pageWidthMm: Optional[float] = None
    pageHeightMm: Optional[float] = None
    sizeSource: Optional[str] = None
    notes: Optional[str] = None


class OrderCardSize(BaseModel):
    id: Optional[str] = None
    size: str = ""
    sizeCode: Optional[str] = None
    model: Optional[str] = None
    quantity: float = 0


class OrderCardLayer(BaseModel):
    label: Optional[str] = None
    paperStock: Optional[str] = None
    grammage: float = 0
    colors: Optional[str] = None


class OrderCardSpot(BaseModel):
    name: str = ""
    code: Optional[str] = None
    hex: Optional[str] = None
    side: Optional[str] = None


class OrderCardOperation(BaseModel):
    stepNumber: int = 0
    name: str = ""
    machine: Optional[str] = None
    operator: Optional[str] = None
    # The step's plan in its own counting unit (sheets, metres or pieces)
    plannedQty: Optional[float] = None
    planUnit: Optional[str] = None


class OrderCardMaterial(BaseModel):
    name: str = ""
    spec: Optional[str] = None
    planQty: float = 0
    unit: Optional[str] = None


class OrderCardRequest(BaseModel):
    """Work order passport: page 1 is the visual card sent to the Telegram orders
    group, page 2 the production sheet (route, materials, press run)."""
    docNo: str = ""
    clientName: str = ""
    productName: Optional[str] = None
    itemCategory: Optional[str] = None
    quantity: float = 0
    unit: Optional[str] = None
    orderDate: Optional[str] = None
    deadline: Optional[str] = None
    statusLabel: Optional[str] = None
    stageLabel: Optional[str] = None

    width: Optional[float] = None
    height: Optional[float] = None
    bleed: Optional[float] = 0
    shapeType: Optional[str] = None
    cornerType: Optional[str] = None
    cornerRadius: Optional[float] = None
    holeSize: Optional[float] = 0
    holePosition: Optional[str] = None
    holeOffset: Optional[float] = 0

    paperStock: Optional[str] = None
    grammage: Optional[float] = None
    targetGsm: Optional[float] = None
    kashirovkaMode: Optional[str] = None
    kashirovkaLayers: List[OrderCardLayer] = Field(default_factory=list)
    kashirovkaTotalGsm: Optional[float] = None

    colorsConfig: Optional[str] = None
    frontColors: Optional[Dict[str, Any]] = None
    backColors: Optional[Dict[str, Any]] = None
    spotColorItems: List[OrderCardSpot] = Field(default_factory=list)

    lamination: Optional[str] = None
    laminationSides: Optional[str] = None
    laminationMicron: Optional[float] = None
    coating: Optional[str] = None
    coatingZone: Optional[str] = None
    embellishment: Optional[str] = None

    sizes: List[OrderCardSize] = Field(default_factory=list)
    skuArtworks: List[Dict[str, Any]] = Field(default_factory=list)
    artworkFront: Optional[str] = None
    artworkBack: Optional[str] = None

    notes: Optional[str] = None
    customNote: Optional[str] = None
    erpUrl: Optional[str] = None
    # Header logo: "printgoo" (default), "label" or "none"
    logo: Optional[str] = None

    # Page 2: production sheet
    department: Optional[str] = None
    pressMachine: Optional[str] = None
    operations: List[OrderCardOperation] = Field(default_factory=list)
    materials: List[OrderCardMaterial] = Field(default_factory=list)
    itemsPerSheet: Optional[int] = None
    pressSheets: Optional[int] = None
    parentSheets: Optional[int] = None
    forms: Optional[int] = None
    makeReadySheets: Optional[int] = None
    effectivePieces: Optional[int] = None
    plateCalculations: List[Dict[str, Any]] = Field(default_factory=list)
    # 1 = card only (chat preview), 2 = card + production sheet
    pages: int = 2

    format: str = "png"
    dpi: int = 200
