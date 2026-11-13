"use client";

import type { BomItem } from "../../BomMaterialsGrid";
import type { WarehouseMovementRecord } from "@/store/workspaceStore";
import type {
  RouteStep,
  ShiftEvent,
  WorkOrderPackagingSummary,
  WorkOrderToolingItem,
} from "../types";
import type { MachineRecord } from "@/components/documents/machine/types";
import { formatMoney } from "../../common/DocumentShell";

export interface ExtendedBomItem extends BomItem {
  originalCurrency?: "USD" | "UZS";
  originalUnitPrice?: number;
  [key: string]: unknown;
}

/**
 * Cost groups. The first eight partition the order cost (COGS);
 * "recharge" and "claim" are tracked but never included in it.
 */
export type CostGroup =
  | "material"
  | "packaging"
  | "tooling"
  | "sample"
  | "machine"
  | "labor"
  | "defect"
  | "overhead"
  | "recharge"
  | "claim";

export const DEFAULT_OVERHEAD_PERCENT = 10;

export interface CostBreakdownRow {
  id: string;
  group: CostGroup;
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
  overheadPercent?: number;
  packagingData?: WorkOrderPackagingSummary;
  materialReturns?: MaterialReturnCredit[];
}

export interface MaterialReturnCredit {
  docNo: string;
  name: string;
  quantity: number;
  unit?: string;
  creditUsd: number;
}

/** Offcut returns credited to a work order: lines of its completed "CuttingReturn" warehouse documents. */
export function getWorkOrderMaterialReturns(
  movements: WarehouseMovementRecord[] | undefined,
  workOrderId: string | undefined
): MaterialReturnCredit[] {
  if (!workOrderId) return [];
  return (movements || [])
    .filter((m) => m.movementType === "CuttingReturn" && m.status === "Completed" && m.workOrderId === workOrderId)
    .flatMap((m) =>
      (m.items || [])
        .filter((line) => Number(line.creditUsd) > 0)
        .map((line) => ({
          docNo: m.id,
          name: line.name,
          quantity: Number(line.receivedQty) || Number(line.quantity) || 0,
          unit: line.unit,
          creditUsd: Number(line.creditUsd) || 0,
        }))
    );
}

export interface FinancialCostResult {
  totalBaseCost: number;
  unitBaseCost: number;
  /** Quantity the unit cost is divided by: packed good qty once packaging is completed, else the ordered qty. */
  costBasisQty: number;
  directCost: number;
  materialCost: number;
  plannedMaterialCost: number;
  packagingCost: number;
  toolingCost: number;
  sampleCost: number;
  machineCost: number;
  laborCost: number;
  defectCost: number;
  overheadCost: number;
  overheadPercent: number;
  /** Outside COGS: client-fault remakes and materials, billed on top of the selling price. */
  rechargeToClient: number;
  /** Outside COGS: supplier-fault remakes and materials, to be claimed back. */
  supplierClaim: number;
  /** Informational only (already inside materialCost): over-consumption against the planned norm. */
  wasteInfoCost: number;
  /** Value of reusable offcuts returned to stock; already deducted via negative material rows. */
  returnedMaterialValue: number;
  wasteSheets: number;
  rawCostRows: CostBreakdownRow[];
  nonCogsRows: CostBreakdownRow[];
}

const GROUP_LABELS: Record<CostGroup, string> = {
  material: "Xomashyo",
  packaging: "Qadoqlash",
  tooling: "Jihozlar",
  sample: "Namuna",
  machine: "Uskuna",
  labor: "Mehnat haqi",
  defect: "Brak",
  overhead: "Umumzavod xarajatlari",
  recharge: "Mijozga hisob",
  claim: "Da'vo",
};

const NON_COGS_GROUPS: CostGroup[] = ["recharge", "claim"];

const PLATE_STEP_NAME_RE = /ctp|prepress|polimer qolip/i;

/**
 * Finds machine hourly costing rates from the workspace machine registry.
 * `found` is false when the machine is not in the registry — rates are then 0, never guessed.
 */
export function getMachineHourlyRate(
  machineName?: string,
  machines: MachineRecord[] = []
): { machineRate: number; operatorRate: number; found: boolean } {
  const cleanName = (machineName || "").toLowerCase().trim();
  if (!cleanName) return { machineRate: 0, operatorRate: 0, found: false };

  const matched = (machines || []).find((m) => {
    const mName = (m.name || "").toLowerCase().trim();
    const mCode = ((m as unknown as { code?: string }).code || "").toLowerCase().trim();
    return (
      (mName !== "" && (mName.includes(cleanName) || cleanName.includes(mName))) ||
      (mCode !== "" && mCode.includes(cleanName))
    );
  });
  if (!matched) return { machineRate: 0, operatorRate: 0, found: false };

  const legacyRate = Number((matched as unknown as { hourlyRate?: number }).hourlyRate) || 0;
  return {
    machineRate: Number(matched.costing?.standardHourlyRateUsd) || legacyRate,
    operatorRate: Number(matched.costing?.operatorHourlyWageUsd) || 0,
    found: true,
  };
}

