"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface SupplierItem {
  id?: string;
  name: string;
  category?: string;
  phone?: string;
}

interface SupplierSelectProps {
  value?: string;
  onValueChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SupplierSelect({
  value = "",
  onValueChange,
  placeholder = "Yetkazib beruvchini tanlang...",
  className,
  disabled = false,
}: SupplierSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { suppliers, loadSuppliers } = useWorkspaceStore();

  React.useEffect(() => {
    if (!suppliers || suppliers.length === 0) {
      loadSuppliers();
    }
  }, [suppliers, loadSuppliers]);

  const items = React.useMemo<SupplierItem[]>(() => {
    const list: SupplierItem[] = (suppliers || []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || "",
      phone: s.phone || "",
    }));

    if (value && !list.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      list.unshift({
        name: value,
        category: "Mavjud",
      });
    }

    return list;
  }, [suppliers, value]);

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const selectedItem = items.find(
    (item) => item.name.toLowerCase() === (value || "").toLowerCase()
  );

  const handleSelect = (name: string) => {
    onValueChange(name);
    setOpen(false);
    setSearchQuery("");
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
              "w-full h-7 px-2.5 justify-between text-xs font-normal bg-background hover:bg-muted/30 border-input shadow-none",
              !value && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <Building2 className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground font-medium">
                {selectedItem ? selectedItem.name : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-1.5 shadow-lg space-y-1.5" align="start">
        {/* Real Search Input */}
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-input bg-muted/20 text-xs">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Yetkazib beruvchini qidirish..."
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-xs"
            autoFocus
          />
        </div>

        {/* Suppliers List */}
        <div className="max-h-[240px] overflow-y-auto space-y-0.5 pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Yetkazib beruvchi topilmadi
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected =
                value && item.name.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={item.id || item.name}
                  type="button"
                  onClick={() => handleSelect(item.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-left cursor-pointer transition-colors hover:bg-accent/60",
                    isSelected && "bg-accent font-semibold text-primary"
                  )}
                >
                  <div className="flex flex-col min-w-0 flex-1 pr-1">
                    <span className="truncate font-medium text-foreground">
                      {item.name}
                    </span>
                    {(item.category || item.phone) && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {[item.category, item.phone].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-primary shrink-0 ml-1" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
