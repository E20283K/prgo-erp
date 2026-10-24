import { NextRequest, NextResponse } from "next/server";
import { recordBiometricTurnstileEvent } from "@/lib/server/hrService";
import { db } from "@/db";
import { biometricDevices } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const contentType = request.headers.get("content-type") || "";
    let rawJsonText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      // Hikvision sends event payload in 'event_log' or 'AccessControllerEvent' or 'event'
      const eventFile =
        formData.get("event_log") ||
        formData.get("AccessControllerEvent") ||
        formData.get("event") ||
        formData.get("uploadEvent") ||
        formData.get("data");

      if (typeof eventFile === "string") {
        rawJsonText = eventFile;
      } else if (eventFile && typeof (eventFile as any).text === "function") {
        rawJsonText = await (eventFile as any).text();
      } else {
        // Find first text part in formData
        for (const [key, value] of formData.entries()) {
          if (typeof value === "string" && value.includes("{")) {
            rawJsonText = value;
            break;
          }
        }
      }
    } else {
      rawJsonText = await request.text();
    }

    if (!rawJsonText || !rawJsonText.trim()) {
      return NextResponse.json({ success: false, message: "Bo'sh hodisa (No event payload)" }, { status: 400 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawJsonText);
    } catch {
      return NextResponse.json({ success: false, message: "Yaroqsiz JSON format" }, { status: 400 });
    }

    // Extract Hikvision fields
    const acEvent = payload.AccessControllerEvent || payload;
    const badgeNumber =
      acEvent.employeeNoString ||
      acEvent.employeeNo ||
      acEvent.cardNo ||
      payload.employeeNoString ||
      payload.employeeNo ||
      payload.badgeNumber;

    if (!badgeNumber) {
      // Event may be heartbeat or door bell without user
      return NextResponse.json({
        success: true,
        message: "Xodim identifikatori yo'q bo'lgan texnik hodisa qabul qilindi",
      });
    }

    const eventTime = payload.dateTime || acEvent.dateTime || new Date().toISOString();
    const deviceIp = payload.ipAddress || "";
    const deviceName = acEvent.deviceName || payload.deviceName || "HIKVISION-TERMINAL";

    // Lookup device to determine direction (in/out)
    let eventType: "check_in" | "check_out" | "auto" = "auto";
    if (deviceIp) {
      const matchedDevice = await db.query.biometricDevices.findFirst({
        where: eq(biometricDevices.ipAddress, deviceIp),
      });

      if (matchedDevice) {
        if (matchedDevice.direction === "in") eventType = "check_in";
        else if (matchedDevice.direction === "out") eventType = "check_out";

        // Update lastSeenAt
        await db
          .update(biometricDevices)
          .set({ status: "online", lastSeenAt: new Date(), updatedAt: new Date() })
          .where(eq(biometricDevices.id, matchedDevice.id));
      }
    }

    // Record attendance event to T-13
    const result = await recordBiometricTurnstileEvent(
      {
        deviceId: deviceName,
        badgeNumber: String(badgeNumber).trim(),
        timestamp: eventTime,
        eventType,
      },
      companyCode
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      badgeNumber,
      eventTime,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Hikvision hodisasini qayta ishlashda xatolik" },
      { status: 500 }
    );
  }
}
