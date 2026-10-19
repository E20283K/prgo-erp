export interface TradingSaleItem {
  id: string;
  sku: string;
  name: string;
  category: "Tugmalar" | "Fermuarlar" | "Jakkard" | "Iplar" | "Yorliqlar" | "Furnitura";
  unit: string;
  quantity: number;
  unitPrice: number; // in current currency
  unitPriceUZS: number;
  unitPriceUSD: number;
  totalAmount: number;
  totalUSD: number;
  isSelfProduced?: boolean; // Bosmaxonamizda ishlab chiqarilgan (Cross-sell)
}

export type TradingCurrency = "UZS" | "USD";

export interface TradingSaleRecord {
  id: string;
  docNo: string;
  date: string;
  sellerEntityId: "ytt-qodirov" | "ytt-aliyev" | "ytt-toshmatov" | "mchj-printgoo";
  sellerEntityName: string;
  sellerEntityInn: string;
  customer: string;
  customerTin: string;
  contractNo: string;
  currency: TradingCurrency;
  exchangeRate: number; // e.g. 12850
  totalAmount: number;
  totalUSD: number;
  totalUZS: number;
  paymentMethod: "Bank Wire (Hisob-raqam)" | "Corporate Card" | "Cash / Cash Register";
  status: "Draft" | "Posted" | "Cancelled";
  items: TradingSaleItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface YttTurnoverLimitRecord {
  id: string;
  code: string;
  name: string;
  legalType: "YTT" | "MChJ";
  inn: string;
  bankName: string;
  bankAccount: string;
  annualLimit: number; // e.g. 1_000_000_000 UZS
  currentTurnover: number;
  currency: "UZS";
  turnoverPercent: number;
  status: "Safe" | "Warning" | "Critical" | "Unlimited";
  isRecommended?: boolean;
  activeContractsCount: number;
  notes?: string;
}

export interface ImportBatchItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  fobPriceUSD: number;
  fobTotalUSD: number;
  landedCostUZS: number;
  suggestedSalePriceUZS: number;
}

export interface TradingImportBatchRecord {
  id: string;
  batchNo: string;
  date: string;
  origin: "Guangzhou, Xitoy" | "Yiwu, Xitoy" | "Shanghai, Xitoy";
  supplier: string;
  fobAmountUSD: number;
  internationalCargoUSD: number;
  grossWeightKg: number;
  customsDutyUZS: number;
  exchangeRate: number;
  totalLandedCostUZS: number;
  landedCostMarkupPercent: number; // e.g. +26.4%
  status: "In Transit" | "Customs Clearance" | "Arrived & Calculated" | "Allocated to Stock";
  containerNo: string;
  itemsCount: number;
  items?: ImportBatchItem[];
  notes?: string;
}

export interface TradingCatalogItemRecord {
  id: string;
  sku: string;
  name: string;
  category: "Tugmalar" | "Fermuarlar" | "Jakkard" | "Iplar" | "Yorliqlar" | "Furnitura";
  unit: string;
  priceUZS: number;
  priceUSD: number;
  wholesalePriceUZS: number;
  retailPriceUZS: number;
  stockQty: number;
  minStockLevel: number;
  origin: string;
  material?: string;
  colorCode?: string;
  dimensions?: string;
  supplier?: string;
  notes?: string;
}

export interface TradingSettlementLedgerEntry {
  id: string;
  date: string;
  docNo: string;
  docType: "Sotuv Hujjati" | "Bank To'lovi" | "Boshlang'ich Saldo";
  sellerEntityName: string;
  customer: string;
  debit: number;
  credit: number;
  currency: "UZS" | "USD";
  balance: number;
}
