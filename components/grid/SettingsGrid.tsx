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
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { PlantRecord } from "@/components/documents/plant/types";
import { SystemUserRecord } from "@/components/documents/user/types";
import { createEmptyUser } from "@/components/documents/user/data";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Download,
  Printer,
  ExternalLink,
  Plus,
  Building,
  Shield,
  Coins,
  Save,
} from "lucide-react";

interface SettingsGridProps {
  type: "plants" | "users" | "tariffs";
}

interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  plant: string;
  accessLevel: string;
  status: "Active" | "Suspended";
}

interface TariffRecord {
  id: string;
  category: string;
  operationName: string;
  machineOrDept: string;
  unit: string;
  rateUsd: number;
  setupFeeUsd: number;
  vatRate: number;
  status: "Active" | "Review";
}

interface SettingsRow {
  id: string;
  name?: string;
  fullName?: string;
  operationName?: string;
  branchType?: string;
  tin?: string;
  director?: string;
  shiftRegime?: string;
  machinesCount?: number;
  address?: string;
  email?: string;
  role?: string;
  department?: string;
  accessLevel?: string;
  category?: string;
  machineOrDept?: string;
  unit?: string;
  rateUsd?: number;
  setupFeeUsd?: number;
  vatRate?: number;
  status?: string;
  [key: string]: unknown;
}

const INITIAL_USERS: UserRecord[] = [
  {
    id: "USR-001",
    fullName: "Dmitry Morozov",
    email: "admin@printgoo.com",
    role: "System Administrator",
    department: "Management / IT",
    plant: "PrintGoo Main Factory — Tashkent (HQ)",
    accessLevel: "Full ERP Admin",
    status: "Active",
  },
  {
    id: "USR-002",
    fullName: "Elena Voronina",
    email: "e.voronina@printgoo.com",
    role: "Sales & Client Director",
    department: "Commercial / Sales",
    plant: "PrintGoo Main Factory — Tashkent (HQ)",
    accessLevel: "Sales, Costing & Contracts",
    status: "Active",
  },
  {
    id: "USR-003",
    fullName: "Alexey Kovalev",
    email: "a.kovalev@printgoo.com",
    role: "Production Shift Lead",
    department: "Offset & Post-Press",
    plant: "PrintGoo Main Factory — Tashkent (HQ)",
    accessLevel: "Production, BOM & Tooling",
    status: "Active",
  },
  {
    id: "USR-004",
    fullName: "Davron Karimov",
    email: "d.karimov@printgoo.com",
    role: "Chief Warehouse Manager",
    department: "Warehouse & Logistics",
    plant: "Central Paper & Substrate Warehouse",
    accessLevel: "Stock, Receipts & Shipments",
    status: "Active",
  },
  {
    id: "USR-005",
    fullName: "Malika Ivanova",
    email: "m.ivanova@printgoo.com",
    role: "Senior Prepress & CTP Engineer",
    department: "Prepress / Layout",
    plant: "PrintGoo Main Factory — Tashkent (HQ)",
    accessLevel: "Imposition, CTP & Proofs",
    status: "Active",
  },
  {
    id: "USR-006",
    fullName: "Sardor Abdullayev",
    email: "s.abdullayev@printgoo.com",
    role: "Chief Accountant (1C / Finance)",
    department: "Finance & Accounting",
    plant: "PrintGoo Main Factory — Tashkent (HQ)",
    accessLevel: "Schet-faktura, Settlements & Ledger",
    status: "Active",
  },
];

