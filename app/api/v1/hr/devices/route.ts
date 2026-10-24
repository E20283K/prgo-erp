import { NextRequest, NextResponse } from "next/server";
import { getBiometricDevicesList } from "@/lib/server/hikvisionService";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { db } from "@/db";
import { biometricDevices } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const devices = await getBiometricDevicesList(companyCode);
    return NextResponse.json({ success: true, data: devices });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const companyId = await getCompanyIdByCode(companyCode);

    const body = await request.json();
    const {
      name,
      deviceCode,
      model = "Hikvision MinMoe",
      ipAddress,
      port = 80,
      username = "admin",
      password,
      direction = "in",
      location = "Asosiy kirish",
    } = body;

    if (!name || !ipAddress || !password) {
      return NextResponse.json(
        { success: false, error: "Nomi, IP manzili va paroli majburiy" },
        { status: 400 }
      );
    }

    const code =
      deviceCode?.trim() ||
      `DEV-${Date.now().toString().slice(-4)}`;

    const [inserted] = await db
      .insert(biometricDevices)
      .values({
        companyId,
        name: name.trim(),
        deviceCode: code,
        model,
        ipAddress: ipAddress.trim(),
        port: Number(port) || 80,
        username: username.trim(),
        password: password.trim(),
        direction,
        location: location.trim(),
        isEnabled: true,
        status: "unknown",
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: inserted,
      message: "Biometrik qurilma muvaffaqiyatli qo'shildi",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
