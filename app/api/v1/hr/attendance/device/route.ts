import { NextRequest, NextResponse } from "next/server";
import { recordBiometricTurnstileEvent } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const { deviceId, badgeNumber, timestamp, eventType } = body;

    if (!badgeNumber) {
      return NextResponse.json({ success: false, message: "badgeNumber majburiy" }, { status: 400 });
    }

    const result = await recordBiometricTurnstileEvent(
      {
        deviceId: deviceId || "BIOMETRIC-TURNSTILE-01",
        badgeNumber,
        timestamp: timestamp || new Date().toISOString(),
        eventType: eventType || "auto",
      },
      companyCode
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}
