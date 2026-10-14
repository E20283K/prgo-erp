"use client";

import * as React from "react";
import { cn } from "cn";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export interface ComboboxItem {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SmartComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  onAddNew?: (newValue: string) => void;
  options: (ComboboxItem | string)[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  className?: string;
  popoverWidth?: string;
}

export function SmartCombobox({
  value,
  onChange,
  onAddNew,
  options,
  placeholder = "Select or type...",
  searchPlaceholder = "Search...",
  allowCustom = true,
  className,
  popoverWidth,
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

  const selected = normalizedOptions.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
  const displayLabel = selected ? selected.label : value || placeholder;

  // Check if current search matches any existing option
  const exactMatch = normalizedOptions.some(
    (o) => o.value.toLowerCase() === searchValue.trim().toLowerCase() ||
           o.label.toLowerCase() === searchValue.trim().toLowerCase()
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
            className={cn(
              "h-8 w-full justify-between px-2.5 font-normal text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-none hover:border-blue-400 dark:hover:border-blue-500 transition-colors",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <div className="flex items-center gap-1.5 truncate text-left flex-1 font-medium text-foreground min-w-0">
          {selected?.icon && <selected.icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate">{displayLabel}</span>
        </div>
        <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-(--anchor-width) min-w-[220px] p-0 shadow-lg border border-border bg-popover", popoverWidth)}
        align="start"
        sideOffset={4}
      >
        <Command className="w-full">
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-8 text-xs"
          />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-2.5 px-3 text-center text-xs text-muted-foreground">
              {allowCustom && searchValue.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    const clean = searchValue.trim();
                    onChange(clean);
                    onAddNew?.(clean);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Use &quot;{searchValue.trim()}&quot;</span>
                </button>
              ) : (
                "No results found."
              )}
            </CommandEmpty>

            <CommandGroup>
              {normalizedOptions.map((opt) => {
                const isSelected = (value || "").toLowerCase() === opt.value.toLowerCase();
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.value} ${opt.label} ${opt.description || ""}`}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="py-1.5 px-2 text-xs cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {opt.icon && <opt.icon className="size-3.5 shrink-0 text-muted-foreground" />}
                        <span className={cn("font-medium", isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground")}>
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="text-[9px] px-1 py-0 rounded border border-border bg-muted/60 text-muted-foreground">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{opt.description}</span>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-3.5 w-3.5 text-blue-600 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                );
              })}

              {/* Allow direct custom creation item if typed value doesn't match */}
              {allowCustom && searchValue.trim() && !exactMatch && (
                <CommandItem
                  value={searchValue.trim()}
                  onSelect={() => {
                    const clean = searchValue.trim();
                    onChange(clean);
                    onAddNew?.(clean);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="py-1.5 px-2 text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5 border-t border-border mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add custom: &quot;{searchValue.trim()}&quot;</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
