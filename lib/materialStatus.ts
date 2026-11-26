import type { MaterialStatus } from "@/store/workspaceStore";

/** Xomashyo oqimi holati — jadval, Overview va ishga tushirish ogohlantirishi uchun yagona nomlar. */
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  none: "",
  planned: "Reja",
  reserved: "Band",
  issued: "Sexda",
  closed: "Yakunlangan",
};

/** [dark, light] matn rangi */
export const MATERIAL_STATUS_COLOR: Record<MaterialStatus, [string, string]> = {
  none: ["#71717a", "#a1a1aa"],
  planned: ["#f87171", "#dc2626"],
  reserved: ["#60a5fa", "#2563eb"],
  issued: ["#fbbf24", "#d97706"],
  closed: ["#4ade80", "#16a34a"],
};

/** Ish boshlanganda xomashyo hali sexga berilmagan */
export const isMaterialNotIssued = (s?: MaterialStatus) => s === "planned" || s === "reserved";

/**
 * Bosqich boshlanishida xomashyo holatini serverdan tekshiradi. Sexga berilmagan bo'lsa,
 * jurnal izohiga qo'shiladigan matnni qaytaradi (ishni to'xtatmaydi). Tekshirib bo'lmasa — null.
 */
export async function materialNotIssuedNote(workOrderNo: string): Promise<string | null> {
  if (!workOrderNo) return null;
  try {
    const res = await fetch(`/api/v1/production/work-orders/${encodeURIComponent(workOrderNo)}/materials`, {
      cache: "no-store",
    });
    const json = await res.json();
    const status = json?.data?.status as MaterialStatus | undefined;
    if (!json?.success || !isMaterialNotIssued(status)) return null;
    return status === "reserved" ? "Xomashyo band, sexga berilmagan" : "Xomashyo sexga berilmagan";
  } catch {
    return null;
  }
}
