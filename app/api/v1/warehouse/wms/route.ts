import { NextRequest, NextResponse } from "next/server";
import {
  getWarehouseWmsLayout,
  upsertWmsRack,
  deleteWmsRack,
  upsertWmsZone,
  deleteWmsZone,
  updateWmsElementsPositions,
  modifyWmsBinStructure,
  upsertWmsBinItem,
  moveWmsBinItem,
  removeWmsBinItem,
} from "@/lib/server/wmsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const data = await getWarehouseWmsLayout(warehouseId, companyCode);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "WMS ma'lumotlarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";
    const body = await request.json();
    const action = body.action || "upsert-rack";

    let result;
    if (action === "upsert-rack") {
      result = await upsertWmsRack(body.data || body, companyCode);
    } else if (action === "delete-rack") {
      result = await deleteWmsRack(body.rackId || body.id, companyCode);
    } else if (action === "upsert-zone") {
      result = await upsertWmsZone(body.data || body, companyCode);
    } else if (action === "delete-zone") {
      result = await deleteWmsZone(body.zoneId || body.id, companyCode);
    } else if (action === "batch-positions") {
      result = await updateWmsElementsPositions(body.updates || [], companyCode);
    } else if (action === "modify-bin") {
      result = await modifyWmsBinStructure(body.subAction || "update", body.data || body, companyCode);
    } else if (action === "upsert-bin-item") {
      result = await upsertWmsBinItem(body.data || body, companyCode);
    } else if (action === "move-bin-item") {
      result = await moveWmsBinItem(body.data || body, companyCode);
    } else if (action === "remove-bin-item") {
      result = await removeWmsBinItem(body.itemId || body.id, companyCode);
    } else {
      return NextResponse.json(
        { success: false, error: "Noma'lum WMS amali: " + action },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "WMS amalini bajarishda xatolik",
      },
      { status: 500 }
    );
  }
}
