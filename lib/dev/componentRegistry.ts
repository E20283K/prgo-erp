/**
 * Resolves the active workspace view to the source file that renders it.
 *
 * Reads the same route tables the workspace renders from
 * (lib/workspace/viewRoutes.ts), so the dev tools always point at the
 * component that is really on screen. Line counts are not stored here:
 * they come live from /api/dev/source (see useSourceLineCount).
 */

import type { DocumentTab } from "@/store/workspaceStore";
import {
  DOCUMENT_SUBVIEWS,
  DOCUMENT_VIEWS,
  REGISTRY_COMPONENT_FILES,
  isDocumentViewType,
  resolveRegistryView,
} from "@/lib/workspace/viewRoutes";

export interface ResolvedFile {
  componentName: string;
  fileName: string;
  relativePath: string;
}

export interface ActiveComponentResolution {
  /** Module of the active tab, e.g. "warehouse". */
  module: string;
  /** Tab id for registries, tab type for documents. */
  viewId: string;
  isDocument: boolean;
  /** Component the workspace mounts for this tab. */
  view: ResolvedFile;
  /** String props the workspace passes to it, e.g. { type: "receipts" }. */
  props?: Record<string, string>;
  /** Inner document tab (activeLevel3Tab) and the component rendering it. */
  subView?: ResolvedFile & { id: string };
  /** Innermost known file: subView if any, else view. */
  target: ResolvedFile;
  /** False when the tab did not match any route (fallback shown). */
  matched: boolean;
  record?: { docNo?: string; id?: string | number; status?: string };
  vscodeUrl: string;
}

export const WORKSPACE_ROOT =
  process.env.NEXT_PUBLIC_WORKSPACE_ROOT ||
  "c:/Users/ThinkPad X1/Documents/PROJECTS/printgoo_ecosystem";

export function vscodeFileUrl(relativePath: string, line?: number): string {
  return `vscode://file/${WORKSPACE_ROOT}/${relativePath}${line ? `:${line}:1` : ""}`;
}

function fileOf(componentName: string, relativePath: string): ResolvedFile {
  return { componentName, relativePath, fileName: relativePath.split("/").pop() || relativePath };
}

const WORKSPACE_FILE = fileOf("Workspace", "components/layout/Workspace.tsx");

export function resolveActiveComponent(
  tab: DocumentTab | undefined,
  activeModule: string,
  currentSubModule: string
): ActiveComponentResolution {
  const module = tab?.module || activeModule;

  if (tab && tab.type !== "registry") {
    const docType = isDocumentViewType(tab.type) ? tab.type : null;
    const known = docType !== null;
    const view = docType
      ? fileOf(DOCUMENT_VIEWS[docType].component, DOCUMENT_VIEWS[docType].file)
      : WORKSPACE_FILE;

    let subView: ActiveComponentResolution["subView"];
    const subId = tab.activeLevel3Tab;
    const sub = docType && subId ? DOCUMENT_SUBVIEWS[docType]?.[subId] : undefined;
    if (sub && subId) subView = { id: subId, ...fileOf(sub.component, sub.file) };

    const data = tab.documentData ?? {};
    const record = {
      docNo: data.docNo ?? data.number ?? undefined,
      id: data.id ?? undefined,
      status: data.status ?? undefined,
    };
    const target = subView ?? view;
    return {
      module,
      viewId: tab.type,
      isDocument: true,
      view,
      subView,
      target,
      matched: known,
      record: record.docNo || record.id || record.status ? record : undefined,
      vscodeUrl: vscodeFileUrl(target.relativePath),
    };
  }

  const { view: route, matched } = resolveRegistryView({
    id: tab?.id || currentSubModule,
    module,
  });
  const view = fileOf(route.component, REGISTRY_COMPONENT_FILES[route.component]);
  return {
    module,
    viewId: tab?.id || currentSubModule,
    isDocument: false,
    view,
    props: route.props,
    target: view,
    matched,
    vscodeUrl: vscodeFileUrl(view.relativePath),
  };
}

/** `WarehouseGrid type="receipts"` */
export function formatViewSignature(r: ActiveComponentResolution): string {
  const props = Object.entries(r.props ?? {})
    .map(([k, val]) => `${k}="${val}"`)
    .join(" ");
  return props ? `${r.view.componentName} ${props}` : r.view.componentName;
}

/**
 * Compact view context for an AI prompt: where the user is, what is mounted,
 * which record is open. No line totals or styling noise.
 */
export function buildViewContextLines(r: ActiveComponentResolution): string[] {
  const lines = [
    `View: ${r.module} › ${r.viewId}${r.subView ? ` › ${r.subView.id}` : ""}`,
    `Mounted: ${formatViewSignature(r)} (${r.view.relativePath})`,
  ];
  if (r.subView) {
    lines.push(`Inner tab: ${r.subView.componentName} (${r.subView.relativePath})`);
  }
  if (r.record) {
    const { docNo, id, status } = r.record;
    const parts = [docNo, id !== undefined && String(id) !== String(docNo) ? `id ${id}` : null, status];
    lines.push(`Record: ${parts.filter(Boolean).join(" · ")}`);
  }
  if (!r.matched) {
    lines.push("Note: tab matched no route in lib/workspace/viewRoutes.ts; a fallback view is shown.");
  }
  return lines;
}
