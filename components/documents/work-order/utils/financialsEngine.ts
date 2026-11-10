"use client";

import type { BomItem } from "../../BomMaterialsGrid";
import type { RouteStep, ShiftEvent, WorkOrderToolingItem } from "../types";
import type { MachineRecord } from "@/components/documents/machine/types";
import { formatMoney } from "../../common/DocumentShell";

export interface ExtendedBomItem extends BomItem {
  originalCurrency?: "USD" | "UZS";
  originalUnitPrice?: number;
  [key: string]: unknown;
}

export interface CostBreakdownRow {
  id: string;
  category: string;
  name: string;
  quantity: string;
  unitRate: string;
  totalCost: number;
  share: number;
  type: string;
}

export interface FinancialCostParams {
  quantity: number;
  currency?: string;
  exchangeRate?: number;
  materials?: BomItem[];
  toolingItems?: WorkOrderToolingItem[];
  operations?: RouteStep[];
  shiftEvents?: ShiftEvent[];
  machines?: MachineRecord[];
}

export interface FinancialCostResult {
  totalBaseCost: number;
  unitBaseCost: number;
  materialCost: number;
  toolingCost: number;
  machineCost: number;
  laborCost: number;
  wasteCost: number;
  wasteLossCost: number;
  rawCostRows: CostBreakdownRow[];
}

/**
 * Finds machine hourly costing rates from the workspace machine registry.
 */
export function getMachineHourlyRate(
  machineName?: string,
  machines: MachineRecord[] = []
): { machineRate: number; operatorRate: number } {
  if (!machineName) return { machineRate: 35.0, operatorRate: 12.0 };
  const cleanName = machineName.toLowerCase();
  const matched = (machines || []).find((m) => {
    const mName = m.name?.toLowerCase() || "";
    const mExtra = m as unknown as { code?: string };
    const mCode = mExtra.code?.toLowerCase() || "";
    return mName.includes(cleanName) || cleanName.includes(mName) || (mCode && mCode.includes(cleanName));
  });

  const mExtra = matched as unknown as { hourlyRate?: number } | undefined;
  const machineRate =
    matched?.costing?.standardHourlyRateUsd ||
    (mExtra?.hourlyRate ? Number(mExtra.hourlyRate) : 35.0);
  const operatorRate = matched?.costing?.operatorHourlyWageUsd || 12.0;

  return {
    machineRate: Number(machineRate) || 35.0,
    operatorRate: Number(operatorRate) || 12.0,
  };
}

/**
 * Pure calculation engine for Work Order cost breakdown, unit base cost, and expense allocation.
 * Used by FinancialsTab, WorkOrderDetail, and Packaging Receipt to synchronize costPricePerUnit.
 */
