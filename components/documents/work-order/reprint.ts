// Qo'shimcha chop etish (Reprint): asl buyurtma tirajidan kam yaroqli mahsulot chiqqanda,
// yetishmagan qism alohida buyurtmada chiqariladi. Asl buyurtma haqiqiy son bilan yopiladi,
// Reprint esa unga bog'lanadi — brakning materiali, mashina vaqti va tannarxi alohida ko'rinadi.
// Takroriy buyurtma kabi shablon olinadi (klishe/CTP qayta ishlatiladi), lekin mijoz, shartnoma
// va tasdiqlangan etalon o'sha qoladi.
import { buildReorderDocument } from "./reorder";
import type { WorkOrderReprintInfo } from "./types";

type Row = Record<string, unknown>;

/** Brak kimning aybi bilan: bizniki bo'lsa Reprint mijozga hisoblanmaydi. */
export const REPRINT_FAULT_PARTIES = ["production", "prepress", "supplier", "client"] as const;
export type ReprintFaultParty = (typeof REPRINT_FAULT_PARTIES)[number];

/** Mijozdan haq olinmaydigan holatlar. */
export function isInternalFault(party: ReprintFaultParty): boolean {
  return party !== "client";
}

function scaleQty(value: unknown, ratio: number): number {
  const n = Number(value) || 0;
  return n > 0 ? Math.ceil(n * ratio) : 0;
}

export function buildReprintDocument(
  source: Row,
  opts: {
    parentDocNo: string;
    draftId: string;
    quantity: number;
    producedQty: number;
    faultParty: ReprintFaultParty;
    reason: string;
  }
): Row {
  const orderedQty = Number(source.quantity) || 0;
  const quantity = Math.max(1, Math.round(opts.quantity));
  const ratio = orderedQty > 0 ? quantity / orderedQty : 1;

  // Mijoz, shartnoma va STIR o'sha: takroriy buyurtmadagidek tozalanmaydi.
  const keep = {
    clientId: source.clientId,
    contractNo: source.contractNo,
    customerTin: source.customerTin,
  };
  const base = buildReorderDocument({ ...source, quantity }, { parentDocNo: opts.parentDocNo, draftId: opts.draftId });

  const sourcePrice = Number(source.priceTotal) || 0;
  const decimals = String(source.currency || "UZS").toUpperCase() === "UZS" ? 0 : 2;
  const priceTotal = isInternalFault(opts.faultParty)
    ? 0
    : orderedQty > 0
      ? Number(((sourcePrice / orderedQty) * quantity).toFixed(decimals))
      : 0;

  const reprint: WorkOrderReprintInfo = {
    faultParty: opts.faultParty,
    reason: opts.reason.trim(),
    parentOrderedQty: orderedQty,
    parentProducedQty: Math.max(0, Math.round(opts.producedQty)),
  };

  const materials = (Array.isArray(base.materials) ? (base.materials as Row[]) : []).map((item) => {
    const planQty = scaleQty(item.planQty, ratio);
    const unitPrice = Number(item.unitPrice) || 0;
    return { ...item, planQty, actualQty: planQty, qty: planQty, totalPrice: Number((planQty * unitPrice).toFixed(2)) };
  });

  const { reprint: _sourceReprint, reprintDocNos: _sourceChildren, ...rest } = base;
  void _sourceReprint;
  void _sourceChildren;

  return {
    ...rest,
    ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined && v !== null && v !== "")),
    orderType: "Reprint",
    quantity,
    priceTotal,
    plannedSheets: scaleQty(source.plannedSheets, ratio) || undefined,
    materials,
    reprint,
    notes: [
      [`Qo'shimcha: ${opts.parentDocNo}`, reprint.reason].filter(Boolean).join(" — "),
      String(source.notes || "").trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
