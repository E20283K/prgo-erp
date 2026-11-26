"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { SpreadsheetImportDialog, type ImportPreviewColumn } from "./SpreadsheetImportDialog";
import {
  buildStockTemplateCsv,
  buildStockTemplateXlsx,
  validateRows,
  CATEGORY_OPTIONS,
  UNIT_OPTIONS,
  type ParsedStockRow,
} from "@/components/documents/warehouse/utils/stockImport";
import type { RawTable } from "@/components/documents/warehouse/utils/tableImport";

interface StockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const unitLabel = (v: string) => UNIT_OPTIONS.find((u) => u.value === v)?.label || v;
const categoryLabel = (v: string) => CATEGORY_OPTIONS.find((c) => c.value === v)?.label || v;
const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

const PREVIEW_COLUMNS: ImportPreviewColumn<ParsedStockRow>[] = [
  { header: "SKU", className: "font-mono", render: (r) => r.data.sku || muted("Avto") },
  { header: "Nomi", render: (r) => r.data.name },
  { header: "Kategoriya", render: (r) => categoryLabel(r.data.category) },
  { header: "Ombor", render: (r) => r.data.location || muted("—") },
  { header: "Miqdor", className: "font-mono text-right", render: (r) => r.data.stockLevel.toLocaleString() },
  { header: "Birlik", render: (r) => unitLabel(r.data.unit) },
];

export function StockImportDialog({ open, onOpenChange }: StockImportDialogProps) {
  const { warehousesList, warehouseStock, loadWarehouses, loadWarehouseStock } = useWorkspaceStore();

  useEffect(() => {
    if (open && (warehousesList || []).length === 0 && loadWarehouses) void loadWarehouses();
  }, [open, warehousesList, loadWarehouses]);

  const warehouses = useMemo(
    () => (warehousesList || []).filter((w: any) => w?.name).map((w: any) => ({ name: String(w.name) })),
    [warehousesList]
  );

  const validate = useCallback(
    (table: RawTable) => validateRows(table, { warehouses, existingStock: warehouseStock || [] }),
    [warehouses, warehouseStock]
  );

  return (
    <SpreadsheetImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Qoldiq importi"
      templateName="ombor_qoldiq_shablon"
      buildXlsx={() => buildStockTemplateXlsx(warehouses)}
      buildCsv={buildStockTemplateCsv}
      validate={validate}
      previewColumns={PREVIEW_COLUMNS}
      endpoint="/api/v1/warehouse/stock/import?company=PRINTGOO"
      onImported={() => loadWarehouseStock()}
    />
  );
}