const INITIAL_TARIFFS: TariffRecord[] = [
  {
    id: "TRF-001",
    category: "Prepress / CTP",
    operationName: "CTP Thermal Plate Output (B1 / 790×1030)",
    machineOrDept: "Kodak Trendsetter Q800",
    unit: "1 plate",
    rateUsd: 12.5,
    setupFeeUsd: 0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-002",
    category: "Prepress / CTP",
    operationName: "CTP Thermal Plate Output (B2 / 500×707)",
    machineOrDept: "Kodak Trendsetter Q800",
    unit: "1 plate",
    rateUsd: 8.5,
    setupFeeUsd: 0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-003",
    category: "Offset Printing",
    operationName: "Sheetfed Offset Run (4+0 CMYK)",
    machineOrDept: "Heidelberg Speedmaster XL 106",
    unit: "1,000 impressions",
    rateUsd: 24.0,
    setupFeeUsd: 45.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-004",
    category: "Kashirovka (Mounting)",
    operationName: "Duplex / Triplex Sheet-to-Sheet Mounting + Press Cure",
    machineOrDept: "Stock Laminator + Hydraulic Press",
    unit: "1,000 glue passes",
    rateUsd: 28.0,
    setupFeeUsd: 25.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-005",
    category: "Kashirovka (Adhesive)",
    operationName: "PVA Dispersion Adhesive Consumption (25 g/m²)",
    machineOrDept: "Kashirovka Line",
    unit: "1 kg",
    rateUsd: 3.4,
    setupFeeUsd: 0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-006",
    category: "Surface Coating",
    operationName: "Soft-Touch Matte Lamination (BOPP 28 mic)",
    machineOrDept: "Autobond Mini 76 UV",
    unit: "1,000 sheets (B2)",
    rateUsd: 42.0,
    setupFeeUsd: 15.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-007",
    category: "Surface Coating",
    operationName: "Spot UV Varnish (Selective Screen / Digital)",
    machineOrDept: "Sakurai Maestro / Scodix",
    unit: "1,000 sheets",
    rateUsd: 55.0,
    setupFeeUsd: 30.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-008",
    category: "Die-Cutting & Finishing",
    operationName: "Flatbed Die-Cutting & Creasing (Высечка / Биговка)",
    machineOrDept: "Bobst Novacut 106 E",
    unit: "1,000 strokes",
    rateUsd: 18.0,
    setupFeeUsd: 35.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-009",
    category: "Flexo Roll Label",
    operationName: "Narrow-Web Rotary Flexo Run + Die-Cut",
    machineOrDept: "Mark Andy P7 / Nilpeter FA-4",
    unit: "1,000 linear meters",
    rateUsd: 32.0,
    setupFeeUsd: 40.0,
    vatRate: 12,
    status: "Active",
  },
  {
    id: "TRF-010",
    category: "Bindery & Guillotine",
    operationName: "Polar High-Speed Guillotine Trimming & Packing",
    machineOrDept: "Polar N 115 Plus",
    unit: "1,000 finished pcs",
    rateUsd: 4.5,
    setupFeeUsd: 10.0,
    vatRate: 12,
    status: "Active",
  },
];

