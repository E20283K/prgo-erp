import { NextRequest, NextResponse } from "next/server";
import { triggerRemoteDoorOpen } from "@/lib/server/hikvisionService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await triggerRemoteDoorOpen(id);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
