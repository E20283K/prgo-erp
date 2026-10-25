import { NextRequest, NextResponse } from "next/server";
import { recordBiometricTurnstileEvent } from "@/lib/server/hrService";
import { db } from "@/db";
import { biometricDevices } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ─── Debounce Anti-Spam Cache ────────────────────────────────────────────────
// Bir xil xodimning 2 daqiqa (120 soniya) ichidagi takroriy skanlarini filtrlash
const DEBOUNCE_WINDOW_MS = 2 * 60 * 1000;
const recentScanCache = new Map<string, number>();

function isDebounced(key: string, scanTimeMs: number): boolean {
  // Tozalash: 1000 dan oshsa eski yozuvlarni tozalaymiz
  if (recentScanCache.size > 1000) {
    const cutoff = Date.now() - DEBOUNCE_WINDOW_MS;
    for (const [k, timestamp] of recentScanCache.entries()) {
      if (timestamp < cutoff) recentScanCache.delete(k);
    }
  }

  const lastTime = recentScanCache.get(key);
  if (lastTime && Math.abs(scanTimeMs - lastTime) < DEBOUNCE_WINDOW_MS) {
    return true;
  }

  recentScanCache.set(key, scanTimeMs);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    // 1. Gateway Secret Himoyasi
    const expectedSecret = process.env.GATEWAY_SECRET || "printgoo_isup_secret_2026";
    const incomingSecret = request.headers.get("x-gateway-secret");
    if (incomingSecret && incomingSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Noto'g'ri gateway maxfiy kaliti (Unauthorized)" },
        { status: 403 }
      );
    }

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
        for (const [_, value] of formData.entries()) {
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

    const cleanBadge = String(badgeNumber).trim();
    const eventTime = payload.dateTime || acEvent.dateTime || new Date().toISOString();
    const eventTimeMs = new Date(eventTime).getTime();
    const deviceIp = payload.ipAddress || "";
    const deviceName = acEvent.deviceName || payload.deviceName || payload.ipAddress || "HIKVISION-TERMINAL";

    // 2. Lookup device to determine direction (in/out) and update lastSeenAt
    let eventType: "check_in" | "check_out" | "auto" = "auto";
    const matchedDevice = await db.query.biometricDevices.findFirst({
      where: or(
        deviceIp ? eq(biometricDevices.ipAddress, deviceIp) : undefined,
        deviceName ? eq(biometricDevices.deviceCode, deviceName) : undefined,
        deviceName ? eq(biometricDevices.name, deviceName) : undefined
      ),
    });

    if (matchedDevice) {
      if (matchedDevice.direction === "in") eventType = "check_in";
      else if (matchedDevice.direction === "out") eventType = "check_out";

      // Mark device online & update lastSeen
      await db
        .update(biometricDevices)
        .set({ status: "online", lastSeenAt: new Date(), updatedAt: new Date() })
        .where(eq(biometricDevices.id, matchedDevice.id));
    }

    // 3. Debounce Check: Bir xil xodimning qisqa vaqtdagi qayta qarashini filtrlash
    const debounceKey = `${companyCode}:${cleanBadge}:${eventType}`;
    if (isDebounced(debounceKey, eventTimeMs)) {
      return NextResponse.json({
        success: true,
        debounced: true,
        message: "Takroriy o'tish filtrlandi (Debounce cooldown)",
        badgeNumber: cleanBadge,
        eventTime,
      });
    }

    // 4. Record attendance event to T-13
    const result = await recordBiometricTurnstileEvent(
      {
        deviceId: matchedDevice ? matchedDevice.name : deviceName,
        badgeNumber: cleanBadge,
        timestamp: eventTime,
        eventType,
      },
      companyCode
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      badgeNumber: cleanBadge,
      eventTime,
      eventType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Hikvision hodisasini qayta ishlashda xatolik" },
      { status: 500 }
    );
  }
}