export function SettingsGrid({ type }: SettingsGridProps) {
  const tCommon = useTranslations("Common");
  const tMod = useTranslations("Modules");
  const { updateGridStats, theme, openTab, plants, upsertPlant, users, upsertUser, fetchUsers } = useWorkspaceStore();
  const isDark = theme === "dark";

  useEffect(() => {
    if (type === "users") {
      fetchUsers();
    }
  }, [type, fetchUsers]);

  const [tariffs, setTariffs] = useState<TariffRecord[]>(INITIAL_TARIFFS);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Editable draft state inside drawer
  const [editRateUsd, setEditRateUsd] = useState<string>("");
  const [editSetupUsd, setEditSetupUsd] = useState<string>("");
  const [editName, setEditName] = useState<string>("");

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let dataRows: SettingsRow[] = [];

    if (type === "plants") {
      cols = [
        { id: "id", title: "Branch ID", width: 95, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Company / Plant / Workshop Name", width: 270, icon: GridColumnIcon.HeaderString },
        { id: "branchType", title: "Specialization", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "tin", title: "STIR (INN)", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "director", title: "Head / Responsible", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "shiftRegime", title: "Shift Schedule", width: 165, icon: GridColumnIcon.HeaderString },
        { id: "machinesCount", title: "Units", width: 80, icon: GridColumnIcon.HeaderNumber },
        { id: "address", title: "Location Address", width: 240, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Status", width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = plants as unknown as SettingsRow[];
    } else if (type === "users") {
      cols = [
        { id: "id", title: "User ID", width: 90, icon: GridColumnIcon.HeaderReference },
        { id: "fullName", title: "Employee Name", width: 190, icon: GridColumnIcon.HeaderString },
        { id: "email", title: "Login / Email", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "role", title: "Position / Role", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "department", title: "Department", width: 165, icon: GridColumnIcon.HeaderString },
        { id: "accessLevel", title: "1C Access Profile", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "plant", title: "Assigned Branch", width: 240, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Status", width: 105, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = users.map((u) => ({
        ...u,
        accessLevel: u.role || "Operator",
      })) as unknown as SettingsRow[];
    } else {
      cols = [
        { id: "id", title: "Tariff Code", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "category", title: "Process Group", width: 165, icon: GridColumnIcon.HeaderLookup },
        { id: "operationName", title: "Operation / Normative Tariff", width: 310, icon: GridColumnIcon.HeaderString },
        { id: "machineOrDept", title: "Equipment / Line", width: 210, icon: GridColumnIcon.HeaderString },
        { id: "unit", title: "Calc Unit", width: 145, icon: GridColumnIcon.HeaderString },
        { id: "rateUsd", title: "Rate ($ USD)", width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: "setupFeeUsd", title: "Make-Ready ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "vatRate", title: "VAT (%)", width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 105, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = tariffs as unknown as SettingsRow[];
    }

    return { columns: cols, rows: dataRows };
  }, [type, plants, users, tariffs]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
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

  const availableStatuses = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.status) s.add(r.status);
    });
    return Array.from(s);
  }, [rows]);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = filteredRows[row];
      if (!rowData) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const val = rowData[column.id as keyof typeof rowData];

      if (column.id === "status") {
        const isOk = val === "Active";
        return {
          kind: GridCellKind.Text,
          data: String(val),
          displayData: String(val),
          allowOverlay: false,
          themeOverride: {
            textDark: isOk
              ? isDark
                ? "#4ade80"
                : "#15803d"
              : isDark
              ? "#facc15"
              : "#a16207",
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      if (typeof val === "number") {
        const numVal = val as number;
        const isMoney = column.id === "rateUsd" || column.id === "setupFeeUsd";
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: isMoney
            ? `$${numVal.toFixed(2)}`
            : column.id === "vatRate"
            ? `${numVal}%`
            : String(numVal),
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: isMoney
            ? { baseFontStyle: "600 12px monospace" }
            : undefined,
        };
      }

      return {
        kind: GridCellKind.Text,
        data: String(val ?? ""),
        displayData: String(val ?? ""),
        allowOverlay: false,
      };
    },
    [filteredRows, columns, isDark]
  );

  const selectedRecord = useMemo(() => {
    if (!selectedRowId) return null;
    return rows.find((r) => r.id === selectedRowId) || null;
  }, [rows, selectedRowId]);

  const handleOpenRow = (rowIndex: number) => {
    const row = filteredRows[rowIndex];
    if (!row) return;

    if (type === "plants") {
      openTab({
        id: `plant-${row.id}`,
        title: row.name || "",
        type: "plant-detail",
        module: "settings",
        documentData: row,
      });
      return;
    }

    if (type === "users") {
      openTab({
        id: `user-${row.id}`,
        title: row.fullName || row.email || "Foydalanuvchi",
        type: "user-detail",
        module: "settings",
        documentData: row,
      });
      return;
    }

    setSelectedRowId(row.id);
    if (type === "tariffs") {
      setEditName(row.operationName || "");
      setEditRateUsd(String(row.rateUsd ?? ""));
      setEditSetupUsd(String(row.setupFeeUsd ?? ""));
    } else {
      setEditName(row.fullName || "");
    }
    setIsDrawerOpen(true);
  };

  const handleCreateNew = () => {
    if (type === "tariffs") {
      const newTariff: TariffRecord = {
        id: `TRF-${String(tariffs.length + 1).padStart(3, "0")}`,
        category: "Post-Press",
        operationName: "New Custom Print/Finishing Operation",
        machineOrDept: "Finishing Shop",
        unit: "1,000 pcs",
        rateUsd: 15.0,
        setupFeeUsd: 20.0,
        vatRate: 12,
        status: "Active",
      };
      setTariffs((prev) => [newTariff, ...prev]);
      setSelectedRowId(newTariff.id);
      setEditName(newTariff.operationName);
      setEditRateUsd(String(newTariff.rateUsd));
      setEditSetupUsd(String(newTariff.setupFeeUsd));
      setIsDrawerOpen(true);
    } else if (type === "plants") {
      const nextNum = plants.length + 1;
      const newPlant: PlantRecord = {
        id: `PLT-${String(nextNum).padStart(3, "0")}`,
        code: `BRN-${String(nextNum).padStart(2, "0")}`,
        name: `Yangi Filial / Sex #${nextNum}`,
        shortName: `Filial #${nextNum}`,
        legalEntityName: "'PrintGoo Industrial Group' MCHJ",
        branchType: "Offset & Packaging Plant",
        tin: "305112890",
        vatNumber: "320011289012",
        oked: "18.12.0",
        address: "Toshkent shahri",
        legalAddress: "Toshkent shahri",
        phone: "+998 71 200-55-00",
        email: "branch@printgoo.uz",
        director: "Yangi Rahbar",
        chiefAccountant: "Bosh Buxgalter",
        shiftRegime: "24/7 (2×12h Shifts)",
        workingHours: "08:00 – 20:00 / 20:00 – 08:00",
        daysOfWeek: "Dushanba – Shanba",
        machinesCount: 0,
        status: "Active",
        departments: [],
        warehouses: [],
        bankAccounts: [
          {
            id: `ACC-${Date.now()}`,
            bankName: "AT 'Kapitalbank' Bosh Ofisi",
            mfo: "01087",
            accountNumber: "20208000700543210001",
            currency: "UZS",
            isPrimary: true,
          },
        ],
        integration: {
          didoxEnabled: true,
          didoxContractorCode: `DIDOX-BRN-${nextNum}`,
          apiKeySet: false,
          autoSyncInvoices: false,
          oneCSyncEnabled: false,
        },
      };
      upsertPlant(newPlant);
      openTab({
        id: `plant-${newPlant.id}`,
        title: newPlant.name,
        type: "plant-detail",
        module: "settings",
        documentData: newPlant,
      });
    } else {
      const nextNum = (users?.length || 0) + 1;
      const newUserId = `USR-${String(nextNum).padStart(3, "0")}`;
      const emptyUser = createEmptyUser(newUserId);
      openTab({
        id: `user-new-${Date.now()}`,
        title: "Yangi foydalanuvchi *",
        type: "user-detail",
        module: "settings",
        documentData: emptyUser,
        isUnsaved: true,
      });
    }
  };

  const handleSaveRecord = () => {
    if (!selectedRecord) return;
    if (type === "tariffs") {
      setTariffs((prev) =>
        prev.map((item) =>
          item.id === selectedRecord.id
            ? {
                ...item,
                operationName: editName || item.operationName,
                rateUsd: Number(editRateUsd) || item.rateUsd,
                setupFeeUsd: Number(editSetupUsd) || 0,
              }
            : item
        )
      );
    } else if (type === "plants") {
      const plant = selectedRecord as unknown as PlantRecord;
      upsertPlant({ ...plant, name: editName || plant.name });
    } else if (type === "users") {
      const user = selectedRecord as unknown as SystemUserRecord;
      upsertUser({ ...user, fullName: editName || user.fullName });
    }
    setIsDrawerOpen(false);
  };

  return (
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
                <span>{tCommon("create")}</span>
              </Button>
              <Button
                onClick={() => {
                  const indices = selection.rows.toArray();
                  if (indices.length > 0) handleOpenRow(indices[0]);
                }}
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium gap-1 rounded"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>{tCommon("edit")}</span>
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />

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
                  {availableStatuses.map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        statusFilter === st
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {st}
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
                  placeholder={`${tCommon("search")}...`}
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
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getContent}
              columns={columns}
              rows={filteredRows.length}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={(cell) => handleOpenRow(cell[1])}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>

          {/* Inspector Drawer */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetContent className="w-[420px] sm:w-[480px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  {type === "plants" ? (
                    <Building className="w-4 h-4 text-blue-600" />
                  ) : type === "users" ? (
                    <Shield className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Coins className="w-4 h-4 text-blue-600" />
                  )}
                  <SheetTitle className="text-sm font-semibold font-mono">
                    {selectedRecord?.id}
                  </SheetTitle>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {selectedRecord?.status}
                  </Badge>
                </div>
                <SheetDescription className="text-xs">
                  {type === "plants"
                    ? tMod("plants")
                    : type === "users"
                    ? tMod("users")
                    : tMod("tariffs")}
                </SheetDescription>
              </SheetHeader>

              {selectedRecord && (
                <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {type === "tariffs"
                        ? "Operation / Normative Name"
                        : type === "plants"
                        ? "Branch / Workshop Name"
                        : "Employee Full Name"}
                    </Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {type === "tariffs" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            Unit Rate ($ USD)
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editRateUsd}
                            onChange={(e) => setEditRateUsd(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            Setup / Make-Ready ($ USD)
                          </Label>
                          <Input
                            type="number"
                            step="1"
                            value={editSetupUsd}
                            onChange={(e) => setEditSetupUsd(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="font-medium">{selectedRecord.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Equipment:</span>
                          <span className="font-medium">{selectedRecord.machineOrDept}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Calculation Unit:</span>
                          <span className="font-mono">{selectedRecord.unit}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {type === "plants" && (
                    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Specialization:</span>
                        <span className="font-medium">{selectedRecord.branchType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">STIR / INN:</span>
                        <span className="font-mono">{selectedRecord.tin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Director:</span>
                        <span className="font-medium">{selectedRecord.director}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shift Regime:</span>
                        <span className="font-mono">{selectedRecord.shiftRegime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-medium">{selectedRecord.address}</span>
                      </div>
                    </div>
                  )}

                  {type === "users" && (
                    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email / Login:</span>
                        <span className="font-mono">{selectedRecord.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Role:</span>
                        <span className="font-medium">{selectedRecord.role}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Department:</span>
                        <span className="font-medium">{selectedRecord.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Access Profile:</span>
                        <span className="font-medium">{selectedRecord.accessLevel}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  onClick={handleSaveRecord}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{tCommon("save")}</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </ContextMenuTrigger>
    </ContextMenu>
  );
}
