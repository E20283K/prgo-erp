/**
 * AI Element & Container Inspector Engine (Chrome Ctrl+Shift+C style)
 *
 * Extracts:
 * 1. DOM element / container metadata (tag, data-slot, role, classes, dimensions, text)
 * 2. React 19 Fiber component hierarchy & owning ERP module/component
 * 3. Exact source file (.tsx) and code line range (L123-L145) via source line matching
 * 4. Formatted AI-ready Markdown context for one-click copy to clipboard
 */

import { ActiveComponentResolution, WORKSPACE_ROOT } from "./componentRegistry";

export interface IndexedComponentMeta {
  componentName: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
}

export interface InspectedElementInfo {
  /** Target DOM element */
  element: HTMLElement;
  /** Owning React component root DOM element (if different from element) */
  componentRootEl: HTMLElement | null;
  /** Tag name in lowercase, e.g. 'button', 'div', 'section' */
  tagName: string;
  /** Whether this element acts as a structural container */
  isContainer: boolean;
  /** Human-readable element or container title, e.g. '<Button> "Save"' or '<Card> Container' */
  elementLabel: string;
  /** shadcn/ui data-slot if present (e.g. 'button', 'card', 'tabs-trigger') */
  dataSlot: string | null;
  /** Short visible text or aria-label / title / placeholder */
  textPreview: string;
  /** Distinctive Tailwind / CSS classes on the element */
  classPreview: string;
  /** All class tokens on the element */
  classTokens: string[];
  /** Bounding box in viewport coordinates */
  rect: DOMRect;
  /** Owning feature component name (e.g. 'OverviewTab', 'AppSidebar', 'ProductionGrid') */
  componentName: string;
  /** UI primitive component name if wrapped in one (e.g. 'Button', 'Badge', 'TabsTrigger') */
  uiPrimitiveName: string | null;
  /** Full breadcrumb of React components from feature root down to element */
  componentChain: string[];
  /** ERP Module ID & Label (e.g. 'PRODUCTION') */
  moduleName: string;
  /** Sub-module or active tab title */
  subModuleOrDoc: string;
  /** Relative path to the .tsx source file */
  relativePath: string;
  /** File basename (e.g. 'OverviewTab.tsx') */
  fileName: string;
  /** Total lines of code in the file */
  totalLines: number;
  /** 1-indexed start line in the .tsx source file */
  startLine: number;
  /** 1-indexed end line in the .tsx source file */
  endLine: number;
  /** Formatted line range string, e.g. 'L142' or 'L142-L158' */
  lineRangeLabel: string;
  /** 1-3 lines of source code snippet around startLine */
  codeSnippet: string;
  /** Direct VS Code URL with exact line number */
  vscodeUrl: string;
  /** Formatted AI prompt context string ready to paste into AI chat */
  aiPromptText: string;
}

// In-memory cache on the client for component index & file lines
let clientComponentMap: Record<string, IndexedComponentMeta> = {};
const fileLinesCache = new Map<string, string[]>();
const pendingFileFetches = new Map<string, Promise<string[]>>();
let indexLoaded = false;

// Ignored internal/wrapper component names when walking React Fiber
const IGNORED_FIBER_NAMES = new Set([
  "Fragment",
  "Suspense",
  "StrictMode",
  "ErrorBoundary",
  "Boundary",
  "InnerLayoutRouter",
  "RedirectErrorBoundary",
  "RedirectBoundary",
  "HTTPAccessFallbackErrorBoundary",
  "HTTPAccessFallbackBoundary",
  "LoadingBoundary",
  "OuterLayoutRouter",
  "RenderFromTemplateContext",
  "ScrollAndFocusHandler",
  "InnerScrollAndFocusHandler",
  "AppRouter",
  "ServerRoot",
  "Root",
  "HotReload",
  "ReactDevOverlay",
  "SegmentViewNode",
  "Slot",
  "SlotClone",
  "Primitive",
  "Presence",
  "CollectionSlot",
  "CollectionItemSlot",
  "Popper",
  "PopperContent",
  "PopperAnchor",
  "Portal",
  "FocusScope",
  "DismissableLayer",
  "RovingFocusGroup",
  "TooltipProvider",
  "SidebarProvider",
  "QueryProvider",
  "NextIntlClientProvider",
  "TabContentWrapper",
]);

