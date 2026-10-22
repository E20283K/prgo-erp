"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface FieldComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onAddNew?: (newValue: string) => void;
  allowCustom?: boolean;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  actionLabel?: string;
  onAction?: (searchValue?: string) => void;
  actionIcon?: React.ComponentType<{ className?: string }>;
  addCustomLabel?: string | ((val: string) => string);
}

export function FieldCombobox({
  value,
  onChange,
  onAddNew,
  allowCustom = false,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  popoverClassName,
  disabled = false,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  addCustomLabel,
}: FieldComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const selected = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());

  const exactMatch = options.some(
    (o) => o.value.toLowerCase() === searchValue.trim().toLowerCase() ||
           o.label.toLowerCase() === searchValue.trim().toLowerCase()
  );

  const handleAddCustom = (newVal: string) => {
    const clean = newVal.trim();
    if (!clean) return;
    onChange(clean);
    onAddNew?.(clean);
    setOpen(false);
    setSearchValue("");
  };

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal text-sm shadow-none",
              !value && "text-muted-foreground",
              disabled && "opacity-75 cursor-not-allowed hover:border-border",
              className
            )}
          >
            <span className="truncate">
              {selected ? selected.label : value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent
        className={cn("w-(--anchor-width) p-0 overflow-hidden shadow-lg border border-border flex flex-col", popoverClassName)}
        align="start"
        sideOffset={4}
      >
        <Command className="w-full flex flex-col">
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-56">
            <CommandEmpty>
              {allowCustom && searchValue.trim() ? (
                <button
                  type="button"
                  onClick={() => handleAddCustom(searchValue)}
                  className="flex items-center justify-center gap-1.5 w-full py-1 text-primary font-medium hover:underline cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {typeof addCustomLabel === "function"
                      ? addCustomLabel(searchValue.trim())
                      : addCustomLabel
                      ? `${addCustomLabel}: "${searchValue.trim()}"`
                      : `Add: "${searchValue.trim()}"`}
                  </span>
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(current) => {
                    onChange(current === value ? "" : current);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  data-checked={value === option.value}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}

              {allowCustom && searchValue.trim() && !exactMatch && (
                <CommandItem
                  value={searchValue.trim()}
                  onSelect={() => handleAddCustom(searchValue)}
                  className="py-1.5 px-2 text-xs cursor-pointer text-primary font-medium flex items-center gap-1.5 border-t border-border mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {typeof addCustomLabel === "function"
                      ? addCustomLabel(searchValue.trim())
                      : addCustomLabel
                      ? `${addCustomLabel}: "${searchValue.trim()}"`
                      : `Add: "${searchValue.trim()}"`}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>

          {onAction && actionLabel && (
            <div className="p-1 border-t border-border bg-muted/40 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onAction(searchValue.trim());
                }}
                className="w-full justify-start text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 h-7.5 gap-1.5 cursor-pointer rounded px-2"
              >
                {ActionIcon ? <ActionIcon className="w-3.5 h-3.5 shrink-0" /> : <Plus className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">
                  {searchValue.trim() ? `${actionLabel}: "${searchValue.trim()}"` : actionLabel}
                </span>
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
