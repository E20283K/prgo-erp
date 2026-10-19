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
import { CrmCustomerRecord, ClientSettlementRecord } from "@/store/workspaceStore";

interface AktSverkaPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CrmCustomerRecord;
  settlement: ClientSettlementRecord | null;
  startDate?: string;
  endDate?: string;
}

export function AktSverkaPrintModal({
  open,
  onOpenChange,
  customer,
  settlement,
  startDate = "2026-01-01",
  endDate = "2026-12-31",
}: AktSverkaPrintModalProps) {
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
          <title>Akt Sverka - ${customer.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #111; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
            th, td { border: 1px solid #777; padding: 4px 6px; font-size: 10.5px; }
            th { background: #f0f0f0; text-align: center; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .font-mono { font-family: monospace; }
            .header-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
            .header-subtitle { text-align: center; font-size: 11px; margin-bottom: 12px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px; font-size: 11px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 25px; page-break-inside: avoid; }
            .sign-line { border-bottom: 1px solid #222; height: 35px; margin-top: 10px; }
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
    }, 300);
  };

  const ledger = settlement?.ledger || [];
  let runningSaldo = settlement?.openingBalance || 0;
  const ledgerWithSaldo = ledger.map((row, idx) => {
    runningSaldo = Number((runningSaldo + row.debit - row.credit).toFixed(2));
    return { ...row, idx: idx + 1, runningSaldo };
  });

  const totalDebit = settlement?.totalDebit || 0;
  const totalCredit = settlement?.totalCredit || 0;
  const closingBalance = settlement?.closingBalance || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border bg-muted/40 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            <span>O&apos;zaro hisob-kitoblar solishtirma dalolatnomasi (Akt Sverka)</span>
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Printable Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-white text-zinc-900 select-text">
          <div ref={printAreaRef} className="space-y-4 text-xs font-sans">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold tracking-wide uppercase">
                O&apos;ZARO HISOB-KITOBLARNI SOLISHTIRMA DALOLATNOMASI
              </h2>
              <p className="text-[11px] text-zinc-600">
                Davr: <strong>{startDate}</strong> dan <strong>{endDate}</strong> gacha holatiga
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] border p-3 rounded bg-zinc-50 border-zinc-300">
              <div className="space-y-1">
                <div className="font-bold text-zinc-800">Ijrochi / Xizmat ko&apos;rsatuvchi:</div>
                <div className="font-semibold">&ldquo;PRINTGOO ERP SOLUTIONS&rdquo; MCHJ</div>
                <div>STIR (INN): 308991200</div>
                <div>Bank: ATB &ldquo;Ipoteka Bank&rdquo; Yunusobod filiali</div>
                <div>H/r: 20208000900501234001, MFO: 00450</div>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-zinc-800">Buyurtmachi / Mijoz:</div>
                <div className="font-semibold">{customer.name}</div>
                <div>STIR (INN): {customer.tin}</div>
                <div>Shartnoma: {customer.contractNo}</div>
                <div>Aloqa: {customer.contactPerson} ({customer.phone})</div>
              </div>
            </div>

            <div className="text-[11px]">
              Biz, quyida imzo chekuvchilar, &ldquo;PRINTGOO&rdquo; MCHJ va {customer.name} o&apos;rtasida{" "}
              <strong>{customer.contractNo}</strong> sonli shartnoma bo&apos;yicha o&apos;zaro hisob-kitoblar holatini
              quyidagicha tasdiqlaymiz:
            </div>

            {/* Table */}
            <table className="w-full border-collapse border border-zinc-400 text-[11px]">
              <thead>
                <tr className="bg-zinc-100 font-bold">
                  <th className="border border-zinc-300 p-1 text-center w-8">№</th>
                  <th className="border border-zinc-300 p-1 text-center w-20">Sana</th>
                  <th className="border border-zinc-300 p-1 text-center w-24">Hujjat №</th>
                  <th className="border border-zinc-300 p-1 text-left">Operatsiya mazmuni</th>
                  <th className="border border-zinc-300 p-1 text-right w-24">Debet (Yuklandi)</th>
                  <th className="border border-zinc-300 p-1 text-right w-24">Kredit (To&apos;landi)</th>
                  <th className="border border-zinc-300 p-1 text-right w-24">Joriy Saldo ($)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-zinc-50 font-semibold">
                  <td colSpan={4} className="border border-zinc-300 p-1 text-right">
                    Boshlang&apos;ich qoldiq (Opening Balance):
                  </td>
                  <td colSpan={3} className="border border-zinc-300 p-1 text-right font-mono">
                    ${(settlement?.openingBalance || 0).toFixed(2)}
                  </td>
                </tr>
                {ledgerWithSaldo.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-zinc-300 p-1 text-center">{row.idx}</td>
                    <td className="border border-zinc-300 p-1 text-center font-mono">{row.date}</td>
                    <td className="border border-zinc-300 p-1 text-center font-mono">{row.docNo}</td>
                    <td className="border border-zinc-300 p-1">{row.description}</td>
                    <td className="border border-zinc-300 p-1 text-right font-mono">
                      {row.debit > 0 ? `$${row.debit.toFixed(2)}` : "—"}
                    </td>
                    <td className="border border-zinc-300 p-1 text-right font-mono">
                      {row.credit > 0 ? `$${row.credit.toFixed(2)}` : "—"}
                    </td>
                    <td className="border border-zinc-300 p-1 text-right font-mono font-medium">
                      ${row.runningSaldo.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-100 font-bold">
                  <td colSpan={4} className="border border-zinc-300 p-1.5 text-right">
                    JAMI OBOROT (Total Turnover):
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-right font-mono text-emerald-800">
                    +${totalDebit.toFixed(2)}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-right font-mono text-blue-800">
                    -${totalCredit.toFixed(2)}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-900">
                    ${closingBalance.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="p-2.5 border rounded bg-zinc-50 text-[11px] font-medium border-zinc-300">
              {closingBalance > 0 ? (
                <span>
                  Xulosa: <strong>{endDate}</strong> holatiga <strong>{customer.name}</strong> korxonasining{" "}
                  &ldquo;PRINTGOO&rdquo; MCHJ foydasiga qarzdorligi{" "}
                  <strong className="underline text-rose-700">${closingBalance.toFixed(2)} USD</strong> ni tashkil etadi.
                </span>
              ) : closingBalance < 0 ? (
                <span>
                  Xulosa: <strong>{endDate}</strong> holatiga <strong>&ldquo;PRINTGOO&rdquo; MCHJ</strong> korxonasining{" "}
                  foydalanilmagan avans summasi{" "}
                  <strong className="underline text-blue-700">${Math.abs(closingBalance).toFixed(2)} USD</strong> ni tashkil etadi.
                </span>
              ) : (
                <span>
                  Xulosa: <strong>{endDate}</strong> holatiga tomonlar o&apos;rtasida o&apos;zaro qarzdorlik mavjud emas (0.00 USD).
                </span>
              )}
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="space-y-4">
                <div className="font-bold text-xs uppercase text-zinc-800">
                  &ldquo;PRINTGOO&rdquo; MCHJ dan:
                </div>
                <div className="space-y-3 text-[11px]">
                  <div className="flex justify-between items-end border-b border-zinc-400 pb-1">
                    <span>Rahbar:</span>
                    <span className="font-mono text-zinc-500">/ __________________ /</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-400 pb-1">
                    <span>Bosh hisobchi:</span>
                    <span className="font-mono text-zinc-500">/ __________________ /</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1">M.O&apos;. (Muhr o&apos;rni)</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="font-bold text-xs uppercase text-zinc-800 truncate" title={customer.name}>
                  {customer.name} dan:
                </div>
                <div className="space-y-3 text-[11px]">
                  <div className="flex justify-between items-end border-b border-zinc-400 pb-1">
                    <span>Rahbar:</span>
                    <span className="font-mono text-zinc-500">/ __________________ /</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-400 pb-1">
                    <span>Bosh hisobchi:</span>
                    <span className="font-mono text-zinc-500">/ __________________ /</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1">M.O&apos;. (Muhr o&apos;rni)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-3.5 h-3.5 mr-1" />
            Yopish
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="bg-primary text-primary-foreground gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Chop etish (Print)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