// Known UI primitive components (from components/ui/* or Radix)
const UI_PRIMITIVE_NAMES = new Set([
  "Button",
  "Badge",
  "Input",
  "Textarea",
  "Select",
  "SelectTrigger",
  "SelectContent",
  "SelectItem",
  "SelectValue",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Dialog",
  "DialogContent",
  "DialogHeader",
  "DialogFooter",
  "DialogTitle",
  "DialogDescription",
  "Sheet",
  "SheetContent",
  "SheetHeader",
  "SheetTitle",
  "DropdownMenu",
  "DropdownMenuTrigger",
  "DropdownMenuContent",
  "DropdownMenuItem",
  "DropdownMenuGroup",
  "DropdownMenuLabel",
  "ContextMenu",
  "ContextMenuTrigger",
  "ContextMenuContent",
  "ContextMenuItem",
  "ContextMenuCheckboxItem",
  "ContextMenuLabel",
  "ContextMenuSeparator",
  "Popover",
  "PopoverTrigger",
  "PopoverContent",
  "Tooltip",
  "TooltipTrigger",
  "TooltipContent",
  "Card",
  "CardHeader",
  "CardTitle",
  "CardDescription",
  "CardContent",
  "CardFooter",
  "ScrollArea",
  "Separator",
  "Checkbox",
  "Switch",
  "Label",
  "Kbd",
  "Avatar",
  "AvatarImage",
  "AvatarFallback",
  "Collapsible",
  "CollapsibleTrigger",
  "CollapsibleContent",
  "Sidebar",
  "SidebarHeader",
  "SidebarContent",
  "SidebarGroup",
  "SidebarGroupLabel",
  "SidebarMenu",
  "SidebarMenuItem",
  "SidebarMenuButton",
  "SidebarMenuSub",
  "SidebarMenuSubItem",
  "SidebarMenuSubButton",
  "SidebarTrigger",
  "SidebarInset",
  "SidebarRail",
]);

