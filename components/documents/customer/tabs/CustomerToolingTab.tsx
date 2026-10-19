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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Stamp, Check } from "lucide-react";
import {
  useWorkspaceStore,
  CrmCustomerRecord,
  CustomerToolingItem,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface CustomerToolingTabProps {
  customer: CrmCustomerRecord;
}

export function CustomerToolingTab({ customer }: CustomerToolingTabProps) {
  const { customerTooling, upsertCustomerTooling, theme, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";

  // Filter tools belonging to this customer
  const tools = useMemo(() => {
    const cleanCustomer = customer.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    const matched = customerTooling.filter((t) => {
      if (t.customerId && t.customerId === customer.id) return true;
      if (!t.customerName) return false;
      const tName = t.customerName.toLowerCase();
      return (
        tName === cleanCustomer ||
        tName.includes(cleanCustomer) ||
        cleanCustomer.includes(tName)
      );
    });

    if (matched.length > 0) return matched;

    // Default template item for new customer
    return [
      {
        id: `DIE-${customer.id.replace("CUST-", "0")}`,
        customerName: customer.name,
        name: `${customer.name} — Standart Qadoq Shtansformasi`,
        toolType: "Flatbed Die (Штанцформа)",
        format: "700×1000 mm (B1)",
        cavities: "4-up",
        location: "Rack B-04",
        impressionsUsed: 15400,
        maxLife: 150000,
        status: "Ready" as const,
      },
    ];
  }, [customerTooling, customer.name, customer.id]);

  // Modal State for adding new tooling
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTool, setNewTool] = useState<Partial<CustomerToolingItem>>({
    id: `DIE-${Math.floor(100 + Math.random() * 899)}`,
    name: "",
    toolType: "Flatbed Die (Штанцформа)",
    format: "700×1000 mm (B1)",
    cavities: "4-up",
    location: "Rack A-03",
    impressionsUsed: 0,
    maxLife: 150000,
    status: "Ready",
  });

  const handleSaveNewTool = () => {
    if (!newTool.name?.trim()) return;
    const itemToSave: CustomerToolingItem = {
      id: newTool.id || `DIE-${Math.floor(100 + Math.random() * 899)}`,
      customerId: customer.id,
      customerName: customer.name,
      name: newTool.name.trim(),
      toolType: newTool.toolType || "Flatbed Die (Штанцформа)",
      format: newTool.format || "700×1000 mm",
      cavities: newTool.cavities || "2-up",
      location: newTool.location || "Rack A-01",
      impressionsUsed: Number(newTool.impressionsUsed) || 0,
      maxLife: Number(newTool.maxLife) || 150000,
      status: (newTool.status as CustomerToolingItem["status"]) || "Ready",
    };

    upsertCustomerTooling(itemToSave);
    addNotification({
      title: "Yangi shtansforma qo'shildi",
      description: `${itemToSave.name} (${itemToSave.id}) ${customer.name} hisobiga saqlandi.`,
      severity: "success",
      link: { module: "crm", subModule: "customers" },
    });

    setIsAddOpen(false);
    setNewTool({
      id: `DIE-${Math.floor(100 + Math.random() * 899)}`,
      name: "",
      toolType: "Flatbed Die (Штанцформа)",
      format: "700×1000 mm (B1)",
      cavities: "4-up",
      location: "Rack A-03",
      impressionsUsed: 0,
      maxLife: 150000,
      status: "Ready",
    });
  };

  // Columns definition with resizing support
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "id", title: "Osnastka ID", width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "name", title: "Shtansforma / Klishe Nomi", width: 330, icon: GridColumnIcon.HeaderString },
    { id: "toolType", title: "Osnastka Turi", width: 220, icon: GridColumnIcon.HeaderSingleValue },
    { id: "format", title: "Format / O'lcham", width: 150, icon: GridColumnIcon.HeaderString },
    { id: "cavities", title: "Katak (N-up)", width: 105, icon: GridColumnIcon.HeaderString },
    { id: "location", title: "Ombor / Stellaj", width: 130, icon: GridColumnIcon.HeaderLookup },
    { id: "impressionsUsed", title: "Ishlatilgan (Udar)", width: 140, icon: GridColumnIcon.HeaderNumber },
    { id: "maxLife", title: "Maks. Resurs", width: 130, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
  ]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === column.id ? { ...c, width: newSize } : c))
    );
  }, []);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = tools[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "impressionsUsed" || column.id === "maxLife") {
        const val = Number((item as any)[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: false,
          contentAlign: "right",
        };
      }

      if (column.id === "status") {
        let color: string | undefined = undefined;
        if (item.status === "Ready") color = isDark ? "#4ade80" : "#15803d";
        if (item.status === "Re-knifing Soon") color = isDark ? "#facc15" : "#b45309";
        if (item.status === "Damaged") color = isDark ? "#f87171" : "#b91c1c";

        return {
          kind: GridCellKind.Text,
          data: item.status,
          displayData: item.status,
          allowOverlay: false,
          themeOverride: color ? { textDark: color, baseFontStyle: "600 12px sans-serif" } : undefined,
        };
      }

      const val = (item as any)[String(column.id)];
      return {
        kind: GridCellKind.Text,
        data: String(val ?? ""),
        displayData: String(val ?? ""),
        allowOverlay: false,
      };
    },
    [tools, columns, isDark]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="text-xs text-muted-foreground">
          Ushbu mijozning buyurtmalari uchun tayyorlangan va bosmaxona osnastka omborida saqlanayotgan shtansformalar hamda klishelar ({tools.length} ta).
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Yangi Shtansforma / Klishe</span>
          </Button>
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <DataEditor
            getCellContent={getCellContent}
            columns={columns}
            onColumnResize={handleColumnResize}
            rows={tools.length}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            headerHeight={28}
            rowHeight={30}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={() => setIsAddOpen(true)} className="gap-2">
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>+ Yangi Osnastka ro&apos;yxatga olish (Ins)</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Add Tooling Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Stamp className="w-4 h-4 text-primary" />
              <span>Yangi Shtansforma / Klishe ro&apos;yxatga olish</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Osnastka ID *</Label>
                <Input
                  value={newTool.id || ""}
                  onChange={(e) => setNewTool((prev) => ({ ...prev, id: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Turi</Label>
                <Select
                  value={newTool.toolType}
                  onValueChange={(v) => v && setNewTool((prev) => ({ ...prev, toolType: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flatbed Die (Штанцформа)">Flatbed Die (Штанцформа)</SelectItem>
                    <SelectItem value="Rotary Die (Ротационная)">Rotary Die (Ротационная)</SelectItem>
                    <SelectItem value="Hot Foil Cliché (Brass 7mm)">Hot Foil Cliché (Brass 7mm)</SelectItem>
                    <SelectItem value="Flexo Cliché (Флексоклише)">Flexo Cliché (Флексоклише)</SelectItem>
                    <SelectItem value="Embossing Stamp (Конгрев)">Embossing Stamp (Конгрев)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Osnastka nomi / Mahsulot tavsifi *</Label>
              <Input
                value={newTool.name || ""}
                onChange={(e) => setNewTool((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Masalan: 350g Parfyumeriya qutisi shtansformasi"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Format / O&apos;lcham</Label>
                <Input
                  value={newTool.format || ""}
                  onChange={(e) => setNewTool((prev) => ({ ...prev, format: e.target.value }))}
                  placeholder="700×1000 mm"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Katak soni (N-up)</Label>
                <Input
                  value={newTool.cavities || ""}
                  onChange={(e) => setNewTool((prev) => ({ ...prev, cavities: e.target.value }))}
                  placeholder="6-up"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Saqlash joyi (Stellaj)</Label>
                <Input
                  value={newTool.location || ""}
                  onChange={(e) => setNewTool((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Rack B-03"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Maks. Resurs (Udar)</Label>
                <Input
                  value={String(newTool.maxLife || 150000)}
                  onChange={(e) => setNewTool((prev) => ({ ...prev, maxLife: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" onClick={handleSaveNewTool} className="bg-primary text-primary-foreground gap-1">
              <Check className="w-3.5 h-3.5" />
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
