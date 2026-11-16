"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2, Briefcase, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceStore } from "@/store/workspaceStore";

export interface OrgUnitSelectValue {
  companyId: string;
  /** Filiallar olib tashlangan — har doim null. Eski chaqiruvlar bilan moslik uchun saqlangan. */
  branchId: string | null;
  label: string;
  code?: string;
  legalType?: string;
}

export interface OrgUnitSelectProps {
  value?: string | { companyId?: string | null; branchId?: string | null } | null;
  companyId?: string | null;
  /** Eski ma'lumotlar uchun: tashkilot id si sifatida ham tekshiriladi. */
  branchId?: string | null;
  onValueChange: (val: OrgUnitSelectValue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function OrgUnitSelect({
  value,
  companyId,
  branchId,
  onValueChange,
  placeholder = "Tashkilotni tanlang...",
  className,
  disabled = false,
}: OrgUnitSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const { companiesList, loadCompanies } = useWorkspaceStore();

  React.useEffect(() => {
    if (companiesList.length === 0) loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return companiesList;
    return companiesList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q)
    );
  }, [companiesList, searchQuery]);

  const selected = React.useMemo(() => {
    const candidates: string[] = [];
    if (companyId) candidates.push(companyId);
    if (value && typeof value === "object") {
      if (value.companyId) candidates.push(value.companyId);
      if (value.branchId) candidates.push(value.branchId);
    }
    if (typeof value === "string" && value) candidates.push(value);
    if (branchId) candidates.push(branchId);

    for (const key of candidates) {
      const k = key.toLowerCase();
      const found = companiesList.find(
        (c) =>
          c.id === key ||
          c.name.toLowerCase() === k ||
          (c.code || "").toLowerCase() === k
      );
      if (found) return found;
    }
    return null;
  }, [companiesList, companyId, branchId, value]);

  const handleSelect = (id: string) => {
    const c = companiesList.find((x) => x.id === id);
    if (!c) return;
    onValueChange({
      companyId: c.id,
      branchId: null,
      label: c.name,
      code: c.code,
      legalType: c.legalType || undefined,
    });
    setOpen(false);
    setSearchQuery("");
  };

  const iconFor = (legalType?: string | null, size = "size-3.5") =>
    legalType === "YTT" ? (
      <Briefcase className={cn(size, "text-muted-foreground shrink-0")} />
    ) : (
      <Building2 className={cn(size, "text-muted-foreground shrink-0")} />
    );

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
              !selected && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              {iconFor(selected?.legalType)}
              <span className={cn("truncate", selected && "text-foreground font-medium")}>
                {selected ? selected.name : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[300px] p-1 space-y-1" align="start">
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

        <div className="max-h-[260px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">Topilmadi</div>
          ) : (
            filtered.map((c) => {
              const isCurrent = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    "w-full h-7 flex items-center justify-between gap-2 px-2 rounded text-xs text-left hover:bg-accent/60 cursor-pointer",
                    isCurrent && "bg-accent/80 font-medium"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {iconFor(c.legalType, "size-3")}
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {c.legalType || "MChJ"}
                    </span>
                    {isCurrent && <Check className="size-3.5 text-primary" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
