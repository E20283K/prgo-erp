"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export interface ComboboxItem {
  value: string;
  label: string;
  code?: string;
  description?: string;
  badge?: string;
  group?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SmartComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  onAddNew?: (newValue: string) => void;
  options: (ComboboxItem | string)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  className?: string;
  popoverWidth?: string;
  disabled?: boolean;
}

export function SmartCombobox({
  value,
  onChange,
  onAddNew,
  options,
  placeholder = "Tanlang...",
  searchPlaceholder = "Qidirish...",
  emptyText = "Hech narsa topilmadi",
  allowCustom = true,
  className,
  popoverWidth,
  disabled = false,
}: SmartComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Normalize options to ComboboxItem
  const normalizedOptions: ComboboxItem[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Robust selected item matching: by value, label, or code
  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const lowerVal = value.toLowerCase().trim();
    return normalizedOptions.find(
      (o) =>
        o.value.toLowerCase() === lowerVal ||
        o.label.toLowerCase() === lowerVal ||
        (o.code && o.code.toLowerCase() === lowerVal)
    );
  }, [normalizedOptions, value]);

  const isUuid = React.useMemo(() => {
    return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()));
  }, [value]);

  const displayLabel = selected ? selected.label : (isUuid ? placeholder : value || placeholder);
  const isPlaceholder = !selected && (!value || isUuid);

  // Instant, responsive filtering in React (avoids cmdk prefix score drops on IDs/UUIDs)
  const filteredOptions = React.useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(query);
      const descMatch = opt.description?.toLowerCase().includes(query);
      const badgeMatch = opt.badge?.toLowerCase().includes(query);
      const codeMatch = opt.code?.toLowerCase().includes(query);
      const valueMatch = opt.value.toLowerCase().includes(query);
      return labelMatch || descMatch || badgeMatch || codeMatch || valueMatch;
    });
  }, [normalizedOptions, searchValue]);

  // Group items if any item has a `group` defined
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, ComboboxItem[]> = {};
    filteredOptions.forEach((opt) => {
      const key = opt.group || "";
      if (!groups[key]) groups[key] = [];
      groups[key].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  // Check if current search matches any existing option exactly
  const exactMatch = normalizedOptions.some(
    (o) =>
      o.value.toLowerCase() === searchValue.trim().toLowerCase() ||
      o.label.toLowerCase() === searchValue.trim().toLowerCase()
  );

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-between px-2.5 font-normal text-xs bg-card hover:bg-accent/40 border border-input shadow-none transition-colors",
              !selected && !value && "text-muted-foreground",
              disabled && "opacity-60 cursor-not-allowed hover:bg-card",
              className
            )}
          />
        }
      >
        <div className="flex items-center gap-1.5 truncate text-left flex-1 min-w-0">
          {selected?.icon && (
            <selected.icon className="size-3.5 shrink-0 text-primary" />
          )}
          <span className={cn("truncate", isPlaceholder ? "text-muted-foreground font-normal" : "font-medium text-foreground")}>
            {displayLabel}
          </span>
          {selected?.code && (
            <span className="text-[10px] font-mono px-1 py-0 rounded bg-muted border border-border text-muted-foreground shrink-0 hidden sm:inline-block">
              {selected.code}
            </span>
          )}
        </div>
        <ChevronsUpDown className="ml-1.5 size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "p-0 gap-0 border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden",
          popoverWidth || "w-72 min-w-[260px]"
        )}
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="w-full border-none p-0 bg-transparent">
          {/* Qidiruv qatori */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                title="Tozalash"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Umumiy miqdor ko'rsatkichi */}
          {normalizedOptions.length > 4 && (
            <div className="flex items-center justify-between px-2.5 py-1 text-[10px] text-muted-foreground bg-muted/10 border-b border-border/40 font-mono">
              <span>Jami: {normalizedOptions.length} ta</span>
              {searchValue.trim() && (
                <span>Mos keldi: {filteredOptions.length} ta</span>
              )}
            </div>
          )}

          <CommandList className="max-h-60 p-1 overflow-y-auto no-scrollbar">
            {filteredOptions.length === 0 ? (
              <CommandEmpty className="py-6 px-3 text-center text-xs text-muted-foreground">
                {emptyText}
              </CommandEmpty>
            ) : (
              Object.entries(groupedOptions).map(([groupName, items]) => (
                <CommandGroup
                  key={groupName || "all"}
                  heading={groupName || undefined}
                  className="p-0.5"
                >
                  {items.map((opt) => {
                    const isSelected = selected?.value === opt.value;
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        data-checked={isSelected}
                        onSelect={() => {
                          onChange(opt.value);
                          setOpen(false);
                          setSearchValue("");
                        }}
                        className={cn(
                          "py-1.5 px-2 text-xs rounded cursor-pointer flex items-center justify-between gap-2 transition-colors [&>svg:last-child]:hidden",
                          isSelected
                            ? "bg-accent/80 font-medium text-foreground"
                            : "hover:bg-accent/50 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {opt.icon && (
                            <opt.icon
                              className={cn(
                                "size-3.5 shrink-0",
                                isSelected ? "text-primary" : "text-muted-foreground"
                              )}
                            />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{opt.label}</span>
                              {opt.code && (
                                <span className="text-[9px] font-mono px-1 py-0 rounded bg-muted text-muted-foreground border border-border/60 shrink-0">
                                  {opt.code}
                                </span>
                              )}
                            </div>
                            {opt.description && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {opt.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded border border-border bg-muted/60 text-muted-foreground shrink-0">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            )}

            {/* Qo'lda yangi qiymat qo'shish (allowCustom true bo'lsa) */}
            {allowCustom && searchValue.trim() && !exactMatch && (
              <div className="p-1 border-t border-border mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const clean = searchValue.trim();
                    onChange(clean);
                    onAddNew?.(clean);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-primary font-medium hover:bg-accent/60 rounded cursor-pointer transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>&quot;{searchValue.trim()}&quot; sifatida qo&apos;shish</span>
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
