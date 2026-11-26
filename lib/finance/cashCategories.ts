/**
 * Built-in cash-journal categories, created for every company. Integrations (avans, raschet,
 * ta'minotchi va mijoz to'lovlari, dostavka) post under these codes, so the codes are stable.
 */

export type CashDirection = "in" | "out";
export type PnlType =
  | "revenue"
  | "cogs"
  | "expense"
  | "capex"
  | "prepayment"
  | "settlement"
  | "transfer";

export type CashCategoryGroup =
  | "payroll"
  | "materials"
  | "logistics"
  | "equipment"
  | "tooling"
  | "outsourcing"
  | "overhead"
  | "tax"
  | "finance"
  | "sales"
  | "other";

export interface CashCategoryDef {
  code: string;
  name: string;
  group: CashCategoryGroup;
  direction: CashDirection;
  pnlType: PnlType;
  /** Posted by an integration: users can rename it but not delete or re-type it. */
  isSystem: boolean;
}

export const CASH_CATEGORY = {
  PAYROLL_ADVANCE: "PAYROLL_ADVANCE",
  PAYROLL_SETTLEMENT: "PAYROLL_SETTLEMENT",
  SUPPLIER_PAYMENT: "SUPPLIER_PAYMENT",
  DELIVERY_INBOUND: "DELIVERY_INBOUND",
  CLIENT_PAYMENT: "CLIENT_PAYMENT",
  TRANSFER_OUT: "TRANSFER_OUT",
  TRANSFER_IN: "TRANSFER_IN",
} as const;

export const DEFAULT_CASH_CATEGORIES: readonly CashCategoryDef[] = [
  // ── Chiqim: integratsiyalar yozadi
  { code: "PAYROLL_ADVANCE", name: "Avans", group: "payroll", direction: "out", pnlType: "prepayment", isSystem: true },
  { code: "PAYROLL_SETTLEMENT", name: "Oylik raschet", group: "payroll", direction: "out", pnlType: "settlement", isSystem: true },
  { code: "SUPPLIER_PAYMENT", name: "Ta'minotchiga to'lov", group: "materials", direction: "out", pnlType: "settlement", isSystem: true },
  { code: "DELIVERY_INBOUND", name: "Dostavka (kirim)", group: "logistics", direction: "out", pnlType: "cogs", isSystem: true },
  { code: "TRANSFER_OUT", name: "O'tkazma (chiqim)", group: "finance", direction: "out", pnlType: "transfer", isSystem: true },

  // ── Chiqim: qo'lda kiritiladi
  { code: "EQUIPMENT", name: "Jihoz xaridi", group: "equipment", direction: "out", pnlType: "capex", isSystem: false },
  { code: "RAW_MATERIALS", name: "Xomashyo (naqd)", group: "materials", direction: "out", pnlType: "cogs", isSystem: false },
  { code: "TOOLING", name: "Shtamp, CTP, klishe", group: "tooling", direction: "out", pnlType: "cogs", isSystem: false },
  { code: "OUTSOURCING", name: "Autsorsing", group: "outsourcing", direction: "out", pnlType: "cogs", isSystem: false },
  { code: "DELIVERY_OUTBOUND", name: "Dostavka (mijozga)", group: "logistics", direction: "out", pnlType: "expense", isSystem: false },
  { code: "REPAIR", name: "Ta'mirlash", group: "overhead", direction: "out", pnlType: "expense", isSystem: false },
  { code: "RENT", name: "Ijara", group: "overhead", direction: "out", pnlType: "expense", isSystem: false },
  { code: "UTILITIES", name: "Kommunal", group: "overhead", direction: "out", pnlType: "expense", isSystem: false },
  { code: "OFFICE", name: "Xo'jalik", group: "overhead", direction: "out", pnlType: "expense", isSystem: false },
  { code: "PAYROLL_TAX", name: "Ish haqi soliqlari", group: "tax", direction: "out", pnlType: "expense", isSystem: false },
  { code: "TAX", name: "Soliqlar", group: "tax", direction: "out", pnlType: "expense", isSystem: false },
  { code: "BANK_FEE", name: "Bank xizmati", group: "finance", direction: "out", pnlType: "expense", isSystem: false },
  { code: "OTHER_OUT", name: "Boshqa chiqim", group: "other", direction: "out", pnlType: "expense", isSystem: false },

  // ── Kirim
  { code: "CLIENT_PAYMENT", name: "Mijoz to'lovi", group: "sales", direction: "in", pnlType: "settlement", isSystem: true },
  { code: "TRANSFER_IN", name: "O'tkazma (kirim)", group: "finance", direction: "in", pnlType: "transfer", isSystem: true },
  { code: "OTHER_IN", name: "Boshqa kirim", group: "other", direction: "in", pnlType: "revenue", isSystem: false },
];
