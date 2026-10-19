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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Download,
  Printer,
  Search,
  ExternalLink,
  Building2,
  UserCheck,
  FilePlus2,
  Scale,
  Save,
  ArrowUpRight,
  Sparkles,
  Mail,
  Phone,
  MessageSquare,
  Copy,
  Check,
  FileText,
} from "lucide-react";

import { useWorkspaceStore, CrmCustomerRecord } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

interface CrmGridProps {
  type: string; // "customers" | "leads"
}

interface LeadRecord {
  id: string;
  company: string;
  tin: string;
  contact: string;
  phone: string;
  email?: string;
  productInterest: string;
  estimatedOrderUsd: number;
  source: string;
  manager: string;
  notes?: string;
  status: "New" | "Contacted" | "Sample Sent" | "Qualified" | "Converted";
}

const INITIAL_LEADS: LeadRecord[] = [
  {
    id: "LD-1001",
    company: "Tashkent Tea & Spices LLC",
    tin: "309881240",
    contact: "Javlonbek Orifov",
    phone: "+998 90 944-11-22",
    email: "procurement@tea-spices.uz",
    productInterest: "300g Coated Tea Packaging Box + Hot Foil (25,000 pcs)",
    estimatedOrderUsd: 6400,
    source: "UzPrint Expo 2026",
    manager: "Elena Voronina",
    notes: "Ko'rgazmada tanishdik. 25,000 dona quti uchun qolip (die-cut) va oltin folga namunalarini taqdim etish so'ralgan. To'lov shartlari: 50% oldindan.",
    status: "Qualified",
  },
  {
    id: "LD-1002",
    company: "Silk Road Boutique Hotel",
    tin: "307612398",
    contact: "Malika Karimova",
    phone: "+998 93 380-55-66",
    email: "sales@silkroadhotel.uz",
    productInterest: "600g Duplex Kashirovka VIP Keycard Holder & Welcome Folder",
    estimatedOrderUsd: 3200,
    source: "Instagram / Website",
    manager: "Elena Voronina",
    notes: "Mehmonxona ochilishiga brendlashtirilgan VIP kartochka qutisi va papka kerak. Namunalar kuryer orqali yuborildi.",
    status: "Sample Sent",
  },
  {
    id: "LD-1003",
    company: "Bukhara Textile Cluster",
    tin: "304119872",
    contact: "Rustamjon Sobirov",
    phone: "+998 97 301-77-88",
    email: "info@bukhara-textile.com",
    productInterest: "Woven Satin 60mm Care Labels + Hangtags (100,000 pcs)",
    estimatedOrderUsd: 8900,
    source: "Tavsiya (Referral)",
    manager: "T. Alimov",
    notes: "Eksport uchun to'qimachilik yorliqlari (satin lentali pechat). O'lchamlari: 60x30mm, 4 rangli pechat. Qayta aloqaga chiqish: Dushanba 14:00.",
    status: "Contacted",
  },
  {
    id: "LD-1004",
    company: "Samarkand Sweets Factory",
    tin: "305229104",
    contact: "Sherzod Normatov",
    phone: "+998 99 512-00-99",
    email: "supply@samarkand-sweets.uz",
    productInterest: "E-Flute Laminated Gift Box 350g + Matte Lamination",
    estimatedOrderUsd: 14500,
    source: "Sovuq qo'ng'iroq",
    manager: "M. Ivanova",
    notes: "Yangi yil va bayram shirinliklari uchun mikrogofrali sovg'a qutilari. Namunaviy maket va narx taklifi tayyorlanmoqda.",
    status: "New",
  },
  {
    id: "LD-1005",
    company: "OrienPharma Med",
    tin: "308771203",
    contact: "Dilnoza Rahimova",
    phone: "+998 71 277-88-99",
    email: "purchasing@orienpharma.uz",
    productInterest: "Medicine Folding Cartons + 80g Instructions Insert",
    estimatedOrderUsd: 11200,
    source: "Tender Portal",
    manager: "Elena Voronina",
    notes: "Farmatsevtika dori qutilari va ichki yo'riqnoma qog'ozlari (80g ofset). Sertifikatlar va gigiyenik xulosalar talab qilinadi.",
    status: "Qualified",
  },
];

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
    addNotification,
  } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [leads, setLeads] = useState<LeadRecord[]>(INITIAL_LEADS);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomerRecord | null>(null);
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

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
  }, [type, customerRows, leads]);

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

      if (colId === "id" || colId === "tin" || colId === "contractNo") {
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

      if (column.id === "balance") {
        const num = Number(val ?? 0);
        const formatted =
          num > 0
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
      setEditingLead({ ...rowData });
      setEditingCustomer(null);
      setInspectorOpen(true);
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
      setEditingLead({
        id: `LD-${nextNum}`,
        company: "",
        tin: "",
        contact: "",
        phone: "+998 ",
        email: "",
        productInterest: "",
        estimatedOrderUsd: 2500,
        source: "Instagram / Website",
        manager: "Elena Voronina",
        notes: "",
        status: "New",
      });
      setEditingCustomer(null);
      setInspectorOpen(true);
    } else {
      const nextNum = 101 + crmCustomers.length;
      const newCust: CrmCustomerRecord = {
        id: `CUST-${nextNum}`,
        name: `Yangi Mijoz MCHJ #${nextNum}`,
        tin: "309500100",
        industry: "FMCG & Packaging",
        contactPerson: "",
        phone: "+998 90 ",
        email: "",
        contractNo: `CON-2026-${nextNum}`,
        paymentTerms: "50% Prepay / 50% Ship",
        manager: "Elena Voronina",
        status: "Active",
      };
      openTab({
        id: newCust.id,
        title: `${newCust.id}: ${newCust.name}`,
        type: "customer",
        module: "crm",
        isUnsaved: true,
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

  const handleSaveCustomer = () => {
    if (!editingCustomer || !editingCustomer.name.trim()) return;
    upsertCustomer(editingCustomer);
    addNotification({
      title: `Mijoz kartochkasi saqlandi (${editingCustomer.id})`,
      description: `${editingCustomer.name} (STIR: ${editingCustomer.tin}) CRM va Moliya bazasida yangilandi.`,
      severity: "success",
      link: { module: "crm", subModule: "customers" },
    });
    setInspectorOpen(false);
  };

  const handleCreateOrderForCustomer = (cust: CrmCustomerRecord) => {
    upsertCustomer(cust);
    const newOrderNo = `ORD-2026-${Math.floor(195 + Math.random() * 700)}`;
    openTab({
      id: newOrderNo,
      title: `${newOrderNo}: ${cust.name}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newOrderNo,
        customer: cust.name,
        product: "New Print Specification",
        quantity: 5000,
        unit: "pcs",
        orderType: "Production",
        approvalStatus: "Draft",
        currency: "USD",
        recipe: "OFFSET_STD_V1",
        department: "Offset",
        deadline: "2026-10-25",
        responsible: cust.manager || "Elena Voronina",
      },
    });
    setInspectorOpen(false);
  };

  const handleSaveLead = () => {
    if (!editingLead || !editingLead.company.trim()) return;
    setLeads((prev) => {
      const exists = prev.some((l) => l.id === editingLead.id);
      return exists
        ? prev.map((l) => (l.id === editingLead.id ? editingLead : l))
        : [editingLead, ...prev];
    });
    setInspectorOpen(false);
  };

  const handleConvertLeadToOrder = (lead: LeadRecord) => {
    const nextNum = 101 + crmCustomers.length;
    const newCust: CrmCustomerRecord = {
      id: `CUST-${nextNum}`,
      name: lead.company || "New Client LLC",
      tin: lead.tin || "309112233",
      industry: "Commercial & Packaging",
      contactPerson: lead.contact || "Procurement Lead",
      phone: lead.phone || "+998 90 000-00-00",
      email: lead.email || "orders@client.uz",
      contractNo: `CON-2026-${nextNum}`,
      paymentTerms: "50% Advance / 50% Before Dispatch",
      manager: lead.manager || "Elena Voronina",
      status: "Active",
    };
    upsertCustomer(newCust);
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: "Converted" } : l))
    );

    const newOrderNo = `ORD-2026-${Math.floor(200 + Math.random() * 600)}`;
    openTab({
      id: newOrderNo,
      title: `${newOrderNo}: ${newCust.name}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
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
    setInspectorOpen(false);
  };

  const activeCustomerSettlement = useMemo(() => {
    if (!editingCustomer) return null;
    return clientSettlements.find(
      (s) =>
        s.customer.toLowerCase() === editingCustomer.name.toLowerCase() ||
        s.customerTin === editingCustomer.tin
    );
  }, [editingCustomer, clientSettlements]);

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
                  <span>{type === "leads" ? "New Lead" : "New Customer"}</span>
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
      </ContextMenu>

      {/* 360° Customer / Lead Inspector Drawer */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent className="w-[520px] sm:max-w-[540px] p-0 flex flex-col h-full bg-card overflow-hidden">
          {editingCustomer && (
            <div className="flex flex-col h-full overflow-hidden">
              <SheetHeader className="px-6 pt-5 pb-3 border-b border-border pr-12 bg-muted/20 shrink-0 text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs bg-background">
                    {editingCustomer.id}
                  </Badge>
                  <Badge
                    className={
                      editingCustomer.status === "VIP"
                        ? "bg-amber-500/15 text-amber-500 border-amber-500/30 font-medium"
                        : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-medium"
                    }
                  >
                    {editingCustomer.status}
                  </Badge>
                </div>
                <SheetTitle className="flex items-center gap-2 text-base pt-1 truncate">
                  <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate">{editingCustomer.name || "Customer Card (360°)"}</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Mijoz rekvizitlari (STIR, Shartnoma), o&apos;zaro hisob-kitob saldosi va tezkor buyurtma ochish.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Live Financial Settlement Card */}
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-500" />
                      Akt Sverka / Hisob-kitob Saldosi
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-blue-500 hover:text-blue-600 gap-1"
                      onClick={() => {
                        setInspectorOpen(false);
                        setModule("finance", "settlements");
                      }}
                    >
                      <span>Moliya reestriga o&apos;tish</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-background rounded p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Jami yuklangan (Debit)</div>
                      <div className="text-xs font-mono font-semibold text-foreground">
                        ${(activeCustomerSettlement?.totalDebit ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-background rounded p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">To&apos;langan (Credit)</div>
                      <div className="text-xs font-mono font-semibold text-emerald-500">
                        ${(activeCustomerSettlement?.totalCredit ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-background rounded p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Joriy Saldo</div>
                      <div
                        className={`text-xs font-mono font-bold ${
                          (activeCustomerSettlement?.closingBalance ?? 0) > 0
                            ? "text-red-500"
                            : (activeCustomerSettlement?.closingBalance ?? 0) < 0
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        ${(activeCustomerSettlement?.closingBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editable Requisites */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Korxona nomi (Company Name)</Label>
                    <Input
                      value={editingCustomer.name}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, name: e.target.value })
                      }
                      placeholder="e.g. Alpha Media Group LLC"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">STIR / INN (9 digits)</Label>
                    <Input
                      value={editingCustomer.tin}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, tin: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Asosiy Shartnoma № (Contract)</Label>
                    <Input
                      value={editingCustomer.contractNo}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, contractNo: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Mas&apos;ul shaxs (Contact Person)</Label>
                    <Input
                      value={editingCustomer.contactPerson}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          contactPerson: e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Telefon raqami</Label>
                    <Input
                      value={editingCustomer.phone}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, phone: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Soha (Industry)</Label>
                    <Input
                      value={editingCustomer.industry}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, industry: e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={editingCustomer.status}
                      onValueChange={(val) =>
                        val && setEditingCustomer({ ...editingCustomer, status: val as CrmCustomerRecord["status"] })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">To&apos;lov shartlari (Payment Terms)</Label>
                    <Input
                      value={editingCustomer.paymentTerms}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          paymentTerms: e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Account Manager</Label>
                    <Input
                      value={editingCustomer.manager}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, manager: e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <Separator />

              </div>

              <div className="p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between gap-3">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleCreateOrderForCustomer(editingCustomer)}
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Yangi Buyurtma Ochish</span>
                </Button>

                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSaveCustomer}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Saqlash</span>
                </Button>
              </div>
            </div>
          )}

          {editingLead && (
            <div className="flex flex-col h-full overflow-hidden">
              <SheetHeader className="px-6 pt-5 pb-3 border-b border-border pr-12 bg-muted/20 shrink-0 text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs bg-background">
                    {editingLead.id}
                  </Badge>
                  <Badge
                    className={
                      editingLead.status === "New"
                        ? "bg-sky-500/15 text-sky-500 border-sky-500/30 font-medium"
                        : editingLead.status === "Qualified"
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-medium"
                        : editingLead.status === "Sample Sent"
                        ? "bg-purple-500/15 text-purple-500 border-purple-500/30 font-medium"
                        : editingLead.status === "Contacted"
                        ? "bg-amber-500/15 text-amber-500 border-amber-500/30 font-medium"
                        : "bg-blue-500/15 text-blue-500 border-blue-500/30 font-medium"
                    }
                  >
                    {editingLead.status}
                  </Badge>
                  {editingLead.source && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {editingLead.source}
                    </Badge>
                  )}
                </div>
                <SheetTitle className="flex items-center gap-2 text-base pt-1 truncate">
                  <UserCheck className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{editingLead.company || "Yangi Lead / So'rov"}</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Kiruvchi so&apos;rov ma&apos;lumotlari, mijoz talabi va muzokara bosqichi.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
                {/* 1. Kompaniya va Bog'lanish */}
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Kompaniya va Aloqa Rekvizitlari</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Kompaniya / Brend nomi</Label>
                      <Input
                        value={editingLead.company}
                        onChange={(e) =>
                          setEditingLead({ ...editingLead, company: e.target.value })
                        }
                        placeholder="Masalan: Silk Road LLC"
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">STIR / INN</Label>
                      <Input
                        value={editingLead.tin || ""}
                        onChange={(e) =>
                          setEditingLead({ ...editingLead, tin: e.target.value })
                        }
                        placeholder="309..."
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Muloqotdagi shaxs</Label>
                      <Input
                        value={editingLead.contact}
                        onChange={(e) =>
                          setEditingLead({ ...editingLead, contact: e.target.value })
                        }
                        placeholder="Ism Familiya"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Telefon</Label>
                        {editingLead.phone && (
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(editingLead.phone)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            {copiedPhone ? (
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                            <span>{copiedPhone ? "Nusxalandi" : "Nusxalash"}</span>
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                        <Input
                          value={editingLead.phone}
                          onChange={(e) =>
                            setEditingLead({ ...editingLead, phone: e.target.value })
                          }
                          className="h-8 text-xs font-mono pl-8"
                          placeholder="+998 90 123-45-67"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Email pochta</Label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                      <Input
                        value={editingLead.email || ""}
                        onChange={(e) =>
                          setEditingLead({ ...editingLead, email: e.target.value })
                        }
                        placeholder="procurement@company.uz"
                        className="h-8 text-xs pl-8"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Spetsifikatsiya va Baholash */}
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>Poligrafiya Buyurtmasi va Baholash</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">So&apos;ralayotgan poligrafiya mahsuloti (Print Spec)</Label>
                    <Input
                      value={editingLead.productInterest}
                      onChange={(e) =>
                        setEditingLead({ ...editingLead, productInterest: e.target.value })
                      }
                      placeholder="Masalan: 300g Coated Tea Packaging Box + Hot Foil (25,000 dona)"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Taxminiy buyurtma qiymati ($)</Label>
                      <Input
                        type="number"
                        value={editingLead.estimatedOrderUsd}
                        onChange={(e) =>
                          setEditingLead({
                            ...editingLead,
                            estimatedOrderUsd: Number(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-xs font-mono font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Bosqich (Stage)</Label>
                      <Select
                        value={editingLead.status}
                        onValueChange={(val) =>
                          val && setEditingLead({ ...editingLead, status: val as LeadRecord["status"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New (Yangi so&apos;rov)</SelectItem>
                          <SelectItem value="Contacted">Contacted (Bog&apos;lanildi)</SelectItem>
                          <SelectItem value="Sample Sent">Sample Sent (Namuna yuborildi)</SelectItem>
                          <SelectItem value="Qualified">Qualified (Kelishildi)</SelectItem>
                          <SelectItem value="Converted">Converted (Buyurtmaga aylandi)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Kelib tushish manbasi (Source)</Label>
                      <Select
                        value={editingLead.source}
                        onValueChange={(val) =>
                          val && setEditingLead({ ...editingLead, source: val })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UzPrint Expo 2026">UzPrint Expo 2026</SelectItem>
                          <SelectItem value="Instagram / Website">Instagram / Website</SelectItem>
                          <SelectItem value="Telegram">Telegram</SelectItem>
                          <SelectItem value="Tavsiya (Referral)">Tavsiya (Referral)</SelectItem>
                          <SelectItem value="Sovuq qo'ng'iroq">Sovuq qo&apos;ng&apos;iroq</SelectItem>
                          <SelectItem value="Tender Portal">Tender Portal</SelectItem>
                          <SelectItem value="Direct Inquiry">Boshqa / To&apos;g&apos;ridan-to&apos;g&apos;ri</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Mas&apos;ul menejer</Label>
                      <Select
                        value={editingLead.manager}
                        onValueChange={(val) =>
                          val && setEditingLead({ ...editingLead, manager: val })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Elena Voronina">Elena Voronina</SelectItem>
                          <SelectItem value="T. Alimov">T. Alimov</SelectItem>
                          <SelectItem value="M. Ivanova">M. Ivanova</SelectItem>
                          <SelectItem value="Bobur Shokirov">Bobur Shokirov</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 3. Muzokara Tarixi va Izohlar */}
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      Muzokara Izohi va Eslatmalar
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Menejer kundaligi
                    </span>
                  </div>

                  <Textarea
                    value={editingLead.notes || ""}
                    onChange={(e) =>
                      setEditingLead({ ...editingLead, notes: e.target.value })
                    }
                    placeholder="Mijoz talablari, so'ralgan namunalar, muddatlar va qayta qo'ng'iroq vaqti..."
                    className="min-h-[85px] text-xs resize-none leading-relaxed"
                  />

                  {/* Tezkor teglar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Tezkor:</span>
                    {[
                      "+ Namunalar yuborildi",
                      "+ Maket kutilmoqda",
                      "+ Narx kelishilmoqda",
                      "+ Shoshilinch tiraj",
                      "+ Qayta qo'ng'iroq",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = editingLead.notes || "";
                          const updated = current
                            ? `${current}\n${tag.replace("+ ", "• ")}`
                            : tag.replace("+ ", "• ");
                          setEditingLead({ ...editingLead, notes: updated });
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between gap-3">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  onClick={() => handleConvertLeadToOrder(editingLead)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mijozga aylantirish va Buyurtma ochish</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setInspectorOpen(false)}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    onClick={handleSaveLead}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Saqlash</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
