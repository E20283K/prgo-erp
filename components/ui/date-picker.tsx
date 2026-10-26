"use client";

import * as React from "react";
import { format, parseISO, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string | Date;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  formatString?: string;
}

export function DatePicker({
  id,
  name,
  value,
  onChange,
  placeholder = "Sanani tanlang",
  className,
  disabled = false,
  readOnly = false,
  formatString = "dd.MM.yyyy",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      let parsed = parseISO(trimmed);
      if (isValid(parsed)) return parsed;
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
        parsed = parse(trimmed, "dd.MM.yyyy", new Date());
        if (isValid(parsed)) return parsed;
      }
      parsed = new Date(trimmed);
      if (isValid(parsed)) return parsed;
    }
    return undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.("");
    } else {
      onChange?.(format(date, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  const isDisabled = disabled || readOnly;

  return (
    <Popover open={open && !isDisabled} onOpenChange={(val) => !isDisabled && setOpen(val)}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            name={name}
            type="button"
            variant="outline"
            disabled={isDisabled}
            className={cn(
              "h-8 w-full justify-start text-left font-normal text-xs px-2 shadow-none min-w-0 truncate bg-background",
              !selectedDate && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">
          {selectedDate ? format(selectedDate, formatString || "dd.MM.yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-border shadow-lg z-50" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
