import { NextRequest, NextResponse } from "next/server";
import {
  getAllToolingOrders,
  upsertSupplierOrder,
} from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const orders = await getAllToolingOrders(companyCode);

    return NextResponse.json({
      success: true,
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    console.error("Tooling orders fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Qolip va CTP buyurtmalarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    // Server-side validation: tooling orders must have an attached file if not Draft
    const isDraft = body.status === "Draft";
    const hasFile = Boolean(body.fileUrl || body.fileName);
    if (!isDraft && !hasFile) {
      return NextResponse.json(
        {
          success: false,
          error: "Buyurtma berish uchun jihoz chizma fayli biriktirilishi shart",
        },
        { status: 400 }
      );
    }

    const result = await upsertSupplierOrder(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tooling order upsert error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Qolip va CTP buyurtmasini saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}
