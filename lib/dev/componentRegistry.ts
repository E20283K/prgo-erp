/**
 * Component & Module Registry for Developer Tools & Status Bar
 * 
 * Maps active workspace tabs, modules, and sub-views to their concrete
 * React Component Modules (.tsx files) and exact Lines of Code (LOC).
 */

import { DocumentTab } from "@/store/workspaceStore";

export interface SubComponentMeta {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
  description: string;
}

export interface ComponentMeta {
  componentName: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
  featureModule: string;
  category: "registry-grid" | "document-editor" | "dashboard" | "tool";
  description: string;
  subTabs?: Record<string, SubComponentMeta>;
}

export interface ActiveComponentResolution {
  featureModule: string;
  featureModuleLabel: string;
  subModuleName: string;
  componentName: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
  category: string;
  description: string;
  activeSubTab?: SubComponentMeta;
  totalLines: number;
  vscodeUrl: string;
  isDocument: boolean;
  docTitle?: string;
  docNo?: string;
  status?: string;
}

export const WORKSPACE_ROOT = "d:/Soft Projects/printgo_erp";

// ── Master Component Registry with real line counts ──
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = {
  // Grids & Registries
  "grid-production-work-orders": {
    componentName: "DataGrid",
    fileName: "DataGrid.tsx",
    relativePath: "components/grid/DataGrid.tsx",
    linesOfCode: 845,
    featureModule: "production",
    category: "registry-grid",
    description: "High-performance Glide Data Grid for Work Orders registry.",
  },
  "grid-production-planning": {
    componentName: "ProductionGrid",
    fileName: "ProductionGrid.tsx",
    relativePath: "components/grid/ProductionGrid.tsx",
    linesOfCode: 1190,
    featureModule: "production",
    category: "registry-grid",
    description: "Production planning scheduling grid and machine allocation.",
  },
  "grid-production-machines": {
    componentName: "ProductionGrid",
    fileName: "ProductionGrid.tsx",
    relativePath: "components/grid/ProductionGrid.tsx",
    linesOfCode: 1190,
    featureModule: "production",
    category: "registry-grid",
    description: "Machine fleet management and maintenance registry.",
  },
  "grid-production-bom": {
    componentName: "ProductionGrid",
    fileName: "ProductionGrid.tsx",
    relativePath: "components/grid/ProductionGrid.tsx",
    linesOfCode: 1190,
    featureModule: "production",
    category: "registry-grid",
    description: "Bill of Materials & specs master registry.",
  },
  "grid-production-tooling": {
    componentName: "ProductionGrid",
    fileName: "ProductionGrid.tsx",
    relativePath: "components/grid/ProductionGrid.tsx",
    linesOfCode: 1190,
    featureModule: "production",
    category: "registry-grid",
    description: "Die-cuts, cylinders, and tooling registry.",
  },
  "grid-crm-customers": {
    componentName: "CrmGrid",
    fileName: "CrmGrid.tsx",
    relativePath: "components/grid/CrmGrid.tsx",
    linesOfCode: 939,
    featureModule: "crm",
    category: "registry-grid",
    description: "CRM Client counterparty directory and VIP account ledger.",
  },
  "grid-crm-leads": {
    componentName: "CrmGrid",
    fileName: "CrmGrid.tsx",
    relativePath: "components/grid/CrmGrid.tsx",
    linesOfCode: 939,
    featureModule: "crm",
    category: "registry-grid",
    description: "Sales pipeline opportunities and leads registry.",
  },
  "grid-tasks": {
    componentName: "TaskGrid",
    fileName: "TaskGrid.tsx",
    relativePath: "components/grid/TaskGrid.tsx",
    linesOfCode: 624,
    featureModule: "crm",
    category: "registry-grid",
    description: "Operational task tracker and Kanban board integration.",
  },
  "grid-warehouse": {
    componentName: "WarehouseGrid",
    fileName: "WarehouseGrid.tsx",
    relativePath: "components/grid/WarehouseGrid.tsx",
    linesOfCode: 1039,
    featureModule: "warehouse",
    category: "registry-grid",
    description: "Warehouse stock balance, raw materials, and barcode movements.",
  },
  "grid-sales": {
    componentName: "SalesGrid",
    fileName: "SalesGrid.tsx",
    relativePath: "components/grid/SalesGrid.tsx",
    linesOfCode: 450,
    featureModule: "sales",
    category: "registry-grid",
    description: "Commercial orders, quotations, and Schet-faktura acts.",
  },
  "grid-finance": {
    componentName: "FinanceGrid",
    fileName: "FinanceGrid.tsx",
    relativePath: "components/grid/FinanceGrid.tsx",
    linesOfCode: 690,
    featureModule: "finance",
    category: "registry-grid",
    description: "Financial settlements, mutual payments, and bank transactions.",
  },
  "grid-settings": {
    componentName: "SettingsGrid",
    fileName: "SettingsGrid.tsx",
    relativePath: "components/grid/SettingsGrid.tsx",
    linesOfCode: 816,
    featureModule: "settings",
    category: "registry-grid",
    description: "System parameters, plant configurations, and user RBAC security.",
  },
  "grid-hr": {
    componentName: "EmployeeDetail",
    fileName: "EmployeeDetail.tsx",
    relativePath: "components/documents/hr/EmployeeDetail.tsx",
    linesOfCode: 520,
    featureModule: "hr",
    category: "registry-grid",
    description: "Staff & personnel registry, timesheets, and wage records.",
  },
  "grid-trading": {
    componentName: "TradingGrid",
    fileName: "TradingGrid.tsx",
    relativePath: "components/grid/TradingGrid.tsx",
    linesOfCode: 650,
    featureModule: "sales",
    category: "registry-grid",
    description: "Wholesale trade, retail sales, and import registry.",
  },

  // Document Detail Views
  "doc-employee-detail": {
    componentName: "EmployeeDetail",
    fileName: "EmployeeDetail.tsx",
    relativePath: "components/documents/hr/EmployeeDetail.tsx",
    linesOfCode: 520,
    featureModule: "hr",
    category: "document-editor",
    description: "Employee T-2 personal record, wage tariffs, piecework logs, and attendance history.",
  },
  "doc-work-order": {
    componentName: "WorkOrderDetail",
    fileName: "WorkOrderDetail.tsx",
    relativePath: "components/documents/work-order/WorkOrderDetail.tsx",
    linesOfCode: 589,
    featureModule: "production",
    category: "document-editor",
    description: "Production Work Order 1C-style document container.",
    subTabs: {
      overview: {
        id: "overview",
        name: "OverviewTab",
        fileName: "OverviewTab.tsx",
        relativePath: "components/documents/work-order/tabs/OverviewTab.tsx",
        linesOfCode: 2108,
        description: "Primary work order specifications, paper stock, ink run, and approval gates.",
      },
      specs: {
        id: "specs",
        name: "SpecificationsTab",
        fileName: "SpecificationsTab.tsx",
        relativePath: "components/documents/work-order/tabs/SpecificationsTab.tsx",
        linesOfCode: 520,
        description: "Technical dimensions, 2D/3D die-cut folding model preview, and coating.",
      },
      layout: {
        id: "layout",
        name: "LayoutCalcTab",
        fileName: "LayoutCalcTab.tsx",
        relativePath: "components/documents/work-order/tabs/LayoutCalcTab.tsx",
        linesOfCode: 401,
        description: "Sheet layout nesting calculator, plate utilization, and grain direction.",
      },
      flexo: {
        id: "flexo",
        name: "FlexoCalcTab",
        fileName: "FlexoCalcTab.tsx",
        relativePath: "components/documents/work-order/tabs/FlexoCalcTab.tsx",
        linesOfCode: 1177,
        description: "Flexographic cylinder gear, repeat length, and anilox calculator.",
      },
      sample: {
        id: "sample",
        name: "SampleTab",
        fileName: "SampleTab.tsx",
        relativePath: "components/documents/work-order/tabs/SampleTab.tsx",
        linesOfCode: 327,
        description: "Pre-production physical sample configuration and proofing gates.",
      },
      operations: {
        id: "operations",
        name: "OperationsTab",
        fileName: "OperationsTab.tsx",
        relativePath: "components/documents/work-order/tabs/OperationsTab.tsx",
        linesOfCode: 302,
        description: "Tech routing steps, machinery logs, and prepress stages.",
      },
      materials: {
        id: "materials",
        name: "MaterialsTab",
        fileName: "MaterialsTab.tsx",
        relativePath: "components/documents/work-order/tabs/MaterialsTab.tsx",
        linesOfCode: 26,
        description: "Raw material consumption and BOM reservation table.",
      },
      timeline: {
        id: "timeline",
        name: "ShiftTimelineTab",
        fileName: "ShiftTimelineTab.tsx",
        relativePath: "components/documents/work-order/tabs/ShiftTimelineTab.tsx",
        linesOfCode: 641,
        description: "Gantt timeline of production shifts and machine utilization.",
      },
      financials: {
        id: "financials",
        name: "FinancialsTab",
        fileName: "FinancialsTab.tsx",
        relativePath: "components/documents/work-order/tabs/FinancialsTab.tsx",
        linesOfCode: 178,
        description: "Cost calculation, direct expenses, labor, and profit margins.",
      },
      history: {
        id: "history",
        name: "HistoryTab",
        fileName: "HistoryTab.tsx",
        relativePath: "components/documents/work-order/tabs/HistoryTab.tsx",
        linesOfCode: 15,
        description: "Document audit log and state modification trail.",
      },
    },
  },

  "doc-client-order": {
    componentName: "WorkOrderDetail",
    fileName: "WorkOrderDetail.tsx",
    relativePath: "components/documents/work-order/WorkOrderDetail.tsx",
    linesOfCode: 968,
    featureModule: "production",
    category: "document-editor",
    description: "Consolidated Work Order document (unified order model replacing Client Order).",
  },

  "doc-product-spec": {
    componentName: "ProductSpecDetail",
    fileName: "ProductSpecDetail.tsx",
    relativePath: "components/documents/ProductSpecDetail.tsx",
    linesOfCode: 681,
    featureModule: "production",
    category: "document-editor",
    description: "Standard technical specification for repeat print packaging.",
  },
  "doc-delivery-act": {
    componentName: "DeliveryActDetail",
    fileName: "DeliveryActDetail.tsx",
    relativePath: "components/documents/DeliveryActDetail.tsx",
    linesOfCode: 1010,
    featureModule: "sales",
    category: "document-editor",
    description: "Official Schet-faktura & delivery handover act document.",
  },
  "doc-customer": {
    componentName: "CustomerDetail",
    fileName: "CustomerDetail.tsx",
    relativePath: "components/documents/CustomerDetail.tsx",
    linesOfCode: 1161,
    featureModule: "crm",
    category: "document-editor",
    description: "Customer 360 card, contracts, bank requisites, and contact persons.",
  },
  "doc-warehouse-receipt": {
    componentName: "WarehouseReceiptDetail",
    fileName: "WarehouseReceiptDetail.tsx",
    relativePath: "components/documents/WarehouseReceiptDetail.tsx",
    linesOfCode: 499,
    featureModule: "warehouse",
    category: "document-editor",
    description: "Inbound raw materials receiving invoice (Prikhodniy order).",
  },
  "doc-planning-slot": {
    componentName: "PlanningSlotDetail",
    fileName: "PlanningSlotDetail.tsx",
    relativePath: "components/documents/PlanningSlotDetail.tsx",
    linesOfCode: 1120,
    featureModule: "production",
    category: "document-editor",
    description: "Machine scheduling slot, setup time, and shift planning detail.",
  },
  "doc-bom": {
    componentName: "BomMaterialsGrid",
    fileName: "BomMaterialsGrid.tsx",
    relativePath: "components/documents/BomMaterialsGrid.tsx",
    linesOfCode: 739,
    featureModule: "production",
    category: "document-editor",
    description: "Bill of materials formulation and raw component matrix.",
  },
  "doc-plant-detail": {
    componentName: "PlantDetail",
    fileName: "PlantDetail.tsx",
    relativePath: "components/documents/PlantDetail.tsx",
    linesOfCode: 320,
    featureModule: "settings",
    category: "document-editor",
    description: "Enterprise factory, workshops, bank requisites, and warehouse configurations.",
  },
  "doc-user-detail": {
    componentName: "UserDetail",
    fileName: "UserDetail.tsx",
    relativePath: "components/documents/UserDetail.tsx",
    linesOfCode: 450,
    featureModule: "settings",
    category: "document-editor",
    description: "Enterprise system user card, role-based access control, granular CRUD matrix, and security audit.",
  },
};

