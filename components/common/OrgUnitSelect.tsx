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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceStore } from "@/store/workspaceStore";

export interface OrgUnitItem {
  id: string;
  companyId: string;
  branchId: string | null;
  label: string;
  code: string;
  fullLabel: string;
  type: "ytt" | "branch" | "central";
}

export interface OrgUnitSelectValue {
  companyId: string;
  branchId: string | null;
  label: string;
  code?: string;
  legalType?: string;
}

export interface OrgUnitSelectProps {
  value?: string | { companyId?: string | null; branchId?: string | null } | null;
  companyId?: string | null;
  branchId?: string | null;
  onValueChange: (val: OrgUnitSelectValue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface OrgGroup {
  companyId: string;
  companyName: string;
  companyCode: string;
  legalType: string;
  isYtt: boolean;
  items: OrgUnitItem[];
}

// ─── 1-daraja: Asosiy Kompaniya Akkordeoni (Expand / Collapse) ────────────────
function OrgCompanySection({
  group,
  selectedItem,
  onSelect,
  forceOpen,
}: {
  group: OrgGroup;
  selectedItem: OrgUnitItem | null;
  onSelect: (item: OrgUnitItem) => void;
  forceOpen: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(true);
  const open = forceOpen || isOpen;

  // YTT: Filialsiz yuridik shaxs
  if (group.isYtt) {
    const item = group.items[0];
    const isCurrent = selectedItem?.id === item?.id;
    return (
      <div className="rounded-md border border-border/70 overflow-hidden bg-card/80">
        <button
          type="button"
          onClick={() => item && onSelect(item)}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 bg-muted/40 hover:bg-accent/60 transition-colors text-left cursor-pointer select-none group",
            isCurrent && "bg-accent/80 font-semibold"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-foreground truncate">
              {group.companyName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-background border border-border text-muted-foreground">
              YTT
            </span>
            {isCurrent && <Check className="size-3.5 text-primary shrink-0" />}
          </div>
        </button>
      </div>
    );
  }

  // MChJ / XK / AJ: Kompaniya va uning filiallari akkordeoni
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
          <Building2 className="size-3 text-primary shrink-0" />
          <span className="text-[11px] font-semibold text-foreground truncate">
            {group.companyName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-background border border-border text-muted-foreground">
            {group.legalType}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/80">
            {group.items.length} ta filial
          </span>
        </div>
      </button>

      {/* Kompaniya filiallari ro'yxati */}
      {open && (
        <div className="p-1 space-y-0.5 bg-background">
          {group.items.map((item) => {
            const isCurrent = selectedItem?.id === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelect(item)}
                className={cn(
                  "w-full justify-between h-6 px-1.5 text-xs font-normal hover:bg-accent/60 cursor-pointer pl-3.5",
                  isCurrent && "bg-accent/80 font-medium text-primary"
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.type === "branch" ? (
                    <GitFork className="size-3 text-blue-600 dark:text-blue-400 rotate-90 shrink-0" />
                  ) : (
                    <Building2 className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
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

// ─── Asosiy OrgUnitSelect Komponenti ──────────────────────────────────────────
export function OrgUnitSelect({
  value,
  companyId,
  branchId,
  onValueChange,
  placeholder = "Tashkilot yoki filialni tanlang...",
  className,
  disabled = false,
}: OrgUnitSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const {
    companiesList,
    plants,
    loadCompanies,
    fetchPlants,
  } = useWorkspaceStore();

  React.useEffect(() => {
    if (companiesList.length === 0) {
      loadCompanies();
    }
    if (plants.length === 0) {
      fetchPlants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = React.useMemo<OrgGroup[]>(() => {
    return companiesList.map((company) => {
      const isYtt = company.legalType === "YTT";
      const companyBranches = plants.filter((p) => {
        if (p.companyId) return p.companyId === company.id;
        return company.code === "PRINTGOO";
      });

      if (isYtt) {
        return {
          companyId: company.id,
          companyName: company.name,
          companyCode: company.code,
          legalType: "YTT",
          isYtt: true,
          items: [
            {
              id: `company-${company.id}`,
              companyId: company.id,
              branchId: null,
              label: company.name,
              code: company.code,
              fullLabel: `${company.name} (YTT)`,
              type: "ytt" as const,
            },
          ],
        };
      }

      const items: OrgUnitItem[] = [];
      if (companyBranches.length > 0) {
        for (const b of companyBranches) {
          items.push({
            id: `branch-${b.id}`,
            companyId: company.id,
            branchId: b.id,
            label: b.name,
            code: b.code || "",
            fullLabel: `${company.name} • ${b.name}`,
            type: "branch" as const,
          });
        }
      } else {
        items.push({
          id: `company-${company.id}`,
          companyId: company.id,
          branchId: null,
          label: `${company.name} (Bosh ofis)`,
          code: company.code,
          fullLabel: `${company.name} (Bosh ofis)`,
          type: "central" as const,
        });
      }

      return {
        companyId: company.id,
        companyName: company.name,
        companyCode: company.code,
        legalType: company.legalType || "MChJ",
        isYtt: false,
        items,
      };
    });
  }, [companiesList, plants]);

  const isSearching = Boolean(searchQuery.trim());
  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((g) => {
        const companyMatches =
          g.companyName.toLowerCase().includes(q) ||
          g.companyCode.toLowerCase().includes(q);

        const matchingItems = g.items.filter(
          (item) =>
            companyMatches ||
            item.label.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q)
        );

        if (matchingItems.length > 0) {
          return {
            ...g,
            items: matchingItems,
          };
        }
        return null;
      })
      .filter(Boolean) as OrgGroup[];
  }, [groups, searchQuery]);

  const selectedItem = React.useMemo(() => {
    const allItems = groups.flatMap((g) => g.items);

    if (branchId) {
      const found = allItems.find((i) => i.branchId === branchId);
      if (found) return found;
    }

    if (value) {
      if (typeof value === "string") {
        const found = allItems.find(
          (i) =>
            i.id === value ||
            i.branchId === value ||
            i.companyId === value ||
            i.label.toLowerCase() === value.toLowerCase() ||
            i.fullLabel.toLowerCase() === value.toLowerCase()
        );
        if (found) return found;
      } else if (typeof value === "object") {
        if (value.branchId) {
          const found = allItems.find((i) => i.branchId === value.branchId);
          if (found) return found;
        }
        if (value.companyId) {
          const found = allItems.find(
            (i) => i.companyId === value.companyId && i.branchId === null
          );
          if (found) return found;
        }
      }
    }

    if (companyId) {
      const found = allItems.find(
        (i) => i.companyId === companyId && i.branchId === null
      );
      if (found) return found;
    }

    return null;
  }, [groups, branchId, companyId, value]);

  const handleSelect = (item: OrgUnitItem) => {
    const parentGroup = groups.find((g) => g.companyId === item.companyId);
    onValueChange({
      companyId: item.companyId,
      branchId: item.branchId,
      label: item.fullLabel,
      code: item.code,
      legalType: parentGroup?.legalType,
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
              {selectedItem?.type === "ytt" ? (
                <Briefcase className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : selectedItem?.type === "branch" ? (
                <GitFork className="size-3.5 text-blue-600 dark:text-blue-400 rotate-90 shrink-0" />
              ) : (
                <Building2 className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate text-foreground font-medium">
                {selectedItem ? selectedItem.fullLabel : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-1.5 shadow-lg space-y-1.5" align="start">
        {/* Search Input */}
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-input bg-muted/20 text-xs">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Qidirish..."
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-xs"
          />
        </div>

        {/* Tree Container with Explicit Expand / Collapse on Companies */}
        <div className="max-h-[260px] overflow-y-auto space-y-1 pr-0.5">
          {filteredGroups.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Topilmadi
            </div>
          ) : (
            filteredGroups.map((group) => (
              <OrgCompanySection
                key={group.companyId}
                group={group}
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
