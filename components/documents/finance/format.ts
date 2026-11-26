export const fmtMoney = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 }).replace(/,/g, ".");

export const fmtDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayLocal(): string {
  const d = new Date();
  return `${currentMonth()}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Last day of a YYYY-MM month as YYYY-MM-DD. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export const SOURCE_LABEL: Record<string, string> = {
  employee_advance: "Avans",
  payroll_settlement: "Raschot",
  supplier_payment: "Ta'minotchi",
  client_payment: "Mijoz",
  supplier_order_delivery: "Dostavka",
  expense: "Xarajat",
  manual: "Qo'lda",
};

export const KIND_LABEL: Record<string, string> = { bank: "Bank", cash: "Kassa", card: "Karta" };

export const PNL_LABEL: Record<string, string> = {
  revenue: "Daromad",
  cogs: "Tannarx",
  expense: "Xarajat",
  capex: "Asosiy vosita",
  prepayment: "Avans",
  settlement: "Qarz yopish",
  transfer: "O'tkazma",
};

export const GROUP_LABEL: Record<string, string> = {
  payroll: "Ish haqi",
  materials: "Materiallar",
  logistics: "Logistika",
  equipment: "Jihoz",
  tooling: "Qoliplar",
  outsourcing: "Autsorsing",
  overhead: "Umumiy",
  tax: "Soliq",
  finance: "Moliya",
  sales: "Sotuv",
  other: "Boshqa",
};

export async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!json?.success) throw new Error(json?.error || "Xatolik");
  return json as T;
}
