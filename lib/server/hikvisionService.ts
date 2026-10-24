import crypto from "crypto";
import { db } from "@/db";
import { biometricDevices, employees } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { BiometricDeviceRecord } from "@/components/documents/hr/types";
import { getCompanyIdByCode } from "./crmService";

// Helper: Calculate Hikvision Digest Authentication header
function getDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  authHeader: string
): string {
  const realmMatch = authHeader.match(/realm="([^"]+)"/);
  const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
  const qopMatch = authHeader.match(/qop="([^"]+)"/);

  const realm = realmMatch ? realmMatch[1] : "";
  const nonce = nonceMatch ? nonceMatch[1] : "";
  const qop = qopMatch ? qopMatch[1] : "";

  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");

  const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");

  let response: string;
  if (qop) {
    response = crypto
      .createHash("md5")
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest("hex");
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  } else {
    response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  }
}

// Low-level ISAPI request sender with Digest Auth support
export async function sendHikvisionRequest(
  device: { ipAddress: string; port: number; username: string; password: string },
  method: string,
  path: string,
  body?: string | FormData,
  contentType: string = "application/json"
): Promise<{ status: number; text: string; json?: any }> {
  const url = `http://${device.ipAddress}:${device.port}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    // 1st attempt (without auth or Basic)
    const basicAuth = Buffer.from(`${device.username}:${device.password}`).toString("base64");
    const firstRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        ...(typeof body === "string" ? { "Content-Type": contentType } : {}),
      },
      body: body as any,
      signal: controller.signal,
    });

    if (firstRes.status !== 401) {
      clearTimeout(timeoutId);
      const text = await firstRes.text();
      let json: any = undefined;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: firstRes.status, text, json };
    }

    // If 401, check WWW-Authenticate for Digest
    const wwwAuth = firstRes.headers.get("www-authenticate");
    if (!wwwAuth || !wwwAuth.toLowerCase().includes("digest")) {
      clearTimeout(timeoutId);
      return { status: 401, text: "Unauthorized: Digest header missing" };
    }

    // 2nd attempt with Digest header
    const digestHeader = getDigestHeader(method, path, device.username, device.password, wwwAuth);
    const secondRes = await fetch(url, {
      method,
      headers: {
        Authorization: digestHeader,
        ...(typeof body === "string" ? { "Content-Type": contentType } : {}),
      },
      body: body as any,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await secondRes.text();
    let json: any = undefined;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: secondRes.status, text, json };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(
      err.name === "AbortError"
        ? `Qurilma bilan aloqa vaqti tugadi (Timeout: ${device.ipAddress}:${device.port})`
        : `Qurilmaga ulanib bo'lmadi (${device.ipAddress}:${device.port}): ${err.message}`
    );
  }
}

// ─── 1. Devices CRUD & Health Check ───────────────────────────────────────────

