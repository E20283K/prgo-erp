import { OrderRow } from "./DataGrid";
import type { useWorkspaceStore } from "@/store/workspaceStore";

type OpenTabFn = ReturnType<typeof useWorkspaceStore.getState>["openTab"];

export function openWorkOrderTab(
  order: OrderRow,
  openTab: OpenTabFn
) {
  openTab({
    id: order.id,
    title: `${order.id}: Production Order`,
    type: "work-order",
    module: "production",
    isUnsaved: false,
    activeLevel3Tab: "overview",
    documentData: {
      docNo: order.id,
      customer: order.customer,
      product: order.product,
      department: order.department,
      site: order.site,
      quantity: order.qty,
      unit: order.unit,
      status: order.status,
      priority: order.priority,
      pressMachine: order.machine,
      startDate: order.startDate,
      deadline: order.deadline,
      priceTotal: order.priceTotal,
      currency: "USD",
      responsible: order.responsible,
    },
  });
}
