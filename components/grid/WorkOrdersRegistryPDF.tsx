import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { OrderRow } from "./DataGrid";
import type { ProductionReadinessChecks } from "@/store/workspaceStore";
import { PrintgooPdfLogo } from "./PrintgooPdfLogo";

// Register local Unicode Roboto font supporting Latin, Uzbek, Turkish, and Cyrillic
Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

export interface RegistryPrintRow extends OrderRow {
  resolvedThumbUrl?: string;
  thumbSourceType?: "proof" | "artwork" | "sku" | null;
  resolvedSkuThumbs?: Record<string, string>;
  evaluatedChecks: ProductionReadinessChecks;
}

export interface WorkOrdersRegistryPdfLabels {
  title: string;
  colSketch: string;
  colDocDeadline: string;
  colCustomerProduct: string;
  colMachineOperator: string;
  colQtySizes: string;
  colSizeBreakdown: string;
  colTechSpecs: string;
  colGates: string;
  colStateSample: string;
  colNote: string;
  deptOrdersCount: string;
  totalQtyLabel: string;
  pageLabel: string;
  statusActive: string;
  statusDraft: string;
  priorityUrgent: string;
  priorityHigh: string;
  priorityNormal: string;
}

export interface WorkOrdersRegistryPDFProps {
  rows: RegistryPrintRow[];
  orientation: "landscape" | "portrait";
  showThumbnails: boolean;
  filterSummaryText: string;
  generatedAt: string;
  labels: WorkOrdersRegistryPdfLabels;
}