/**
 * Pure calculation engine for Work Order cost breakdown, unit base cost, and expense allocation.
 * Used by FinancialsTab and by the finished-goods receipt to write the real unit cost.
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
  overheadPercent = DEFAULT_OVERHEAD_PERCENT,
  packagingData,
  materialReturns = [],
}: FinancialCostParams): FinancialCostResult {
  const targetQty = Number(quantity) || 0;
  const cur = currency.toUpperCase();
  const isUsd = cur === "USD";
  const rate = Number(exchangeRate) || 12850;
  const fromUsd = (usd: number) => (isUsd ? usd : Number((usd * rate).toFixed(2)));
  const rows: CostBreakdownRow[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // A. XOMASHYO VA MATERIALLAR (BOM)
  // ──────────────────────────────────────────────────────────────────────────
  let plannedMaterialCost = 0;
  let wasteInfoCost = 0;
  let returnedMaterialValue = 0;

  (materials || []).forEach((mat, idx) => {
    const extMat = mat as ExtendedBomItem;
    const qty = Number(
      extMat.actualQty !== undefined ? extMat.actualQty : extMat.qty !== undefined ? extMat.qty : extMat.planQty || 0
    );
    const planQty = Number(extMat.planQty !== undefined ? extMat.planQty : qty) || 0;
    const matCur = (extMat.originalCurrency || (extMat.currency === "UZS" ? "UZS" : "USD")).toUpperCase();
    const origPrice = Number(
      extMat.originalUnitPrice !== undefined ? extMat.originalUnitPrice : extMat.unitPrice || 0
    );

    let unitP = Number(extMat.unitPrice || 0);
    if (extMat.originalUnitPrice !== undefined || extMat.originalCurrency) {
      if (matCur === "USD" && cur === "UZS") {
        unitP = Number((origPrice * rate).toFixed(2));
      } else if (matCur === "UZS" && cur === "USD") {
        unitP = Number((origPrice / rate).toFixed(4));
      } else {
        unitP = origPrice;
      }
    }

    // Actual consumption × price; the stored total is only a fallback for lines without a unit price.
    const lineTotal = Number((unitP > 0 ? qty * unitP : Number(extMat.totalPrice) || 0).toFixed(2));

    const catClean = (extMat.category || "").toLowerCase();
    const isPackagingMat = catClean.includes("pack") || catClean.includes("box") || catClean.includes("qadoq");
    let category = "Yordamchi xomashyo";
    if (catClean.includes("paper") || catClean.includes("board") || catClean.includes("roll")) {
      category = GROUP_LABELS.material;
    } else if (catClean.includes("ink") || catClean.includes("plate") || catClean.includes("chemical")) {
      category = "Kraska va kimyo";
    } else if (isPackagingMat) {
      category = GROUP_LABELS.packaging;
    }

    let group: CostGroup = isPackagingMat ? "packaging" : "material";
    if (extMat.faultParty === "client") group = "recharge";
    else if (extMat.faultParty === "supplier") group = "claim";
    else if (extMat.faultParty === "prepress" || extMat.faultParty === "production") group = "defect";
    if (group !== "material" && group !== "packaging") category = GROUP_LABELS[group];

    if (group === "material" || group === "packaging") {
      plannedMaterialCost += planQty * unitP;
      wasteInfoCost += Math.max(0, qty - planQty) * unitP;
    }

    const origDisplay =
      extMat.originalUnitPrice !== undefined && matCur !== cur
        ? ` [${matCur === "UZS" ? `${extMat.originalUnitPrice.toLocaleString()} UZS` : `$${extMat.originalUnitPrice}`}]`
        : "";

    rows.push({
      id: `bom-${extMat.id || idx}`,
      group,
      category,
      name: `${extMat.name}${extMat.spec ? ` (${extMat.spec})` : ""}${origDisplay}`,
      quantity: `${qty.toLocaleString()} ${extMat.unit || "birlik"}`,
      unitRate: unitP > 0 ? `${formatMoney(unitP, currency, 3)}/${extMat.unit || "birlik"}` : "—",
      totalCost: lineTotal,
      share: 0,
      type: unitP > 0 ? "BOM" : "Narx yo'q",
    });
  });

  // Reusable offcuts received back into stock (completed RET documents) are not this order's cost.
  (materialReturns || []).forEach((ret, idx) => {
    const credit = fromUsd(Number(ret.creditUsd) || 0);
    if (credit <= 0) return;
    returnedMaterialValue += credit;
    rows.push({
      id: `ret-${ret.docNo}-${idx}`,
      group: "material",
      category: GROUP_LABELS.material,
      name: `${ret.name} — delovoy otxod`,
      quantity: `${ret.quantity.toLocaleString()} ${ret.unit || "birlik"}`,
      unitRate: ret.quantity > 0 ? `${formatMoney(credit / ret.quantity, currency, 3)}/${ret.unit || "birlik"}` : "—",
      totalCost: -credit,
      share: 0,
      type: ret.docNo,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // B. TEXNOLOGIK JIHOZLAR (SHTAMP, CTP, KLISHE)
  // ──────────────────────────────────────────────────────────────────────────
  let platesCostedAsTooling = false;

  (toolingItems || []).forEach((tool, idx) => {
    const rawCost = Number(tool.actualCost !== undefined ? tool.actualCost : tool.estimatedCost || 0);
    const toolCur = (tool.currency || cur).toUpperCase();
    let cost = rawCost;
    if (toolCur === "USD" && cur === "UZS") {
      cost = Number((rawCost * rate).toFixed(2));
    } else if (toolCur === "UZS" && cur === "USD") {
      cost = Number((rawCost / rate).toFixed(2));
    }
    const qty = Number(tool.quantity || 1);
    const unitP = qty > 0 ? Number((cost / qty).toFixed(2)) : cost;

    let group: CostGroup = tool.phase === "sample" ? "sample" : "tooling";
    if (tool.isRemake) {
      if (tool.faultParty === "client") group = "recharge";
      else if (tool.faultParty === "supplier") group = "claim";
      else group = "defect";
    }

    const isPlate = tool.category === "ctp_plates" || tool.category === "flexo_polymer";
    if (isPlate && cost > 0 && !NON_COGS_GROUPS.includes(group)) {
      platesCostedAsTooling = true;
    }

    rows.push({
      id: `tool-${tool.id || idx}`,
      group,
      category: GROUP_LABELS[group],
      name: `${tool.isRemake ? "[Remake] " : ""}${tool.name}`,
      quantity: `${qty} ${tool.unit || "dona"}`,
      unitRate: unitP > 0 ? `${formatMoney(unitP, currency, 2)}/${tool.unit || "dona"}` : "—",
      totalCost: cost,
      share: 0,
      type: tool.actualCost !== undefined ? "Fakt" : "Reja",
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // C. USKUNALAR VA MEHNAT HAQI (MARSHRUT)
  // Tarif = faqat uskuna. Ish haqi = sdelka; soatbay stavka faqat tarifsiz bosqichda.
  // ──────────────────────────────────────────────────────────────────────────
  (operations || []).forEach((op, idx) => {
    const duration = Number(op.duration) || 0;
    const rates = getMachineHourlyRate(op.machine, machines);
    const isPackaging = op.kind === "packaging";
    const hasTariff = op.plannedCostUsd !== undefined && op.plannedCostUsd > 0;
    const hasMachine = Boolean(op.machine && op.machine !== "Manual" && op.machine !== "—");
    const qtyLabel = targetQty ? `${targetQty.toLocaleString()} dona` : `${duration} soat`;

    if (hasMachine || hasTariff) {
      // Plates are bought/made as tooling items: do not charge the plate-making step a second time.
      const isPlateStep = op.kind === "prepress" || (!op.kind && PLATE_STEP_NAME_RE.test(op.name || ""));
      const coveredByTooling = isPlateStep && platesCostedAsTooling;

      const rawMachCost = coveredByTooling
        ? 0
        : hasTariff
        ? Number(op.plannedCostUsd)
        : duration * rates.machineRate;
      const rawMachRate = hasTariff && op.rateUsd !== undefined ? op.rateUsd : rates.machineRate;

      let type = op.tariffCode ? `Tarif ${op.tariffCode}` : hasTariff ? "Tarif" : "Soatbay";
      if (coveredByTooling) type = "Jihozlarda";
      else if (!hasTariff && !rates.found) type = "Stavka yo'q";

      rows.push({
        id: `op-mach-${op.id || idx}`,
        group: isPackaging ? "packaging" : "machine",
        category: isPackaging ? GROUP_LABELS.packaging : GROUP_LABELS.machine,
        name: hasMachine ? `${op.name} (${op.machine})` : op.name,
        quantity: hasTariff ? qtyLabel : `${duration} soat`,
        unitRate:
          rawMachRate > 0
            ? `${formatMoney(fromUsd(rawMachRate), currency, 2)}/${hasTariff ? op.calcUnit || "birlik" : "soat"}`
            : "—",
        totalCost: fromUsd(rawMachCost),
        share: 0,
        type,
      });
    }

    const hasPiecework = op.pieceworkTotalUsd !== undefined && op.pieceworkTotalUsd > 0;
    if (hasPiecework || !hasTariff) {
      const rawLabCost = hasPiecework ? Number(op.pieceworkTotalUsd) : duration * rates.operatorRate;
      const rawLabRate =
        hasPiecework && op.pieceworkRateUsd !== undefined ? op.pieceworkRateUsd : rates.operatorRate;

      rows.push({
        id: `op-lab-${op.id || idx}`,
        group: isPackaging ? "packaging" : "labor",
        category: isPackaging ? GROUP_LABELS.packaging : GROUP_LABELS.labor,
        name: `${op.name} — ${op.operator || "Belgilanmagan"}`,
        quantity: hasPiecework ? qtyLabel : `${duration} soat`,
        unitRate:
          rawLabRate > 0
            ? `${formatMoney(fromUsd(rawLabRate), currency, 2)}/${hasPiecework ? op.calcUnit || "birlik" : "soat"}`
            : "—",
        totalCost: fromUsd(rawLabCost),
        share: 0,
        type: hasPiecework ? "Sdelka" : rawLabRate > 0 ? "Soatbay" : "Stavka yo'q",
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // D. BRAK — faqat ma'lumot: material faktik sarfi brakni allaqachon o'z ichiga oladi.
  // ──────────────────────────────────────────────────────────────────────────
  const wasteSheets = (shiftEvents || [])
    .filter((ev) => ev.type === "Waste")
    .reduce((s, ev) => s + (Number(ev.wasteQty) || 0), 0);

  // ──────────────────────────────────────────────────────────────────────────
  // E. UMUMZAVOD XARAJATLARI VA JAMI
  // ──────────────────────────────────────────────────────────────────────────
  const cogsRows = rows.filter((r) => !NON_COGS_GROUPS.includes(r.group));
  const nonCogsRows = rows.filter((r) => NON_COGS_GROUPS.includes(r.group));
  const sumGroup = (group: CostGroup) =>
    Number(rows.filter((r) => r.group === group).reduce((s, r) => s + r.totalCost, 0).toFixed(2));

  const directCost = Number(cogsRows.reduce((s, r) => s + r.totalCost, 0).toFixed(2));
  const pct = Math.max(0, Number(overheadPercent) || 0);
  const overheadCost = Number(((directCost * pct) / 100).toFixed(2));

  if (overheadCost > 0) {
    cogsRows.push({
      id: "overhead",
      group: "overhead",
      category: GROUP_LABELS.overhead,
      name: "Ijara, ma'muriyat, kommunal",
      quantity: `${pct}%`,
      unitRate: formatMoney(directCost, currency, 2),
      totalCost: overheadCost,
      share: 0,
      type: "Foiz",
    });
  }

  const grandTotal = Number((directCost + overheadCost).toFixed(2));
  const packedQty = Number(packagingData?.totalPackedQty) || 0;
  const costBasisQty = packagingData?.isCompleted && packedQty > 0 ? packedQty : targetQty;
  const unitCost = costBasisQty > 0 && grandTotal > 0 ? Number((grandTotal / costBasisQty).toFixed(4)) : 0;

  cogsRows.forEach((r) => {
    r.share = grandTotal > 0 ? Number(((r.totalCost / grandTotal) * 100).toFixed(1)) : 0;
  });

  return {
    totalBaseCost: grandTotal,
    unitBaseCost: unitCost,
    costBasisQty,
    directCost,
    materialCost: sumGroup("material"),
    plannedMaterialCost: Number(plannedMaterialCost.toFixed(2)),
    packagingCost: sumGroup("packaging"),
    toolingCost: sumGroup("tooling"),
    sampleCost: sumGroup("sample"),
    machineCost: sumGroup("machine"),
    laborCost: sumGroup("labor"),
    defectCost: sumGroup("defect"),
    overheadCost,
    overheadPercent: pct,
    rechargeToClient: sumGroup("recharge"),
    supplierClaim: sumGroup("claim"),
    wasteInfoCost: Number(wasteInfoCost.toFixed(2)),
    returnedMaterialValue: Number(returnedMaterialValue.toFixed(2)),
    wasteSheets,
    rawCostRows: cogsRows,
    nonCogsRows,
  };
}
