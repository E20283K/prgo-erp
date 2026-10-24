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
  evaluatedChecks: ProductionReadinessChecks;
}

export interface WorkOrdersRegistryPdfLabels {
  title: string;
  colSketch: string;
  colDocDeadline: string;
  colCustomerProduct: string;
  colMachineOperator: string;
  colQtySizes: string;
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

const DEPT_ORDER = ["Offset", "Flexo", "Jacquard", "Post-press", "Digital"];

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
  brandBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 1.5,
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
    fontSize: 5.8,
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  },
  trRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    alignItems: "stretch",
    minHeight: 24,
  },
  trRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tdCell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
    justifyContent: "center",
  },

  // Typography helpers
  boldDark: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0f172a",
  },
  regularSlate: {
    fontSize: 6,
    color: "#334155",
    marginTop: 0.8,
  },
  mutedSmall: {
    fontSize: 5.5,
    color: "#64748b",
    marginTop: 0.6,
  },

  // Badges
  prioUrgent: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 0.8,
    borderRadius: 1,
  },
  prioHigh: {
    backgroundColor: "#d97706",
    color: "#ffffff",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 0.8,
    borderRadius: 1,
  },
  prioNormal: {
    backgroundColor: "#e2e8f0",
    color: "#475569",
    fontSize: 5,
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 0.8,
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

  // 4-Gate Readiness Mini Grid
  gatesWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
  },
  gateBoxReady: {
    width: 9,
    height: 9,
    backgroundColor: "#16a34a",
    borderRadius: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gateBoxPending: {
    width: 9,
    height: 9,
    backgroundColor: "#e2e8f0",
    borderWidth: 0.4,
    borderColor: "#94a3b8",
    borderRadius: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gateTextReady: {
    fontSize: 5.2,
    fontWeight: "bold",
    color: "#ffffff",
  },
  gateTextPending: {
    fontSize: 5.2,
    fontWeight: "bold",
    color: "#64748b",
  },

  // Check / Note cell
  checkSquare: {
    width: 8,
    height: 8,
    borderWidth: 0.7,
    borderColor: "#475569",
    borderRadius: 1,
    marginRight: 3,
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

function formatCompactSizes(sizes?: any[]): string {
  if (!Array.isArray(sizes) || sizes.length === 0) return "";
  const valid = sizes.filter((s) => Number(s.quantity) > 0);
  if (valid.length === 0) return "";
  const parts = valid.slice(0, 6).map((s) => {
    const code = s.sizeCode || s.size || "STD";
    return `${code}:${Number(s.quantity).toLocaleString()}`;
  });
  if (valid.length > 6) {
    parts.push(`+${valid.length - 6}`);
  }
  return parts.join(" ");
}

function buildTechSpecLines(row: RegistryPrintRow, isLandscape: boolean): string[] {
  const raw = row.rawOrder || {};
  const dims = raw.dimensions || {};
  const lines: string[] = [];

  // Line 1: Material / Paper Stock + Dimensions
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

  const line1Parts = [dimStr, stock].filter(Boolean);
  if (line1Parts.length > 0) {
    lines.push(line1Parts.join(" • "));
  }

  // Line 2: Colors & Spot / Pantone
  const colorFormula = raw.colorsConfig || raw.colors || "4+0";
  const spots: string[] = Array.isArray(raw.spotColors)
    ? raw.spotColors
    : Array.isArray(raw.spotColorItems)
    ? raw.spotColorItems.map((s: any) => s.name || s.code).filter(Boolean)
    : [];
  const spotStr = spots.length > 0 ? `Spot: ${spots.slice(0, isLandscape ? 3 : 2).join(", ")}` : "";
  const kashMode = raw.kashirovkaMode && raw.kashirovkaMode !== "none" ? `Kash: ${String(raw.kashirovkaMode).toUpperCase()}` : "";

  const line2Parts = [`Rang: ${colorFormula}`, spotStr, kashMode].filter(Boolean);
  if (line2Parts.length > 0) {
    lines.push(line2Parts.join(" | "));
  }

  // Line 3: Finishing (Lamination / Coating / Embellishment / Tooling)
  const lam = raw.lamination && raw.lamination !== "None" ? raw.lamination : "";
  const coat = raw.coating && raw.coating !== "None" ? raw.coating : "";
  const emb = raw.embellishment && raw.embellishment !== "None" ? raw.embellishment : "";
  const tool = raw.selectedToolingName || raw.selectedToolingId || "";
  const finishParts = [lam, coat, emb, tool].filter(Boolean);
  if (finishParts.length > 0) {
    lines.push(finishParts.join(" • "));
  }

  return lines.length > 0 ? lines : ["—"];
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
      const totalQty = deptRows.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
      return {
        department: dept,
        rows: deptRows,
        totalQty,
      };
    });
  }, [rows]);

  const grandTotalQty = React.useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0),
    [rows]
  );

  // Column percentage widths tailored for Landscape vs Portrait and Thumbnail visibility
  const colWidths = React.useMemo(() => {
    if (isLandscape) {
      return showThumbnails
        ? {
            idx: "2.5%",
            thumb: "5.0%",
            doc: "11.5%",
            custProd: "19.5%",
            machOp: "12.5%",
            qtySizes: "12.0%",
            tech: "19.5%",
            gates: "6.5%",
            status: "6.5%",
            note: "4.5%",
          }
        : {
            idx: "2.8%",
            thumb: "0%",
            doc: "12.0%",
            custProd: "21.0%",
            machOp: "13.5%",
            qtySizes: "12.5%",
            tech: "20.7%",
            gates: "6.5%",
            status: "6.5%",
            note: "4.5%",
          };
    } else {
      // Portrait (210mm width) — tighter column allocation
      return showThumbnails
        ? {
            idx: "3.0%",
            thumb: "6.5%",
            doc: "13.0%",
            custProd: "20.5%",
            machOp: "12.5%",
            qtySizes: "12.0%",
            tech: "15.0%",
            gates: "7.5%",
            status: "6.0%",
            note: "4.0%",
          }
        : {
            idx: "3.2%",
            thumb: "0%",
            doc: "14.0%",
            custProd: "22.5%",
            machOp: "13.5%",
            qtySizes: "12.8%",
            tech: "16.5%",
            gates: "7.5%",
            status: "6.0%",
            note: "4.0%",
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
            <Text style={styles.brandBadge}>PRINTGOO</Text>
            <Text style={styles.docTitle}>{labels.title}</Text>
            <Text style={styles.filterSub}>{filterSummaryText}</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.summaryPill}>
              {labels.deptOrdersCount.replace("{count}", String(rows.length))} •{" "}
              {labels.totalQtyLabel}: {grandTotalQty.toLocaleString()}
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
                {labels.totalQtyLabel}: {group.totalQty.toLocaleString()}
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
                <View style={[styles.thCell, { width: colWidths.machOp }]}>
                  <Text style={styles.thText}>{labels.colMachineOperator}</Text>
                </View>
                <View style={[styles.thCell, { width: colWidths.qtySizes }]}>
                  <Text style={styles.thText}>{labels.colQtySizes}</Text>
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
                const sizesText = formatCompactSizes(raw.sizes || raw.dimensions?.sizes);
                const techLines = buildTechSpecLines(row, isLandscape);
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

                    {/* 3. Order No, Priority & Deadline */}
                    <View style={[styles.tdCell, { width: colWidths.doc }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                        <Text style={styles.boldDark}>{row.id}</Text>
                        <Text style={prioStyle}>{prioLabel.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.regularSlate}>
                        {row.startDate ? `${row.startDate} → ` : ""}
                        <Text style={{ fontWeight: "bold", color: "#0f172a" }}>
                          {row.deadline || "—"}
                        </Text>
                      </Text>
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

                    {/* 5. Machine, Site & Responsible Operator */}
                    <View style={[styles.tdCell, { width: colWidths.machOp }]}>
                      <Text style={styles.boldDark}>{row.machine || "—"}</Text>
                      <Text style={styles.regularSlate}>
                        {row.site || "Building 1"}
                        {row.responsible ? ` • ${row.responsible}` : ""}
                      </Text>
                      {raw.shift && <Text style={styles.mutedSmall}>{raw.shift}</Text>}
                    </View>

                    {/* 6. Run Quantity, Sheets & Size Breakdown */}
                    <View style={[styles.tdCell, { width: colWidths.qtySizes }]}>
                      <Text style={[styles.boldDark, { color: "#1d4ed8" }]}>
                        {(Number(row.qty) || 0).toLocaleString()} {row.unit || "pcs"}
                      </Text>
                      {plannedSheets > 0 && plannedSheets !== row.qty && (
                        <Text style={styles.regularSlate}>
                          {plannedSheets.toLocaleString()} sht
                        </Text>
                      )}
                      {sizesText ? (
                        <Text style={styles.mutedSmall}>{sizesText}</Text>
                      ) : null}
                    </View>

                    {/* 7. Technical Specifications */}
                    <View style={[styles.tdCell, { width: colWidths.tech }]}>
                      {techLines.map((line, lIdx) => (
                        <Text
                          key={lIdx}
                          style={lIdx === 0 ? styles.boldDark : styles.regularSlate}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>

                    {/* 8. 4-Gate Readiness */}
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
                      <Text style={[styles.mutedSmall, { fontWeight: "bold", color: row.readyCount === 4 ? "#15803d" : "#475569" }]}>
                        {row.readinessLabel}
                      </Text>
                    </View>

                    {/* 9. Status & Sample Stage */}
                    <View style={[styles.tdCell, { width: colWidths.status }]}>
                      <Text
                        style={[
                          styles.boldDark,
                          {
                            color:
                              row.status === "Active"
                                ? "#15803d"
                                : row.status === "Draft"
                                ? "#b45309"
                                : "#334155",
                          },
                        ]}
                      >
                        {row.status === "Active"
                          ? labels.statusActive
                          : row.status === "Draft"
                          ? labels.statusDraft
                          : row.status}
                      </Text>
                      <Text style={styles.mutedSmall}>{row.sampleStatusLabel}</Text>
                    </View>

                    {/* 10. Shop-Floor Checkbox & Note */}
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