// Static fallback map for core layout & feature components
const STATIC_COMPONENT_FILES: Record<string, string> = {
  AppLayout: "components/layout/AppLayout.tsx",
  AppSidebar: "components/layout/Sidebar.tsx",
  Sidebar: "components/layout/Sidebar.tsx",
  Workspace: "components/layout/Workspace.tsx",
  StatusBar: "components/layout/StatusBar.tsx",
  CommandPalette: "components/command/CommandPalette.tsx",
  AiChatSheet: "components/layout/AiChatSheet.tsx",
  NotificationPanel: "components/layout/NotificationPanel.tsx",
  UserNav: "components/layout/UserNav.tsx",
  LanguageSwitcher: "components/layout/LanguageSwitcher.tsx",
  RegistryGridRenderer: "components/layout/RegistryGridRenderer.tsx",
  DataGrid: "components/grid/DataGrid.tsx",
  ProductionGrid: "components/grid/ProductionGrid.tsx",
  CrmGrid: "components/grid/CrmGrid.tsx",
  TaskGrid: "components/grid/TaskGrid.tsx",
  WarehouseGrid: "components/grid/WarehouseGrid.tsx",
  SalesGrid: "components/grid/SalesGrid.tsx",
  FinanceGrid: "components/grid/FinanceGrid.tsx",
  SettingsGrid: "components/grid/SettingsGrid.tsx",
  TradingGrid: "components/grid/TradingGrid.tsx",
  MachineQueueBoard: "components/grid/MachineQueueBoard.tsx",
  WorkOrderDetail: "components/documents/work-order/WorkOrderDetail.tsx",
  OverviewTab: "components/documents/work-order/tabs/OverviewTab.tsx",
  SpecificationsTab: "components/documents/work-order/tabs/SpecificationsTab.tsx",
  LayoutCalcTab: "components/documents/work-order/tabs/layout-calc/LayoutCalcTab.tsx",
  FlexoCalcTab: "components/documents/work-order/tabs/FlexoCalcTab.tsx",
  SampleTab: "components/documents/work-order/tabs/SampleTab.tsx",
  OperationsTab: "components/documents/work-order/tabs/OperationsTab.tsx",
  MaterialsTab: "components/documents/work-order/tabs/MaterialsTab.tsx",
  ShiftTimelineTab: "components/documents/work-order/tabs/ShiftTimelineTab.tsx",
  FinancialsTab: "components/documents/work-order/tabs/FinancialsTab.tsx",
  HistoryTab: "components/documents/work-order/tabs/HistoryTab.tsx",
  DimensionsSection: "components/documents/work-order/tabs/layout-calc/panels/DimensionsSection.tsx",
  OverproductionSection: "components/documents/work-order/tabs/layout-calc/panels/OverproductionSection.tsx",
  PlateTabs: "components/documents/work-order/tabs/layout-calc/panels/PlateTabs.tsx",
  ProductionSummary: "components/documents/work-order/tabs/layout-calc/panels/ProductionSummary.tsx",
  SampleConfigSection: "components/documents/work-order/tabs/layout-calc/panels/SampleConfigSection.tsx",
  SlotAssignmentTable: "components/documents/work-order/tabs/layout-calc/panels/SlotAssignmentTable.tsx",
  PrintPlanningCard: "components/documents/work-order/tabs/layout-calc/panels/PrintPlanningCard.tsx",
  SheetPreview: "components/documents/work-order/tabs/layout-calc/preview/SheetPreview.tsx",
  PreviewToolbar: "components/documents/work-order/tabs/layout-calc/preview/PreviewToolbar.tsx",
  LayoutCell: "components/documents/work-order/tabs/layout-calc/preview/LayoutCell.tsx",
  OrderReadinessRouteCard: "components/documents/work-order/OrderReadinessRouteCard.tsx",
  DieLinePreview: "components/documents/work-order/DieLinePreview.tsx",
  TextileLabelPreview: "components/documents/work-order/TextileLabelPreview.tsx",
  SizeMatrixCard: "components/documents/work-order/tabs/SizeMatrixCard.tsx",
  CustomerDetail: "components/documents/CustomerDetail.tsx",
  DeliveryActDetail: "components/documents/DeliveryActDetail.tsx",
  ProductSpecDetail: "components/documents/ProductSpecDetail.tsx",
  WarehouseReceiptDetail: "components/documents/WarehouseReceiptDetail.tsx",
  WarehouseShipmentDetail: "components/documents/WarehouseShipmentDetail.tsx",
  WarehouseStockDetail: "components/documents/WarehouseStockDetail.tsx",
  PlanningSlotDetail: "components/documents/PlanningSlotDetail.tsx",
  MachineDetail: "components/documents/MachineDetail.tsx",
  PlantDetail: "components/documents/PlantDetail.tsx",
  UserDetail: "components/documents/UserDetail.tsx",
  EmployeeDetail: "components/documents/hr/EmployeeDetail.tsx",
  TradingSaleDetail: "components/documents/trading/TradingSaleDetail.tsx",
  TradingSettlementDetail: "components/documents/trading/TradingSettlementDetail.tsx",
  BomMaterialsGrid: "components/documents/BomMaterialsGrid.tsx",
};

/**
 * Preloads the component index from /api/dev/source?index=1
 */
export async function ensureComponentIndexLoaded(): Promise<void> {
  if (indexLoaded) return;
  try {
    const res = await fetch("/api/dev/source?index=1");
    if (res.ok) {
      const data = await res.json();
      if (data.componentMap) {
        clientComponentMap = data.componentMap;
        indexLoaded = true;
      }
    }
  } catch {
    // ignore fetch error
  }
}