export async function getBiometricDevicesList(
  companyCode: string = "PRINTGOO"
): Promise<BiometricDeviceRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const list = await db.query.biometricDevices.findMany({
    where: eq(biometricDevices.companyId, companyId),
    orderBy: [desc(biometricDevices.createdAt)],
  });

  return list.map((d) => ({
    id: d.id,
    name: d.name,
    deviceCode: d.deviceCode,
    model: d.model,
    ipAddress: d.ipAddress,
    port: d.port,
    username: d.username,
    direction: d.direction as "in" | "out" | "both",
    location: d.location || "Asosiy kirish",
    isEnabled: d.isEnabled,
    lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    status: (d.status as any) || "unknown",
    metadata: d.metadata as any,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function testDeviceConnection(
  deviceId: string
): Promise<{ success: boolean; message: string; deviceInfo?: any }> {
  const device = await db.query.biometricDevices.findFirst({
    where: eq(biometricDevices.id, deviceId),
  });

  if (!device) {
    return { success: false, message: "Qurilma topilmadi" };
  }

  try {
    const res = await sendHikvisionRequest(device, "GET", "/ISAPI/System/deviceInfo");
    if (res.status >= 200 && res.status < 300) {
      await db
        .update(biometricDevices)
        .set({
          status: "online",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(biometricDevices.id, device.id));

      return {
        success: true,
        message: "Aloqa muvaffaqiyatli o'rnatildi (Online)",
        deviceInfo: res.json || res.text,
      };
    } else {
      await db
        .update(biometricDevices)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(biometricDevices.id, device.id));

      return {
        success: false,
        message: `Qurilma xatolik qaytardi (HTTP ${res.status}): ${res.text.slice(0, 100)}`,
      };
    }
  } catch (err: any) {
    await db
      .update(biometricDevices)
      .set({ status: "offline", updatedAt: new Date() })
      .where(eq(biometricDevices.id, device.id));

    return { success: false, message: err.message };
  }
}

// ─── 2. Employee User & Face Sync ─────────────────────────────────────────────

/**
 * Xodim ma'lumotlari va yuz suratini bitta Hikvision terminaliga yuklash
 */
export async function syncEmployeeToDevice(
  device: { id: string; ipAddress: string; port: number; username: string; password: string; name: string },
  emp: { id: string; badgeNumber: string; fullName: string; avatarUrl?: string | null }
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. UserInfo Record qo'shish/yangilash
    const userInfoPayload = JSON.stringify({
      UserInfo: {
        employeeNo: emp.badgeNumber,
        name: emp.fullName.slice(0, 32),
        userType: "normal",
        closeDelayEnabled: false,
        Valid: {
          enable: true,
          beginTime: "2026-01-01T00:00:00",
          endTime: "2036-12-31T23:59:59",
          timeType: "local",
        },
        doorRight: "1",
        RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
      },
    });

    const userRes = await sendHikvisionRequest(
      device,
      "PUT",
      "/ISAPI/AccessControl/UserInfo/Record?format=json",
      userInfoPayload
    );

    // Hikvision ba'zi modellarda PUT o'rniga POST qabul qiladi
    if (userRes.status === 400 || userRes.status === 404) {
      await sendHikvisionRequest(
        device,
        "POST",
        "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
        userInfoPayload
      );
    }

    // 2. Agar xodimda 3x4 rasm bo'lsa, fotosuratni terminalga yuklash
    if (emp.avatarUrl && emp.avatarUrl.startsWith("data:image/")) {
      const base64Data = emp.avatarUrl.split(",")[1];
      if (base64Data) {
        const imageBuffer = Buffer.from(base64Data, "base64");
        
        // FaceDataRecord multipart payload
        const boundary = "----WebKitFormBoundary" + crypto.randomBytes(12).toString("hex");
        const jsonHeader = JSON.stringify({
          faceLibType: "blackFD",
          FDID: "1",
          FPID: emp.badgeNumber,
        });

        let bodyBuffer = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: text/json\r\n\r\n${jsonHeader}\r\n`
          ),
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="img"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
          ),
          imageBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        await sendHikvisionRequest(
          device,
          "PUT",
          "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
          bodyBuffer as any,
          `multipart/form-data; boundary=${boundary}`
        );
      }
    }

    return {
      success: true,
      message: `${emp.fullName} (${emp.badgeNumber}) ma'lumotlari ${device.name} ga yuklandi.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `${device.name} ga yuklashda xatolik: ${err.message}`,
    };
  }
}

/**
 * Xodimni barcha faol Hikvision terminallariga sinxronlash
 */
export async function syncEmployeeToAllActiveDevices(
  emp: { id: string; badgeNumber: string; fullName: string; avatarUrl?: string | null },
  companyCode: string = "PRINTGOO"
): Promise<{ results: Array<{ deviceName: string; success: boolean; message: string }> }> {
  const companyId = await getCompanyIdByCode(companyCode);

  const devices = await db.query.biometricDevices.findMany({
    where: and(eq(biometricDevices.companyId, companyId), eq(biometricDevices.isEnabled, true)),
  });

  const results = [];
  for (const device of devices) {
    const res = await syncEmployeeToDevice(device, emp);
    results.push({
      deviceName: device.name,
      success: res.success,
      message: res.message,
    });
  }

  return { results };
}

/**
 * Xodimni terminaldan o'chirish (Ishdan bo'shatilganda)
 */
export async function removeEmployeeFromDevice(
  device: { ipAddress: string; port: number; username: string; password: string; name: string },
  badgeNumber: string
): Promise<{ success: boolean; message: string }> {
  try {
    const deletePayload = JSON.stringify({
      UserInfoDetail: {
        mode: "byEmployeeNo",
        EmployeeNoList: [{ employeeNo: badgeNumber }],
      },
    });

    await sendHikvisionRequest(
      device,
      "PUT",
      "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
      deletePayload
    );

    return {
      success: true,
      message: `${badgeNumber} raqamli xodim ruxsati ${device.name} dan o'chirildi.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `${device.name} dan o'chirishda xatolik: ${err.message}`,
    };
  }
}

/**
 * Xodimni barcha faol terminallardan o'chirish
 */
export async function removeEmployeeFromAllActiveDevices(
  badgeNumber: string,
  companyCode: string = "PRINTGOO"
): Promise<{ results: Array<{ deviceName: string; success: boolean; message: string }> }> {
  const companyId = await getCompanyIdByCode(companyCode);

  const devices = await db.query.biometricDevices.findMany({
    where: and(eq(biometricDevices.companyId, companyId), eq(biometricDevices.isEnabled, true)),
  });

  const results = [];
  for (const device of devices) {
    const res = await removeEmployeeFromDevice(device, badgeNumber);
    results.push({
      deviceName: device.name,
      success: res.success,
      message: res.message,
    });
  }

  return { results };
}

/**
 * Barcha faol xodimlarni tanlangan bitta terminalga ommaviy yuklash
 */
export async function syncAllEmployeesToDevice(
  deviceId: string,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; totalSynced: number; errors: string[] }> {
  const companyId = await getCompanyIdByCode(companyCode);

  const device = await db.query.biometricDevices.findFirst({
    where: eq(biometricDevices.id, deviceId),
  });

  if (!device) {
    throw new Error("Qurilma topilmadi");
  }

  const activeEmployees = await db.query.employees.findMany({
    where: and(eq(employees.companyId, companyId), eq(employees.status, "active")),
  });

  let totalSynced = 0;
  const errors: string[] = [];

  for (const emp of activeEmployees) {
    const res = await syncEmployeeToDevice(device, {
      id: emp.id,
      badgeNumber: emp.badgeNumber,
      fullName: emp.fullName,
      avatarUrl: emp.avatarUrl,
    });

    if (res.success) {
      totalSynced++;
    } else {
      errors.push(`${emp.fullName}: ${res.message}`);
    }
  }

  return { success: errors.length === 0, totalSynced, errors };
}
