"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  CrmCustomerRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  Scale,
  ClipboardList,
  Stamp,
  Printer,
  Save,
  Check,
  Plus,
  CreditCard,
  FilePlus2,
  ExternalLink,
  Phone,
  Mail,
  UserCheck,
  FileText,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface CustomerToolingItem {
  id: string;
  name: string;
  toolType: string;
  format: string;
  cavities: string;
  location: string;
  impressionsUsed: number;
  maxLife: number;
  status: string;
}

const CUSTOMER_TOOLING_MOCK: Record<string, CustomerToolingItem[]> = {
  "Alpha Media Group": [
    {
      id: "FOIL-301",
      name: "Hot Foil Brass Cliché — Luxury Perfume & Catalog Cover",
      toolType: "Hot Foil Cliché (Brass 7mm)",
      format: "180×120 mm",
      cavities: "2-up",
      location: "Cabinet C-01",
      impressionsUsed: 18500,
      maxLife: 300000,
      status: "Ready",
    },
    {
      id: "DIE-004",
      name: "A4 Presentation Folder Die w/ Business Card Slot",
      toolType: "Flatbed Die (Штанцформа)",
      format: "640×460 mm (B2)",
      cavities: "2-up",
      location: "Rack A-05",
      impressionsUsed: 42000,
      maxLife: 150000,
      status: "Ready",
    },
  ],
  "Apex Packaging": [
    {
      id: "DIE-001",
      name: "FEFCO 0201 Master Carton Die (400×300×250)",
      toolType: "Flatbed Die (Штанцформа)",
      format: "1020×720 mm (B1)",
      cavities: "2-up",
      location: "Rack A-01",
      impressionsUsed: 64200,
      maxLife: 150000,
      status: "Ready",
    },
    {
      id: "DIE-002",
      name: "Pharma Folding Box 60×40×110 (Tuck-End)",
      toolType: "Flatbed Die (Штанцформа)",
      format: "700×1000 mm",
      cavities: "18-up",
      location: "Rack A-02",
      impressionsUsed: 138500,
      maxLife: 150000,
      status: "Re-knifing Soon",
    },
  ],
  "Nordic Print Co": [
    {
      id: "CL-204",
      name: "Flexo Photopolymer Plate Set (CMYK + White) — Satin Label",
      toolType: "Flexo Cliché (Флексоклише 1.14mm)",
      format: "Z=96 (304.8 mm)",
      cavities: "6-up",
      location: "Cabinet B-04",
      impressionsUsed: 210000,
      maxLife: 500000,
      status: "Ready",
    },
  ],
};