/**
 * Fetches and caches source lines for a relative file path
 */
export async function preloadSourceFile(
  relativePath: string,
  onLoaded?: () => void
): Promise<string[]> {
  if (!relativePath) return [];
  const cached = fileLinesCache.get(relativePath);
  if (cached) return cached;

  const existingPromise = pendingFileFetches.get(relativePath);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/dev/source?file=${encodeURIComponent(relativePath)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.componentMap && !indexLoaded) {
          clientComponentMap = data.componentMap;
          indexLoaded = true;
        }
        if (Array.isArray(data.lines) && data.lines.length > 0) {
          fileLinesCache.set(relativePath, data.lines);
          onLoaded?.();
          return data.lines as string[];
        }
      }
    } catch {
      // ignore
    } finally {
      pendingFileFetches.delete(relativePath);
    }
    return [];
  })();

  pendingFileFetches.set(relativePath, promise);
  return promise;
}

/**
 * Extracts React Fiber node from a DOM element
 */
function getReactFiber(el: HTMLElement | null): any | null {
  let curr: HTMLElement | null = el;
  while (curr) {
    const keys = Object.keys(curr);
    for (const k of keys) {
      if (k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")) {
        return (curr as any)[k];
      }
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Gets the clean component name from a React Fiber node
 */
function getFiberComponentName(fiber: any): string | null {
  if (!fiber || !fiber.type) return null;
  const { type } = fiber;
  if (typeof type === "string") return null; // Host DOM node
  const rawName =
    type.displayName ||
    type.name ||
    type.render?.displayName ||
    type.render?.name ||
    type.type?.displayName ||
    type.type?.name ||
    null;

  if (!rawName || typeof rawName !== "string") return null;
  // Strip HOC prefixes
  const cleaned = rawName.replace(/^(Memo|ForwardRef)\((.*)\)$/, "$2").trim();
  if (!cleaned || cleaned.length <= 1 || cleaned.startsWith("_")) return null;
  if (IGNORED_FIBER_NAMES.has(cleaned)) return null;
  return cleaned;
}

/**
 * Finds the first host DOM HTMLElement inside a component Fiber
 */
function findFirstHostDomInFiber(fiber: any): HTMLElement | null {
  if (!fiber) return null;
  let curr = fiber.child;
  let depth = 0;
  while (curr && depth < 25) {
    if (curr.stateNode instanceof HTMLElement) {
      return curr.stateNode;
    }
    curr = curr.child;
    depth++;
  }
  return null;
}

/**
 * Attempts to extract exact line number from React 19 _debugSource or _debugStack
 */
function extractDebugLineFromFiber(fiber: any, targetFileName: string): number | null {
  let curr = fiber;
  let steps = 0;
  const escapedFile = targetFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stackLineRegex = new RegExp(`${escapedFile}[^:\\n]*:(\\d+):(\\d+)`);

  while (curr && steps < 15) {
    // 1. Classic _debugSource
    if (curr._debugSource?.lineNumber) {
      const srcFile = String(curr._debugSource.fileName || "");
      if (!targetFileName || srcFile.endsWith(targetFileName)) {
        return Number(curr._debugSource.lineNumber);
      }
    }
    // 2. React 19 _debugStack Error object
    const stackStr =
      typeof curr._debugStack === "string"
        ? curr._debugStack
        : curr._debugStack?.stack;
    if (typeof stackStr === "string" && targetFileName) {
      const m = stackLineRegex.exec(stackStr);
      if (m && m[1]) {
        const parsed = parseInt(m[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    curr = curr._debugOwner || curr.return;
    steps++;
  }
  return null;
}

/**
 * Determines whether a DOM element is a structural container vs a leaf interactive/display element
 */
function isElementContainer(el: HTMLElement, dataSlot: string | null): boolean {
  const tag = el.tagName.toLowerCase();
  if (["section", "article", "aside", "header", "footer", "main", "nav", "form", "fieldset", "ul", "ol"].includes(tag)) {
    return true;
  }
  if (dataSlot && ["card", "card-header", "card-content", "card-footer", "dialog-content", "sheet-content", "tabs", "tabs-list", "tabs-content", "sidebar", "sidebar-content", "sidebar-group", "scroll-area", "popover-content"].includes(dataSlot)) {
    return true;
  }
  if (tag === "div") {
    const childElements = el.children.length;
    if (childElements >= 2) return true;
    const cls = typeof el.className === "string" ? el.className : "";
    if (/\b(flex|grid|space-y-|space-x-|p-\d|px-\d|py-\d|border|rounded-lg|rounded-xl|bg-card)\b/.test(cls) && childElements >= 1) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts direct text content of an element (preferring immediate text nodes or short innerText)
 */
function getCleanElementText(el: HTMLElement): string {
  // Check direct text nodes first
  let directText = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent || "";
    }
  }
  directText = directText.replace(/\s+/g, " ").trim();
  if (directText.length >= 2 && directText.length <= 80) {
    return directText;
  }

  // Attributes fallback
  const attrText =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("placeholder") ||
    (el as HTMLInputElement).value ||
    "";
  if (attrText.trim()) {
    return attrText.trim().slice(0, 70);
  }

  // Fallback to innerText if reasonably short
  const inner = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  if (inner.length > 0) {
    return inner.length > 65 ? inner.slice(0, 62) + "..." : inner;
  }
  return "";
}

/**
 * Matches a DOM element against the cached .tsx source lines to find the exact startLine, endLine, and codeSnippet
 */
function matchElementInSourceLines(
  el: HTMLElement,
  lines: string[],
  uiPrimitiveName: string | null,
  debugLineHint: number | null
): { startLine: number; endLine: number; snippet: string } {
  if (!lines || lines.length === 0) {
    const fallbackLine = debugLineHint || 1;
    return {
      startLine: fallbackLine,
      endLine: fallbackLine,
      snippet: "",
    };
  }

  // If React Fiber gave us a valid line hint inside the file bounds, refine around it
  if (debugLineHint && debugLineHint >= 1 && debugLineHint <= lines.length) {
    const endLine = findClosingTagLine(lines, debugLineHint - 1);
    const snippet = formatCodeSnippet(lines, debugLineHint, Math.min(endLine, debugLineHint + 2));
    return { startLine: debugLineHint, endLine, snippet };
  }

  const tag = el.tagName.toLowerCase();
  const rawClass = typeof el.className === "string" ? el.className : "";
  const classTokens = rawClass
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 3 && !c.startsWith("data-[") && !c.startsWith("focus-visible:") && !c.startsWith("disabled:"));

  // Pick distinctive class tokens (colors, specific widths/heights, gaps, borders, fonts, positioning)
  const distinctiveTokens = classTokens.filter(
    (c) =>
      !/^(flex|items-center|justify-between|justify-center|w-full|h-full|text-xs|text-sm|font-medium|cursor-pointer|transition-colors|shrink-0|min-w-0|truncate|select-none)$/.test(
        c
      )
  );

  // Also collect parent's distinctive class tokens for disambiguation
  const parentRawClass =
    el.parentElement && typeof el.parentElement.className === "string"
      ? el.parentElement.className
      : "";
  const parentTokens = parentRawClass
    .split(/\s+/)
    .filter((c) => c.length >= 4 && !/^(flex|w-full|h-full|items-center)$/.test(c));

  const directText = getCleanElementText(el).replace(/\.\.\.$/, "").trim();
  const titleAttr = el.getAttribute("title") || "";
  const placeholderAttr = el.getAttribute("placeholder") || "";

  let bestLineIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("import ") || trimmed.startsWith("export interface")) {
      continue;
    }

    // Look at a 4-line window starting at line i (since JSX props often span 2-4 lines)
    const windowText = lines.slice(i, Math.min(lines.length, i + 5)).join(" ");
    let score = 0;

    // 1. Check JSX opening tag match on line i
    if (uiPrimitiveName && line.includes(`<${uiPrimitiveName}`)) {
      score += 28;
    } else if (line.includes(`<${tag}`) && (line.includes(`<${tag} `) || line.includes(`<${tag}>`) || line.endsWith(`<${tag}`))) {
      score += 18;
    } else if (/^\s*<[A-Z][A-Za-z0-9_]*/.test(line)) {
      score += 8;
    } else if (!line.includes("<") && !line.includes("className")) {
      continue;
    }

    // 2. Match distinctive className tokens in the 4-line JSX opening window
    if (distinctiveTokens.length > 0 && windowText.includes("className")) {
      let matchedDistinctive = 0;
      for (const tok of distinctiveTokens) {
        if (windowText.includes(tok)) {
          matchedDistinctive++;
          score += 14;
        }
      }
      if (matchedDistinctive >= 3) {
        score += 30;
      }
      if (matchedDistinctive === distinctiveTokens.length && distinctiveTokens.length >= 2) {
        score += 25;
      }
    }

    // 3. Match regular class tokens
    if (classTokens.length > 0 && windowText.includes("className")) {
      let matchedCommon = 0;
      for (const tok of classTokens) {
        if (windowText.includes(tok)) {
          matchedCommon++;
          score += 4;
        }
      }
      if (matchedCommon === classTokens.length && classTokens.length >= 3) {
        score += 20;
      }
    }

    // 4. Match visible text / title / placeholder in a 6-line window
    const widerWindow = lines.slice(i, Math.min(lines.length, i + 7)).join(" ");
    if (directText && directText.length >= 3 && directText.length <= 50) {
      if (widerWindow.includes(directText)) {
        score += 45;
      } else {
        // Case-insensitive partial word match
        const firstWord = directText.split(/\s+/)[0];
        if (firstWord && firstWord.length >= 4 && widerWindow.toLowerCase().includes(firstWord.toLowerCase())) {
          score += 15;
        }
      }
    }
    if (titleAttr && titleAttr.length >= 4 && widerWindow.includes(titleAttr)) {
      score += 45;
    }
    if (placeholderAttr && placeholderAttr.length >= 4 && widerWindow.includes(placeholderAttr)) {
      score += 45;
    }

    // 5. Check parent context within 18 lines above
    if (score >= 18 && parentTokens.length > 0 && i > 0) {
      const aboveWindow = lines.slice(Math.max(0, i - 18), i).join(" ");
      let parentMatches = 0;
      for (const pTok of parentTokens) {
        if (aboveWindow.includes(pTok)) {
          parentMatches++;
        }
      }
      score += Math.min(parentMatches * 6, 24);
    }

    if (score > bestScore) {
      bestScore = score;
      bestLineIdx = i;
    }
  }

  // If line is a `className=` continuation line, walk up 1-2 lines to the opening `<Tag`
  while (
    bestLineIdx > 0 &&
    !lines[bestLineIdx].includes("<") &&
    lines[bestLineIdx - 1].includes("<")
  ) {
    bestLineIdx--;
  }

  const startLine = bestLineIdx + 1;
  const endLine = findClosingTagLine(lines, bestLineIdx);
  const snippet = formatCodeSnippet(lines, startLine, Math.min(endLine, startLine + 2));

  return { startLine, endLine, snippet };
}

/**
 * Finds the closing line (1-indexed) of a JSX element starting at startIdx (0-indexed)
 */
function findClosingTagLine(lines: string[], startIdx: number): number {
  const firstLine = lines[startIdx] || "";
  const tagMatch = /<([A-Za-z0-9_.-]+)/.exec(firstLine);
  if (!tagMatch) return startIdx + 1;

  const tagName = tagMatch[1];
  // Check if self-closing or closed on the same line
  if (firstLine.includes("/>") || firstLine.includes(`</${tagName}>`)) {
    return startIdx + 1;
  }

  const baseIndent = firstLine.search(/\S/);
  let depth = 0;
  const maxScan = Math.min(lines.length, startIdx + 120);

  for (let i = startIdx; i < maxScan; i++) {
    const ln = lines[i];
    if (i === startIdx && ln.trim().endsWith("/>")) {
      return i + 1;
    }
    // Check if opening tag wasn't closed yet and self-closes within a few lines
    if (i <= startIdx + 6 && ln.trim().endsWith("/>") && depth <= 1) {
      return i + 1;
    }
    const openRegex = new RegExp(`<${tagName}(\\s|>|$)`, "g");
    const closeRegex = new RegExp(`</${tagName}>`, "g");
    const opens = (ln.match(openRegex) || []).length;
    const closes = (ln.match(closeRegex) || []).length;
    depth += opens - closes;
    if (depth <= 0 && i > startIdx && closes > 0) {
      return i + 1;
    }
    // Fallback indentation match for closing tag
    if (i > startIdx && baseIndent >= 0) {
      const indent = ln.search(/\S/);
      if (indent === baseIndent && ln.trim().startsWith(`</${tagName}>`)) {
        return i + 1;
      }
    }
  }

  return Math.min(lines.length, startIdx + 4);
}

/**
 * Formats 1-3 lines of source code with line numbers
 */
function formatCodeSnippet(lines: string[], startLine: number, maxEndLine: number): string {
  const out: string[] = [];
  for (let ln = startLine; ln <= maxEndLine && ln <= lines.length; ln++) {
    const raw = lines[ln - 1] ?? "";
    out.push(`${ln} | ${raw.trim()}`);
  }
  return out.join("\n");
}

/**
 * Resolves full AI inspection metadata for a DOM element
 */
export function inspectDomElement(
  targetEl: HTMLElement,
  activeResolution: ActiveComponentResolution,
  onAsyncSourceLoaded?: () => void
): InspectedElementInfo {
  const tagName = targetEl.tagName.toLowerCase();
  const dataSlot = targetEl.getAttribute("data-slot");
  const isContainer = isElementContainer(targetEl, dataSlot);
  const rect = targetEl.getBoundingClientRect();

  const rawClass = typeof targetEl.className === "string" ? targetEl.className : "";
  const classTokens = rawClass.split(/\s+/).filter(Boolean);
  const classPreview = classTokens.slice(0, 4).join(".");

  const textPreview = getCleanElementText(targetEl);

  // Walk React Fiber tree to find UI primitive + owning feature component
  const startFiber = getReactFiber(targetEl);
  const rawChain: string[] = [];
  let uiPrimitiveName: string | null = null;
  let owningComponentName: string | null = null;
  let owningComponentFiber: any = null;

  let curr = startFiber;
  let steps = 0;
  while (curr && steps < 60) {
    const compName = getFiberComponentName(curr);
    if (compName) {
      if (rawChain[rawChain.length - 1] !== compName) {
        rawChain.push(compName);
      }
      if (UI_PRIMITIVE_NAMES.has(compName)) {
        if (!uiPrimitiveName) {
          uiPrimitiveName = compName;
        }
      } else if (!owningComponentName) {
        // Check if this is a known feature/layout component
        if (
          STATIC_COMPONENT_FILES[compName] ||
          clientComponentMap[compName] ||
          !compName.endsWith("Provider")
        ) {
          owningComponentName = compName;
          owningComponentFiber = curr;
        }
      }
    }
    curr = curr.return;
    steps++;
  }

  // Fallback by DOM region if Fiber names were minified or unavailable
  if (!owningComponentName) {
    if (targetEl.closest("footer")) {
      owningComponentName = "StatusBar";
    } else if (targetEl.closest('[data-slot="sidebar"]')) {
      owningComponentName = "AppSidebar";
    } else {
      owningComponentName =
        activeResolution.activeSubTab?.name || activeResolution.componentName;
    }
  }

  // Determine source file path
  let relativePath =
    clientComponentMap[owningComponentName]?.relativePath ||
    STATIC_COMPONENT_FILES[owningComponentName] ||
    (activeResolution.activeSubTab?.name === owningComponentName
      ? activeResolution.activeSubTab.relativePath
      : activeResolution.relativePath);

  // Special case: if inside Sidebar / StatusBar / Workspace header
  if (owningComponentName === "AppSidebar" || owningComponentName === "Sidebar") {
    relativePath = "components/layout/Sidebar.tsx";
  } else if (owningComponentName === "StatusBar") {
    relativePath = "components/layout/StatusBar.tsx";
  } else if (owningComponentName === "Workspace") {
    relativePath = "components/layout/Workspace.tsx";
  }

  const fileName = relativePath.split("/").pop() || `${owningComponentName}.tsx`;

  // Trigger preload of source file if not already cached
  const cachedLines = fileLinesCache.get(relativePath) || [];
  if (cachedLines.length === 0) {
    preloadSourceFile(relativePath, onAsyncSourceLoaded);
  }

  const debugLineHint = extractDebugLineFromFiber(
    owningComponentFiber || startFiber,
    fileName
  );

  const { startLine, endLine, snippet } = matchElementInSourceLines(
    targetEl,
    cachedLines,
    uiPrimitiveName,
    debugLineHint
  );

  const totalLines =
    cachedLines.length ||
    clientComponentMap[owningComponentName]?.linesOfCode ||
    activeResolution.linesOfCode;

  const lineRangeLabel =
    endLine > startLine ? `L${startLine}-L${endLine}` : `L${startLine}`;

  const vscodeUrl = `vscode://file/${WORKSPACE_ROOT}/${relativePath}:${startLine}:1`;

  // Build readable hierarchy chain (feature components from top to leaf)
  const featureChain = rawChain
    .filter((name) => !UI_PRIMITIVE_NAMES.has(name) && name !== "AppLayout")
    .reverse();
  if (featureChain.length === 0) {
    featureChain.push(owningComponentName);
  }
  if (uiPrimitiveName) {
    featureChain.push(uiPrimitiveName);
  }

  // Human-readable element label
  const displayType = uiPrimitiveName
    ? `<${uiPrimitiveName}>`
    : dataSlot
    ? `<${tagName}[${dataSlot}]>`
    : `<${tagName}>`;
  const kindTag = isContainer ? "Container" : "Element";
  const elementLabel = textPreview
    ? `${displayType} "${textPreview.slice(0, 36)}"`
    : `${displayType} (${kindTag})`;

  const moduleName = activeResolution.featureModuleLabel || "PRODUCTION";
  const subModuleOrDoc = activeResolution.isDocument
    ? `${activeResolution.subModuleName} (${activeResolution.docNo || activeResolution.docTitle || "Doc"})`
    : activeResolution.subModuleName;

  const componentRootEl = findFirstHostDomInFiber(owningComponentFiber);

  const aiPromptText = [
    `[UI Element Context]`,
    `- Target: ${elementLabel} [${kindTag}]`,
    `- Component: ${owningComponentName}${featureChain.length > 1 ? ` (${featureChain.join(" › ")})` : ""}`,
    `- ERP Module: ${moduleName} › ${subModuleOrDoc}`,
    `- File & Line: ${relativePath}:${lineRangeLabel} (${startLine}..${endLine} of ${totalLines} LOC)`,
    `- DOM Selector: ${tagName}${dataSlot ? `[data-slot="${dataSlot}"]` : ""}${classPreview ? `.${classPreview}` : ""}`,
    ...(snippet ? [`- Source Code:\n${snippet}`] : []),
  ].join("\n");

  return {
    element: targetEl,
    componentRootEl,
    tagName,
    isContainer,
    elementLabel,
    dataSlot,
    textPreview,
    classPreview,
    classTokens,
    rect,
    componentName: owningComponentName,
    uiPrimitiveName,
    componentChain: featureChain,
    moduleName,
    subModuleOrDoc,
    relativePath,
    fileName,
    totalLines,
    startLine,
    endLine,
    lineRangeLabel,
    codeSnippet: snippet,
    vscodeUrl,
    aiPromptText,
  };
}
