import { db } from "@/db";
import {
  warehouseShipments,
  warehouseReceipts,
  productionSpecifications,
  clients,
} from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

/**
 * 2 xonali joriy yil qo'shimchasini olish (masalan, 2026 -> "26")
 */
export function getCurrentYearSuffix(): string {
  return new Date().getFullYear().toString().slice(-2);
}

/**
 * Berilgan prefiks, yil va mavjud raqamlar ro'yxatidan navbatdagi unikal raqamni hisoblash
 * Format: PREFIX-YY-XXXX (masalan, SHP-26-0001)
 */
export function calculateNextNumber(
  prefix: string,
  existingList: (string | null | undefined)[],
  yearSuffix: string = getCurrentYearSuffix(),
  padLength: number = 4
): string {
  const cleanPrefix = prefix.trim().toUpperCase();
  const pattern = new RegExp(`^${cleanPrefix}-${yearSuffix}-(\\d+)$`, "i");

  let maxNum = 0;
  for (const item of existingList) {
    if (!item) continue;
    const match = item.trim().match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${cleanPrefix}-${yearSuffix}-${String(nextNum).padStart(padLength, "0")}`;
}

/**
 * Ombor Chiqimi (Shipment) uchun navbatdagi unikal raqam: SHP-26-XXXX
 */
export async function getNextShipmentNumber(
  companyCode: string = "PRINTGOO"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const yearSuffix = getCurrentYearSuffix();
  const searchPattern = `SHP-${yearSuffix}-%`;

  const rows = await db
    .select({ num: warehouseShipments.shipmentNumber })
    .from(warehouseShipments)
    .where(
      and(
        eq(warehouseShipments.companyId, companyId),
        ilike(warehouseShipments.shipmentNumber, searchPattern)
      )
    );

  return calculateNextNumber("SHP", rows.map((r) => r.num), yearSuffix);
}

/**
 * Ombor Kirimi (Receipt) uchun navbatdagi unikal raqam: RCV-26-XXXX
 */
export async function getNextReceiptNumber(
  companyCode: string = "PRINTGOO"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const yearSuffix = getCurrentYearSuffix();
  const searchPattern = `RCV-${yearSuffix}-%`;

  const rows = await db
    .select({ num: warehouseReceipts.receiptNumber })
    .from(warehouseReceipts)
    .where(
      and(
        eq(warehouseReceipts.companyId, companyId),
        ilike(warehouseReceipts.receiptNumber, searchPattern)
      )
    );

  return calculateNextNumber("RCV", rows.map((r) => r.num), yearSuffix);
}

/**
 * Schet-faktura / Bajarilgan ishlar dalolatnomasi (Delivery Act) uchun raqam: SF-26-XXXX
 */
export async function getNextDeliveryActNumber(
  companyCode: string = "PRINTGOO"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const yearSuffix = getCurrentYearSuffix();
  const searchPattern = `SF-${yearSuffix}-%`;

  const rows = await db
    .select({ num: warehouseShipments.deliveryActId })
    .from(warehouseShipments)
    .where(
      and(
        eq(warehouseShipments.companyId, companyId),
        ilike(warehouseShipments.deliveryActId, searchPattern)
      )
    );

  return calculateNextNumber("SF", rows.map((r) => r.num), yearSuffix);
}

/**
 * Mahsulot texnologik xaritasi (Specification / BOM) uchun raqam: SPEC-26-XXXX
 */
export async function getNextSpecNumber(
  companyCode: string = "PRINTGOO"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const yearSuffix = getCurrentYearSuffix();
  const searchPattern = `SPEC-${yearSuffix}-%`;

  const rows = await db
    .select({ num: productionSpecifications.code })
    .from(productionSpecifications)
    .where(
      and(
        eq(productionSpecifications.companyId, companyId),
        ilike(productionSpecifications.code, searchPattern)
      )
    );

  return calculateNextNumber("SPEC", rows.map((r) => r.num), yearSuffix);
}

/**
 * Mijoz (Customer / Client) kodi uchun navbatdagi raqam: CUST-26-XXXX
 */
export async function getNextCustomerCode(
  companyCode: string = "PRINTGOO"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const yearSuffix = getCurrentYearSuffix();
  const searchPattern = `CUST-${yearSuffix}-%`;

  const rows = await db
    .select({ num: clients.code })
    .from(clients)
    .where(
      and(
        eq(clients.companyId, companyId),
        ilike(clients.code, searchPattern)
      )
    );

  return calculateNextNumber("CUST", rows.map((r) => r.num), yearSuffix);
}
