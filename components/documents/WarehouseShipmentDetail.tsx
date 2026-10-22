"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  WarehouseShipmentRecord,
  ShipmentLineItem,
  ShipmentType,
  ProductionQueueItem,
  CrmCustomerRecord,
  WarehouseStockRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Truck,
  Plus,
  Trash2,
  Printer,
  Save,
  Check,
  Lock,
  ExternalLink,
  FileText,
  Boxes,
  Send,
  Layers,
  Search,
  ChevronsUpDown,
  SlidersHorizontal,
  Pencil,
  Phone,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export const WAREHOUSE_LOCATIONS = [
  "Main Factory — Tashkent (Tayyor mahsulot ombori)",
  "Branch Warehouse — Samarkand (Taqsimot ombori)",
  "Finishing Shop — Bukhara (Bosma sexi)",
];

export interface CarrierProfile {
  id: string;
  name: string;
  vehicleModel: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  type: "fleet" | "courier" | "self" | "other";
}

export const DEFAULT_CARRIERS: CarrierProfile[] = [
  {
    id: "carrier-1",
    name: "PrintGoo Fleet #1 (ISUZU)",
    vehicleModel: "ISUZU Furgon 3.5t",
    vehicleNo: "01 A 772 BB",
    driverName: "Rustam Ismoilov",
    driverPhone: "+998 90 123-45-67",
    type: "fleet",
  },
  {
    id: "carrier-2",
    name: "PrintGoo Fleet #2 (Labo)",
    vehicleModel: "Labo 0.7t (Furgon)",
    vehicleNo: "01 B 334 CC",
    driverName: "Anvar Xalilov",
    driverPhone: "+998 90 987-65-43",
    type: "fleet",
  },
  {
    id: "carrier-3",
    name: "PrintGoo Fleet #3 (Gazelle)",
    vehicleModel: "Gazelle Next 1.5t",
    vehicleNo: "01 F 550 AA",
    driverName: "Jamshid Saidov",
    driverPhone: "+998 93 456-78-90",
    type: "fleet",
  },
  {
    id: "carrier-4",
    name: "Express Logistics UZ",
    vehicleModel: "Ford Transit Express",
    vehicleNo: "01 E 100 EX",
    driverName: "Navbatchi kuryer",
    driverPhone: "+998 71 200-11-22",
    type: "courier",
  },
  {
    id: "carrier-5",
    name: "BTS Express Pochta",
    vehicleModel: "BTS Logistics Van",
    vehicleNo: "01 B 707 TS",
    driverName: "BTS Kuryer",
    driverPhone: "+998 71 123-00-00",
    type: "courier",
  },
  {
    id: "carrier-6",
    name: "Yandex Delivery Cargo",
    vehicleModel: "Yandex Cargo Furgon",
    vehicleNo: "Ilovada belgilanadi",
    driverName: "Ilovadagi haydovchi",
    driverPhone: "+998 71 200-00-00",
    type: "courier",
  },
  {
    id: "carrier-7",
    name: "Mijoz o'zi olib ketadi (Samovyvoz)",
    vehicleModel: "Mijoz transporti",
    vehicleNo: "—",
    driverName: "Mijoz vakili",
    driverPhone: "—",
    type: "self",
  },
];

const BRANCH_RECIPIENTS = [
  "Samarkand Branch (Filial ombori)",
  "Bukhara Finishing Shop (Buxoro filiali)",
  "Andijan Distribution Center (Andijon filiali)",
];

const SUBCONTRACTORS = [
  "Master UV & Foil Co (Subpudrat)",
  "Gold Bookbinders Workshop (Muqovalash sexi)",
  "Spiral & Wire-O Masters",
  "Silk Screen Embellishers",
];

const VENDORS = [
  "Antalis Central Asia (Yetkazib beruvchi)",
  "Toyo Ink Uzbekistan",
  "Igepa Group GmbH",
  "Fujifilm CIS",
];

