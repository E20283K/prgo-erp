import { NextRequest, NextResponse } from "next/server";
import { deleteCrmClient } from "@/lib/server/crmService";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const result = await deleteCrmClient(id, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Mijozni o'chirishda xatolik",
      },
      { status: 400 }
    );
  }
}
