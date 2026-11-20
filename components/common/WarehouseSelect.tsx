"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Search,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceStore } from "@/store/workspaceStore";

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  type: string;
  branchId: string | null;
  companyId: string;
  companyName?: string;
  fullLabel: string;
}

export interface WarehouseSelectValue {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  branchId: string | null;
  companyId: string;
  companyName?: string;
  locationDisplay: string;
}

export interface WarehouseSelectProps {
  value?: string | { warehouseId?: string | null; location?: string | null } | null;
  warehouseId?: string | null;
  onValueChange: (val: WarehouseSelectValue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  companyCode: string;
  warehouses: WarehouseItem[];
}

function WarehouseRow({
  wh,
  isCurrent,
  onSelect,
}: {
  wh: WarehouseItem;
  isCurrent: boolean;
  onSelect: (item: WarehouseItem) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={() => onSelect(wh)}
      className={cn(
        "w-full justify-between h-6 px-1.5 text-xs font-normal hover:bg-accent/60 cursor-pointer",
        isCurrent && "bg-accent/80 font-semibold text-primary"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Warehouse className="size-3 text-muted-foreground shrink-0" />
        <span className="truncate">{wh.companyName}</span>
      </div>
      {isCurrent && <Check className="size-3 text-primary shrink-0 ml-1" />}
    </Button>
  );
}

export function WarehouseSelect({
  value,
  warehouseId,
  onValueChange,
  placeholder = "Omborni tanlang...",
  className,
  disabled = false,
}: WarehouseSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const { companiesList, warehousesList, loadCompanies, loadWarehouses } =
    useWorkspaceStore();

  React.useEffect(() => {
    if (companiesList.length === 0) {
      loadCompanies();
    }
    if (warehousesList.length === 0) {
      loadWarehouses("PRINTGOO");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Company -> warehouses. Warehouses always belong to a company.
  const groups = React.useMemo<CompanyGroup[]>(() => {
    return companiesList
      .map((company) => ({
        companyId: company.id,
        companyName: company.name,
        companyCode: company.code,
        warehouses: warehousesList
          .filter((w) => w.companyId === company.id)
          .map(
            (w): WarehouseItem => ({
              id: w.id,
              code: w.code,
              name: w.name,
              type: w.type || "general",
              branchId: w.branchId ?? null,
              companyId: company.id,
              companyName: company.name,
              fullLabel: company.name,
            })
          ),
      }))
      .filter((g) => g.warehouses.length > 0);
  }, [companiesList, warehousesList]);

  const allWarehouses = React.useMemo<WarehouseItem[]>(
    () => groups.flatMap((g) => g.warehouses),
    [groups]
  );

  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => {
        const companyMatches =
          g.companyName.toLowerCase().includes(q) ||
          g.companyCode.toLowerCase().includes(q);
        const warehouses = g.warehouses.filter(
          (w) =>
            companyMatches ||
            w.name.toLowerCase().includes(q) ||
            w.code.toLowerCase().includes(q)
        );
        return warehouses.length > 0 ? { ...g, warehouses } : null;
      })
      .filter(Boolean) as CompanyGroup[];
  }, [groups, searchQuery]);

  const selectedItem = React.useMemo(() => {
    if (warehouseId) {
      const found = allWarehouses.find((w) => w.id === warehouseId);
      if (found) return found;
    }

    if (value) {
      if (typeof value === "string") {
        const v = value.toLowerCase();
        return (
          allWarehouses.find(
            (w) =>
              w.id === value ||
              w.name.toLowerCase() === v ||
              w.fullLabel.toLowerCase() === v ||
              w.code.toLowerCase() === v
          ) ??
          allWarehouses.find((w) => v.includes(w.name.toLowerCase())) ??
          null
        );
      }
      if (value.warehouseId) {
        const found = allWarehouses.find((w) => w.id === value.warehouseId);
        if (found) return found;
      }
      if (value.location) {
        const loc = value.location.toLowerCase();
        const found = allWarehouses.find(
          (w) => w.name.toLowerCase() === loc || w.fullLabel.toLowerCase() === loc
        );
        if (found) return found;
      }
    }

    return null;
  }, [allWarehouses, warehouseId, value]);

  const handleSelect = (item: WarehouseItem) => {
    onValueChange({
      warehouseId: item.id,
      warehouseName: item.name,
      warehouseCode: item.code,
      branchId: item.branchId,
      companyId: item.companyId,
      companyName: item.companyName,
      locationDisplay: item.fullLabel,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full h-8 px-2.5 justify-between text-xs font-normal bg-muted/20 hover:bg-muted/30 border-input shadow-none",
              !selectedItem && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Warehouse className="size-3.5 text-primary shrink-0" />
              <span className="truncate text-foreground font-medium">
                {selectedItem ? selectedItem.fullLabel : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[340px] p-1.5 shadow-lg space-y-1.5" align="start">
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-input bg-muted/20 text-xs">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Omborni qidirish..."
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-xs"
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto space-y-1 pr-0.5">
          {filteredGroups.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Ombor topilmadi
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredGroups
                .flatMap((g) => g.warehouses)
                .map((wh) => (
                  <WarehouseRow
                    key={wh.id}
                    wh={wh}
                    isCurrent={selectedItem?.id === wh.id}
                    onSelect={handleSelect}
                  />
                ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
