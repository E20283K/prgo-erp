import { NextRequest, NextResponse } from "next/server";
import { getWarehouseShipments, upsertWarehouseShipment } from "@/lib/server/warehouseService";
import { getRequestActor, errorHttpStatus } from "@/lib/server/requestActor";
import { requireApiUser, WAREHOUSE_READ, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

    const data = await getWarehouseShipments(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Chiqim orderlarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [...WAREHOUSE_WRITE, ["trading", "create"], ["trading", "edit"]]);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

    const actor = await getRequestActor(request);
    const result = await upsertWarehouseShipment(body, companyCode, actor);
    return NextResponse.json({
      success: true,
      data: result.allShipments,
      shipment: result.shipment,
      shipmentNumber: result.shipmentNumber,
      deliveryActId: result.deliveryActId,
      status: result.nextStatus,
    });
  } catch (error) {
    const status = errorHttpStatus(error);
    if (status === 500) console.error("[POST /api/v1/warehouse/shipments]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Chiqim orderini saqlashda xatolik",
      },
      { status }
    );
  }
}
