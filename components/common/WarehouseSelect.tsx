"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  ChevronRight,
  Building2,
  GitFork,
  Briefcase,
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
  branchName?: string;
  companyId: string;
  companyName?: string;
  fullLabel: string;
}

export interface WarehouseSelectValue {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  branchId: string | null;
  branchName?: string;
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

interface BranchGroup {
  branchId: string;
  branchName: string;
  branchCode?: string;
  warehouses: WarehouseItem[];
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  companyCode: string;
  legalType: string;
  isYtt: boolean;
  branches: BranchGroup[];
  directWarehouses: WarehouseItem[]; // For YTT or root warehouses
}

// ─── 2-daraja: Filial Akkordeoni ─────────────────────────────────────────────
function BranchSection({
  branch,
  selectedItem,
  onSelect,
  forceOpen,
}: {
  branch: BranchGroup;
  selectedItem: WarehouseItem | null;
  onSelect: (item: WarehouseItem) => void;
  forceOpen: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(true);
  const open = forceOpen || isOpen;

  return (
    <div className="rounded border border-border/40 overflow-hidden bg-muted/10">
      {/* Filial Expand/Collapse Sarlavhasi */}
      <button
        type="button"
        onClick={() => setIsOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-muted/50 transition-colors text-left cursor-pointer select-none group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              "size-2.5 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-90"
            )}
          />
          <GitFork className="size-3 text-blue-600 dark:text-blue-400 rotate-90 shrink-0" />
          <span className="text-[11px] font-medium text-foreground/90 truncate">
            {branch.branchName}
          </span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/70 shrink-0 ml-1">
          {branch.warehouses.length} ta ombor
        </span>
      </button>

      {/* Omborlar ro'yxati */}
      {open && (
        <div className="pl-3.5 pr-1 py-0.5 space-y-0.5 bg-background/50">
          {branch.warehouses.map((wh) => {
            const isCurrent = selectedItem?.id === wh.id;
            return (
              <Button
                key={wh.id}
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
                  <span className="truncate">{wh.name}</span>
                </div>
                {isCurrent && <Check className="size-3 text-primary shrink-0 ml-1" />}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 1-daraja: Asosiy Kompaniya Akkordeoni (Expand / Collapse) ────────────────
function CompanySection({
  company,
  selectedItem,
  onSelect,
  forceOpen,
}: {
  company: CompanyGroup;
  selectedItem: WarehouseItem | null;
  onSelect: (item: WarehouseItem) => void;
  forceOpen: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(true);
  const open = forceOpen || isOpen;

  const totalWhCount =
    company.directWarehouses.length +
    company.branches.reduce((acc, b) => acc + b.warehouses.length, 0);

  return (
    <div className="rounded-md border border-border/70 overflow-hidden bg-card/80 space-y-0.5">
      {/* Asosiy Kompaniya Expand/Collapse Sarlavhasi */}
      <button
        type="button"
        onClick={() => setIsOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left cursor-pointer border-b border-border/40 select-none group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              "size-3 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-90"
            )}
          />
          {company.isYtt ? (
            <Briefcase className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <Building2 className="size-3 text-primary shrink-0" />
          )}
          <span className="text-[11px] font-semibold text-foreground truncate">
            {company.companyName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-background border border-border text-muted-foreground">
            {company.legalType}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/80">
            {totalWhCount} ta ombor
          </span>
        </div>
      </button>

      {/* Kompaniya ichidagi filiallar yoki omborlar */}
      {open && (
        <div className="p-1 space-y-1 bg-background">
          {/* MChJ Filiallari */}
          {company.branches.map((branch) => (
            <BranchSection
              key={branch.branchId}
              branch={branch}
              selectedItem={selectedItem}
              onSelect={onSelect}
              forceOpen={forceOpen}
            />
          ))}

          {/* To'g'ridan-to'g'ri omborlar (YTT yoki kompaniyaning markaziy ombori) */}
          {company.directWarehouses.map((wh) => {
            const isCurrent = selectedItem?.id === wh.id;
            return (
              <Button
                key={wh.id}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelect(wh)}
                className={cn(
                  "w-full justify-between h-6 px-2 text-xs font-normal hover:bg-accent/60 cursor-pointer pl-4",
                  isCurrent && "bg-accent/80 font-semibold text-primary"
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Warehouse className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{wh.name}</span>
                </div>
                {isCurrent && <Check className="size-3 text-primary shrink-0 ml-1" />}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Asosiy WarehouseSelect Komponenti ─────────────────────────────────────────
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

  const {
    companiesList,
    plants,
    warehousesList,
    loadCompanies,
    fetchPlants,
    loadWarehouses,
  } = useWorkspaceStore();

  React.useEffect(() => {
    if (companiesList.length === 0) {
      loadCompanies();
    }
    if (plants.length === 0) {
      fetchPlants();
    }
    if (warehousesList.length === 0) {
      loadWarehouses("PRINTGOO");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build 3-level tree: Company -> Branch -> Warehouses
  const groups = React.useMemo<CompanyGroup[]>(() => {
    const list: CompanyGroup[] = [];

    companiesList.forEach((company) => {
      const isYtt = company.legalType === "YTT";

      if (isYtt) {
        const directWhs: WarehouseItem[] = warehousesList
          .filter((w) => w.companyId === company.id)
          .map((w) => ({
            id: w.id,
            code: w.code,
            name: w.name,
            type: w.type || "general",
            branchId: null,
            companyId: company.id,
            companyName: company.name,
            fullLabel: `${company.name} • ${w.name}`,
          }));

        if (directWhs.length === 0) {
          directWhs.push({
            id: `wh-ytt-${company.id}`,
            code: `WH-STORE-${company.code}`,
            name: "Savdo ombori",
            type: "general",
            branchId: null,
            companyId: company.id,
            companyName: company.name,
            fullLabel: `${company.name} • Savdo ombori`,
          });
        }

        list.push({
          companyId: company.id,
          companyName: company.name,
          companyCode: company.code,
          legalType: "YTT",
          isYtt: true,
          branches: [],
          directWarehouses: directWhs,
        });
      } else {
        const companyBranches = plants.filter((p) => {
          if (p.companyId) return p.companyId === company.id;
          return company.code === "PRINTGOO";
        });

        const branchGroups: BranchGroup[] = [];

        companyBranches.forEach((branch) => {
          const bWhs: WarehouseItem[] = warehousesList
            .filter((w) => w.branchId === branch.id)
            .map((w) => ({
              id: w.id,
              code: w.code,
              name: w.name,
              type: w.type || "raw_materials",
              branchId: branch.id,
              branchName: branch.name,
              companyId: company.id,
              companyName: company.name,
              fullLabel: `${branch.name} • ${w.name}`,
            }));

          if (bWhs.length === 0) {
            bWhs.push({
              id: `wh-raw-${branch.id}`,
              code: `WH-RAW-${branch.code || "BRN"}`,
              name: "Xomashyo ombori",
              type: "raw_materials",
              branchId: branch.id,
              branchName: branch.name,
              companyId: company.id,
              companyName: company.name,
              fullLabel: `${branch.name} • Xomashyo ombori`,
            });
            bWhs.push({
              id: `wh-fg-${branch.id}`,
              code: `WH-FG-${branch.code || "BRN"}`,
              name: "Tayyor mahsulotlar ombori",
              type: "finished_goods",
              branchId: branch.id,
              branchName: branch.name,
              companyId: company.id,
              companyName: company.name,
              fullLabel: `${branch.name} • Tayyor mahsulotlar ombori`,
            });
          }

          branchGroups.push({
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
            warehouses: bWhs,
          });
        });

        const directWhs: WarehouseItem[] = warehousesList
          .filter((w) => w.companyId === company.id && !w.branchId)
          .map((w) => ({
            id: w.id,
            code: w.code,
            name: w.name,
            type: w.type || "general",
            branchId: null,
            companyId: company.id,
            companyName: company.name,
            fullLabel: `${company.name} • ${w.name}`,
          }));

        list.push({
          companyId: company.id,
          companyName: company.name,
          companyCode: company.code,
          legalType: company.legalType || "MChJ",
          isYtt: false,
          branches: branchGroups,
          directWarehouses: directWhs,
        });
      }
    });

    return list;
  }, [companiesList, plants, warehousesList]);

  // Flattened list for quick value matching
  const allWarehouses = React.useMemo<WarehouseItem[]>(() => {
    const res: WarehouseItem[] = [];
    groups.forEach((cg) => {
      res.push(...cg.directWarehouses);
      cg.branches.forEach((bg) => {
        res.push(...bg.warehouses);
      });
    });
    return res;
  }, [groups]);

  // Filter groups according to search input
  const isSearching = Boolean(searchQuery.trim());
  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((g) => {
        const companyMatches =
          g.companyName.toLowerCase().includes(q) ||
          g.companyCode.toLowerCase().includes(q);

        const matchingDirect = g.directWarehouses.filter(
          (w) =>
            companyMatches ||
            w.name.toLowerCase().includes(q) ||
            w.code.toLowerCase().includes(q) ||
            w.fullLabel.toLowerCase().includes(q)
        );

        const matchingBranches = g.branches
          .map((b) => {
            const branchMatches =
              companyMatches ||
              b.branchName.toLowerCase().includes(q) ||
              (b.branchCode && b.branchCode.toLowerCase().includes(q));

            const matchingWhs = b.warehouses.filter(
              (w) =>
                branchMatches ||
                w.name.toLowerCase().includes(q) ||
                w.code.toLowerCase().includes(q) ||
                w.fullLabel.toLowerCase().includes(q)
            );

            if (matchingWhs.length > 0) {
              return { ...b, warehouses: matchingWhs };
            }
            return null;
          })
          .filter(Boolean) as BranchGroup[];

        if (matchingDirect.length > 0 || matchingBranches.length > 0) {
          return {
            ...g,
            directWarehouses: matchingDirect,
            branches: matchingBranches,
          };
        }
        return null;
      })
      .filter(Boolean) as CompanyGroup[];
  }, [groups, searchQuery]);

  // Selected item lookup
  const selectedItem = React.useMemo(() => {
    if (warehouseId) {
      const found = allWarehouses.find((w) => w.id === warehouseId);
      if (found) return found;
    }

    if (value) {
      if (typeof value === "string") {
        const found = allWarehouses.find(
          (w) =>
            w.id === value ||
            w.name.toLowerCase() === value.toLowerCase() ||
            w.fullLabel.toLowerCase() === value.toLowerCase() ||
            w.code.toLowerCase() === value.toLowerCase()
        );
        if (found) return found;

        const partial = allWarehouses.find(
          (w) =>
            value.toLowerCase().includes(w.name.toLowerCase()) ||
            (w.branchName && value.toLowerCase().includes(w.branchName.toLowerCase()))
        );
        if (partial) return partial;
      } else if (typeof value === "object") {
        if (value.warehouseId) {
          const found = allWarehouses.find((w) => w.id === value.warehouseId);
          if (found) return found;
        }
        if (value.location) {
          const found = allWarehouses.find(
            (w) =>
              w.name.toLowerCase() === value.location?.toLowerCase() ||
              w.fullLabel.toLowerCase() === value.location?.toLowerCase()
          );
          if (found) return found;
        }
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
      branchName: item.branchName,
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
        {/* Search Input */}
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

        {/* Tree Container with Explicit Expand / Collapse on Companies & Branches */}
        <div className="max-h-[280px] overflow-y-auto space-y-1 pr-0.5">
          {filteredGroups.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Ombor topilmadi
            </div>
          ) : (
            filteredGroups.map((company) => (
              <CompanySection
                key={company.companyId}
                company={company}
                selectedItem={selectedItem}
                onSelect={handleSelect}
                forceOpen={isSearching}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
