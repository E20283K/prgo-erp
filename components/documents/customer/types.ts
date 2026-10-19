import { CrmCustomerRecord, CustomerToolingItem, DocumentTab } from "@/store/workspaceStore";

export type CustomerTabType = "overview" | "settlements" | "orders" | "tooling";

export interface CustomerDetailProps {
  tab: DocumentTab;
}

export interface CustomerOrderRow {
  docId: string;
  docType: "Client Order (CO)" | "Schet-faktura (SF)" | "Work Order (WO)";
  date: string;
  orderRef?: string;
  workOrderRef?: string;
  product: string;
  quantity: number;
  unit: string;
  amountUsd?: number;
  status: string;
}

export type SettlementFilterPeriod = "all" | "30d" | "90d" | "year";
