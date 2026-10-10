import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { WorkOrderFormData, RouteStep, ShiftEvent } from "./types";

export interface WorkOrderSpecPdfProps {
  docNo: string;
  orderData: WorkOrderFormData;
  operations: RouteStep[];
  materials?: { name: string; req: number; unit: string; stock: number }[];
  shiftEvents?: ShiftEvent[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 12,
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
  metaRight: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  docBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0284c7",
    marginTop: 2,
  },
  docDate: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },

  // Key KPI Overview Bar
  kpiBar: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 8,
    marginBottom: 12,
  },
  kpiCol: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  kpiSub: {
    fontSize: 8,
    color: "#475569",
    marginTop: 1,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
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

  // Two columns for parameters
  twoCol: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cardPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  cardTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 2,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f8fafc",
  },
  rowLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  rowVal: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "right",
  },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  th: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  td: {
    fontSize: 8,
    color: "#1e293b",
  },

  // Signoff & Authorization
  signoffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 14,
  },
  signoffBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    padding: 7,
    minHeight: 46,
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
    marginTop: 16,
  },

  // Footer
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

export const WorkOrderSpecPDF: React.FC<WorkOrderSpecPdfProps> = ({
  docNo,
  orderData,
  operations = [],
  materials = [],
  shiftEvents = [],
}) => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Document title={`WorkOrder-Spec-${docNo}`} author="PrintGoo ERP">
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>PRINTGOO INDUSTRIAL</Text>
            <Text style={styles.brandSubtitle}>Shop Floor Work Order & Routing Traveler</Text>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.docTitle}>WORK ORDER SPECIFICATION</Text>
            <Text style={styles.docBadge}>WO REF: {docNo || "WO-UNASSIGNED"}</Text>
            <Text style={styles.docDate}>Issued Date: {currentDate}</Text>
          </View>
        </View>

        {/* Primary Job KPI Bar */}
        <View style={styles.kpiBar}>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>Client & Product</Text>
            <Text style={styles.kpiVal}>{orderData.customer || "Internal / Stock"}</Text>
            <Text style={styles.kpiSub}>{orderData.product || "Manufacturing Run"}</Text>
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>Production Run Qty</Text>
            <Text style={styles.kpiVal}>
              {orderData.quantity?.toLocaleString() || "0"} {orderData.unit || "pcs"}
            </Text>
            <Text style={styles.kpiSub}>Recipe: {orderData.recipe || "DEFAULT_V1"}</Text>
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>Assigned Machine</Text>
            <Text style={styles.kpiVal}>{orderData.pressMachine || "Press Queue"}</Text>
            <Text style={styles.kpiSub}>
              {orderData.department} • {orderData.site}
            </Text>
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>Schedule Window</Text>
            <Text style={styles.kpiVal}>{orderData.startDate || "Today"} → {orderData.deadline || "TBD"}</Text>
            <Text style={styles.kpiSub}>Priority: {orderData.priority || "Normal"}</Text>
          </View>
        </View>

        {/* Two Column: Physical Specs & Recipe Requirements */}
        <View style={styles.twoCol}>
          {/* Box 1: Physical Geometry */}
          <View style={styles.cardPanel}>
            <Text style={styles.cardTitle}>Substrate & Finishing Specs</Text>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Item Category:</Text>
              <Text style={styles.rowVal}>{orderData.itemCategory || "Commercial Print"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Finished Dimensions:</Text>
              <Text style={styles.rowVal}>
                {orderData.width ?? "-"} × {orderData.height ?? "-"} {orderData.dimensionUnit || "mm"}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Bleed Allowance:</Text>
              <Text style={styles.rowVal}>{orderData.bleed ?? 0} {orderData.dimensionUnit || "mm"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Corners / Cutting:</Text>
              <Text style={styles.rowVal}>{orderData.cornerType || "Square"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Paper / Board Stock:</Text>
              <Text style={styles.rowVal}>{orderData.paperStock || "Standard Stock"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>Varnish / Coating:</Text>
              <Text style={styles.rowVal}>{orderData.coating || "None"}</Text>
            </View>
          </View>

          {/* Box 2: SKU / Size breakdown if present */}
          <View style={styles.cardPanel}>
            <Text style={styles.cardTitle}>Variant / SKU Distribution</Text>
            {orderData.sizes && orderData.sizes.length > 0 ? (
              orderData.sizes.map((s, idx) => (
                <View key={s.id || idx} style={styles.cardRow}>
                  <Text style={styles.rowLabel}>Size / Variant {s.size}:</Text>
                  <Text style={styles.rowVal}>{s.quantity.toLocaleString()} pcs</Text>
                </View>
              ))
            ) : (
              <View style={styles.cardRow}>
                <Text style={styles.rowLabel}>Batch Lot:</Text>
                <Text style={styles.rowVal}>Single Batch ({orderData.quantity?.toLocaleString()} pcs)</Text>
              </View>
            )}
            <View style={[styles.cardRow, { marginTop: 4, borderTopWidth: 0.8, borderTopColor: "#cbd5e1" }]}>
              <Text style={[styles.rowLabel, { fontFamily: "Helvetica-Bold" }]}>Total Output Target:</Text>
              <Text style={[styles.rowVal, { color: "#0284c7" }]}>
                {orderData.quantity?.toLocaleString()} {orderData.unit || "pcs"}
              </Text>
            </View>
          </View>
        </View>

        {/* Planned Raw Materials (BOM) */}
        {materials && materials.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Required Raw Materials (Bill of Materials)</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { width: "45%" }]}>Material Description</Text>
                <Text style={[styles.th, { width: "25%" }]}>Required Quantity</Text>
                <Text style={[styles.th, { width: "30%", textAlign: "right" }]}>Warehouse Stock</Text>
              </View>
              {materials.map((m, idx) => (
                <View key={idx} style={styles.tdRow}>
                  <Text style={[styles.td, { width: "45%", fontFamily: "Helvetica-Bold" }]}>{m.name}</Text>
                  <Text style={[styles.td, { width: "25%" }]}>
                    {m.req.toLocaleString()} {m.unit}
                  </Text>
                  <Text style={[styles.td, { width: "30%", textAlign: "right", color: "#64748b" }]}>
                    {m.stock.toLocaleString()} {m.unit} Available
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Shop-Floor Routing / Operations Travel Table */}
        <View style={{ marginBottom: 10 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Routing Route Sheet / Shop Floor Operations</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { width: "10%" }]}>Step</Text>
              <Text style={[styles.th, { width: "32%" }]}>Operation Name</Text>
              <Text style={[styles.th, { width: "28%" }]}>Machine Station</Text>
              <Text style={[styles.th, { width: "15%" }]}>Lead Op</Text>
              <Text style={[styles.th, { width: "15%", textAlign: "right" }]}>Status</Text>
            </View>
            {operations.map((op, idx) => (
              <View key={op.id || idx} style={styles.tdRow}>
                <Text style={[styles.td, { width: "10%", fontFamily: "Helvetica-Bold" }]}>#{op.stepNumber}</Text>
                <Text style={[styles.td, { width: "32%", fontFamily: "Helvetica-Bold" }]}>{op.name}</Text>
                <Text style={[styles.td, { width: "28%", color: "#475569" }]}>{op.machine}</Text>
                <Text style={[styles.td, { width: "15%", color: "#64748b" }]}>{op.operator}</Text>
                <Text style={[styles.td, { width: "15%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                  {op.status}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Floor Sign-offs */}
        <View style={styles.signoffRow}>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Pressman Sign-off & Run Start</Text>
            <View style={styles.signoffLine} />
          </View>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Finishing & QA Inspector</Text>
            <View style={styles.signoffLine} />
          </View>
          <View style={styles.signoffBox}>
            <Text style={styles.signoffLabel}>Warehouse Acceptance / Packed</Text>
            <View style={styles.signoffLine} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            PRINTGOO FACTORY ROUTER • INTERNAL PRODUCTION ORDER REF: {docNo}
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
