/**
 * REFERENCE TEMPLATE: Standard Registry / Table Page
 * Follows 100% shadcn/ui + Glide Data Grid + Radix Context Menu
 */
"use client";

import React, { useCallback, useState } from "react";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item,
  GridSelection,
  CompactSelection
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Download, Printer, Search, ExternalLink } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

const COLUMNS: GridColumn[] = [
  { id: "code", title: "Code", width: 110 },
  { id: "name", title: "Description", width: 280 },
  { id: "quantity", title: "Stock Qty", width: 120 },
  { id: "status", title: "Status", width: 120 },
];

export function ReferenceRegistryGrid() {
  const { openTab } = useWorkspaceStore();
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    return {
      kind: GridCellKind.Text,
      data: `Cell ${col}:${row}`,
      displayData: `Cell ${col}:${row}`,
      allowOverlay: true,
    };
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-950 select-none">
          {/* Toolbar */}
          <div className="h-10 border-b border-border bg-muted/40 px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1.5 shadow-none rounded">
                <Plus className="w-3.5 h-3.5" />
                <span>New Item (Ins)</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open (F12)</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="h-7 pl-8 text-xs bg-background" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getContent}
              columns={COLUMNS}
              rows={500}
              rowMarkers="both"
              freezeColumns={1}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              headerHeight={28}
              rowHeight={26}
            />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="text-xs">
        <ContextMenuItem>Open Item (F12)</ContextMenuItem>
        <ContextMenuItem>New Item (Ins)</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Copy Selection (Ctrl+C)</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