const DEPT_ORDER = ["Offset", "Flexo", "Jacquard", "Termo", "Post-press", "Digital"];

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 20,
    paddingHorizontal: 14,
    fontFamily: "Roboto",
    fontSize: 6.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.2,
    borderBottomColor: "#0f172a",
    paddingBottom: 4,
    marginBottom: 6,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  filterSub: {
    fontSize: 6.2,
    color: "#475569",
    marginLeft: 4,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryPill: {
    backgroundColor: "#f1f5f9",
    borderWidth: 0.6,
    borderColor: "#cbd5e1",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 1.5,
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  timestampText: {
    fontSize: 6.2,
    color: "#475569",
  },

  // Department Section Group
  deptSection: {
    marginBottom: 6,
  },
  deptHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },
  deptTitle: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  deptMeta: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#93c5fd",
  },

  // High-Density Table
  table: {
    width: "100%",
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#94a3b8",
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 0.8,
    borderBottomColor: "#64748b",
    alignItems: "stretch",
  },
  thCell: {
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
    justifyContent: "center",
  },
  thText: {
    fontSize: 5.6,
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  },
  trRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    alignItems: "stretch",
    minHeight: 28,
  },
  trRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tdCell: {
    paddingVertical: 2.2,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
    justifyContent: "center",
  },

  // Typography helpers
  boldDark: {
    fontSize: 6.6,
    fontWeight: "bold",
    color: "#0f172a",
  },
  regularSlate: {
    fontSize: 5.8,
    color: "#334155",
    marginTop: 0.8,
  },
  mutedSmall: {
    fontSize: 5.3,
    color: "#64748b",
    marginTop: 0.6,
  },

  // Priority Badges
  prioUrgent: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    fontSize: 4.8,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.8,
    borderRadius: 1,
  },
  prioHigh: {
    backgroundColor: "#d97706",
    color: "#ffffff",
    fontSize: 4.8,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.8,
    borderRadius: 1,
  },
  prioNormal: {
    backgroundColor: "#e2e8f0",
    color: "#475569",
    fontSize: 4.8,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.8,
    borderRadius: 1,
  },

  // Deadline Countdown Pill
  deadlineBadgeOverdue: {
    backgroundColor: "#fee2e2",
    borderWidth: 0.5,
    borderColor: "#ef4444",
    color: "#b91c1c",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.6,
    borderRadius: 1,
  },
  deadlineBadgeSoon: {
    backgroundColor: "#fef3c7",
    borderWidth: 0.5,
    borderColor: "#f59e0b",
    color: "#b45309",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.6,
    borderRadius: 1,
  },
  deadlineBadgeOk: {
    backgroundColor: "#f1f5f9",
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    color: "#334155",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 2.5,
    paddingVertical: 0.6,
    borderRadius: 1,
  },

  // Thumbnail frame
  thumbBox: {
    width: 24,
    height: 24,
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    borderRadius: 1.5,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: {
    width: 22,
    height: 22,
    objectFit: "contain",
  },
  thumbPlaceholder: {
    fontSize: 5,
    color: "#94a3b8",
    textAlign: "center",
  },

  // Technological Routing Step Pills
  routeStepsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1.8,
    alignItems: "center",
  },
  routeStepDone: {
    backgroundColor: "#dcfce7",
    borderWidth: 0.5,
    borderColor: "#86efac",
    paddingHorizontal: 2.5,
    paddingVertical: 0.8,
    borderRadius: 1.2,
  },
  routeStepDoneText: {
    fontSize: 5.1,
    fontWeight: "bold",
    color: "#166534",
  },
  routeStepActive: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 2.8,
    paddingVertical: 0.9,
    borderRadius: 1.2,
  },
  routeStepActiveText: {
    fontSize: 5.2,
    fontWeight: "bold",
    color: "#ffffff",
  },
  routeStepPending: {
    backgroundColor: "#f1f5f9",
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    paddingHorizontal: 2.5,
    paddingVertical: 0.8,
    borderRadius: 1.2,
  },
  routeStepPendingText: {
    fontSize: 5.1,
    color: "#475569",
  },

  // Size Matrix Mini-Table inside each order row
  sizesGridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    alignItems: "center",
  },
  sizeMiniCard: {
    borderWidth: 0.5,
    borderColor: "#94a3b8",
    borderRadius: 1.2,
    backgroundColor: "#ffffff",
    minWidth: 22,
    overflow: "hidden",
  },
  sizeMiniHeader: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 2.2,
    paddingVertical: 0.7,
    borderBottomWidth: 0.4,
    borderBottomColor: "#cbd5e1",
    alignItems: "center",
  },
  sizeMiniHeaderText: {
    fontSize: 5.4,
    fontWeight: "bold",
    color: "#0f172a",
  },
  sizeMiniArtWrap: {
    width: "100%",
    height: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 0.4,
    borderBottomColor: "#cbd5e1",
  },
  sizeMiniArtImg: {
    width: 17,
    height: 17,
    objectFit: "contain",
  },
  sizeMiniBody: {
    paddingHorizontal: 2.2,
    paddingVertical: 0.9,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  sizeMiniBodyText: {
    fontSize: 5.9,
    fontWeight: "bold",
    color: "#1d4ed8",
  },

  // Front & Back Color Pills
  colorSideRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1.5,
    marginTop: 1.2,
  },
  colorSideLabel: {
    fontSize: 5.3,
    fontWeight: "bold",
    color: "#475569",
    width: 19,
  },
  cmykPill: {
    paddingHorizontal: 2.2,
    paddingVertical: 0.5,
    borderRadius: 1,
    fontSize: 4.8,
    fontWeight: "bold",
  },
  spotPill: {
    backgroundColor: "#eff6ff",
    borderWidth: 0.4,
    borderColor: "#93c5fd",
    color: "#1e40af",
    paddingHorizontal: 2.5,
    paddingVertical: 0.4,
    borderRadius: 1,
    fontSize: 4.8,
    fontWeight: "bold",
  },

  // 4-Gate Readiness Mini Grid
  gatesWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
  },
  gateBoxReady: {
    width: 8.5,
    height: 8.5,
    backgroundColor: "#16a34a",
    borderRadius: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gateBoxPending: {
    width: 8.5,
    height: 8.5,
    backgroundColor: "#fee2e2",
    borderWidth: 0.5,
    borderColor: "#ef4444",
    borderRadius: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gateTextReady: {
    fontSize: 5,
    fontWeight: "bold",
    color: "#ffffff",
  },
  gateTextPending: {
    fontSize: 5,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  blockerBadge: {
    fontSize: 4.9,
    fontWeight: "bold",
    color: "#dc2626",
    marginTop: 0.8,
    textAlign: "center",
  },
  toolingCodeBadge: {
    fontSize: 4.9,
    fontWeight: "bold",
    color: "#1e40af",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 2,
    paddingVertical: 0.4,
    borderRadius: 1,
    marginTop: 0.8,
    textAlign: "center",
  },

  // WIP Progress Bar
  wipBarOuter: {
    width: "100%",
    height: 3,
    backgroundColor: "#e2e8f0",
    borderRadius: 1,
    marginTop: 1.2,
    overflow: "hidden",
  },
  wipBarFill: {
    height: "100%",
    backgroundColor: "#2563eb",
  },

  // Check / Note cell
  checkSquare: {
    width: 8,
    height: 8,
    borderWidth: 0.7,
    borderColor: "#475569",
    borderRadius: 1,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 6,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 2.5,
  },
  footerText: {
    fontSize: 5.8,
    color: "#64748b",
  },
});

export interface SizeBreakdownEntry {
  id?: string;
  sizeCode?: string;
  label: string;
  quantity: number | null;
  isMultiSize: boolean;
  artworkThumb?: string;
}

export interface RouteChainItem {
  index: number;
  shortName: string;
  fullName: string;
  machine: string;
  state: "done" | "active" | "pending";
  completedQty: number;
  plannedQty: number;
}

/**
 * Computes deadline countdown badge ("KECHIKDI (-2k)", "BUGUN", "ERTAGA", "+4 kun")
 */
function computeDeadlineCountdown(deadline?: string): {
  label: string;
  type: "overdue" | "soon" | "ok";
} | null {
  if (!deadline || typeof deadline !== "string") return null;
  const trimmed = deadline.trim().slice(0, 10);
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const target = new Date(y, m, d, 0, 0, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { label: `KECHIKDI (${diffDays}k)`, type: "overdue" };
  }
  if (diffDays === 0) {
    return { label: "BUGUN", type: "soon" };
  }
  if (diffDays === 1) {
    return { label: "ERTAGA (+1k)", type: "soon" };
  }
  if (diffDays <= 3) {
    return { label: `+${diffDays} kun`, type: "soon" };
  }
  return { label: `+${diffDays} kun`, type: "ok" };
}

/**
 * Shortens verbose operation names into compact industrial step names for the routing column.
 */
function shortenStepName(name: string): string {
  const n = (name || "").trim();
  const lower = n.toLowerCase();
  // Specific process keywords are checked before the generic "bosma" / "qolip" words,
  // otherwise "Flexo bosma", "Folga bosma" or "Shtamp qolipi" collapse into the wrong step.
  if (lower.includes("ctp") || lower.includes("pre-press") || lower.includes("prepress")) {
    return "CTP qolip";
  }
  if (lower.includes("guillotine") || lower.includes("gilotina")) {
    return "Gilotina kesim";
  }
  if (lower.includes("flexo")) {
    return "Flexo bosma";
  }
  if (lower.includes("woven") || lower.includes("jakkar") || lower.includes("jacquard") || lower.includes("to'qish")) {
    return "Jakkar to'qish";
  }
  if (lower.includes("ultrasonic")) {
    return "Ultrasonic kesim";
  }
  if (lower.includes("laminat")) {
    return "Laminatsiya";
  }
  if (lower.includes("kashir") || lower.includes("mount")) {
    return "Kashirovka";
  }
  if (lower.includes("foil") || lower.includes("folga") || lower.includes("zarhal")) {
    return "Folga (Zar)";
  }
  if (/\buv\b/.test(lower) || lower.includes("lak") || lower.includes("varnish")) {
    return "UF-Lak";
  }
  if (lower.includes("die-cut") || lower.includes("shtans") || lower.includes("shtamp") || lower.includes("vurubka")) {
    return "Shtansovka";
  }
  if (lower.includes("slit") || lower.includes("rewind") || lower.includes("bobina")) {
    return "Bobina kesish";
  }
  if (lower.includes("fold") || lower.includes("glue") || lower.includes("yelim") || lower.includes("bukla")) {
    return "Buklama / Yelim";
  }
  if (lower.includes("pack") || lower.includes("qadoq")) {
    return "Qadoqlash";
  }
  if (lower.includes("offset")) {
    return "Offset bosma";
  }
  return n.length > 18 ? n.slice(0, 16) + ".." : n;
}

/**
 * Builds the complete technological routing chain (steps) for an order row.
 * Uses the order's saved `operations` only; returns an empty chain when none are saved.
 */
function buildOrderRoutingChain(row: RegistryPrintRow, targetQty: number): RouteChainItem[] {
  const raw = row.rawOrder || {};
  const ops: any[] = Array.isArray(raw.operations) ? raw.operations : [];
  const events: any[] = Array.isArray(raw.events) ? raw.events : [];

  if (ops.length > 0) {
    const firstActiveIdx = ops.findIndex(
      (o) => o.status === "In Progress" || o.status === "Paused"
    );
    const firstPendingIdx = ops.findIndex(
      (o) => o.status !== "Completed" && o.status !== "Finished"
    );
    const currentIdx =
      firstActiveIdx >= 0
        ? firstActiveIdx
        : firstPendingIdx >= 0
        ? firstPendingIdx
        : ops.length - 1;

    return ops.map((op, idx) => {
      const opEvents = events.filter((e) => String(e.opId) === String(op.id));
      let completedQty = 0;
      if (opEvents.length > 0) {
        completedQty = opEvents.reduce(
          (sum, e) => sum + (Number(e.goodOutput || e.goodQty) || 0),
          0
        );
      } else if (op.qtyCompleted) {
        const firstPart = String(op.qtyCompleted).split("/")[0] || "0";
        completedQty = parseInt(firstPart.replace(/[^\d]/g, ""), 10) || 0;
      }

      const isDone =
        op.status === "Completed" || op.status === "Finished" || idx < currentIdx;
      const isActive = !isDone && idx === currentIdx;

      return {
        index: idx + 1,
        shortName: shortenStepName(op.name || `Bosqich ${idx + 1}`),
        fullName: op.name || `Bosqich ${idx + 1}`,
        machine: op.machine || row.machine || "—",
        state: isDone ? "done" : isActive ? "active" : "pending",
        completedQty,
        plannedQty: Number(op.plannedQty) || targetQty || 1,
      };
    });
  }

  // No saved operations: the route is unknown, so nothing is shown rather than guessed.
  return [];
}

/**
 * Extracts all size & quantity pairs for an order row without truncation.
 */
function extractSizeBreakdown(row: RegistryPrintRow): SizeBreakdownEntry[] {
  const raw = row.rawOrder || {};
  const dims = raw.dimensions || {};
  const rawSizes: any[] =
    Array.isArray(raw.sizes) && raw.sizes.length > 0
      ? raw.sizes
      : Array.isArray(dims.sizes) && dims.sizes.length > 0
      ? dims.sizes
      : [];

  const skuThumbs = row.resolvedSkuThumbs || {};

  if (rawSizes.length > 0) {
    const withPositiveQty = rawSizes.filter((s) => Number(s.quantity) > 0);
    const sourceList = withPositiveQty.length > 0 ? withPositiveQty : rawSizes;

    return sourceList.map((s, idx) => {
      const code = String(s.sizeCode || s.size || "STD").trim();
      const model =
        s.model && s.model !== "Standart" && s.model !== "Model 1"
          ? String(s.model).trim()
          : "";
      const label = model && !code.startsWith(model) ? `${model}/${code}` : code;
      // Unknown per-size quantity stays null (printed as "—") instead of an even split.
      const qty = Number(s.quantity) > 0 ? Number(s.quantity) : null;

      const sId = String(s.id || "");
      const sCodeLower = code.toLowerCase();
      const thumb =
        (sId && skuThumbs[sId]) ||
        (code && skuThumbs[code]) ||
        (sCodeLower && skuThumbs[sCodeLower]) ||
        skuThumbs[`idx_${idx}`] ||
        undefined;

      return {
        id: sId,
        sizeCode: code,
        label,
        quantity: qty,
        isMultiSize:
          sourceList.length > 1 ||
          (code.toLowerCase() !== "standart" && code.toLowerCase() !== "std"),
        artworkThumb: thumb,
      };
    });
  }

  const w = Number(raw.width || dims.width || 0);
  const h = Number(raw.height || dims.height || 0);
  const dimUnit = raw.dimensionUnit || dims.dimensionUnit || "mm";
  if (w > 0 && h > 0) {
    return [
      {
        label: `${w}×${h} ${dimUnit}`,
        quantity: Number(row.qty) || 0,
        isMultiSize: false,
      },
    ];
  }

  const prod = String(row.product || "");
  const dimMatch = prod.match(
    /(\d+\s*[×xX*]\s*\d+(\s*mm)?|\bA[345]\b|\bB[123]\b|\b\d+\s*(ml|gr|g)\b)/i
  );
  return [
    {
      label: dimMatch ? dimMatch[0].replace(/\s+/g, "") : "Standart",
      quantity: Number(row.qty) || 0,
      isMultiSize: false,
    },
  ];
}

interface ResolvedSideColors {
  frontCmyk: ("C" | "M" | "Y" | "K")[];
  backCmyk: ("C" | "M" | "Y" | "K")[];
  /** Ink count per side; null when the order records no colour data at all. */
  frontCount: number | null;
  backCount: number | null;
  frontSpots: string[];
  backSpots: string[];
}

/**
 * Resolves explicit Front (Oldi) and Back (Orqa) CMYK channels and Spot/Pantone inks.
 */
function resolveFrontBackColors(raw: any): ResolvedSideColors {
  const fc = raw?.frontColors || raw?.colorsConfig?.frontColors || {};
  const bc = raw?.backColors || raw?.colorsConfig?.backColors || {};
  const hasExplicitFront = Boolean(fc.c || fc.m || fc.y || fc.k);
  const hasExplicitBack = Boolean(bc.c || bc.m || bc.y || bc.k);

  let frontCmyk: ("C" | "M" | "Y" | "K")[] = [];
  let backCmyk: ("C" | "M" | "Y" | "K")[] = [];
  let frontCount: number | null = null;
  let backCount: number | null = null;

  if (hasExplicitFront || hasExplicitBack) {
    if (fc.c) frontCmyk.push("C");
    if (fc.m) frontCmyk.push("M");
    if (fc.y) frontCmyk.push("Y");
    if (fc.k) frontCmyk.push("K");

    if (bc.c) backCmyk.push("C");
    if (bc.m) backCmyk.push("M");
    if (bc.y) backCmyk.push("Y");
    if (bc.k) backCmyk.push("K");
  } else {
    // Only a "N+M" formula is known: 4 inks means CMYK; any other count is shown as a
    // plain number because which channels (or Pantones) are used is not recorded.
    const formula = String(
      (typeof raw?.colorsConfig === "string" ? raw.colorsConfig : raw?.colorsConfig?.formula) ||
        raw?.colors ||
        ""
    );
    const match = formula.match(/(\d)\s*\+\s*(\d)/);
    if (match) {
      frontCount = parseInt(match[1], 10);
      backCount = parseInt(match[2], 10);
      if (frontCount === 4) frontCmyk = ["C", "M", "Y", "K"];
      if (backCount === 4) backCmyk = ["C", "M", "Y", "K"];
    }
  }

  const frontSpots: string[] = [];
  const backSpots: string[] = [];

  const spotItems: any[] = Array.isArray(raw?.spotColorItems)
    ? raw.spotColorItems
    : Array.isArray(raw?.colorsConfig?.spotColorItems)
    ? raw.colorsConfig.spotColorItems
    : [];

  if (spotItems.length > 0) {
    spotItems.forEach((sp) => {
      const label = String(sp.code || sp.name || "").trim();
      if (!label) return;
      const side = String(sp.side || "front").toLowerCase();
      if (side === "back") {
        backSpots.push(label);
      } else if (side === "both") {
        frontSpots.push(label);
        backSpots.push(label);
      } else {
        frontSpots.push(label);
      }
    });
  } else if (Array.isArray(raw?.spotColors) && raw.spotColors.length > 0) {
    raw.spotColors.forEach((name: string) => {
      if (name) frontSpots.push(String(name).trim());
    });
  }

  if (hasExplicitFront || hasExplicitBack) {
    frontCount = frontCmyk.length;
    backCount = backCmyk.length;
  }

  return { frontCmyk, backCmyk, frontCount, backCount, frontSpots, backSpots };
}

/**
 * Extracts 4-Gate missing blocker labels and Tooling / Cylinder code.
 */
function extractGateBlockersAndTooling(
  row: RegistryPrintRow
): { blockers: string[]; toolingCode: string | null } {
  const raw = row.rawOrder || {};
  const dims = raw.dimensions || {};
  const checks = row.evaluatedChecks;
  const blockers: string[] = [];

  if (!checks.designReady) blockers.push("Maket yo'q");
  if (!checks.paperReady) blockers.push("Qog'oz kam");
  if (!checks.platesReady) blockers.push("Qolip yo'q");
  if (!checks.toolingReady) {
    if (raw.toolingProcurementNeeded || dims.toolingProcurementNeeded) {
      blockers.push("Pichoq xaridda");
    } else {
      blockers.push("Pichoq yo'q");
    }
  }

  let toolingCode: string | null = null;
  const selTool =
    raw.selectedToolingId ||
    dims.selectedToolingId ||
    raw.selectedToolingName ||
    dims.selectedToolingName ||
    (Array.isArray(raw.toolingItems) && raw.toolingItems[0]?.code) ||
    (Array.isArray(dims.toolingItems) && dims.toolingItems[0]?.code);

  const teeth = raw.flexoCylinderTeeth || dims.flexoCylinderTeeth;
  const webW = raw.flexoWebWidth || dims.flexoWebWidth;

  if (selTool) {
    toolingCode = String(selTool);
  } else if (teeth) {
    toolingCode = `${teeth}T Val${webW ? ` (${webW}mm)` : ""}`;
  }

  return { blockers, toolingCode };
}

function buildMaterialAndFinishSpecs(row: RegistryPrintRow): {
  materialLine: string;
  finishLine: string | null;
} {
  const raw = row.rawOrder || {};
  const dims = raw.dimensions || {};

  const w = raw.width || dims.width;
  const h = raw.height || dims.height;
  const unit = raw.dimensionUnit || dims.dimensionUnit || "mm";
  const dimStr = w && h ? `${w}×${h}${unit}` : "";

  const stock =
    raw.paperStock ||
    dims.paperStock ||
    raw.flexoMaterialId ||
    dims.flexoMaterialId ||
    raw.labelMaterialType ||
    dims.labelMaterialType ||
    raw.recipe ||
    "";

  const matParts = [dimStr, stock].filter(Boolean);
  const materialLine = matParts.length > 0 ? matParts.join(" • ") : "Standart xomashyo";

  const kashMode =
    raw.kashirovkaMode && raw.kashirovkaMode !== "none"
      ? `Kash: ${String(raw.kashirovkaMode).toUpperCase()}`
      : "";
  const lam = raw.lamination && raw.lamination !== "None" ? raw.lamination : "";
  const coat = raw.coating && raw.coating !== "None" ? raw.coating : "";
  const emb = raw.embellishment && raw.embellishment !== "None" ? raw.embellishment : "";
  const fold = raw.labelFoldType || dims.labelFoldType || raw.foldType || dims.foldType || "";
  const finishParts = [kashMode, lam, coat, emb, fold].filter(Boolean);

  return {
    materialLine,
    finishLine: finishParts.length > 0 ? finishParts.join(" • ") : null,
  };
}

function getCmykBadgeColor(ch: "C" | "M" | "Y" | "K"): { bg: string; fg: string } {
  if (ch === "C") return { bg: "#06b6d4", fg: "#ffffff" };
  if (ch === "M") return { bg: "#ec4899", fg: "#ffffff" };
  if (ch === "Y") return { bg: "#eab308", fg: "#0f172a" };
  return { bg: "#0f172a", fg: "#ffffff" };
}

/**
 * Sums order quantities per unit ("1 700 pcs • 300 m"); pcs, metres and sheets are never added together.
 * Uses the same quantity as the row itself: order qty, or the size breakdown sum when qty is empty.
 */
function formatQtyTotalsByUnit(list: RegistryPrintRow[]): string {
  const byUnit = new Map<string, number>();
  for (const r of list) {
    const qty =
      Number(r.qty) > 0
        ? Number(r.qty)
        : extractSizeBreakdown(r).reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    if (qty <= 0) continue;
    const unit = String(r.unit || "pcs").trim() || "pcs";
    byUnit.set(unit, (byUnit.get(unit) || 0) + qty);
  }
  if (byUnit.size === 0) return "0";
  return Array.from(byUnit.entries())
    .map(([unit, qty]) => `${qty.toLocaleString()} ${unit}`)
    .join(" • ");
}

export const WorkOrdersRegistryPDF: React.FC<WorkOrdersRegistryPDFProps> = ({
  rows,
  orientation,
  showThumbnails,
  filterSummaryText,
  generatedAt,
  labels,
}) => {
  const isLandscape = orientation === "landscape";

  // Group rows by Department (Sex)
  const groupedDepartments = React.useMemo(() => {
    const map = new Map<string, RegistryPrintRow[]>();
    for (const r of rows) {
      const dept = r.department || "Offset";
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)!.push(r);
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      const idxA = DEPT_ORDER.indexOf(a);
      const idxB = DEPT_ORDER.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    return sortedKeys.map((dept) => {
      const deptRows = map.get(dept) || [];
      return {
        department: dept,
        rows: deptRows,
        totalQtyText: formatQtyTotalsByUnit(deptRows),
      };
    });
  }, [rows]);

  const grandTotalQtyText = React.useMemo(() => formatQtyTotalsByUnit(rows), [rows]);

  // Column percentage widths with generous room for Technological Routing (Bosqichlar)
  const colWidths = React.useMemo(() => {
    if (isLandscape) {
      return showThumbnails
        ? {
            idx: "2.2%",
            thumb: "4.2%",
            doc: "10.0%",
            custProd: "13.5%",
            route: "14.0%",
            qtyTotal: "6.8%",
            sizeBreakdown: "17.5%",
            tech: "14.5%",
            gates: "6.5%",
            status: "8.0%",
            note: "2.8%",
          }
        : {
            idx: "2.4%",
            thumb: "0%",
            doc: "10.5%",
            custProd: "14.5%",
            route: "15.0%",
            qtyTotal: "7.2%",
            sizeBreakdown: "18.5%",
            tech: "14.8%",
            gates: "6.5%",
            status: "7.8%",
            note: "2.8%",
          };
    } else {
      // Portrait (210mm width)
      return showThumbnails
        ? {
            idx: "2.6%",
            thumb: "5.0%",
            doc: "11.0%",
            custProd: "13.5%",
            route: "13.5%",
            qtyTotal: "7.0%",
            sizeBreakdown: "17.0%",
            tech: "13.2%",
            gates: "6.6%",
            status: "7.8%",
            note: "2.8%",
          }
        : {
            idx: "2.8%",
            thumb: "0%",
            doc: "11.5%",
            custProd: "14.8%",
            route: "14.5%",
            qtyTotal: "7.4%",
            sizeBreakdown: "18.0%",
            tech: "13.8%",
            gates: "6.6%",
            status: "7.8%",
            note: "2.8%",
          };
    }
  }, [isLandscape, showThumbnails]);

  let globalRowCounter = 0;

  return (
    <Document
      title={`${labels.title} (${generatedAt})`}
      author="PrintGoo ERP"
    >
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* 1-Line Compact Top Header (Fixed across pages) */}
        <View style={styles.topBar} fixed>
          <View style={styles.topLeft}>
            <PrintgooPdfLogo height={16} />
            <Text style={styles.docTitle}>{labels.title}</Text>
            <Text style={styles.filterSub}>{filterSummaryText}</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.summaryPill}>
              {labels.deptOrdersCount.replace("{count}", String(rows.length))} •{" "}
              {labels.totalQtyLabel}: {grandTotalQtyText}
            </Text>
            <Text style={styles.timestampText}>{generatedAt}</Text>
          </View>
        </View>

        {/* Department Grouped Tables */}
        {groupedDepartments.map((group) => (
          <View key={group.department} style={styles.deptSection}>
            {/* Department Header Bar */}
            <View style={styles.deptHeaderBar} minPresenceAhead={36}>
              <Text style={styles.deptTitle}>SEX: {group.department}</Text>
              <Text style={styles.deptMeta}>
                {labels.deptOrdersCount.replace("{count}", String(group.rows.length))} •{" "}
                {labels.totalQtyLabel}: {group.totalQtyText}
              </Text>
            </View>

            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.thRow}>
                <View style={[styles.thCell, { width: colWidths.idx, alignItems: "center" }]}>
                  <Text style={styles.thText}>№</Text>
                </View>
                {showThumbnails && (
                  <View style={[styles.thCell, { width: colWidths.thumb, alignItems: "center" }]}>
                    <Text style={styles.thText}>{labels.colSketch}</Text>
                  </View>
                )}
                <View style={[styles.thCell, { width: colWidths.doc }]}>
                  <Text style={styles.thText}>{labels.colDocDeadline}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.custProd }]}>
                  <Text style={styles.thText}>{labels.colCustomerProduct}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.route }]}>
                  <Text style={styles.thText}>{labels.colMachineOperator}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.qtyTotal }]}>
                  <Text style={styles.thText}>{labels.colQtySizes}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.sizeBreakdown }]}>
                  <Text style={styles.thText}>{labels.colSizeBreakdown}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.tech }]}>
                  <Text style={styles.thText}>{labels.colTechSpecs}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.gates, alignItems: "center" }]}>
                  <Text style={styles.thText}>{labels.colGates}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.status }]}>
                  <Text style={styles.thText}>{labels.colStateSample}</Text>
                </View>
                <View
                  style={[
                    styles.thCell,
                    { width: colWidths.note, borderRightWidth: 0, alignItems: "center" },
                  ]}
                >
                  <Text style={styles.thText}>{labels.colNote}</Text>
                </View>
              </View>

              {/* Table Rows */}
              {group.rows.map((row, rIdx) => {
                globalRowCounter += 1;
                const raw = row.rawOrder || {};
                const sizeEntries = extractSizeBreakdown(row);
                const sizesSum = sizeEntries.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
                const effectiveTotalQty = Number(row.qty) > 0 ? Number(row.qty) : sizesSum;
                const routeChain = buildOrderRoutingChain(row, effectiveTotalQty);
                // null when every step is done or no route is saved; never fall back to step 1.
                const activeRouteStep = routeChain.find((s) => s.state === "active") ?? null;
                const activeIdx = activeRouteStep ? routeChain.indexOf(activeRouteStep) : -1;
                const nextRouteStep =
                  activeIdx >= 0 && activeIdx + 1 < routeChain.length
                    ? routeChain[activeIdx + 1]
                    : null;
                const doneStepsCount = routeChain.filter((s) => s.state === "done").length;
                const isOrderCompleted =
                  row.status === "Completed" ||
                  (routeChain.length > 0 && doneStepsCount === routeChain.length);
                const overallRoutePct = Math.min(
                  100,
                  Math.round(
                    ((doneStepsCount +
                      (activeRouteStep
                        ? activeRouteStep.completedQty /
                          Math.max(1, activeRouteStep.plannedQty)
                        : 0)) /
                      Math.max(1, routeChain.length)) *
                      100
                  )
                );

                const { materialLine, finishLine } = buildMaterialAndFinishSpecs(row);
                const fbColors = resolveFrontBackColors(raw);
                const { blockers, toolingCode } = extractGateBlockersAndTooling(row);
                const countdown = isOrderCompleted
                  ? null
                  : computeDeadlineCountdown(row.deadline);
                const plannedSheets = Number(raw.plannedSheets || raw.dimensions?.plannedSheets || 0);
                const checks = row.evaluatedChecks;

                const prioLabel =
                  row.priority === "Urgent"
                    ? labels.priorityUrgent
                    : row.priority === "High"
                    ? labels.priorityHigh
                    : labels.priorityNormal;

                const prioStyle =
                  row.priority === "Urgent"
                    ? styles.prioUrgent
                    : row.priority === "High"
                    ? styles.prioHigh
                    : styles.prioNormal;

                const gates = [
                  { code: "D", ready: checks.designReady },
                  { code: "Q", ready: checks.paperReady },
                  { code: "P", ready: checks.platesReady },
                  { code: "S", ready: checks.toolingReady },
                ];

                return (
                  <View
                    key={row.id}
                    wrap={false}
                    style={[styles.trRow, rIdx % 2 === 1 ? styles.trRowAlt : {}]}
                  >
                    {/* 1. Row Index */}
                    <View style={[styles.tdCell, { width: colWidths.idx, alignItems: "center" }]}>
                      <Text style={styles.boldDark}>{globalRowCounter}</Text>
                    </View>

                    {/* 2. Thumbnail (Smart Fallback: Proof -> Artwork -> SKU Thumb) */}
                    {showThumbnails && (
                      <View
                        style={[
                          styles.tdCell,
                          { width: colWidths.thumb, alignItems: "center", justifyContent: "center" },
                        ]}
                      >
                        <View style={styles.thumbBox}>
                          {row.resolvedThumbUrl ? (
                            <Image src={row.resolvedThumbUrl} style={styles.thumbImg} />
                          ) : (
                            <Text style={styles.thumbPlaceholder}>—</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 3. Order No, Priority, Deadline & Countdown Indicator */}
                    <View style={[styles.tdCell, { width: colWidths.doc }]}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 2,
                        }}
                      >
                        <Text style={styles.boldDark}>{row.id}</Text>
                        <Text style={prioStyle}>{prioLabel.toUpperCase()}</Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 1.2,
                          gap: 2,
                        }}
                      >
                        <Text style={{ fontSize: 5.8, fontWeight: "bold", color: "#0f172a" }}>
                          {row.deadline || "—"}
                        </Text>
                        {countdown && (
                          <Text
                            style={
                              countdown.type === "overdue"
                                ? styles.deadlineBadgeOverdue
                                : countdown.type === "soon"
                                ? styles.deadlineBadgeSoon
                                : styles.deadlineBadgeOk
                            }
                          >
                            {countdown.label}
                          </Text>
                        )}
                      </View>
                      {raw.clientOrderId && (
                        <Text style={styles.mutedSmall}>Ref: {raw.clientOrderId}</Text>
                      )}
                    </View>

                    {/* 4. Customer & Product */}
                    <View style={[styles.tdCell, { width: colWidths.custProd }]}>
                      <Text style={styles.boldDark}>{row.customer || "—"}</Text>
                      <Text style={styles.regularSlate}>{row.product || "—"}</Text>
                      {(raw.itemCategory || raw.orderType === "Sample") && (
                        <Text style={styles.mutedSmall}>
                          {[
                            raw.itemCategory,
                            raw.orderType === "Sample" ? "NAMUNA" : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </Text>
                      )}
                    </View>

                    {/* 5. Technological Routing (Bosqichlar Zanjiri) */}
                    <View style={[styles.tdCell, { width: colWidths.route }]}>
                      {routeChain.length === 0 && (
                        <Text style={styles.mutedSmall}>Marshrut yo&apos;q</Text>
                      )}
                      <View style={styles.routeStepsWrap}>
                        {routeChain.map((step) => {
                          const boxStyle =
                            step.state === "done"
                              ? styles.routeStepDone
                              : step.state === "active"
                              ? styles.routeStepActive
                              : styles.routeStepPending;
                          const txtStyle =
                            step.state === "done"
                              ? styles.routeStepDoneText
                              : step.state === "active"
                              ? styles.routeStepActiveText
                              : styles.routeStepPendingText;
                          return (
                            <View key={step.index} style={boxStyle}>
                              <Text style={txtStyle}>
                                {step.index}.{step.shortName}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <Text style={styles.mutedSmall}>
                        Dastgoh: {activeRouteStep?.machine || row.machine || "—"}
                      </Text>
                    </View>

                    {/* 6. Total Run Quantity & Sheets */}
                    <View style={[styles.tdCell, { width: colWidths.qtyTotal }]}>
                      <Text style={[styles.boldDark, { color: "#1d4ed8" }]}>
                        {effectiveTotalQty.toLocaleString()} {row.unit || "pcs"}
                      </Text>
                      {plannedSheets > 0 && plannedSheets !== effectiveTotalQty && (
                        <Text style={styles.regularSlate}>
                          {plannedSheets.toLocaleString()} sht
                        </Text>
                      )}
                      {sizeEntries.length > 1 && (
                        <Text style={styles.mutedSmall}>{sizeEntries.length} razmer</Text>
                      )}
                    </View>

                    {/* 7. Dedicated Size Breakdown (Razmer : Soni Mini-Table) */}
                    <View style={[styles.tdCell, { width: colWidths.sizeBreakdown }]}>
                      <View style={styles.sizesGridWrap}>
                        {sizeEntries.map((sz, sIdx) => (
                          <View key={sIdx} style={styles.sizeMiniCard}>
                            <View style={styles.sizeMiniHeader}>
                              <Text style={styles.sizeMiniHeaderText}>{sz.label}</Text>
                            </View>
                            {showThumbnails && sz.artworkThumb ? (
                              <View style={styles.sizeMiniArtWrap}>
                                <Image src={sz.artworkThumb} style={styles.sizeMiniArtImg} />
                              </View>
                            ) : null}
                            <View style={styles.sizeMiniBody}>
                              <Text style={styles.sizeMiniBodyText}>
                                {sz.quantity != null ? sz.quantity.toLocaleString() : "—"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* 8. Technical Specs + Separate Front (Oldi) & Back (Orqa) Colors */}
                    <View style={[styles.tdCell, { width: colWidths.tech }]}>
                      <Text style={styles.boldDark}>{materialLine}</Text>

                      {/* OLDI (Front) Colors */}
                      <View style={styles.colorSideRow}>
                        <Text style={styles.colorSideLabel}>OLDI:</Text>
                        {fbColors.frontCmyk.length > 0 ? (
                          fbColors.frontCmyk.map((ch) => {
                            const col = getCmykBadgeColor(ch);
                            return (
                              <Text
                                key={ch}
                                style={[
                                  styles.cmykPill,
                                  { backgroundColor: col.bg, color: col.fg },
                                ]}
                              >
                                {ch}
                              </Text>
                            );
                          })
                        ) : (
                          <Text style={{ fontSize: 5.2, color: "#94a3b8" }}>
                            {fbColors.frontCount == null
                              ? "—"
                              : fbColors.frontCount > 0
                              ? `${fbColors.frontCount} rang`
                              : "0"}
                          </Text>
                        )}
                        {fbColors.frontSpots.map((sp, idx) => (
                          <Text key={idx} style={styles.spotPill}>
                            +{sp}
                          </Text>
                        ))}
                      </View>

                      {/* ORQA (Back) Colors */}
                      <View style={styles.colorSideRow}>
                        <Text style={styles.colorSideLabel}>ORQA:</Text>
                        {fbColors.backCmyk.length > 0 ? (
                          fbColors.backCmyk.map((ch) => {
                            const col = getCmykBadgeColor(ch);
                            return (
                              <Text
                                key={ch}
                                style={[
                                  styles.cmykPill,
                                  { backgroundColor: col.bg, color: col.fg },
                                ]}
                              >
                                {ch}
                              </Text>
                            );
                          })
                        ) : fbColors.backCount != null && fbColors.backCount > 0 ? (
                          <Text style={{ fontSize: 5.2, color: "#64748b" }}>
                            {fbColors.backCount} rang
                          </Text>
                        ) : fbColors.backSpots.length > 0 ? null : (
                          <Text style={{ fontSize: 5.2, color: "#64748b" }}>
                            {fbColors.backCount === 0 ? "0 (Bosmasiz)" : "—"}
                          </Text>
                        )}
                        {fbColors.backSpots.map((sp, idx) => (
                          <Text key={idx} style={styles.spotPill}>
                            +{sp}
                          </Text>
                        ))}
                      </View>

                      {finishLine && <Text style={styles.mutedSmall}>{finishLine}</Text>}
                    </View>

                    {/* 9. 4-Gate Readiness + Blocker Reason + Tooling/Cylinder Code */}
                    <View
                      style={[
                        styles.tdCell,
                        { width: colWidths.gates, alignItems: "center", justifyContent: "center" },
                      ]}
                    >
                      <View style={styles.gatesWrap}>
                        {gates.map((g) => (
                          <View
                            key={g.code}
                            style={g.ready ? styles.gateBoxReady : styles.gateBoxPending}
                          >
                            <Text style={g.ready ? styles.gateTextReady : styles.gateTextPending}>
                              {g.code}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {blockers.length > 0 ? (
                        <Text style={styles.blockerBadge}>
                          {blockers.join(", ")}
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.mutedSmall,
                            { fontWeight: "bold", color: "#15803d" },
                          ]}
                        >
                          4/4 Tayyor
                        </Text>
                      )}
                      {toolingCode && (
                        <Text style={styles.toolingCodeBadge}>{toolingCode}</Text>
                      )}
                    </View>

                    {/* 10. Current WIP Operation, Progress (%) & Next Operation */}
                    <View style={[styles.tdCell, { width: colWidths.status }]}>
                      <Text style={styles.boldDark}>
                        {isOrderCompleted
                          ? "Tayyor"
                          : activeRouteStep
                          ? `${activeRouteStep.index}/${routeChain.length}: ${activeRouteStep.shortName}`
                          : "—"}
                      </Text>
                      {routeChain.length > 0 && (
                        <>
                          <Text
                            style={[
                              styles.regularSlate,
                              { fontWeight: "bold", color: "#1d4ed8" },
                            ]}
                          >
                            {activeRouteStep && activeRouteStep.completedQty > 0
                              ? `${activeRouteStep.completedQty.toLocaleString()} (${overallRoutePct}%)`
                              : `${doneStepsCount}/${routeChain.length} bosqich (${overallRoutePct}%)`}
                          </Text>
                          <View style={styles.wipBarOuter}>
                            <View
                              style={[
                                styles.wipBarFill,
                                { width: `${Math.max(4, overallRoutePct)}%` },
                              ]}
                            />
                          </View>
                        </>
                      )}
                      {nextRouteStep && (
                        <Text style={styles.mutedSmall}>
                          Keyingi: {nextRouteStep.shortName}
                        </Text>
                      )}
                    </View>

                    {/* 11. Shop-Floor Checkbox & Note */}
                    <View
                      style={[
                        styles.tdCell,
                        {
                          width: colWidths.note,
                          borderRightWidth: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <View style={styles.checkSquare} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Fixed Minimal Page Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            PRINTGOO ERP • {labels.title}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${labels.pageLabel} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};
