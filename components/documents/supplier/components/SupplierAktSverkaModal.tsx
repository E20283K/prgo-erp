"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Printer, Download, X } from "lucide-react";
import type { SupplierRecord, SupplierLedgerEntry } from "@/lib/server/supplierService";

interface SupplierAktSverkaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierRecord;
  ledger: SupplierLedgerEntry[];
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  startDate?: string;
  endDate?: string;
}

export function SupplierAktSverkaModal({
  open,
  onOpenChange,
  supplier,
  ledger,
  totalCredit,
  totalDebit,
  closingBalance,
  startDate = "2026-01-01",
  endDate = new Date().toISOString().split("T")[0],
}: SupplierAktSverkaModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    const content = printAreaRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Akt-sverka — ${supplier.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 0; }
            h1 { font-size: 15pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; }
            .subtitle { font-size: 10pt; text-align: center; color: #555; margin-bottom: 16px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt; }
            .meta-table td { padding: 4px 6px; vertical-align: top; }
            .meta-label { font-weight: bold; color: #444; width: 22%; }
            .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt; }
            .grid-table th, .grid-table td { border: 1px solid #444; padding: 5px 6px; }
            .grid-table th { background: #f2f2f2; font-weight: bold; text-align: center; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row { font-weight: bold; background: #fafafa; }
            .signatures { width: 100%; margin-top: 36px; border-collapse: collapse; font-size: 10pt; }
            .signatures td { width: 50%; vertical-align: top; padding: 0 12px; }
            .sig-line { margin-top: 45px; border-bottom: 1px solid #111; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const curr = supplier.currency || "UZS";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold">
              O'zaro hisob-kitoblarni solishtirish dalolatnomasi (Akt-sverka)
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ta'minotchi: {supplier.name} | Davr: {startDate} — {endDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="w-3.5 h-3.5" />
              <span>Chop etish (A4)</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Paper Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-100 dark:bg-zinc-950/50">
          <div
            ref={printAreaRef}
            className="max-w-[760px] mx-auto bg-white text-zinc-900 p-8 shadow-sm border border-zinc-200 rounded-sm font-sans"
          >
            <h1 className="text-center font-bold text-base uppercase tracking-tight mb-1">
              O'ZARO HISOB-KITOBLARNI SOLISHTIRISH DALOLATNOMASI
            </h1>
            <p className="text-center text-xs text-zinc-600 mb-6">
              davr: {startDate} yildan {endDate} yilgacha
            </p>

            <p className="text-xs leading-relaxed mb-4 text-justify">
              Biz, quyida imzo chekuvchilar, bir tomondan <strong>«PRINTGOO» MChJ</strong> (Buyurtmachi),
              ikkinchi tomondan <strong>{supplier.legalName || supplier.name}</strong> (Ta'minotchi / Pudratchi),
              ushbu dalolatnomani tuzdik, shu haqdakim, yuqorida ko'rsatilgan davr uchun tomonlar
              o'rtasidagi hisob-kitoblar holati quyidagicha:
            </p>

            <table className="w-full text-xs border-collapse mb-4 border border-zinc-400">
              <thead>
                <tr className="bg-zinc-100 font-semibold text-zinc-800">
                  <th className="border border-zinc-400 p-1.5 text-center w-8">№</th>
                  <th className="border border-zinc-400 p-1.5 text-center w-24">Sana</th>
                  <th className="border border-zinc-400 p-1.5 text-center w-28">Hujjat №</th>
                  <th className="border border-zinc-400 p-1.5 text-left">Operatsiya / Mazmuni</th>
                  <th className="border border-zinc-400 p-1.5 text-right w-28">
                    Biz to'ladik (-Debet)
                  </th>
                  <th className="border border-zinc-400 p-1.5 text-right w-28">
                    Yetkazildi (+Kredit)
                  </th>
                  <th className="border border-zinc-400 p-1.5 text-right w-28">
                    Qoldiq Qarzimiz
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-zinc-400 p-4 text-center text-zinc-500 italic">
                      Ushbu davrda hisob-kitob operatsiyalari mavjud emas.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-zinc-50">
                      <td className="border border-zinc-400 p-1.5 text-center font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-center font-mono text-[11px]">
                        {entry.date}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-center font-mono text-[11px] font-semibold">
                        {entry.docNo}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-left text-[11px]">
                        {entry.description}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-right font-mono text-[11px]">
                        {entry.debit > 0
                          ? `${entry.debit.toLocaleString("uz-UZ")} ${curr}`
                          : "-"}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-right font-mono text-[11px]">
                        {entry.credit > 0
                          ? `${entry.credit.toLocaleString("uz-UZ")} ${curr}`
                          : "-"}
                      </td>
                      <td className="border border-zinc-400 p-1.5 text-right font-mono text-[11px] font-bold">
                        {entry.balance.toLocaleString("uz-UZ")} {curr}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-500">
                  <td colSpan={4} className="border border-zinc-400 p-1.5 text-right">
                    Jami aylanma:
                  </td>
                  <td className="border border-zinc-400 p-1.5 text-right font-mono">
                    {totalDebit.toLocaleString("uz-UZ")} {curr}
                  </td>
                  <td className="border border-zinc-400 p-1.5 text-right font-mono">
                    {totalCredit.toLocaleString("uz-UZ")} {curr}
                  </td>
                  <td className="border border-zinc-400 p-1.5 text-right font-mono text-zinc-900 font-extrabold">
                    {closingBalance.toLocaleString("uz-UZ")} {curr}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bg-zinc-50 border border-zinc-300 p-3 rounded text-xs mb-8">
              <strong>Xulosa:</strong> {endDate} holatiga ko'ra «PRINTGOO» MChJ ning{" "}
              <strong>{supplier.name}</strong> oldidagi qarzdorligi:{" "}
              <span className="font-bold underline text-sm">
                {closingBalance.toLocaleString("uz-UZ")} {curr}
              </span>{" "}
              ni tashkil etadi.
            </div>

            <table className="w-full text-xs mt-8">
              <tbody>
                <tr>
                  <td className="w-1/2 pr-6 align-top">
                    <p className="font-bold">«PRINTGOO» MChJ nomidan:</p>
                    <p className="text-zinc-600">Bosh buxgalter / Direktor</p>
                    <div className="mt-12 border-b border-zinc-800 w-48" />
                    <p className="mt-1 text-[11px] text-zinc-500">(imzo, F.I.Sh, muhr)</p>
                  </td>
                  <td className="w-1/2 pl-6 align-top">
                    <p className="font-bold">{supplier.name} nomidan:</p>
                    <p className="text-zinc-600">
                      {supplier.contactPerson || "Mas'ul vakil"}
                    </p>
                    <div className="mt-12 border-b border-zinc-800 w-48" />
                    <p className="mt-1 text-[11px] text-zinc-500">(imzo, F.I.Sh, muhr)</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="p-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
