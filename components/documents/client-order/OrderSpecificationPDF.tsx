import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ClientOrderFormData, SizeDistribution, ClientOrderSampleData, ProductionMilestone } from "./types";

export interface OrderSpecPdfProps {
  docNo: string;
  orderData: ClientOrderFormData;
  sizes?: SizeDistribution[];
  sampleData?: ClientOrderSampleData;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  // Top Header Block
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  specTitleBadge: {
    alignItems: "flex-end",
  },
  specDocTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  specDocId: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    marginTop: 2,
  },
  specMetaDate: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },

  // Key Value Summary Grid
  metaGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 8,
    marginBottom: 14,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  metaSubValue: {
    fontSize: 8,
    color: "#334155",
    marginTop: 1,
  },

  // Section Styles
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    marginBottom: 6,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Two column specs layout
  twoColRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  boxPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  paramLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  paramValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "right",
  },

  // Tables
  tableContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  colTh: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  colTd: {
    fontSize: 8,
    color: "#1e293b",
  },

  // Milestones row
  milestoneBadge: {
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },

  // Signoff Block
  signoffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 16,
  },
  signoffBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    padding: 8,
    minHeight: 48,
    justifyContent: "space-between",
  },
  signoffLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
  },
  signoffLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#94a3b8",
    borderStyle: "dashed",
    marginTop: 18,
  },

  // Page Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
});

