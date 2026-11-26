"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { SpreadsheetImportDialog, type ImportPreviewColumn } from "./SpreadsheetImportDialog";
import {
  buildFgTemplateCsv,
  buildFgTemplateXlsx,
  pickFgWarehouses,
  validateFgRows,
  FG_UNIT_OPTIONS,
  type ParsedFgRow,
} from "@/components/documents/warehouse/utils/fgImport";
import type { RawTable } from "@/components/documents/warehouse/utils/tableImport";

interface FgImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const unitLabel = (v: string) => FG_UNIT_OPTIONS.find((u) => u.value === v)?.label || v;
const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

const PREVIEW_COLUMNS: ImportPreviewColumn<ParsedFgRow>[] = [
  { header: "SKU", className: "font-mono", render: (r) => r.data.sku || muted("Avto") },
  { header: "Mijoz", render: (r) => r.data.customerName },
  { header: "Mahsulot", render: (r) => r.data.productName },
  { header: "Miqdor", className: "font-mono text-right", render: (r) => r.data.quantity.toLocaleString() },
  { header: "Birlik", render: (r) => unitLabel(r.data.unit) },
  {
    header: "Tannarx",
    className: "font-mono text-right",
    render: (r) => (r.data.costPricePerUnit !== undefined ? r.data.costPricePerUnit.toLocaleString() : muted("—")),
  },
];

/** Tayyor mahsulot boshlang'ich qoldig'ini Excel/CSV fayldan ommaviy kiritish */
export function FgImportDialog({ open, onOpenChange }: FgImportDialogProps) {
  const { crmCustomers, warehousesList, finishedGoods, loadCrmCustomers, loadWarehouses, loadFinishedGoods } =
    useWorkspaceStore();

  useEffect(() => {
    if (!open) return;
    if ((crmCustomers || []).length === 0 && loadCrmCustomers) void loadCrmCustomers();
    if ((warehousesList || []).length === 0 && loadWarehouses) void loadWarehouses();
  }, [open, crmCustomers, warehousesList, loadCrmCustomers, loadWarehouses]);

  const customers = useMemo(
    () =>
      (crmCustomers || [])
        .filter((c: any) => c?.name)
        .map((c: any) => ({ name: String(c.name), dbId: c.dbId ? String(c.dbId) : null })),
    [crmCustomers]
  );
  const warehouses = useMemo(
    () =>
      pickFgWarehouses<any>(warehousesList || [])
        .filter((w: any) => w?.name)
        .map((w: any) => ({ name: String(w.name) })),
    [warehousesList]
  );

  const validate = useCallback(
    (table: RawTable) => validateFgRows(table, { customers, warehouses, finishedGoods: (finishedGoods || []) as any[] }),
    [customers, warehouses, finishedGoods]
  );

  return (
    <SpreadsheetImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tayyor mahsulot importi"
      templateName="tayyor_mahsulot_shablon"
      buildXlsx={() => buildFgTemplateXlsx({ customers, warehouses })}
      buildCsv={buildFgTemplateCsv}
      validate={validate}
      previewColumns={PREVIEW_COLUMNS}
      endpoint="/api/v1/warehouse/finished-goods/import?company=PRINTGOO"
      onImported={() => loadFinishedGoods()}
    />
  );
}