export function calculateWorkOrderFinancials({
  quantity,
  currency = "UZS",
  exchangeRate = 12850,
  materials = [],
  toolingItems = [],
  operations = [],
  shiftEvents = [],
  machines = [],
}: FinancialCostParams): FinancialCostResult {
  const targetQty = Number(quantity) || 0;
  const isUsd = currency.toUpperCase() === "USD";
  const hasQty = targetQty > 0;
  const rows: CostBreakdownRow[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // A. XOMASHYO VA MATERIALLAR (BOM)
  // ──────────────────────────────────────────────────────────────────────────
  let totalMatCost = 0;
  if (materials && materials.length > 0) {
    materials.forEach((mat, idx) => {
      const extMat = mat as ExtendedBomItem;
      const qty = Number(
        extMat.actualQty !== undefined ? extMat.actualQty : extMat.qty !== undefined ? extMat.qty : extMat.planQty || 0
      );
      const matCur = (
        extMat.originalCurrency || (extMat.currency === "UZS" ? "UZS" : "USD")
      ).toUpperCase();
      const origPrice = Number(
        extMat.originalUnitPrice !== undefined ? extMat.originalUnitPrice : extMat.unitPrice || 0
      );

      let unitP = Number(extMat.unitPrice || 0);
      if (extMat.originalUnitPrice !== undefined || extMat.originalCurrency) {
        if (matCur === "USD" && currency === "UZS") {
          unitP = Number((origPrice * exchangeRate).toFixed(2));
        } else if (matCur === "UZS" && currency === "USD") {
          unitP = Number((origPrice / exchangeRate).toFixed(4));
        } else {
          unitP = origPrice;
        }
      }
      const lineTotal = Number(
        (
          extMat.totalPrice !== undefined && extMat.totalPrice > 0
            ? extMat.totalPrice
            : qty * unitP
        ).toFixed(2)
      );

      let catLabel = "Xomashyo";
      const catClean = (extMat.category || "").toLowerCase();
      if (catClean.includes("paper") || catClean.includes("board") || catClean.includes("roll")) {
        catLabel = "Xomashyo (Qog'oz)";
      } else if (catClean.includes("ink") || catClean.includes("plate") || catClean.includes("chemical")) {
        catLabel = "Kraska & Kimyo";
      } else if (catClean.includes("pack") || catClean.includes("box")) {
        catLabel = "Qadoqlash";
      } else {
        catLabel = "Yordamchi xomashyo";
      }

      const origDisplay =
        extMat.originalUnitPrice !== undefined && matCur !== currency
          ? ` [${matCur === "UZS" ? `${extMat.originalUnitPrice.toLocaleString()} UZS` : `$${extMat.originalUnitPrice}`}]`
          : "";

      totalMatCost += lineTotal;

      rows.push({
        id: `bom-${extMat.id || idx}`,
        category: catLabel,
        name: `${extMat.name}${extMat.spec ? ` (${extMat.spec})` : ""}${origDisplay}`,
        quantity: `${qty.toLocaleString()} ${extMat.unit || "birlik"}`,
        unitRate:
          unitP > 0
            ? `${formatMoney(unitP, currency, currency === "UZS" ? 0 : 3)}/${extMat.unit || "birlik"}`
            : "—",
        totalCost: lineTotal,
        share: 0,
        type: "BOM (Fakt)",
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. TEXNOLOGIK JIHOZLAR (PRE-PRESS: SHTAMP, CTP, KLISHE)
  // ──────────────────────────────────────────────────────────────────────────
  let totalToolCost = 0;
  if (toolingItems && toolingItems.length > 0) {
    toolingItems.forEach((tool, idx) => {
      const rawCost = Number(tool.actualCost !== undefined ? tool.actualCost : tool.estimatedCost || 0);
      const toolCur = (tool.currency || (isUsd ? "USD" : "UZS")).toUpperCase();
      let cost = rawCost;
      if (toolCur === "USD" && currency === "UZS") {
        cost = Number((rawCost * exchangeRate).toFixed(2));
      } else if (toolCur === "UZS" && currency === "USD") {
        cost = Number((rawCost / exchangeRate).toFixed(2));
      }
      const qty = Number(tool.quantity || 1);
      const unitP = qty > 0 ? Number((cost / qty).toFixed(2)) : cost;

      totalToolCost += cost;

      rows.push({
        id: `tool-${tool.id || idx}`,
        category: "Jihozlar & Qoliplar",
        name: `${tool.name}${tool.category ? ` [${tool.category}]` : ""}`,
        quantity: `${qty} ${tool.unit || "dona"}`,
        unitRate:
          unitP > 0
            ? `${formatMoney(unitP, currency, currency === "UZS" ? 0 : 2)}/${tool.unit || "dona"}`
            : "—",
        totalCost: cost,
        share: 0,
        type: tool.actualCost !== undefined ? "Jihoz (Fakt)" : "Jihoz (Reja)",
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // C. USKUNALAR VA MEHNAT HAQI (ROUTING OPERATIONS)
  // ──────────────────────────────────────────────────────────────────────────
  let totalMachCost = 0;
  let totalLabCost = 0;
  if (operations && operations.length > 0) {
    operations.forEach((op, idx) => {
      const duration = Number(op.duration) || 0;
      const rates = getMachineHourlyRate(op.machine, machines);

      // Stanok / Uskuna qiymati
      if (op.machine && op.machine !== "Manual" && op.machine !== "—") {
        const hasTariffCost = op.plannedCostUsd !== undefined && op.plannedCostUsd > 0;
        const rawMachCost = hasTariffCost
          ? Number(op.plannedCostUsd!.toFixed(2))
          : Number((duration * rates.machineRate).toFixed(2));
        const machineCost = isUsd ? rawMachCost : Number((rawMachCost * exchangeRate).toFixed(2));

        const rawMachRate = hasTariffCost && op.rateUsd !== undefined ? op.rateUsd : rates.machineRate;
        const machRateConv = isUsd ? rawMachRate : rawMachRate * exchangeRate;
        const unitRateDisplay =
          duration > 0 || hasTariffCost
            ? `${formatMoney(machRateConv, currency, currency === "UZS" ? 0 : 2)}/${hasTariffCost ? (op.calcUnit || "birlik") : "soat"}`
            : "—";

        totalMachCost += machineCost;

        rows.push({
          id: `op-mach-${op.id || idx}`,
          category: "Uskuna & Mashina",
          name: `${op.name} (${op.machine})`,
          quantity: hasTariffCost
            ? (targetQty ? `${targetQty.toLocaleString()} dona` : `${duration} soat`)
            : `${duration} soat`,
          unitRate: unitRateDisplay,
          totalCost: machineCost,
          share: 0,
          type: op.tariffCode ? `Tarif (${op.tariffCode})` : `Stanok (#${op.stepNumber})`,
        });
      }

      // Ishchilar mehnati / FOT (Sdelka yoki soatbay stavka)
      const hasPiecework = op.pieceworkTotalUsd !== undefined && op.pieceworkTotalUsd > 0;
      const rawLabCost = hasPiecework
        ? Number(op.pieceworkTotalUsd!.toFixed(2))
        : Number((duration * rates.operatorRate).toFixed(2));
      const laborCost = isUsd ? rawLabCost : Number((rawLabCost * exchangeRate).toFixed(2));

      const rawLabRate = hasPiecework && op.pieceworkRateUsd !== undefined ? op.pieceworkRateUsd : rates.operatorRate;
      const labRateConv = isUsd ? rawLabRate : rawLabRate * exchangeRate;
      const laborRateDisplay =
        duration > 0 || hasPiecework
          ? `${formatMoney(labRateConv, currency, currency === "UZS" ? 0 : 2)}/${hasPiecework ? (op.calcUnit || "birlik") : "soat"}`
          : "—";

      totalLabCost += laborCost;

      rows.push({
        id: `op-lab-${op.id || idx}`,
        category: "Mehnat haqi (FOT)",
        name: `${op.name} — ${op.operator || "Navbatchi usta"}`,
        quantity: hasPiecework
          ? (targetQty ? `${targetQty.toLocaleString()} dona` : `${duration} soat`)
          : `${duration} soat`,
        unitRate: laborRateDisplay,
        totalCost: laborCost,
        share: 0,
        type: op.tariffCode ? `Sdelka (${op.tariffCode})` : `Ishchi (#${op.stepNumber})`,
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // D. SIFAT NUQSONLARI VA BRAK ZIYONLARI (SMENA JURNALLARI)
  // ──────────────────────────────────────────────────────────────────────────
  const preWasteSubtotal = rows.reduce((s, r) => s + r.totalCost, 0);
  const approxUnitCost = hasQty && preWasteSubtotal > 0 ? preWasteSubtotal / targetQty : 0;
  let computedWasteCost = 0;

  const wasteEvents = (shiftEvents || []).filter((ev) => ev.type === "Waste" && ev.wasteQty);
  if (wasteEvents.length > 0 && approxUnitCost > 0) {
    wasteEvents.forEach((we, idx) => {
      const wasteQty = Number(we.wasteQty || 0);
      const lineWasteCost = Number((wasteQty * approxUnitCost).toFixed(2));
      computedWasteCost += lineWasteCost;

      rows.push({
        id: `waste-${we.id || idx}`,
        category: "Nuqson & Brak (COPQ)",
        name: `${we.note || "Brak listlar"} [${we.wasteReason || "Texnologik chiqindi"}]`,
        quantity: `${wasteQty} dona list`,
        unitRate: `${formatMoney(approxUnitCost, currency, currency === "UZS" ? 0 : 3)}/list`,
        totalCost: lineWasteCost,
        share: 0,
        type: `Smena (${we.shift || we.time})`,
      });
    });
  }

  const grandTotal = Number((preWasteSubtotal + computedWasteCost).toFixed(2));
  const unitCost = hasQty && grandTotal > 0 ? Number((grandTotal / targetQty).toFixed(4)) : 0;

  // Ulush foizlarini hisoblash
  rows.forEach((r) => {
    r.share = grandTotal > 0 ? Number(((r.totalCost / grandTotal) * 100).toFixed(1)) : 0;
  });

  return {
    totalBaseCost: grandTotal,
    unitBaseCost: unitCost,
    materialCost: totalMatCost,
    toolingCost: totalToolCost,
    machineCost: totalMachCost,
    laborCost: totalLabCost,
    wasteCost: computedWasteCost,
    wasteLossCost: computedWasteCost,
    rawCostRows: rows,
  };
}
