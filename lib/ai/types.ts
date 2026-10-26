export type CopilotRole = "system" | "user" | "assistant";

export interface CopilotScreenSnapshot {
  selectedRowId?: string;
  selectedEntityTitle?: string;
  visibleFilterSummary?: string;
  visibleRowsCount?: number;
  activeDocumentFields?: Record<string, any>;
}

export interface CopilotUiContext {
  activeModule: string;
  activeSubModule?: string;
  activeTabId?: string;
  activeTabType?: string;
  activeTabTitle?: string;
  activeDocumentSummary?: Record<string, any> | null;
  userRole?: string;
  userName?: string;
  locale?: string;
  clientDataSnapshot?: {
    workOrdersCount?: number;
    stockAlertsCount?: number;
    activeMachinesCount?: number;
    debtTotalUsd?: number;
  };
  screenSnapshot?: CopilotScreenSnapshot;
  includeActiveTabContext: boolean;
}

export type CopilotToolStatus = "running" | "done" | "error";

export interface CopilotToolStep {
  id: string;
  toolName: string;
  label: string;
  status: CopilotToolStatus;
  summary?: string;
  durationMs?: number;
}

export type CopilotClientActionType =
  | "open_tab"
  | "navigate_module"
  | "create_draft_tab"
  | "apply_grid_filter"
  | "highlight_anomalies";

export interface CopilotClientAction {
  id: string;
  type: CopilotClientActionType;
  label: string;
  iconName?:
    | "FileText"
    | "Boxes"
    | "Printer"
    | "DollarSign"
    | "ArrowRight"
    | "Plus"
    | "User"
    | "Truck"
    | "Calculator"
    | "Filter"
    | "AlertTriangle";
  payload: {
    tab?: any;
    module?: string;
    subModule?: string;
    tabType?: string;
    initialData?: any;
    title?: string;
    filterQuery?: string;
    filterField?: string;
    targetIds?: string[];
    [key: string]: any;
  };
}

export interface CopilotMetric {
  label: string;
  value: string | number;
  sublabel?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export interface CopilotTable {
  headers: string[];
  rows: (string | number)[][];
}

export interface CopilotMessage {
  id: string;
  role: CopilotRole;
  content: string;
  timestamp: string;
  toolSteps?: CopilotToolStep[];
  actions?: CopilotClientAction[];
  metrics?: CopilotMetric[];
  structuredTable?: CopilotTable;
}

export interface CopilotRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  context: CopilotUiContext;
  companyCode?: string;
}

export type CopilotProviderMode = "gemini" | "openai" | "claude" | "smart_local";

export interface CopilotResponse {
  success: boolean;
  message: string;
  toolSteps?: CopilotToolStep[];
  actions?: CopilotClientAction[];
  metrics?: CopilotMetric[];
  structuredTable?: CopilotTable;
  providerMode: CopilotProviderMode;
  error?: string;
}

export interface CopilotToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }
    >;
    required?: string[];
  };
}
