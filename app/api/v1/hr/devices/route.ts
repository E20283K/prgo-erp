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
      branchId,
      name,
      deviceCode,
      model = "Hikvision MinMoe",
      ipAddress,
      port = 80,
      username = "admin",
      password,
      direction = "in",
      location = "Asosiy kirish",
      metadata = {},
    } = body;

    const connectionMode = metadata.connectionMode || (Number(port) === 7660 ? "isup" : "isapi");
    const finalIp = (ipAddress && ipAddress.trim()) || (connectionMode === "isup" ? "ISUP-CLOUD" : "");
    const finalPassword = password || metadata.isupKey || "none";

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Qurilma nomi majburiy" },
        { status: 400 }
      );
    }

    if (connectionMode === "isapi" && (!finalIp || !password)) {
      return NextResponse.json(
        { success: false, error: "Lokal rejimda IP manzil va parol kiritilishi shart" },
        { status: 400 }
      );
    }

    const code =
      deviceCode?.trim() ||
      (connectionMode === "isup" && metadata.isupDeviceId
        ? metadata.isupDeviceId
        : `DEV-${Date.now().toString().slice(-4)}`);

    const [inserted] = await db
      .insert(biometricDevices)
      .values({
        companyId,
        branchId: branchId || null,
        name: name.trim(),
        deviceCode: code,
        model,
        ipAddress: finalIp,
        port: Number(port) || (connectionMode === "isup" ? 7660 : 80),
        username: username.trim(),
        password: finalPassword.trim(),
        direction,
        location: location?.trim() || "Asosiy kirish",
        isEnabled: true,
        status: "unknown",
        metadata: {
          connectionMode,
          isupDeviceId: metadata.isupDeviceId || code,
          isupKey: metadata.isupKey || "",
          protocol: metadata.protocol || "http",
          syncScope: metadata.syncScope || "branch",
          enrolledUsersCount: 0,
          ...metadata,
        },
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
