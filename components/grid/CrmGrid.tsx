"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Download,
  Printer,
  Search,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { useWorkspaceStore, CrmCustomerRecord } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { LeadDetailModal, LeadRecord } from "@/components/crm/LeadDetailModal";
import {
  SupplierDetailModal,
  SUPPLIER_CATEGORY_LABELS,
} from "@/components/crm/SupplierDetailModal";
import type { SupplierRecord, SupplierCategory } from "@/lib/server/supplierService";

export type { LeadRecord, SupplierRecord };

interface CrmGridProps {
  type: string; // "customers" | "leads" | "suppliers"
}

export function CrmGrid({ type }: CrmGridProps) {
  const tCommon = useTranslations("Common");
  const {
    updateGridStats,
    theme,
    openTab,
    setModule,
    crmCustomers,
    clientSettlements,
    upsertCustomer,
    loadCrmCustomers,
    isCrmCustomersLoading,
    suppliers,
    loadSuppliers,
    isSuppliersLoading,
    upsertSupplierAsync,
    deleteSupplierAsync,
    addNotification,
  } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/crm/leads");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setLeads(json.data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch CRM leads from server:", e);
    }
  }, []);

  useEffect(() => {
    if (type === "leads") {
      fetchLeads();
    } else if (type === "suppliers") {
      loadSuppliers();
    }
  }, [type, fetchLeads, loadSuppliers]);

  useEffect(() => {
    if (loadCrmCustomers) {
      loadCrmCustomers();
    }
  }, [loadCrmCustomers]);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);

  const customerRows = useMemo(() => {
    return crmCustomers.map((c) => {
      const settlement = clientSettlements.find(
        (s) =>
          s.customer.toLowerCase() === c.name.toLowerCase() ||
          s.customerTin === c.tin
      );
      return {
        ...c,
        balance: settlement ? settlement.closingBalance : 0,
      };
    });
  }, [crmCustomers, clientSettlements]);

  const { columns, rows } = useMemo(() => {
    if (type === "leads") {
      const cols: GridColumn[] = [
        { id: "id", title: "Lead ID", width: 95, icon: GridColumnIcon.HeaderReference },
        { id: "company", title: "Company / Brand", width: 210, icon: GridColumnIcon.HeaderString },
        { id: "contact", title: "Contact Person", width: 155, icon: GridColumnIcon.HeaderString },
        { id: "phone", title: "Phone", width: 145, icon: GridColumnIcon.HeaderString },
        { id: "productInterest", title: "Requested Print Spec", width: 290, icon: GridColumnIcon.HeaderString },
        { id: "estimatedOrderUsd", title: "Est. Value ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "source", title: "Lead Source", width: 135, icon: GridColumnIcon.HeaderLookup },
        { id: "manager", title: "Manager", width: 135, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Stage", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      return { columns: cols, rows: leads };
    }

    if (type === "suppliers") {
      const cols: GridColumn[] = [
        { id: "code", title: "Ta'minotchi ID", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Ta'minotchi / Hamkor", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "categoryLabel", title: "Yo'nalishi / Toifasi", width: 185, icon: GridColumnIcon.HeaderLookup },
        { id: "contactPerson", title: "Mas'ul shaxs", width: 145, icon: GridColumnIcon.HeaderString },
        { id: "phone", title: "Telefon", width: 140, icon: GridColumnIcon.HeaderString },
        { id: "tin", title: "STIR / INN", width: 110, icon: GridColumnIcon.HeaderCode },
        { id: "currentBalance", title: "Bizning qarzimiz (Saldo)", width: 155, icon: GridColumnIcon.HeaderNumber },
        { id: "paymentTerms", title: "To'lov shartlari", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Holati", width: 100, icon: GridColumnIcon.HeaderSingleValue },
      ];
      const suppRows = suppliers.map((s) => ({
        ...s,
        categoryLabel: SUPPLIER_CATEGORY_LABELS[s.category]?.label || s.category,
      }));
      return { columns: cols, rows: suppRows };
    }

    // Default: "customers"
    const cols: GridColumn[] = [
      { id: "id", title: "Cust ID", width: 95, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Company Name", width: 230, icon: GridColumnIcon.HeaderString },
      { id: "tin", title: "STIR / INN", width: 110, icon: GridColumnIcon.HeaderCode },
      { id: "contactPerson", title: "Contact Person", width: 165, icon: GridColumnIcon.HeaderString },
      { id: "phone", title: "Phone", width: 145, icon: GridColumnIcon.HeaderString },
      { id: "paymentTerms", title: "Payment Terms", width: 185, icon: GridColumnIcon.HeaderString },
      { id: "balance", title: "Balance ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "manager", title: "Account Manager", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Status", width: 105, icon: GridColumnIcon.HeaderSingleValue },
    ];
    return { columns: cols, rows: customerRows };
  }, [type, customerRows, leads, suppliers]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r: any) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchFilter, statusFilter]);

  useEffect(() => {
    const selectedRowsCount = selection.rows.length;
    let coords = "R1:C1";
    if (selection.current?.cell) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, filteredRows.length, coords);
  }, [selection, filteredRows.length, columns, updateGridStats]);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData: any = filteredRows[row];
      if (!rowData) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const colId = column?.id || "";
      const val = rowData[colId];

      if (colId === "id" || colId === "code" || colId === "tin" || colId === "contractNo") {
        return {
          kind: GridCellKind.Text,
          data: String(val ?? ""),
          displayData: String(val ?? ""),
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "balance" || column.id === "currentBalance") {
        const num = Number(val ?? 0);
        const curr = rowData.currency || (column.id === "currentBalance" ? "UZS" : "USD");
        const formatted =
          curr === "UZS"
            ? `${num.toLocaleString("uz-UZ")} UZS`
            : num > 0
            ? `+$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : num < 0
            ? `-$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "$0.00";
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: formatted,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark
              ? num > 0
                ? "#f87171"
                : num < 0
                ? "#4ade80"
                : "#a1a1aa"
              : num > 0
              ? "#dc2626"
              : num < 0
              ? "#15803d"
              : "#52525b",
            baseFontStyle: "700 12px monospace",
          },
        };
      }

      if (column.id === "estimatedOrderUsd") {
        const num = Number(val ?? 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: `$${num.toLocaleString("en-US")}`,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#4ade80" : "#15803d",
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        const isGood =
          val === "VIP" || val === "Active" || val === "Qualified" || val === "Converted";
        const isBad = val === "Blocked";
        return {
          kind: GridCellKind.Text,
          data: String(val ?? ""),
          displayData: String(val ?? ""),
          allowOverlay: false,
          themeOverride: {
            textDark: isDark
              ? isGood
                ? "#4ade80"
                : isBad
                ? "#f87171"
                : "#facc15"
              : isGood
              ? "#15803d"
              : isBad
              ? "#b91c1c"
              : "#a16207",
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      return {
        kind: typeof val === "number" ? GridCellKind.Number : GridCellKind.Text,
        data: val ?? "",
        displayData: String(val ?? ""),
        allowOverlay: true,
        contentAlign: typeof val === "number" ? "right" : "left",
      };
    },
    [filteredRows, columns, isDark]
  );

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((r: any) => {
      if (r.status) statuses.add(r.status);
    });
    return Array.from(statuses);
  }, [rows]);

  const handleOpenRow = (rowIndex: number) => {
    const rowData: any = filteredRows[rowIndex];
    if (!rowData) return;

    if (type === "leads") {
      setSelectedLead({ ...rowData });
      setLeadModalOpen(true);
    } else if (type === "suppliers") {
      openTab({
        id: rowData.id,
        title: `${rowData.code || rowData.id}: ${rowData.name}`,
        type: "supplier",
        module: "crm",
        activeLevel3Tab: "overview",
        documentData: rowData,
      });
    } else {
      const custRecord: CrmCustomerRecord = {
        id: rowData.id,
        name: rowData.name,
        tin: rowData.tin,
        industry: rowData.industry,
        contactPerson: rowData.contactPerson,
        phone: rowData.phone,
        email: rowData.email,
        contractNo: rowData.contractNo,
        paymentTerms: rowData.paymentTerms,
        manager: rowData.manager,
        status: rowData.status,
      };
      openTab({
        id: custRecord.id,
        title: `${custRecord.id}: ${custRecord.name}`,
        type: "customer",
        module: "crm",
        activeLevel3Tab: "overview",
        documentData: custRecord,
      });
    }
  };

  const handleCreateNew = () => {
    if (type === "leads") {
      const nextNum = 1001 + leads.length;
      setSelectedLead({
        id: `LD-${nextNum}`,
        company: "",
        tin: "",
        contact: "",
        phone: "",
        email: "",
        productInterest: "",
        estimatedOrderUsd: 2500,
        source: "Instagram / Website",
        manager: "Elena Voronina",
        notes: "",
        status: "New",
      });
      setLeadModalOpen(true);
    } else if (type === "suppliers") {
      const draftId = `draft-supp-${Date.now()}`;
      const nextCode = `SUP-${101 + suppliers.length}`;
      const newSupp: SupplierRecord = {
        id: draftId,
        code: nextCode,
        name: "",
        category: "raw_materials",
        tin: "",
        contactPerson: "",
        phone: "",
        openingBalance: 0,
        currentBalance: 0,
        currency: "UZS",
        paymentTerms: "100% Shartnoma bo'yicha",
        status: "Active",
      };
      openTab({
        id: draftId,
        title: `Yangi ta'minotchi: ${nextCode}`,
        type: "supplier",
        module: "crm",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: newSupp,
      });
    } else {
      const draftId = `draft-cust-${Date.now()}`;
      const newCust: CrmCustomerRecord = {
        id: draftId,
        name: "",
        tin: "",
        industry: "",
        contactPerson: "",
        phone: "",
        email: "",
        contractNo: "",
        paymentTerms: "",
        manager: "",
        status: "New",
        contacts: [],
        contracts: [],
      };
      openTab({
        id: draftId,
        title: "Yangi Mijoz (Qoralama)",
        type: "customer",
        module: "crm",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: newCust,
      });
    }
  };

  const handleOpenSelected = () => {
    const indices = selection.rows.toArray();
    if (indices.length > 0) {
      handleOpenRow(indices[0]);
    } else if (filteredRows.length > 0) {
      handleOpenRow(0);
    }
  };

  const handleSaveLead = async (leadToSave: LeadRecord) => {
    if (!leadToSave || !leadToSave.company.trim()) return;
    setLeads((prev) => {
      const exists = prev.some((l) => l.id === leadToSave.id);
      return exists
        ? prev.map((l) => (l.id === leadToSave.id ? leadToSave : l))
        : [leadToSave, ...prev];
    });
    addNotification({
      title: `Lid saqlandi (${leadToSave.id})`,
      description: `${leadToSave.company} (${leadToSave.status})`,
      severity: "success",
    });
    setLeadModalOpen(false);

    try {
      await fetch("/api/v1/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadToSave),
      });
      fetchLeads();
    } catch (e) {
      console.error("Failed to persist lead to DB:", e);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    addNotification({
      title: `Lid o'chirildi (${leadId})`,
      severity: "info",
    });
    setLeadModalOpen(false);

    try {
      await fetch(`/api/v1/crm/leads/${encodeURIComponent(leadId)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("Failed to delete lead from DB:", e);
    }
  };

  const handleSaveSupplier = async (suppToSave: Partial<SupplierRecord>) => {
    if (!suppToSave || !suppToSave.name?.trim()) return;
    await upsertSupplierAsync(suppToSave);
    addNotification({
      title: `Ta'minotchi saqlandi (${suppToSave.code || suppToSave.name})`,
      severity: "success",
    });
    setSupplierModalOpen(false);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    await deleteSupplierAsync(supplierId);
    addNotification({
      title: "Ta'minotchi o'chirildi",
      severity: "info",
    });
    setSupplierModalOpen(false);
  };

  const handleConvertLeadToOrder = async (lead: LeadRecord) => {
    const draftCustId = `draft-cust-${Date.now()}`;
    const newCust: CrmCustomerRecord = {
      id: draftCustId,
      name: lead.company || "New Client LLC",
      tin: lead.tin || "309112233",
      industry: "Commercial & Packaging",
      contactPerson: lead.contact || "Procurement Lead",
      phone: lead.phone || "+998 90 000-00-00",
      email: lead.email || "orders@client.uz",
      contractNo: "",
      paymentTerms: "50% Advance / 50% Before Dispatch",
      manager: lead.manager || "Elena Voronina",
      status: "Active",
    };
    upsertCustomer(newCust);
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: "Converted" } : l))
    );

    try {
      await fetch(`/api/v1/crm/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, status: "Converted" }),
      });
    } catch (e) {
      console.error("Failed to update converted lead status:", e);
    }

    const newOrderNo = `ORD-2026-${Math.floor(200 + Math.random() * 600)}`;
    openTab({
      id: newOrderNo,
      title: `${newOrderNo}: ${newCust.name}`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newOrderNo,
        customer: newCust.name,
        product: lead.productInterest || "Custom Packaging Order",
        quantity: 5000,
        unit: "pcs",
        orderType: "Production",
        approvalStatus: "Draft",
        currency: "USD",
        recipe: "OFFSET_STD_V1",
        department: "Offset",
        deadline: "2026-10-25",
        responsible: newCust.manager,
        notes: lead.notes || "",
      },
    });

    addNotification({
      title: `Lid buyurtmaga aylantirildi (${newOrderNo})`,
      description: `${newCust.name} uchun yangi ishlab chiqarish buyurtmasi ochildi.`,
      severity: "success",
      link: { module: "production", subModule: "work-orders" },
    });

    setLeadModalOpen(false);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
            {/* Toolbar */}
            <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handleCreateNew}
                  size="sm"
                  className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {type === "leads"
                      ? "New Lead"
                      : type === "suppliers"
                      ? "Yangi Ta'minotchi"
                      : "New Customer"}
                  </span>
                </Button>
                <Separator orientation="vertical" className="h-4 mx-1" />

                {/* Status Filters */}
                {availableStatuses.length > 0 && (
                  <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                    <button
                      onClick={() => setStatusFilter("ALL")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        statusFilter === "ALL"
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ALL
                    </button>
                    {availableStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          statusFilter === status
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={`Search ${type} (Name, STIR, Phone)...`}
                    className="pl-7 h-7 text-xs bg-background border-input rounded"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>{tCommon("export")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Printer className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 w-full h-full relative" id="crm-grid-root">
              <DataEditor
                getCellContent={getContent}
                columns={columns}
                rows={filteredRows.length}
                rowMarkers="both"
                width="100%"
                height="100%"
                smoothScrollX={true}
                smoothScrollY={true}
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                onCellActivated={(cell) => handleOpenRow(cell[1])}
                rowHeight={30}
                headerHeight={32}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              />
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={handleOpenSelected} className="gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {type === "leads"
                ? "Lidni ko'rish / ochish"
                : type === "suppliers"
                ? "Ta'minotchini ko'rish / ochish"
                : "Mijozni ochish"}{" "}
              (F12)
            </span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCreateNew} className="gap-2">
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {type === "leads"
                ? "Yangi lid qo'shish"
                : type === "suppliers"
                ? "Yangi ta'minotchi qo'shish"
                : "Yangi mijoz qo'shish"}{" "}
              (Ins)
            </span>
          </ContextMenuItem>
          {type === "leads" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  const indices = selection.rows.toArray();
                  const targetRow = indices.length > 0 ? (filteredRows[indices[0]] as LeadRecord) : null;
                  if (targetRow) handleConvertLeadToOrder(targetRow);
                }}
                disabled={selection.rows.length === 0}
                className="gap-2 text-emerald-600"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buyurtmaga aylantirish</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Separate Compact Modal Window for Viewing and Managing Leads */}
      <LeadDetailModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        lead={selectedLead}
        onSave={handleSaveLead}
        onConvertToOrder={handleConvertLeadToOrder}
        onDelete={handleDeleteLead}
      />

      {/* Supplier & Partner Detail Modal */}
      <SupplierDetailModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        supplier={selectedSupplier}
        onSave={handleSaveSupplier}
        onDelete={handleDeleteSupplier}
      />
    </>
  );
}