// ─── Searchable Work Order Picker (Customer-dependent) ────────────────────
function WorkOrderPicker({
  value,
  onSelect,
  orders,
  customer,
  onClearCustomer,
  disabled = false,
}: {
  value: string;
  onSelect: (woId: string) => void;
  orders: ProductionQueueItem[];
  customer?: string;
  onClearCustomer?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedWo = orders.find((o) => o.id === value);

  const isCustomerFiltered = Boolean(customer && customer.trim() && !customer.startsWith("—"));

  const { matchingOrders, otherOrders } = useMemo(() => {
    if (!isCustomerFiltered || !customer) {
      return { matchingOrders: orders, otherOrders: [] };
    }
    const target = customer.trim().toLowerCase();
    const matching: ProductionQueueItem[] = [];
    const others: ProductionQueueItem[] = [];
    for (const o of orders) {
      if (o.customer && o.customer.trim().toLowerCase() === target) {
        matching.push(o);
      } else {
        others.push(o);
      }
    }
    return { matchingOrders: matching, otherOrders: others };
  }, [orders, customer, isCustomerFiltered]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-7 w-full justify-between px-2 text-xs font-normal bg-background border-input shadow-none truncate",
              isCustomerFiltered && matchingOrders.length > 0 && !selectedWo && "border-blue-500/40 text-blue-700 dark:text-blue-300"
            )}
          >
            <span className="truncate flex items-center gap-1.5 min-w-0">
              {selectedWo ? (
                <>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                    {selectedWo.id}
                  </span>
                  <span className="text-muted-foreground truncate text-[11px]">
                    — {selectedWo.product}
                  </span>
                </>
              ) : value && value !== "-" && !value.startsWith("—") ? (
                <span className="font-mono font-semibold">{value}</span>
              ) : isCustomerFiltered ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium truncate">
                  {matchingOrders.length > 0
                    ? `${matchingOrders.length} ta buyurtma mavjud...`
                    : "Buyurtma tanlang..."}
                </span>
              ) : (
                <span className="text-muted-foreground">Buyurtmani qidirish...</span>
              )}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[380px] p-0 border border-border shadow-xl" align="start">
        <Command className="w-full">
          {isCustomerFiltered && (
            <div className="p-2 border-b border-border bg-blue-500/5 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="text-muted-foreground shrink-0">Mijoz bo'yicha filtr:</span>
                <span className="font-semibold text-foreground truncate" title={customer}>
                  {customer}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <Badge variant="outline" className="text-[10px] font-mono bg-background">
                  {matchingOrders.length} ta
                </Badge>
                {onClearCustomer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCustomer();
                    }}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    Barchasi
                  </button>
                )}
              </div>
            </div>
          )}

          <CommandInput placeholder="Buyurtma №, mahsulot yoki mijoz..." className="h-8 text-xs" />
          <CommandList className="max-h-64 overflow-y-auto p-1">
            <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
              Buyurtma topilmadi
            </CommandEmpty>

            {isCustomerFiltered && (
              <CommandGroup heading={`${customer} buyurtmalari (${matchingOrders.length})`}>
                {matchingOrders.length === 0 ? (
                  <div className="p-2.5 text-center text-xs text-muted-foreground italic">
                    Ushbu mijoz bo'yicha buyurtmalar topilmadi
                  </div>
                ) : (
                  matchingOrders.map((wo) => (
                    <CommandItem
                      key={wo.id}
                      value={`${wo.id} ${wo.product} ${wo.customer}`}
                      onSelect={() => {
                        onSelect(wo.id);
                        setOpen(false);
                      }}
                      className="flex flex-col items-start gap-0.5 p-2 rounded cursor-pointer text-xs bg-blue-500/5 mb-1"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{wo.id}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {wo.quantity?.toLocaleString()} {wo.unit || "dona"}
                        </span>
                      </div>
                      <div className="font-medium text-foreground text-xs truncate w-full">
                        {wo.product}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate w-full flex items-center justify-between">
                        <span>👤 {wo.customer}</span>
                        {wo.priority === "Urgent" && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1">Tezkor</Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            )}

            <CommandGroup heading={isCustomerFiltered ? `Boshqa mijozlar buyurtmalari (${otherOrders.length})` : "Ishlab chiqarish buyurtmalari"}>
              {(isCustomerFiltered ? otherOrders : orders).map((wo) => (
                <CommandItem
                  key={wo.id}
                  value={`${wo.id} ${wo.product} ${wo.customer}`}
                  onSelect={() => {
                    onSelect(wo.id);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5 p-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{wo.id}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {wo.quantity?.toLocaleString()} {wo.unit || "dona"}
                    </span>
                  </div>
                  <div className="font-medium text-foreground text-xs truncate w-full">
                    {wo.product}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate w-full">
                    👤 {wo.customer}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Boshqa variantlar">
              <CommandItem
                value="WO-DIRECT To'g'ridan-to'g'ri chiqim buyurtmasiz"
                onSelect={() => {
                  onSelect("— (To'g'ridan-to'g'ri chiqim)");
                  setOpen(false);
                }}
                className="p-2 text-xs text-muted-foreground cursor-pointer font-medium"
              >
                ➕ To'g'ridan-to'g'ri chiqim (Buyurtmasiz)
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Stock Material Dialog (Modal) ──────────────────────────────
function StockMaterialDialog({
  open,
  onOpenChange,
  stock,
  onSelectMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: WarehouseStockRecord[];
  onSelectMaterial: (sku: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-3.5 bg-muted/40 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="size-4 text-blue-600" />
            <span>Ombordan xomashyo yoki material tanlash</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Mavjud qog'oz, bo'yoq, plyonka yoki delovoy otxod qoldiqlaridan qatorga qo'shish (F4)
          </DialogDescription>
        </DialogHeader>
        <Command className="w-full">
          <CommandInput placeholder="Material nomi yoki SKU bo'yicha qidirish..." className="h-9 text-xs" />
          <CommandList className="max-h-72 overflow-y-auto p-1.5">
            <CommandEmpty className="p-4 text-xs text-muted-foreground text-center">
              Mos keluvchi material topilmadi
            </CommandEmpty>
            <CommandGroup heading="Ombordagi qoldiqlar">
              {stock.map((item) => (
                <CommandItem
                  key={item.sku}
                  value={`${item.sku} ${item.name} ${item.category} ${item.sheetFormat || ""}`}
                  onSelect={() => {
                    onSelectMaterial(item.sku);
                    onOpenChange(false);
                  }}
                  className="flex items-center justify-between p-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted font-bold text-foreground shrink-0">
                        {item.sku}
                      </span>
                      <span className="font-medium truncate text-foreground text-xs">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Joyi: {item.location} {item.sheetFormat ? `• ${item.sheetFormat}` : ""}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] font-mono font-semibold ${
                      item.available > 0
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-red-500/15 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {item.available.toLocaleString()} {item.unit}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// ─── Searchable Recipient Combobox ─────────────────────────────────────────
function RecipientCombobox({
  value,
  onChange,
  shipmentType,
  customers,
  branches,
  subcontractors,
  vendors,
  disabled = false,
  isAutoLinked = false,
}: {
  value: string;
  onChange: (val: string) => void;
  shipmentType: ShipmentType;
  customers: CrmCustomerRecord[];
  branches: string[];
  subcontractors: string[];
  vendors: string[];
  disabled?: boolean;
  isAutoLinked?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (shipmentType === "BranchTransfer") {
      return branches.map((b) => ({ id: b, name: b, hint: "Filial ombori" }));
    }
    if (shipmentType === "Outsourcing") {
      return subcontractors.map((s) => ({ id: s, name: s, hint: "Autsorser sexi" }));
    }
    if (shipmentType === "VendorReturn") {
      return vendors.map((v) => ({ id: v, name: v, hint: "Yetkazib beruvchi" }));
    }
    return customers.map((c) => ({
      id: c.name,
      name: c.name,
      hint: c.tin ? `STIR: ${c.tin}` : c.industry,
    }));
  }, [shipmentType, branches, subcontractors, vendors, customers]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-7 w-full justify-between px-2 text-xs font-normal bg-background border-input shadow-none truncate",
              isAutoLinked && "border-blue-500/40 bg-blue-500/5 text-blue-900 dark:text-blue-200"
            )}
          >
            <span className="truncate flex items-center gap-1.5 min-w-0">
              {isAutoLinked && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 shrink-0 font-medium">🔗</span>
              )}
              <span className="truncate">{value || "Qabul qiluvchini tanlang..."}</span>
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[340px] p-0 border border-border shadow-xl" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Qabul qiluvchini qidirish..." className="h-8 text-xs" />
          <CommandList className="max-h-60 overflow-y-auto p-1">
            <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
              Topilmadi
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="CLEAR_RECIPIENT_FILTER Tozalash barcha mijozlar"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded cursor-pointer text-xs text-blue-600 dark:text-blue-400 font-medium"
                >
                  <span>🔄 Filtrni tozalash (Barcha mijozlar)</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.hint || ""}`}
                  onSelect={() => {
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between p-2 rounded cursor-pointer text-xs"
                >
                  <span className="font-medium text-foreground truncate">{opt.name}</span>
                  {opt.hint && (
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2 font-mono">
                      {opt.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Carrier Combobox (Bitta joyda chaqirish) ───────────────────
export function CarrierCombobox({
  carrier,
  vehicleNo,
  driverName,
  driverPhone,
  carriers,
  onSelect,
  onAddNew,
  disabled = false,
}: {
  carrier: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  carriers: CarrierProfile[];
  onSelect: (profile: CarrierProfile) => void;
  onAddNew: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Match profile
  const selectedProfile = useMemo(() => {
    return carriers.find((c) => c.name === carrier || (c.vehicleNo && c.vehicleNo === vehicleNo));
  }, [carriers, carrier, vehicleNo]);

  const displayLabel = useMemo(() => {
    if (selectedProfile) {
      const parts = [];
      if (selectedProfile.vehicleNo && selectedProfile.vehicleNo !== "—") {
        parts.push(selectedProfile.vehicleNo);
      }
      if (selectedProfile.vehicleModel) {
        parts.push(selectedProfile.vehicleModel);
      }
      if (selectedProfile.driverName && selectedProfile.driverName !== "—") {
        parts.push(selectedProfile.driverName);
      }
      return parts.join(" • ") || selectedProfile.name;
    }
    const parts = [carrier];
    if (vehicleNo && vehicleNo !== "—") parts.push(`(${vehicleNo})`);
    if (driverName && driverName !== "—") parts.push(`• ${driverName}`);
    return parts.filter(Boolean).join(" ");
  }, [selectedProfile, carrier, vehicleNo, driverName]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-6.5 text-xs font-normal bg-background px-2 gap-1.5 max-w-[370px] truncate justify-between border-input shadow-none"
          >
            <span className="truncate flex items-center gap-1.5 min-w-0">
              <Truck className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-semibold text-foreground truncate">{displayLabel || "Tashuvchini tanlang..."}</span>
              {driverPhone && driverPhone !== "—" && (
                <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden md:inline">
                  {driverPhone}
                </span>
              )}
            </span>
            <ChevronsUpDown className="size-3 opacity-50 shrink-0 ml-1" />
          </Button>
        }
      />
      <PopoverContent className="w-[400px] p-0 border border-border shadow-xl" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Haydovchi ismi, avto raqami yoki rusumi..." className="h-8 text-xs" />
          <CommandList className="max-h-64 overflow-y-auto p-1">
            <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
              Tashuvchi topilmadi
            </CommandEmpty>

            <CommandGroup heading="Mavjud transport va haydovchilar">
              {carriers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.vehicleModel} ${c.vehicleNo} ${c.driverName} ${c.driverPhone}`}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5 p-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                      {c.type === "fleet" ? "🚛" : c.type === "courier" ? "📦" : "🛍️"}
                      <span className="truncate">{c.name}</span>
                    </span>
                    {c.vehicleNo && c.vehicleNo !== "—" && (
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0 font-bold bg-muted/60">
                        {c.vehicleNo}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate w-full mt-0.5">
                    <span className="truncate font-medium">{c.vehicleModel}</span>
                    {c.driverName && c.driverName !== "—" && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">👤 {c.driverName}</span>
                      </>
                    )}
                    {c.driverPhone && c.driverPhone !== "—" && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">📞 {c.driverPhone}</span>
                      </>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Boshqa amallar">
              <CommandItem
                value="ADD_NEW_CARRIER Yangi tashuvchi haydovchi kiritish mashina raqam tel"
                onSelect={() => {
                  setOpen(false);
                  onAddNew();
                }}
                className="flex items-center gap-2 p-2 rounded cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400"
              >
                <Plus className="size-3.5" />
                <span>Yangi transport & haydovchi kiritish...</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Carrier Dialog (Bitta joyda kiritish / tahrirlash) ──────────────────────
export function CarrierDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<CarrierProfile>;
  onSave: (profile: CarrierProfile) => void;
}) {
  const [name, setName] = useState(initialData?.name || "PrintGoo Fleet");
  const [type, setType] = useState<"fleet" | "courier" | "self" | "other">(initialData?.type || "fleet");
  const [vehicleModel, setVehicleModel] = useState(initialData?.vehicleModel || "");
  const [vehicleNo, setVehicleNo] = useState(initialData?.vehicleNo || "");
  const [driverName, setDriverName] = useState(initialData?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(initialData?.driverPhone || "");

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "PrintGoo Fleet");
      setType(initialData.type || "fleet");
      setVehicleModel(initialData.vehicleModel || "");
      setVehicleNo(initialData.vehicleNo || "");
      setDriverName(initialData.driverName || "");
      setDriverPhone(initialData.driverPhone || "");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: CarrierProfile = {
      id: initialData?.id || `carrier-${Date.now()}`,
      name: name || "Kompaniya transporti",
      type,
      vehicleModel: vehicleModel || "Furgon",
      vehicleNo: vehicleNo || "01 A 000 AA",
      driverName: driverName || "Haydovchi",
      driverPhone: driverPhone || "+998 90 000-00-00",
    };
    onSave(profile);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-3.5 bg-muted/40 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-blue-600" />
            <span>Tashuvchi va transport ma'lumotlari</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Mashina rusumi, davlat raqami, haydovchi ismi va telefonini bitta joyda kiritish
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tashuvchi / Kompaniya</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PrintGoo Fleet #1"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tashuv turi</Label>
              <Select
                value={type}
                onValueChange={(val: any) => setType(val)}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="fleet">🚛 Kompaniya avtoparki (Fleet)</SelectItem>
                  <SelectItem value="courier">📦 Kuryer / Logistika xizmati</SelectItem>
                  <SelectItem value="self">🛍️ Mijoz o'zi olib ketadi (Samovyvoz)</SelectItem>
                  <SelectItem value="other">🚚 Yollanma transport</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Mashina rusumi / modeli</Label>
              <Input
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="ISUZU Furgon 3.5t / Labo"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Davlat raqami</Label>
              <Input
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="01 A 772 BB"
                className="h-7 text-xs font-mono font-bold bg-background"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Haydovchi F.I.Sh.</Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Rustam Ismoilov"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Haydovchi telefoni</Label>
              <Input
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+998 90 123-45-67"
                className="h-7 text-xs font-mono bg-background"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Saqlash va tanlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WarehouseShipmentDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseShipments,
    upsertWarehouseShipment,
    upsertWarehouseShipmentAsync,
    replaceTabId,
    productionQueue,
    crmCustomers,
    warehouseStock,
    deliveryActs,
    openTab,
    closeTab,
    setTabUnsaved,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  // Initialize or read existing document
  const initialDoc = useMemo<WarehouseShipmentRecord>(() => {
    const d = tab.documentData || {};
    const defaultProduct = d.product || "";
    const defaultQty = Number(d.quantity) || 0;
    const defaultUnit = d.unit || "pcs";
    const defaultCustomer = d.customer || crmCustomers[0]?.name || "";
    const defaultWo = d.workOrder || "";
    const defaultShipmentType: ShipmentType = d.shipmentType || "CustomerDelivery";

    const defaultItems: ShipmentLineItem[] = d.items && d.items.length > 0
      ? d.items
      : [
          {
            id: "ship-item-1",
            sku: "PRN-JOB-01",
            name: defaultProduct,
            orderQty: defaultQty,
            shippedQty: defaultQty,
            unit: defaultUnit,
            packageCount: Math.ceil(defaultQty / 500) || 10,
            packageType: "Gofroquti (Karton)",
            palletNo: "Pallet P-01",
            notes: "To'liq adad qadoqlandi",
          },
        ];

    return {
      id: d.id || tab.id,
      date: d.date || new Date().toISOString().split("T")[0],
      customer: defaultCustomer,
      deliveryActId: d.deliveryActId || "",
      workOrder: defaultWo,
      product: defaultProduct,
      quantity: defaultQty,
      unit: defaultUnit,
      from: d.from || WAREHOUSE_LOCATIONS[0],
      carrier: d.carrier || DEFAULT_CARRIERS[0].name,
      trackingNo: d.trackingNo || `TRK${Math.floor(900000 + Math.random() * 99999)}`,
      driverName: d.driverName || DEFAULT_CARRIERS[0].driverName,
      driverPhone: d.driverPhone || DEFAULT_CARRIERS[0].driverPhone,
      vehicleNo: d.vehicleNo || DEFAULT_CARRIERS[0].vehicleNo,
      recipientName: d.recipientName || "Mijoz vakili (Ishonchnoma asosida)",
      powerOfAttorney: d.powerOfAttorney || "№ 184 / 12.10.2026 dan",
      packagesCount: d.packagesCount || Math.ceil(defaultQty / 500) || 10,
      grossWeightKg: d.grossWeightKg || Math.round(defaultQty * 0.045) || 145,
      volumeM3: d.volumeM3 || 0.85,
      notes: d.notes || "",
      status: d.status || "Draft",
      shipmentType: defaultShipmentType,
      items: defaultItems,
    };
  }, [tab.documentData, tab.id, crmCustomers, productionQueue]);

  const [doc, setDoc] = useState<WarehouseShipmentRecord>(initialDoc);
  const [carrierList, setCarrierList] = useState<CarrierProfile[]>(DEFAULT_CARRIERS);
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [carrierModalData, setCarrierModalData] = useState<Partial<CarrierProfile> | undefined>(undefined);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);

  const isLocked = doc.status === "Delivered" || doc.status === "Dispatched";

  const totalShippedQty = useMemo(() => {
    return (doc.items || []).reduce((acc, it) => acc + (Number(it.shippedQty) || 0), 0);
  }, [doc.items]);

  const totalPackages = useMemo(() => {
    return (doc.items || []).reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
  }, [doc.items]);

  const handleFieldChange = (field: keyof WarehouseShipmentRecord, val: any) => {
    if (isLocked) return;
    setDoc((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleShipmentTypeChange = (st: ShipmentType) => {
    if (isLocked) return;
    let defaultRecipient = doc.customer;
    let defaultWo = doc.workOrder;

    if (st === "BranchTransfer") {
      defaultRecipient = BRANCH_RECIPIENTS[0];
      defaultWo = "— (Filiallararo)";
    } else if (st === "Outsourcing") {
      defaultRecipient = SUBCONTRACTORS[0];
      defaultWo = productionQueue[0]?.id || "WOOF-26-0351";
    } else if (st === "VendorReturn") {
      defaultRecipient = VENDORS[0];
      defaultWo = "— (Reklamatsiya)";
    } else if (st === "CustomerDelivery") {
      defaultRecipient = crmCustomers[0]?.name || "Alpha Media Group LLC";
      defaultWo = productionQueue[0]?.id || "WOOF-26-0351";
    }

    setDoc((prev) => ({
      ...prev,
      shipmentType: st,
      customer: defaultRecipient,
      workOrder: defaultWo,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleWorkOrderSelect = (woId: string) => {
    if (isLocked) return;

    if (!woId || woId.startsWith("—") || woId === "direct") {
      setDoc((prev) => ({
        ...prev,
        workOrder: "— (To'g'ridan-to'g'ri chiqim)",
      }));
      setTabUnsaved(tab.id, true);
      return;
    }

    const wo = productionQueue.find((w) => w.id === woId);
    if (!wo) {
      setDoc((prev) => ({ ...prev, workOrder: woId }));
      setTabUnsaved(tab.id, true);
      return;
    }

    const orderQty = wo.quantity || 1000;
    const updatedItems: ShipmentLineItem[] = [
      {
        id: `ship-item-${Date.now()}`,
        sku: `PRN-${wo.id}`,
        name: wo.product,
        orderQty: orderQty,
        shippedQty: orderQty,
        unit: wo.unit || "pcs",
        packageCount: Math.ceil(orderQty / 500) || 5,
        packageType: "Gofroquti (Karton)",
        palletNo: "Pallet P-01",
        notes: `${wo.id} buyurtmasi bo'yicha`,
      },
    ];

    setDoc((prev) => {
      const isCustomerDelivery = (prev.shipmentType || "CustomerDelivery") === "CustomerDelivery";
      return {
        ...prev,
        workOrder: wo.id,
        customer: isCustomerDelivery ? (wo.customer || prev.customer) : prev.customer,
        product: wo.product,
        quantity: orderQty,
        unit: wo.unit || "pcs",
        packagesCount: Math.ceil(orderQty / 500) || 5,
        grossWeightKg: Math.round(orderQty * 0.05) || 120,
        items: updatedItems,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const handleCustomerChange = (newCustomer: string) => {
    if (isLocked) return;

    setDoc((prev) => {
      let nextWorkOrder = prev.workOrder;
      let nextProduct = prev.product;
      let nextItems = prev.items;

      if ((prev.shipmentType || "CustomerDelivery") === "CustomerDelivery") {
        if (!newCustomer) {
          return {
            ...prev,
            customer: "",
          };
        }

        const currentWo = productionQueue.find((w) => w.id === prev.workOrder);
        const isMismatch = currentWo && currentWo.customer?.toLowerCase() !== newCustomer.toLowerCase();

        if (isMismatch || !prev.workOrder || prev.workOrder.startsWith("—")) {
          // Check if this newly picked customer has active orders
          const customerOrders = productionQueue.filter(
            (w) => w.customer && w.customer.toLowerCase() === newCustomer.toLowerCase()
          );

          if (customerOrders.length === 1) {
            // Auto-select if only 1 order exists!
            const autoWo = customerOrders[0];
            const orderQty = autoWo.quantity || 1000;
            nextWorkOrder = autoWo.id;
            nextProduct = autoWo.product;
            nextItems = [
              {
                id: `ship-item-${Date.now()}`,
                sku: `PRN-${autoWo.id}`,
                name: autoWo.product,
                orderQty: orderQty,
                shippedQty: orderQty,
                unit: autoWo.unit || "pcs",
                packageCount: Math.ceil(orderQty / 500) || 5,
                packageType: "Gofroquti (Karton)",
                palletNo: "Pallet P-01",
                notes: `${autoWo.id} buyurtmasi bo'yicha`,
              },
            ];
          } else {
            // Multiple or 0 orders: reset workOrder so user picks from the filtered list in WorkOrderPicker
            nextWorkOrder = "";
          }
        }
      }

      return {
        ...prev,
        customer: newCustomer,
        workOrder: nextWorkOrder,
        product: nextProduct,
        items: nextItems,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const handleSelectCarrierProfile = (profile: CarrierProfile) => {
    if (isLocked) return;
    setDoc((prev) => ({
      ...prev,
      carrier: profile.name,
      vehicleNo: profile.vehicleNo,
      driverName: profile.driverName,
      driverPhone: profile.driverPhone,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleSaveCarrierProfile = (profile: CarrierProfile) => {
    if (isLocked) return;
    setCarrierList((prev) => {
      const idx = prev.findIndex((c) => c.id === profile.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = profile;
        return updated;
      }
      return [profile, ...prev];
    });

    setDoc((prev) => ({
      ...prev,
      carrier: profile.name,
      vehicleNo: profile.vehicleNo,
      driverName: profile.driverName,
      driverPhone: profile.driverPhone,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleAddStockMaterial = (stockSku: string | null) => {
    if (!stockSku) return;
    const stockItem = warehouseStock.find((s) => s.sku === stockSku);
    if (!stockItem || isLocked) return;

    const newLine: ShipmentLineItem = {
      id: `mat-item-${Date.now()}`,
      sku: stockItem.sku,
      name: stockItem.name,
      orderQty: Math.min(1000, stockItem.available),
      shippedQty: Math.min(1000, stockItem.available),
      unit: stockItem.unit,
      packageCount: 1,
      packageType: "Karton quti / Poddon",
      palletNo: stockItem.location.slice(0, 15),
      notes: `${doc.shipmentType === "BranchTransfer" ? "Filial ehtiyoji uchun" : "Xomashyo jo'natmasi"}`,
    };

    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), newLine],
    }));
    setTabUnsaved(tab.id, true);
    setIsStockPickerOpen(false);
  };

  const isDraft = !doc.id || doc.id.startsWith("draft-") || doc.id.startsWith("new-") || doc.id.startsWith("SHP-NEW-");

  const saveShipmentInternal = async (overrideStatus?: WarehouseShipmentRecord["status"]) => {
    const status = overrideStatus || doc.status;
    const payload = {
      ...doc,
      status,
      shipmentNumber: isDraft ? "" : doc.id,
      quantity: totalShippedQty,
    };
    const res = await upsertWarehouseShipmentAsync(payload);
    if (res && res.shipmentNumber) {
      const realId = res.shipmentNumber;
      const updated = { ...doc, id: realId, status, quantity: totalShippedQty };
      setDoc(updated);
      upsertWarehouseShipment(updated);
      replaceTabId(tab.id, realId, `${realId}: ${updated.customer || "Chiqim"}`, updated);
    } else {
      const updated = { ...doc, status, quantity: totalShippedQty };
      setDoc(updated);
      upsertWarehouseShipment(updated);
    }
    setTabUnsaved(tab.id, false);
  };

  const handleSave = () => {
    saveShipmentInternal();
  };

  const handleDispatch = () => {
    saveShipmentInternal("Dispatched");
  };

  const handleMarkDelivered = () => {
    saveShipmentInternal("Delivered");
  };

  // ─── Glide Data Grid Columns ──────────────────────────────────────────────
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: "SKU / Artikul", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Mahsulot / Xomashyo tavsifi", width: 300, icon: GridColumnIcon.HeaderString },
      { id: "orderQty", title: "Reja miqdori", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "shippedQty", title: "Jo'natilayotgan soni", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birligi", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "packageCount", title: "Qadoqlar soni", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "packageType", title: "Qadoq turi", width: 150, icon: GridColumnIcon.HeaderLookup },
      { id: "palletNo", title: "Poddon / Joylashuvi", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 200, icon: GridColumnIcon.HeaderTextTemplate },
    ],
    []
  );

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = (doc.items || [])[row];
      if (!item) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const val = item[column.id as keyof ShipmentLineItem];

      if (column.id === "shippedQty" || column.id === "orderQty") {
        const numVal = Number(val) || 0;
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: numVal.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
          themeOverride: column.id === "shippedQty" ? {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "600 12px sans-serif",
          } : undefined,
        };
      }

      if (column.id === "packageCount") {
        const numVal = Number(val) || 0;
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: String(numVal),
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }

      return {
        kind: GridCellKind.Text,
        data: String(val || ""),
        displayData: String(val || ""),
        allowOverlay: !isLocked,
      };
    },
    [doc.items, columns, isLocked, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newVal: EditableGridCell) => {
      if (isLocked) return;
      const [col, row] = cell;
      const column = columns[col];
      const key = column.id as keyof ShipmentLineItem;

      setDoc((prev) => {
        const updated = [...(prev.items || [])];
        const rowItem = { ...updated[row] };

        if (key === "shippedQty" || key === "orderQty" || key === "packageCount") {
          const num = parseFloat((newVal as any).data ?? 0);
          (rowItem as any)[key] = isNaN(num) ? 0 : num;
        } else {
          (rowItem as any)[key] = (newVal as any).data ?? "";
        }

        updated[row] = rowItem;
        return { ...prev, items: updated };
      });
      setTabUnsaved(tab.id, true);
    },
    [columns, isLocked, setTabUnsaved, tab.id]
  );

  const handleAddLine = () => {
    if (isLocked) return;
    const newItem: ShipmentLineItem = {
      id: `line-${Date.now()}`,
      sku: `PRN-ITEM-${(doc.items?.length || 0) + 1}`,
      name: doc.shipmentType === "BranchTransfer" ? "Qog'oz / Bo'yoq xomashyosi" : "Bosma mahsulot / Qo'shimcha qism",
      orderQty: 500,
      shippedQty: 500,
      unit: "pcs",
      packageCount: 1,
      packageType: "Gofroquti (Karton)",
      palletNo: "Pallet P-01",
      notes: "",
    };
    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), newItem],
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleRemoveLine = () => {
    if (isLocked || (doc.items || []).length <= 1) return;
    const rows = selection.rows.toArray();
    if (rows.length === 0) {
      setDoc((prev) => ({
        ...prev,
        items: (prev.items || []).slice(0, -1),
      }));
      setTabUnsaved(tab.id, true);
      return;
    }
    setDoc((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, idx) => !rows.includes(idx)),
    }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  const handleDuplicateLine = () => {
    if (isLocked) return;
    const rows = selection.rows.toArray();
    const sourceIdx = rows.length > 0 ? rows[0] : (doc.items || []).length - 1;
    if (sourceIdx < 0 || !doc.items || !doc.items[sourceIdx]) return;
    const itemToClone = doc.items[sourceIdx];
    const cloned: ShipmentLineItem = {
      ...itemToClone,
      id: `ship-item-${Date.now()}`,
      palletNo: itemToClone.palletNo ? `${itemToClone.palletNo} (nusxa)` : "Pallet P-01",
    };
    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), cloned],
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === "Insert") {
      e.preventDefault();
      handleAddLine();
    } else if (e.key === "Delete" && (doc.items || []).length > 1) {
      e.preventDefault();
      handleRemoveLine();
    } else if (e.key === "F4") {
      e.preventDefault();
      setIsStockPickerOpen(true);
    } else if (e.key === "F9") {
      e.preventDefault();
      handleDuplicateLine();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden">
      {/* ─── Top Document Action Bar ─── */}
      <div className="h-10 px-3 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Truck className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-tight truncate">
            <span className={cn(isDraft && "font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded")}>
              {isDraft ? "Yangi (Avtomatik)" : doc.id}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="truncate text-foreground">
              {doc.customer ? `${doc.customer} (${doc.product})` : (isDraft ? "Yangi Ombor Chiqimi (Qoralama)" : "Ombor Chiqimi")}
            </span>
          </div>

          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 font-medium flex items-center gap-1 ${
              doc.status === "Delivered"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                : doc.status === "Dispatched" || doc.status === "In Transit"
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold"
                : doc.status === "Packed"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isLocked && <Lock className="size-2.5" />}
            <span>{doc.status}</span>
          </Badge>

          {/* Shipment Type Indicator Badge */}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-mono font-medium hidden sm:inline-flex bg-muted/60 text-muted-foreground"
          >
            {doc.shipmentType === "BranchTransfer"
              ? "🚛 Filialga jo'natish"
              : doc.shipmentType === "Outsourcing"
              ? "🔄 Subpudrat (Autsorsing)"
              : doc.shipmentType === "VendorReturn"
              ? "↩️ Qaytarish"
              : doc.shipmentType === "MaterialSale"
              ? "📦 Xomashyo sotuvi"
              : "🛍️ Mijozga topshirish"}
          </Badge>

          {tab.isUnsaved && (
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" title="O'zgarishlar saqlanmagan" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Work Order Link */}
          {doc.workOrder && doc.workOrder !== "-" && !doc.workOrder.startsWith("—") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                openTab({
                  id: doc.workOrder,
                  title: doc.workOrder,
                  type: "work-order",
                  module: "production",
                });
              }}
              className="h-7 px-2 text-xs gap-1 border-border"
              title="Bog'langan buyurtmani ochish"
            >
              <ExternalLink className="size-3 text-muted-foreground" />
              <span>{doc.workOrder}</span>
            </Button>
          )}

          {/* Delivery Act (SF) Link */}
          {doc.deliveryActId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const act = deliveryActs.find((a) => a.id === doc.deliveryActId);
                openTab({
                  id: doc.deliveryActId,
                  title: `${doc.deliveryActId}: ${doc.customer}`,
                  type: "delivery-act",
                  module: "sales",
                  documentData: act,
                });
              }}
              className="h-7 px-2 text-xs gap-1 border-border text-primary"
              title="Schet-fakturani ochish"
            >
              <FileText className="size-3" />
              <span>{doc.deliveryActId}</span>
            </Button>
          )}

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Print Waybill */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-7 px-2.5 text-xs gap-1.5 border-border"
          >
            <Printer className="size-3.5" />
            <span>Chop etish (TTN)</span>
          </Button>

          {/* Save Draft */}
          {!isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 border-border"
            >
              <Save className="size-3.5" />
              <span>Saqlash</span>
            </Button>
          )}

          {/* Dispatch / Post Button */}
          {doc.status !== "Dispatched" && doc.status !== "Delivered" && (
            <Button
              size="sm"
              onClick={handleDispatch}
              className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
            >
              <Send className="size-3.5" />
              <span>Ombordan chiqarish (Провести отгрузку)</span>
            </Button>
          )}

          {doc.status === "Dispatched" && (
            <Button
              size="sm"
              onClick={handleMarkDelivered}
              className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-none"
            >
              <Check className="size-3.5" />
              <span>Yetkazildi deb belgilash (Delivered)</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => closeTab(tab.id)}
            className="h-7 px-2 text-xs"
          >
            Yopish
          </Button>
        </div>
      </div>

      {/* ─── Document Requisites (Non-overlapping spacious columns) ─── */}
      <div className="p-2.5 bg-card border-b border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5 shrink-0 text-xs">
        {/* Col 1 (span 3): Chiqim turi (Shipment Type) */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-3 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold text-blue-700 dark:text-blue-400">
            Chiqim turi (Shipment Type)
          </Label>
          {isLocked ? (
            <Input
              value={
                doc.shipmentType === "BranchTransfer"
                  ? "🚛 Filialga jo'natish"
                  : doc.shipmentType === "Outsourcing"
                  ? "🔄 Subpudratga berish"
                  : doc.shipmentType === "VendorReturn"
                  ? "↩️ Qaytarish"
                  : doc.shipmentType === "MaterialSale"
                  ? "📦 Xomashyo sotuvi"
                  : "🛍️ Mijozga topshirish"
              }
              readOnly
              className="h-7 text-xs bg-muted/40 font-medium w-full"
            />
          ) : (
            <Select
              value={doc.shipmentType || "CustomerDelivery"}
              onValueChange={(val: any) => {
                if (val) handleShipmentTypeChange(val as ShipmentType);
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 font-medium w-full">
                <SelectValue placeholder="Chiqim turini tanlang..." />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="CustomerDelivery">🛍️ Mijozga topshirish (Buyurtma)</SelectItem>
                <SelectItem value="BranchTransfer">🚛 Filialga jo'natish (Inter-branch)</SelectItem>
                <SelectItem value="Outsourcing">🔄 Subpudratga berish (Autsorsing)</SelectItem>
                <SelectItem value="VendorReturn">↩️ Yetkazib beruvchiga qaytarish</SelectItem>
                <SelectItem value="MaterialSale">📦 Xomashyo / Otxod sotuvi</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Col 2 (span 2): Hujjat raqami */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">Hujjat raqami</Label>
          <Input
            value={doc.id}
            readOnly
            className="h-7 text-xs font-mono bg-muted/40 font-bold w-full"
          />
        </div>

        {/* Col 3 (span 2): Hujjat sanasi (shadcn UI Calendar) */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">Hujjat sanasi</Label>
          <DatePicker
            value={doc.date}
            disabled={isLocked}
            onChange={(val) => handleFieldChange("date", val)}
            formatString="dd.MM.yyyy"
            className="h-7 text-xs font-mono bg-background w-full"
          />
        </div>

        {/* Col 4 (span 2): Asos / Buyurtma (Work Order) */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground font-medium">
              {doc.shipmentType === "BranchTransfer" ? "Ichki talabnoma / Asos" : "Buyurtma (Work Order)"}
            </Label>
            {doc.workOrder && !doc.workOrder.startsWith("—") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                № {doc.workOrder}
              </span>
            )}
          </div>
          {doc.shipmentType === "BranchTransfer" || doc.shipmentType === "VendorReturn" ? (
            <Input
              value={doc.workOrder}
              readOnly={isLocked}
              onChange={(e) => handleFieldChange("workOrder", e.target.value)}
              className="h-7 text-xs font-mono bg-background w-full"
              placeholder="Asos hujjati..."
            />
          ) : (
            <WorkOrderPicker
              value={doc.workOrder}
              disabled={isLocked}
              orders={productionQueue}
              customer={doc.customer}
              onClearCustomer={() => handleCustomerChange("")}
              onSelect={handleWorkOrderSelect}
            />
          )}
        </div>

        {/* Col 5 (span 3): Qabul qiluvchi (Recipient) */}
        <div className="sm:col-span-2 md:col-span-2 lg:col-span-3 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground font-medium truncate">
              {doc.shipmentType === "BranchTransfer"
                ? "Qabul qiluvchi filial"
                : doc.shipmentType === "Outsourcing"
                ? "Subpudrat sexi (Autsorser)"
                : doc.shipmentType === "VendorReturn"
                ? "Yetkazib beruvchi (Postavshik)"
                : "Mijoz (Qabul qiluvchi)"}
            </Label>
            {doc.shipmentType === "CustomerDelivery" && doc.workOrder && !doc.workOrder.startsWith("—") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5">
                🔗 {doc.workOrder} ga bog'langan
              </span>
            )}
          </div>
          <RecipientCombobox
            value={doc.customer}
            onChange={handleCustomerChange}
            shipmentType={doc.shipmentType || "CustomerDelivery"}
            customers={crmCustomers}
            branches={BRANCH_RECIPIENTS}
            subcontractors={SUBCONTRACTORS}
            vendors={VENDORS}
            disabled={isLocked}
            isAutoLinked={Boolean(doc.shipmentType === "CustomerDelivery" && doc.workOrder && !doc.workOrder.startsWith("—"))}
          />
        </div>
      </div>

      {/* ─── Contextual Transport Strip (Ixcham va faqat kerakli ma'lumotlar) ─── */}
      <div className="px-3 py-1.5 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Dispatch Warehouse */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">Chiqaruvchi ombor:</span>
            {isLocked ? (
              <span className="font-medium text-foreground text-xs">{doc.from}</span>
            ) : (
              <Select
                value={doc.from}
                onValueChange={(val: any) => {
                  if (val) handleFieldChange("from", val);
                }}
              >
                <SelectTrigger className="h-6 text-xs bg-background max-w-[210px] truncate">
                  <SelectValue placeholder="Ombor..." />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {WAREHOUSE_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc} className="text-xs">
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator orientation="vertical" className="h-3.5" />

          {/* Unified Carrier & Driver Combobox */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">Tashuvchi:</span>
            {isLocked ? (
              <span className="font-medium text-foreground text-xs flex items-center gap-1">
                <span>{doc.carrier}</span>
                {doc.vehicleNo && doc.vehicleNo !== "—" && (
                  <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted/60 font-bold">
                    {doc.vehicleNo}
                  </span>
                )}
                {doc.driverName && doc.driverName !== "—" && (
                  <span className="text-muted-foreground">• {doc.driverName}</span>
                )}
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <CarrierCombobox
                  carrier={doc.carrier}
                  vehicleNo={doc.vehicleNo}
                  driverName={doc.driverName}
                  driverPhone={doc.driverPhone}
                  carriers={carrierList}
                  onSelect={handleSelectCarrierProfile}
                  onAddNew={() => {
                    setCarrierModalData({
                      name: "PrintGoo Fleet",
                      vehicleModel: "",
                      vehicleNo: "",
                      driverName: "",
                      driverPhone: "+998 90 ",
                      type: "fleet",
                    });
                    setIsCarrierModalOpen(true);
                  }}
                  disabled={isLocked}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCarrierModalData({
                      name: doc.carrier || "PrintGoo Fleet #1",
                      vehicleModel: doc.carrier.includes("(") ? doc.carrier.split("(")[1]?.replace(")", "") || "" : "Furgon",
                      vehicleNo: doc.vehicleNo || "",
                      driverName: doc.driverName || "",
                      driverPhone: doc.driverPhone || "",
                      type: (doc.carrier.includes("BTS") || doc.carrier.includes("Express") || doc.carrier.includes("Yandex")) ? "courier" : doc.carrier.includes("Samovyvoz") ? "self" : "fleet",
                    });
                    setIsCarrierModalOpen(true);
                  }}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  title="Tashuvchi, avto raqami, haydovchi va telefonni bitta joyda tahrirlash"
                >
                  <Pencil className="size-3" />
                  <span className="hidden sm:inline">Tahrirlash</span>
                </Button>
              </div>
            )}
          </div>

          {/* Conditional: Courier tracking */}
          {(doc.carrier.includes("Logistics") || doc.carrier.includes("Pochta") || doc.carrier.includes("Yandex")) && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Yuk xati №:</span>
              <Input
                value={doc.trackingNo || ""}
                readOnly={isLocked}
                onChange={(e) => handleFieldChange("trackingNo", e.target.value)}
                placeholder="TRK..."
                className="h-6 w-36 text-xs font-mono bg-background text-primary font-semibold"
              />
            </div>
          )}

          {/* Conditional: Customer Self-Pickup (Samovyvoz -> Ishonchnoma) */}
          {doc.carrier.includes("Samovyvoz") && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                <FileText className="size-3" />
                Ishonchnoma:
              </span>
              <Input
                value={doc.powerOfAttorney || ""}
                readOnly={isLocked}
                onChange={(e) => handleFieldChange("powerOfAttorney", e.target.value)}
                placeholder="№ 184 / 12.10.2026 dan (ixtiyoriy)"
                className="h-6 w-48 text-xs font-mono bg-background"
                title="Mijoz vakilining yuridik ishonchnomasi"
              />
            </div>
          )}

          {/* Extra Details Popover (ixtiyoriy izoh, m³) */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                >
                  <SlidersHorizontal className="size-3" />
                  <span>Qo'shimcha</span>
                  {(doc.notes || doc.volumeM3) && (
                    <span className="size-1.5 rounded-full bg-blue-600" />
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-3 text-xs space-y-2.5 border border-border shadow-xl" align="start">
              <div className="font-semibold text-xs text-foreground pb-1 border-b border-border">
                Ixtiyoriy qo'shimcha ma'lumotlar
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Yuk hajmi (m³)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={doc.volumeM3 || ""}
                  readOnly={isLocked}
                  onChange={(e) => handleFieldChange("volumeM3", Number(e.target.value))}
                  placeholder="0.85 m³"
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Yuk jo'natish izohi / Eslatma</Label>
                <Input
                  value={doc.notes || ""}
                  readOnly={isLocked}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Ehtiyotkorlik bilan yetkazilsin..."
                  className="h-7 text-xs bg-background"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right side live summary badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-normal gap-1.5 bg-background text-foreground h-6 px-2.5 border-border shadow-xs">
            <span>📦 <b className="font-mono">{totalPackages}</b> quti</span>
            <span className="text-muted-foreground">•</span>
            <span>⚖️ <b className="font-mono">{doc.grossWeightKg || Math.round(totalShippedQty * 0.045)}</b> kg</span>
          </Badge>
        </div>
      </div>

      {/* ─── Table Toolbar (Tovarlar spetsifikatsiyasi) ─── */}
      <div className="h-8 px-3 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Boxes className="size-3.5 text-muted-foreground" />
            Jo'natilayotgan tovarlar va materiallar ro'yxati
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-background font-mono">
            {(doc.items || []).length} pozitsiya
          </Badge>
        </div>

        {/* Hotkey and Context Menu hints */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs font-semibold text-foreground">Ins</kbd>
            <span>qo'shish</span>
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="hidden sm:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs font-semibold text-foreground">Del</kbd>
            <span>o'chirish</span>
          </span>
          <span className="hidden md:inline text-muted-foreground/40">•</span>
          <span className="hidden md:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs font-semibold text-foreground">F4</kbd>
            <span>ombor</span>
          </span>
          <span className="hidden lg:inline text-muted-foreground/40">•</span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">O'ng tugma (Kontekst menyu)</span>
        </div>
      </div>

      {/* ─── Tabular Grid Section (Glide Data Grid with Context Menu) ─── */}
      <div
        className="flex-1 w-full min-h-0 bg-background relative overflow-hidden outline-none focus:outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="w-full h-full">
              <DataEditor
                width="100%"
                height="100%"
                rows={(doc.items || []).length}
                columns={columns}
                getCellContent={getContent}
                onCellEdited={handleCellEdited}
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                onCellContextMenu={(cell) => {
                  const [, row] = cell;
                  if (row !== undefined && row >= 0) {
                    setSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                    });
                  }
                }}
                rowMarkers="both"
                freezeColumns={1}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                smoothScrollX
                smoothScrollY
              />
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-60 text-xs">
            <ContextMenuItem onClick={handleAddLine} disabled={isLocked} className="gap-2 cursor-pointer">
              <Plus className="size-3.5 text-blue-600" />
              <span>Yangi satr qo'shish</span>
              <ContextMenuShortcut>Ins</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setIsStockPickerOpen(true)}
              disabled={isLocked}
              className="gap-2 cursor-pointer"
            >
              <Boxes className="size-3.5 text-emerald-600" />
              <span>Ombordan xomashyo qo'shish...</span>
              <ContextMenuShortcut>F4</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleDuplicateLine}
              disabled={isLocked || (doc.items || []).length === 0}
              className="gap-2 cursor-pointer"
            >
              <Layers className="size-3.5 text-indigo-500" />
              <span>Qatordan nusxa olish</span>
              <ContextMenuShortcut>F9</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={handleRemoveLine}
              disabled={isLocked || (doc.items || []).length <= 1}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Tanlangan satrni o'chirish</span>
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* ─── Footer Summary Bar ─── */}
      <div className="h-8 px-3 bg-card border-t border-border flex items-center justify-between shrink-0 text-xs font-medium">
        <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
          <span>
            Jami qatorlar: <b className="text-foreground">{(doc.items || []).length}</b>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span>
            Jami qadoqlar: <b className="text-foreground">{totalPackages || doc.packagesCount || 0} ta quti</b>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span>
            Umumiy vazn: <b className="text-foreground">{doc.grossWeightKg || 0} kg</b>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px]">Jami chiqarilayotgan adad:</span>
          <span className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400">
            {totalShippedQty.toLocaleString()} {doc.unit || "birlik"}
          </span>
        </div>
      </div>

      {/* ─── Printable Waybill Dialog (Товарно-транспортная накладная / TTN) ─── */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border border-border shadow-2xl">
          <DialogHeader className="p-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="size-4 text-blue-600" />
                <span>
                  {doc.shipmentType === "BranchTransfer"
                    ? "FILIALLARARO YUK TASHISH YUK XATI (ICHKI LOGISTIKA)"
                    : doc.shipmentType === "Outsourcing"
                    ? "SUBPUDRATGA BERISH YUK XATI (AUTSORSING)"
                    : "CHIQIM YUK XATI (ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ)"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Chop etish va haydovchi/qabul qiluvchi imzolashi uchun rasmiy yo'l hujjati
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Printable Document Sheet Preview */}
          <div className="p-6 bg-white text-zinc-950 font-sans text-xs space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h1 className="text-base font-black tracking-tight">PRINTGOO POLIGRAFIYA MCHJ</h1>
                <p className="text-[11px] text-zinc-600">Toshkent sh., Chilonzor tumani, Sanoat hududi 12</p>
                <p className="text-[11px] text-zinc-600">Tel: +998 71 200-00-00 | STIR: 305841920</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold font-mono">Hujjat № {doc.id}</div>
                <div className="text-[11px] text-zinc-600 font-mono">Sana: {doc.date}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Yuk xati: {doc.trackingNo}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] p-2.5 rounded bg-zinc-50 border border-zinc-200">
              <div>
                <p><b className="text-zinc-700">Yuk jo'natuvchi:</b> {doc.from}</p>
                <p><b className="text-zinc-700">Tashuvchi:</b> {doc.carrier}</p>
                <p><b className="text-zinc-700">Haydovchi:</b> {doc.driverName} ({doc.vehicleNo}) {doc.driverPhone && doc.driverPhone !== "—" ? `• Tel: ${doc.driverPhone}` : ""}</p>
              </div>
              <div>
                <p><b className="text-zinc-700">Qabul qiluvchi:</b> {doc.customer}</p>
                <p><b className="text-zinc-700">Buyurtma / Asos:</b> {doc.workOrder}</p>
                <p><b className="text-zinc-700">Ishonchnoma:</b> {doc.powerOfAttorney || "Talab etilmaydi (Firma yetkazmasi)"}</p>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse border border-zinc-300 text-[11px]">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-300">
                  <th className="p-1.5 border-r border-zinc-300 w-8 text-center">№</th>
                  <th className="p-1.5 border-r border-zinc-300">Mahsulot / Xomashyo nomi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-24 text-right">Jo'natildi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-16 text-center">Birligi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-20 text-center">Qadoq</th>
                  <th className="p-1.5 text-center w-24">Joylashuvi</th>
                </tr>
              </thead>
              <tbody>
                {(doc.items || []).map((it, idx) => (
                  <tr key={it.id} className="border-b border-zinc-200">
                    <td className="p-1.5 border-r border-zinc-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-1.5 border-r border-zinc-200 font-medium">{it.name}</td>
                    <td className="p-1.5 border-r border-zinc-200 text-right font-mono font-bold">
                      {Number(it.shippedQty).toLocaleString()}
                    </td>
                    <td className="p-1.5 border-r border-zinc-200 text-center">{it.unit}</td>
                    <td className="p-1.5 border-r border-zinc-200 text-center font-mono">{it.packageCount || 1} quti</td>
                    <td className="p-1.5 text-center font-mono text-[10px]">{it.palletNo || "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold border-t border-zinc-300">
                  <td colSpan={2} className="p-1.5 text-right border-r border-zinc-300">Jami:</td>
                  <td className="p-1.5 text-right font-mono text-blue-700">{totalShippedQty.toLocaleString()}</td>
                  <td className="p-1.5 text-center">{doc.unit}</td>
                  <td className="p-1.5 text-center font-mono">{totalPackages} quti</td>
                  <td className="p-1.5 text-center font-mono text-[10px]">{doc.grossWeightKg} kg</td>
                </tr>
              </tfoot>
            </table>

            {/* Signature section */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-[11px]">
              <div className="space-y-6">
                <div>
                  <p className="font-semibold">Topshirdi (Ombor mudiri):</p>
                  <p className="text-zinc-600">D. Karimov ___________________</p>
                </div>
                <div className="text-[10px] text-zinc-400">M.O'. (Muhr o'rni)</div>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="font-semibold">Qabul qildi (Haydovchi / Vakil):</p>
                  <p className="text-zinc-600">{doc.driverName ? doc.driverName.split(" ")[0] : "Haydovchi"} ___________________</p>
                </div>
                <div className="text-[10px] text-zinc-400">Imzo & Qabul vaqti: ____________</div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 bg-muted/40 border-t border-border flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPrintModalOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                window.print();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Chop etish (Ctrl+P)</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ombordan xomashyo tanlash Dialogi (F4 yoki Kontekst Menyu) ─── */}
      <StockMaterialDialog
        open={isStockPickerOpen}
        onOpenChange={setIsStockPickerOpen}
        stock={warehouseStock}
        onSelectMaterial={handleAddStockMaterial}
      />

      {/* ─── Tashuvchi va Haydovchi ma'lumotlarini kiritish / tahrirlash Dialogi ─── */}
      <CarrierDialog
        open={isCarrierModalOpen}
        onOpenChange={setIsCarrierModalOpen}
        initialData={carrierModalData}
        onSave={handleSaveCarrierProfile}
      />
    </div>
  );
}
