"use client";

import React, { useState, useEffect, useRef } from "react";
import { GridCell, GridCellKind } from "@glideapps/glide-data-grid";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface GridComboboxEditorProps {
  value: GridCell;
  onChange: (newValue: GridCell) => void;
  onFinishedEditing: (newValue?: GridCell, movement?: readonly [-1 | 0 | 1, -1 | 0 | 1]) => void;
  options: string[];
  placeholder?: string;
}

export function GridComboboxEditor({
  value,
  onChange,
  onFinishedEditing,
  options,
  placeholder = "Select or type...",
}: GridComboboxEditorProps) {
  const initialText = (value.kind === GridCellKind.Text || value.kind === GridCellKind.Number) 
    ? String(value.data ?? "") 
    : "";

  const [search, setSearch] = useState(initialText);
  const [isOpen, setIsOpen] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSelect = (selectedValue: string) => {
    const updatedCell: GridCell = {
      ...value,
      kind: GridCellKind.Text,
      data: selectedValue,
      displayData: selectedValue,
    };
    onChange(updatedCell);
    onFinishedEditing(updatedCell, [0, 1]); // Move down on enter
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => 
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        // Use typed text
        handleSelect(search);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onFinishedEditing();
    } else if (e.key === "Tab") {
      // Commit and move to next column
      const chosen = (isOpen && filteredOptions[highlightedIndex]) ? filteredOptions[highlightedIndex] : search;
      const updatedCell: GridCell = {
        ...value,
        kind: GridCellKind.Text,
        data: chosen,
        displayData: chosen,
      };
      onChange(updatedCell);
      onFinishedEditing(updatedCell, [e.shiftKey ? -1 : 1, 0]);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center bg-white dark:bg-zinc-950 font-sans text-xs"
    >
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
          onChange({
            ...value,
            kind: GridCellKind.Text,
            data: e.target.value,
            displayData: e.target.value,
          });
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-full px-2 pr-6 text-xs bg-transparent border-2 border-blue-500 rounded-none outline-none font-medium text-foreground"
      />
      
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-1 text-muted-foreground hover:text-foreground p-0.5"
      >
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div 
          className="absolute left-0 top-[100%] mt-0.5 min-w-[240px] max-w-[360px] max-h-56 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-md shadow-xl z-[9999] py-1 select-none animate-in fade-in-50 zoom-in-95"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
              No matching options. Press Enter to use &quot;{search}&quot;.
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt === search;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={opt}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors",
                    isHighlighted ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/60",
                    isSelected && "text-blue-600 dark:text-blue-400 font-semibold"
                  )}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