export const OrderSpecificationPDF: React.FC<OrderSpecPdfProps> = ({
  docNo,
  orderData,
  sizes = [],
  sampleData,
}) => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Document title={`Order-Spec-${docNo}`} author="PrintGoo ERP">
      <Page size="A4" style={styles.page}>
        {/* Header Block */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brandTitle}>PRINTGOO ECOSYSTEM</Text>
            <Text style={styles.brandSubtitle}>Industrial Printing & Manufacturing ERP</Text>
          </View>
          <View style={styles.specTitleBadge}>
            <Text style={styles.specDocTitle}>PRODUCTION SPECIFICATION</Text>
            <Text style={styles.specDocId}>SPEC NO: {docNo || "CO-UNASSIGNED"}</Text>
            <Text style={styles.specMetaDate}>Date Generated: {currentDate}</Text>
          </View>
        </View>

        {/* Primary Metadata Box */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Client / Customer</Text>
            <Text style={styles.metaValue}>{orderData.customer || "General Customer"}</Text>
            <Text style={styles.metaSubValue}>Type: {orderData.orderType || "Production"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Product / Item</Text>
            <Text style={styles.metaValue}>{orderData.product || "Custom Printed Good"}</Text>
            <Text style={styles.metaSubValue}>Category: {orderData.itemCategory || "General"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Batch Quantity</Text>
            <Text style={styles.metaValue}>
              {orderData.quantity?.toLocaleString() || "0"} {orderData.unit || "pcs"}
            </Text>
            <Text style={styles.metaSubValue}>Status: {orderData.status || "Draft"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Target Deadline</Text>
            <Text style={styles.metaValue}>{orderData.deadline || "TBD"}</Text>
            <Text style={styles.metaSubValue}>Priority: {orderData.priority || "Normal"}</Text>
          </View>
        </View>

        {/* Manufacturing & Physical Geometry */}
        <View style={styles.twoColRow}>
          {/* Col 1: Geometry & Prepress */}
          <View style={styles.boxPanel}>
            <Text style={[styles.metaLabel, { color: "#0f172a", marginBottom: 5 }]}>
              Physical Dimensions & Substrate
            </Text>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Dimensions (W x H):</Text>
              <Text style={styles.paramValue}>
                {orderData.width ?? "-"} × {orderData.height ?? "-"} {orderData.dimensionUnit || "mm"}
              </Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Bleed Allowance:</Text>
              <Text style={styles.paramValue}>{orderData.bleed ?? 0} {orderData.dimensionUnit || "mm"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Die-Cut / Corner:</Text>
              <Text style={styles.paramValue}>{orderData.cornerType || "Standard Square"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Paper / Substrate:</Text>
              <Text style={styles.paramValue}>{orderData.paperStock || "Standard Stock"}</Text>
            </View>
            {orderData.kashirovkaMode && orderData.kashirovkaMode !== "none" && (
              <View style={styles.paramRow}>
                <Text style={styles.paramLabel}>Kashirovka Structure:</Text>
                <Text style={styles.paramValue}>
                  {orderData.kashirovkaMode.toUpperCase()} ({orderData.kashirovkaStrategy === "split_half_sheet" ? "1-CTP Split-Mount" : "2-CTP Sheet-to-Sheet"})
                </Text>
              </View>
            )}
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Surface Finishing:</Text>
              <Text style={styles.paramValue}>{orderData.coating || "None"}</Text>
            </View>
          </View>

          {/* Col 2: Production Routing */}
          <View style={styles.boxPanel}>
            <Text style={[styles.metaLabel, { color: "#0f172a", marginBottom: 5 }]}>
              Routing & Press Specs
            </Text>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Assigned Department:</Text>
              <Text style={styles.paramValue}>{orderData.department || "Offset"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Production Site:</Text>
              <Text style={styles.paramValue}>{orderData.site || "Main Plant"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Recipe / Profile:</Text>
              <Text style={styles.paramValue}>{orderData.recipe || "STANDARD_V1"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Responsible Tech/Rep:</Text>
              <Text style={styles.paramValue}>{orderData.responsible || "Production Mgr"}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Linked Work Order:</Text>
              <Text style={styles.paramValue}>{orderData.linkedWoId || "None / Direct"}</Text>
            </View>
          </View>
        </View>

        {/* Flexo Technical Specs if applicable */}
        {orderData.department === "Flexo" && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Flexographic Machine Parameters</Text>
            </View>
            <View style={[styles.metaGrid, { marginBottom: 0 }]}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Cylinder Teeth</Text>
                <Text style={styles.metaValue}>{orderData.flexoCylinderTeeth || "-"} T</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Web Width</Text>
                <Text style={styles.metaValue}>{orderData.flexoWebWidth || "-"} mm</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Print Colors</Text>
                <Text style={styles.metaValue}>{orderData.flexoColors || "-"} Col</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Gap (X / Y)</Text>
                <Text style={styles.metaValue}>{orderData.flexoGapX ?? 3} / {orderData.flexoGapY ?? 3} mm</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sizes / SKU Distribution Table if present */}
        {sizes && sizes.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Size / SKU Breakdown</Text>
            </View>
            <View style={styles.tableContainer}>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.colTh, { width: "30%" }]}>Size / Variant</Text>
                <Text style={[styles.colTh, { width: "40%" }]}>Batch Quantity</Text>
                <Text style={[styles.colTh, { width: "30%" }]}>Share (%)</Text>
              </View>
              {sizes.map((s, idx) => {
                const total = sizes.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
                const percent = total > 0 ? ((s.quantity / total) * 100).toFixed(1) : "0";
                return (
                  <View key={s.id || idx} style={styles.tableRow}>
                    <Text style={[styles.colTd, { width: "30%", fontFamily: "Helvetica-Bold" }]}>
                      {s.size}
                    </Text>
                    <Text style={[styles.colTd, { width: "40%" }]}>
                      {s.quantity?.toLocaleString()} pcs
                    </Text>
                    <Text style={[styles.colTd, { width: "30%", color: "#64748b" }]}>
                      {percent}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Production Milestones Checklist */}
        {orderData.milestones && orderData.milestones.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Routing Stages & Verification Milestones</Text>
            </View>
            <View style={styles.tableContainer}>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.colTh, { width: "35%" }]}>Stage Name</Text>
                <Text style={[styles.colTh, { width: "25%" }]}>Department</Text>
                <Text style={[styles.colTh, { width: "25%" }]}>Assigned Station</Text>
                <Text style={[styles.colTh, { width: "15%", textAlign: "right" }]}>Status</Text>
              </View>
              {orderData.milestones.map((m: ProductionMilestone, idx: number) => (
                <View key={m.id || idx} style={styles.tableRow}>
                  <Text style={[styles.colTd, { width: "35%", fontFamily: "Helvetica-Bold" }]}>{m.name}</Text>
                  <Text style={[styles.colTd, { width: "25%" }]}>{m.department}</Text>
                  <Text style={[styles.colTd, { width: "25%", color: "#64748b" }]}>{m.assignedTo || "General Queue"}</Text>
                  <Text style={[styles.colTd, { width: "15%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                    {m.status}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Physical Sample Dispatch Details if recorded */}
        {sampleData && sampleData.isDispatched && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Physical Proof / Sample Tracking</Text>
            </View>
            <View style={styles.metaGrid}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Courier</Text>
                <Text style={styles.metaValue}>{sampleData.courierName || "Standard"}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Tracking #</Text>
                <Text style={styles.metaValue}>{sampleData.trackingNumber || "N/A"}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Sample Qty</Text>
                <Text style={styles.metaValue}>{sampleData.sampleQty} pcs</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Recipient</Text>
                <Text style={styles.metaValue}>{sampleData.recipientName || "Client Rep"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quality & Sign-off Block */}
        <View style={styles.signoffRow}>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Pre-Press Operator Approval</Text>
            <View style={styles.signoffLine} />
          </View>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Production Shift Supervisor</Text>
            <View style={styles.signoffLine} />
          </View>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Quality Control & Packaging</Text>
            <View style={styles.signoffLine} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            CONFIDENTIAL — PRINTGOO MANUFACTURING SPECIFICATION • DOC REF: {docNo}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};