export function CustomerDetail({ tab }: { tab: DocumentTab }) {
  const {
    crmCustomers,
    clientSettlements,
    deliveryActs,
    upsertCustomer,
    recordClientPayment,
    setTabUnsaved,
    setLevel3Tab,
    openTab,
    closeTab,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";
  const activeTab = tab.activeLevel3Tab || "overview";

  // Find customer from store by ID or Name
  const storeCustomer = useMemo(() => {
    const d = tab.documentData || {};
    return (
      crmCustomers.find(
        (c) =>
          c.id === tab.id ||
          c.id === d.id ||
          (d.customer &&
            (c.name.toLowerCase() === String(d.customer).toLowerCase() ||
              c.name.toLowerCase().includes(String(d.customer).toLowerCase()))) ||
          (d.name &&
            (c.name.toLowerCase() === String(d.name).toLowerCase() ||
              c.name.toLowerCase().includes(String(d.name).toLowerCase())))
      ) || null
    );
  }, [crmCustomers, tab.id, tab.documentData]);

  const initialRecord: CrmCustomerRecord = useMemo(() => {
    if (storeCustomer) return storeCustomer;
    const d = tab.documentData || {};
    return {
      id: d.id || (tab.id.startsWith("CUST-") ? tab.id : `CUST-${Math.floor(100 + Math.random() * 899)}`),
      name: d.name || d.customer || "Alpha Media Group LLC",
      tin: d.tin || d.customerTin || "305841920",
      industry: d.industry || "Publishing & Packaging",
      contactPerson: d.contactPerson || "Azizbek Rahimov",
      phone: d.phone || "+998 90 123-45-67",
      email: d.email || "info@client.uz",
      contractNo: d.contractNo || `CON-2026-${Math.floor(100 + Math.random() * 899)}`,
      paymentTerms: d.paymentTerms || "50% Prepay / 50% Ship",
      manager: d.manager || "Elena Voronina",
      status: d.status === "VIP" || d.status === "Active" || d.status === "New" || d.status === "Blocked" ? d.status : "Active",
    };
  }, [storeCustomer, tab.documentData, tab.id]);

  const [form, setForm] = useState<CrmCustomerRecord>(initialRecord);

  React.useEffect(() => {
    if (storeCustomer) {
      setForm(storeCustomer);
    }
  }, [storeCustomer]);

  const handleFieldChange = (field: keyof CrmCustomerRecord, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  // Match live Client Settlement (Akt Sverka)
  const settlement = useMemo(() => {
    const cleanName = form.name.replace(" LLC", "").toLowerCase();
    return (
      clientSettlements.find(
        (s) =>
          s.customer.toLowerCase() === form.name.toLowerCase() ||
          s.customer.toLowerCase().includes(cleanName) ||
          form.name.toLowerCase().includes(s.customer.toLowerCase()) ||
          (form.tin && s.customerTin === form.tin)
      ) || null
    );
  }, [clientSettlements, form.name, form.tin]);

  // Compute Ledger rows with Running Balance (Saldo)
  const ledgerRows = useMemo(() => {
    if (!settlement) return [];
    let runningSaldo = 0;
    return settlement.ledger.map((entry, idx) => {
      runningSaldo = Number((runningSaldo + entry.debit - entry.credit).toFixed(2));
      return {
        idx: idx + 1,
        ...entry,
        runningSaldo,
      };
    });
  }, [settlement]);

  // Customer Orders & Delivery Acts
  const customerOrders = useMemo(() => {
    const cleanName = form.name.replace(" LLC", "").toLowerCase();
    const acts = deliveryActs
      .filter(
        (a) =>
          a.customer.toLowerCase().includes(cleanName) ||
          form.name.toLowerCase().includes(a.customer.toLowerCase())
      )
      .map((a) => ({
        docId: a.id,
        docType: "Schet-faktura (SF)",
        date: a.date,
        orderRef: a.orderId,
        workOrderRef: a.workOrderId,
        product: a.product,
        quantity: a.quantity,
        unit: a.unit,
        amountUsd: a.totalAmount,
        status: a.status,
      }));

    const baseOrders = [
      {
        docId: "CO-00041",
        docType: "Client Order (CO)",
        date: "2026-10-08",
        orderRef: "CO-00041",
        workOrderRef: "WO-00351",
        product: "A4 Hardcover Catalog 96p + Matte Lam",
        quantity: 5000,
        unit: "pcs",
        amountUsd: 14850,
        status: "In Production",
      },
      {
        docId: "CO-00038",
        docType: "Client Order (CO)",
        date: "2026-09-29",
        orderRef: "CO-00038",
        workOrderRef: "WO-00342",
        product: "350g Duplex Packaging Box + Hot Foil",
        quantity: 12000,
        unit: "pcs",
        amountUsd: 8400,
        status: "Completed",
      },
    ];

    return [...acts, ...baseOrders];
  }, [deliveryActs, form.name]);

  // Customer Tooling (Dies & Clichés)
  const customerTooling = useMemo<CustomerToolingItem[]>(() => {
    const matchKey = Object.keys(CUSTOMER_TOOLING_MOCK).find((k) =>
      form.name.toLowerCase().includes(k.toLowerCase())
    );
    if (matchKey) return CUSTOMER_TOOLING_MOCK[matchKey];
    return [
      {
        id: "DIE-009",
        name: `${form.name} — Custom Packaging Flatbed Die`,
        toolType: "Flatbed Die (Штанцформа)",
        format: "700×1000 mm (B1)",
        cavities: "4-up",
        location: "Rack B-03",
        impressionsUsed: 24500,
        maxLife: 150000,
        status: "Ready",
      },
    ];
  }, [form.name]);

  // Payment Form State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("5000");
  const [paymentMethod, setPaymentMethod] = useState("Bank o'tkazmasi (UZS/USD)");
  const [paymentNote, setPaymentNote] = useState("");

  const handleConfirmPayment = () => {
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return;
    const customerKey = settlement ? settlement.customer : form.name;
    recordClientPayment(
      customerKey,
      amt,
      undefined,
      paymentNote.trim()
        ? `${paymentNote.trim()} (${paymentMethod})`
        : `Shartnoma ${form.contractNo} bo'yicha to'lov (${paymentMethod})`
    );
    setIsPaymentOpen(false);
    setPaymentNote("");
  };

  const handleSave = () => {
    upsertCustomer(form);
    setTabUnsaved(tab.id, false);
  };

  const handleSaveAndClose = () => {
    upsertCustomer(form);
    setTabUnsaved(tab.id, false);
    closeTab(tab.id);
  };

  const handleCreateClientOrder = () => {
    upsertCustomer(form);
    const newId = `CO-${String(Math.floor(100 + Math.random() * 899)).padStart(5, "0")}`;
    openTab({
      id: newId,
      title: `${newId}: ${form.name}`,
      type: "client-order",
      module: "sales",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newId,
        customer: form.name,
        customerTin: form.tin,
        contractNo: form.contractNo,
        status: "Draft",
        quantity: 5000,
        unit: "pcs",
      },
    });
  };

  // ── Grid 1: Akt Sverka Ledger Columns & Cell Renderer ──────────────────────
  const [ledgerSelection, setLedgerSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const ledgerColumns = useMemo<GridColumn[]>(
    () => [
      { id: "idx", title: "№", width: 50, icon: GridColumnIcon.HeaderNumber },
      { id: "date", title: "Sana (Date)", width: 115, icon: GridColumnIcon.HeaderDate },
      { id: "docNo", title: "Hujjat №", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "docType", title: "Operatsiya turi", width: 155, icon: GridColumnIcon.HeaderSingleValue },
      { id: "description", title: "Mazmuni / Asos (Shartnoma, Mahsulot)", width: 360, icon: GridColumnIcon.HeaderString },
      { id: "debit", title: "Debet / Yuklandi (+Dt $)", width: 165, icon: GridColumnIcon.HeaderNumber },
      { id: "credit", title: "Kredit / To'landi (-Kt $)", width: 165, icon: GridColumnIcon.HeaderNumber },
      { id: "runningSaldo", title: "Joriy Saldo ($)", width: 155, icon: GridColumnIcon.HeaderNumber },
    ],
    []
  );

  const getLedgerCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = ledgerRows[row];
      const column = ledgerColumns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "idx") {
        return {
          kind: GridCellKind.Number,
          data: item.idx,
          displayData: String(item.idx),
          allowOverlay: false,
          contentAlign: "center",
        };
      }

      if (column.id === "debit" || column.id === "credit" || column.id === "runningSaldo") {
        const val = Number(item[column.id as "debit" | "credit" | "runningSaldo"] || 0);
        const isDebit = column.id === "debit";
        const isCredit = column.id === "credit";
        const isSaldo = column.id === "runningSaldo";

        let color: string | undefined = undefined;
        if (isDebit && val > 0) color = isDark ? "#f87171" : "#b91c1c";
        if (isCredit && val > 0) color = isDark ? "#4ade80" : "#15803d";
        if (isSaldo) {
          color =
            val > 0
              ? isDark
                ? "#f87171"
                : "#b91c1c"
              : val < 0
              ? isDark
                ? "#60a5fa"
                : "#1d4ed8"
              : isDark
              ? "#4ade80"
              : "#15803d";
        }

        const display =
          val === 0 && !isSaldo
            ? "—"
            : `${isDebit && val > 0 ? "+" : isCredit && val > 0 ? "-" : ""}$${Math.abs(val).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;

        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: color
            ? { textDark: color, baseFontStyle: "700 12px monospace" }
            : undefined,
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal,
        allowOverlay: false,
      };
    },
    [ledgerRows, ledgerColumns, isDark]
  );

  const handleLedgerRowActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const entry = ledgerRows[row];
      if (!entry) return;
      if (entry.docType === "Schet-faktura" || entry.docNo.startsWith("SF-")) {
        const act = deliveryActs.find((a) => a.id === entry.docNo);
        openTab({
          id: entry.docNo,
          title: `${entry.docNo}: ${form.name}`,
          type: "delivery-act",
          module: "sales",
          activeLevel3Tab: "overview",
          documentData: act || {
            id: entry.docNo,
            customer: form.name,
            customerTin: form.tin,
            contractNo: form.contractNo,
            totalAmount: entry.debit,
          },
        });
      }
    },
    [ledgerRows, deliveryActs, openTab, form]
  );

  // ── Grid 2: Customer Orders & Delivery Acts ────────────────────────────────
  const [ordersSelection, setOrdersSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const orderColumns = useMemo<GridColumn[]>(
    () => [
      { id: "docId", title: "Hujjat №", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "docType", title: "Hujjat Turi", width: 155, icon: GridColumnIcon.HeaderSingleValue },
      { id: "date", title: "Sana", width: 115, icon: GridColumnIcon.HeaderDate },
      { id: "workOrderRef", title: "Ishlab chiqarish (WO)", width: 145, icon: GridColumnIcon.HeaderReference },
      { id: "product", title: "Bosma mahsulot / Zakaz nomi", width: 320, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Tiraj (Qty)", width: 115, icon: GridColumnIcon.HeaderNumber },
      { id: "amountUsd", title: "Summa ($)", width: 135, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holati (Status)", width: 145, icon: GridColumnIcon.HeaderSingleValue },
    ],
    []
  );

  const getOrderCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = customerOrders[row];
      const column = orderColumns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }
      if (column.id === "quantity" || column.id === "amountUsd") {
        const num = Number((item as any)[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData:
            column.id === "amountUsd"
              ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : num.toLocaleString(),
          allowOverlay: false,
          contentAlign: "right",
        };
      }
      const val = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: val,
        displayData: val,
        allowOverlay: false,
      };
    },
    [customerOrders, orderColumns]
  );

  const handleOrderRowActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const item = customerOrders[row];
      if (!item) return;
      if (item.docId.startsWith("SF-")) {
        const act = deliveryActs.find((a) => a.id === item.docId);
        openTab({
          id: item.docId,
          title: `${item.docId}: ${form.name}`,
          type: "delivery-act",
          module: "sales",
          activeLevel3Tab: "overview",
          documentData: act || {
            id: item.docId,
            customer: form.name,
            product: item.product,
            quantity: item.quantity,
            totalAmount: item.amountUsd,
          },
        });
      } else {
        openTab({
          id: item.docId,
          title: `${item.docId}: ${item.product}`,
          type: "client-order",
          module: "sales",
          activeLevel3Tab: "overview",
          documentData: {
            docNo: item.docId,
            customer: form.name,
            product: item.product,
            quantity: item.quantity,
            linkedWoId: item.workOrderRef,
            status: item.status,
          },
        });
      }
    },
    [customerOrders, deliveryActs, openTab, form.name]
  );

  // ── Grid 3: Customer Dies & Clichés ────────────────────────────────────────
  const toolingColumns = useMemo<GridColumn[]>(
    () => [
      { id: "id", title: "Osnastka ID", width: 115, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Shtansforma / Klishe Nomi", width: 320, icon: GridColumnIcon.HeaderString },
      { id: "toolType", title: "Turi", width: 210, icon: GridColumnIcon.HeaderSingleValue },
      { id: "format", title: "Format / O'lcham", width: 150, icon: GridColumnIcon.HeaderString },
      { id: "cavities", title: "Katak (N-up)", width: 105, icon: GridColumnIcon.HeaderString },
      { id: "location", title: "Stellaj / Joyi", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "impressionsUsed", title: "Ishlatilgan (Udar)", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "maxLife", title: "Maks. Resurs", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
    ],
    []
  );

  const getToolingCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = customerTooling[row];
      const column = toolingColumns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }
      const val = (item as any)[String(column.id)];
      if (typeof val === "number") {
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: false,
          contentAlign: "right",
        };
      }
      return {
        kind: GridCellKind.Text,
        data: String(val ?? ""),
        displayData: String(val ?? ""),
        allowOverlay: false,
      };
    },
    [customerTooling, toolingColumns]
  );

  const closingBalance = settlement?.closingBalance ?? 0;

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1C Level-3 Document Workspace Header Bar */}
        <div className="px-3 bg-muted/60 border-b border-border shrink-0 flex items-center justify-between h-9 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TabsList
              variant="line"
              className="gap-1 overflow-x-auto overflow-y-hidden no-scrollbar min-w-0"
            >
              <TabsTrigger
                value="overview"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Rekvizitlar va Shartnoma (360°)</span>
              </TabsTrigger>
              <TabsTrigger
                value="settlements"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Akt Sverka ({ledgerRows.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Buyurtmalar va SF ({customerOrders.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="tooling"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>Shtansformalar ({customerTooling.length})</span>
              </TabsTrigger>
            </TabsList>

            <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

            <Badge
              variant="outline"
              className="font-mono text-[11px] shrink-0"
            >
              {form.id}
            </Badge>
            <Badge
              className={
                form.status === "VIP"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[11px]"
                  : form.status === "Blocked"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 text-[11px]"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px]"
              }
            >
              {form.status}
            </Badge>
          </div>

          {/* 1C Standard Top-Right Action Bar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateClientOrder}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-primary" />
              <span>+ Yangi Buyurtma (CO)</span>
            </Button>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => typeof window !== "undefined" && window.print()}
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                Chop etish (Akt Sverka / Kartochka)
              </TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAndClose}
              className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saqlash va yopish</span>
            </Button>
          </div>
        </div>

        {/* ── TAB 1: OVERVIEW (360° Requisites, Contracts & Balance Summary) ── */}
        <TabsContent
          value="overview"
          className="flex-1 overflow-y-auto p-4 space-y-4 m-0"
        >
          {/* Live Financial KPI Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  Boshlang&apos;ich qoldiq (Opening)
                </div>
                <div className="font-mono text-base font-bold mt-0.5">
                  ${(settlement?.openingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                USD
              </Badge>
            </div>

            <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  Jami Yuklangan (+Dt / Schet-faktura)
                </div>
                <div className="font-mono text-base font-bold text-primary mt-0.5">
                  +${(settlement?.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Realizatsiya
              </Badge>
            </div>

            <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  Jami To&apos;langan (-Kt / Bank)
                </div>
                <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  -${(settlement?.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Kirim
              </Badge>
            </div>

            <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  Yakuniy Saldo (Closing Balance)
                </div>
                <div
                  className={`font-mono text-base font-bold mt-0.5 ${
                    closingBalance > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : closingBalance < 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLevel3Tab(tab.id, "settlements")}
                className="h-7 px-2 text-[11px] gap-1"
              >
                <Scale className="w-3 h-3" />
                <span>Akt Sverka</span>
              </Button>
            </div>
          </div>

          {/* High-Density 3-Column 1C Counterparty Form Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Yuridik Rekvizitlar */}
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider">
                  1. Yuridik va Soliq Rekvizitlari
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Korxona / Kontragent nomi *
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  className="h-8 text-xs font-medium bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    STIR (INN) *
                  </Label>
                  <Input
                    value={form.tin}
                    onChange={(e) => handleFieldChange("tin", e.target.value)}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Mijoz Segmenti / Status
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      handleFieldChange("status", v as CrmCustomerRecord["status"])
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIP">VIP Mijoz</SelectItem>
                      <SelectItem value="Active">Faol (Active)</SelectItem>
                      <SelectItem value="New">Yangi (New)</SelectItem>
                      <SelectItem value="Blocked">Bloklangan (Stop-list)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Faoliyat sohasi (Industry)
                </Label>
                <Input
                  value={form.industry}
                  onChange={(e) => handleFieldChange("industry", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Column 2: Aloqa va Mas'ul Menejer */}
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider">
                  2. Mas&apos;ul Shaxs va Aloqa
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Aloqa uchun mas&apos;ul shaxs (F.I.Sh)
                </Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) => handleFieldChange("contactPerson", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefon raqami
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email manzili
                  </Label>
                  <Input
                    value={form.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Biriktirilgan Buyurtma Menejeri
                </Label>
                <Input
                  value={form.manager}
                  onChange={(e) => handleFieldChange("manager", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Column 3: Shartnoma va To'lov Shartlari */}
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider">
                  3. Bosh Shartnoma va To&apos;lov Shartlari
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Asosiy Shartnoma Raqami (Contract №) *
                </Label>
                <Input
                  value={form.contractNo}
                  onChange={(e) => handleFieldChange("contractNo", e.target.value)}
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  To&apos;lov shartlari (Payment Terms)
                </Label>
                <Select
                  value={form.paymentTerms}
                  onValueChange={(v) => v && handleFieldChange("paymentTerms", v)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100% Prepayment">100% Oldindan to&apos;lov</SelectItem>
                    <SelectItem value="50% Prepay / 50% Ship">50% Avans / 50% Yuklashda</SelectItem>
                    <SelectItem value="30% Prepay / 70% Net 15">30% Avans / 70% 15 kun</SelectItem>
                    <SelectItem value="15 Days Net">15 kunlik nasiya (Net 15)</SelectItem>
                    <SelectItem value="30 Days Net">30 kunlik nasiya (Net 30)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setLevel3Tab(tab.id, "settlements");
                    setIsPaymentOpen(true);
                  }}
                  className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>+ To&apos;lov kiritish (Kirim)</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateClientOrder}
                  className="h-8 flex-1 text-xs gap-1.5"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-primary" />
                  <span>+ Yangi Zakaz</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: AKT SVERKA (Full-Screen Reconciliation Grid + Payment Entry) ── */}
        <TabsContent
          value="settlements"
          className="flex-1 flex flex-col overflow-hidden m-0"
        >
          {/* Akt Sverka Action & KPI Sub-Header */}
          <div className="px-4 py-2.5 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Kontragent / STIR
                </div>
                <div className="text-xs font-bold">
                  {form.name} <span className="font-mono text-muted-foreground">({form.tin})</span>
                </div>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Jami Yuklandi (+Dt)
                </div>
                <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                  +${(settlement?.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Jami To&apos;landi (-Kt)
                </div>
                <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  -${(settlement?.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Joriy Saldo (Qoldiq)
                </div>
                <div
                  className={`font-mono text-xs font-bold ${
                    closingBalance > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : closingBalance < 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                  <span className="font-sans text-[10px] font-normal">
                    ({closingBalance > 0 ? "Mijoz qarzdor" : closingBalance < 0 ? "Avans" : "0.00 Yopilgan"})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsPaymentOpen((v) => !v)}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-none"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>+ To&apos;lov qabul qilish (ПКО / Bank)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => typeof window !== "undefined" && window.print()}
                className="h-7 px-2.5 text-xs gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Akt Sverka Chop Etish</span>
              </Button>
            </div>
          </div>

          {/* Inline Payment Bar */}
          {isPaymentOpen && (
            <div className="px-4 py-3 bg-muted/70 border-b border-border flex flex-wrap items-end gap-3 shrink-0">
              <div className="space-y-1 w-40">
                <Label className="text-[11px] font-semibold">To&apos;lov summasi ($)</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>
              <div className="space-y-1 w-56">
                <Label className="text-[11px] font-semibold">To&apos;lov usuli</Label>
                <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank o'tkazmasi (UZS/USD)">Bank o&apos;tkazmasi (UZS/USD)</SelectItem>
                    <SelectItem value="Korporativ karta / Payme">Korporativ karta</SelectItem>
                    <SelectItem value="Naqd kassa (ПКО)">Naqd kassa (ПКО)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[220px]">
                <Label className="text-[11px] font-semibold">Izoh / To&apos;lov topshiriqnomasi №</Label>
                <Input
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder={`Shartnoma ${form.contractNo} bo'yicha to'lov...`}
                  className="h-7 text-xs bg-background"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={handleConfirmPayment}
                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Tasdiqlash va Balansga yozish</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsPaymentOpen(false)}
                  className="h-7 text-xs"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}

          {/* Full-screen Glide Data Grid for Akt Sverka */}
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getLedgerCellContent}
              onCellActivated={handleLedgerRowActivated}
              columns={ledgerColumns}
              rows={ledgerRows.length}
              rowMarkers="both"
              freezeColumns={3}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={ledgerSelection}
              onGridSelectionChange={setLedgerSelection}
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </TabsContent>

        {/* ── TAB 3: CUSTOMER ORDERS & DELIVERY ACTS ── */}
        <TabsContent
          value="orders"
          className="flex-1 flex flex-col overflow-hidden m-0"
        >
          <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between shrink-0">
            <div className="text-xs text-muted-foreground">
              Ikki marta bosish (`Double-click`) orqali tanlangan Buyurtma (`CO`) yoki Schet-faktura (`SF`) to&apos;liq oynada ochiladi.
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleCreateClientOrder}
                className="h-7 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Yangi Mijoz Buyurtmasi (CO)</span>
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getOrderCellContent}
              onCellActivated={handleOrderRowActivated}
              columns={orderColumns}
              rows={customerOrders.length}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={ordersSelection}
              onGridSelectionChange={setOrdersSelection}
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </TabsContent>

        {/* ── TAB 4: CUSTOMER DIES & CLICHÉS (TOOLING) ── */}
        <TabsContent
          value="tooling"
          className="flex-1 flex flex-col overflow-hidden m-0"
        >
          <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between shrink-0">
            <div className="text-xs text-muted-foreground">
              Ushbu mijozning buyurtmalari uchun tayyorlangan va korxona omborida saqlanayotgan shtansformalar hamda klishelar.
            </div>
          </div>
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getToolingCellContent}
              columns={toolingColumns}
              rows={customerTooling.length}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