/**
 * Resolves the currently active view/tab to its concrete .tsx Component Module
 */
export function resolveActiveComponent(
  tab?: DocumentTab,
  activeModule = "production",
  currentSubModule = "work-orders"
): ActiveComponentResolution {
  const isDocument = Boolean(tab && tab.type !== "registry");
  let meta: ComponentMeta;

  if (isDocument && tab) {
    const docKey = `doc-${tab.type}`;
    meta = COMPONENT_REGISTRY[docKey] || {
      componentName: "DocumentDetail",
      fileName: `${tab.type}.tsx`,
      relativePath: `components/documents/${tab.type}.tsx`,
      linesOfCode: 500,
      featureModule: tab.module || activeModule,
      category: "document-editor",
      description: "Document editor module.",
    };
  } else {
    // Registry / Grid
    const tabId = tab?.id || currentSubModule;
    const mod = tab?.module || activeModule;

    if (tabId.includes("tasks")) {
      meta = COMPONENT_REGISTRY["grid-tasks"];
    } else if (mod === "crm") {
      meta = COMPONENT_REGISTRY[tabId.includes("leads") ? "grid-crm-leads" : "grid-crm-customers"];
    } else if (mod === "production") {
      if (tabId.includes("planning")) meta = COMPONENT_REGISTRY["grid-production-planning"];
      else if (tabId.includes("machines")) meta = COMPONENT_REGISTRY["grid-production-machines"];
      else if (tabId.includes("bom")) meta = COMPONENT_REGISTRY["grid-production-bom"];
      else if (tabId.includes("tooling")) meta = COMPONENT_REGISTRY["grid-production-tooling"];
      else meta = COMPONENT_REGISTRY["grid-production-work-orders"];
    } else if (mod === "warehouse") {
      meta = COMPONENT_REGISTRY["grid-warehouse"];
    } else if (mod === "sales") {
      meta = COMPONENT_REGISTRY["grid-sales"];
    } else if (mod === "finance") {
      meta = COMPONENT_REGISTRY["grid-finance"];
    } else if (mod === "hr") {
      meta = COMPONENT_REGISTRY["grid-hr"];
    } else if (mod === "trading") {
      meta = COMPONENT_REGISTRY["grid-trading"];
    } else if (mod === "settings") {
      meta = COMPONENT_REGISTRY["grid-settings"];
    } else {
      meta = COMPONENT_REGISTRY["grid-production-work-orders"];
    }
  }

  if (!meta) {
    meta = COMPONENT_REGISTRY["grid-production-work-orders"] || {
      componentName: "AppModule",
      fileName: "AppLayout.tsx",
      relativePath: "components/layout/AppLayout.tsx",
      linesOfCode: 500,
      featureModule: (tab?.module || activeModule || "production") as any,
      category: "registry-grid",
      description: "Active system module view.",
    };
  }

  // Handle active subTab inside complex documents
  let activeSubTab: SubComponentMeta | undefined;
  if (isDocument && tab?.activeLevel3Tab && meta?.subTabs) {
    activeSubTab = meta.subTabs[tab.activeLevel3Tab];
  }

  const baseLoc = meta?.linesOfCode || 0;
  const effectiveLoc = activeSubTab ? activeSubTab.linesOfCode : baseLoc;
  const totalLoc = activeSubTab ? baseLoc + activeSubTab.linesOfCode : baseLoc;

  const targetPath = activeSubTab ? activeSubTab.relativePath : (meta?.relativePath || "components/layout/AppLayout.tsx");
  const vscodeUrl = `vscode://file/${WORKSPACE_ROOT}/${targetPath}`;

  const docNo = tab?.documentData?.docNo || tab?.documentData?.id || (isDocument ? tab?.title : undefined);
  const status = tab?.documentData?.status || undefined;

  return {
    featureModule: meta?.featureModule || "production",
    featureModuleLabel: (meta?.featureModule || "production").toUpperCase(),
    subModuleName: tab?.id || currentSubModule,
    componentName: meta?.componentName || "Component",
    fileName: meta?.fileName || "Component.tsx",
    relativePath: targetPath,
    linesOfCode: effectiveLoc,
    category: meta?.category || "registry-grid",
    description: meta?.description || "System view",
    activeSubTab,
    totalLines: totalLoc,
    vscodeUrl,
    isDocument,
    docTitle: tab?.title,
    docNo,
    status,
  };
}
