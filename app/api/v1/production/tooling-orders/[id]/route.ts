import { NextRequest, NextResponse } from "next/server";
import { deleteSupplierOrder } from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await deleteSupplierOrder(id, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tooling order delete error:", error);
    const message =
      error instanceof Error ? error.message : "Buyurtmani o'chirishda xatolik";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Buyurtma topilmadi" ? 404 : 500 }
    );
  }
}
