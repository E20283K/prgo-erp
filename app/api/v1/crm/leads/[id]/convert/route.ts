import { NextRequest, NextResponse } from "next/server";
import { convertLeadToClient } from "@/lib/server/leadService";

export const dynamic = "force-dynamic";

/** Lead → CRM client: links the lead to the client it became (existing or newly created). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await convertLeadToClient(id, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Lidni mijozga aylantirishda xatolik",
      },
      { status: 422 }
    );
  }
}
