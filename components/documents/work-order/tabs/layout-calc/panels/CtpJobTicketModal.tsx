"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  FileText,
  Layers,
  CheckCircle,
  Calendar,
  Building,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalculatedPlate, CtpSideRelation } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docNo?: string;
  orderName?: string;
  pressMachine?: string;
  paperStock?: string;
  sheetW: number;
  sheetH: number;
  prodW: number;
  prodH: number;
  plates: CalculatedPlate[];
  effectivePieces: number;
  ctpSideRelation: CtpSideRelation;
  frontColorsCount: number;
  backColorsCount: number;
  totalCtpPlates: number;
  totalSheetsRun: number;
  totalProducedYield: number;
  totalOverproduction: number;
}

export function CtpJobTicketModal({
  isOpen,
  onClose,
  docNo = "WO-00000",
  orderName = "Buyurtma",
  pressMachine = "Heidelberg Speedmaster XL 106",
  paperStock = "Coated Cardboard 300g/m²",
  sheetW,
  sheetH,
  prodW,
  prodH,
  plates,
  effectivePieces,
  ctpSideRelation,
  frontColorsCount,
  backColorsCount,
  totalCtpPlates,
  totalSheetsRun,
  totalProducedYield,
  totalOverproduction,
}: Props) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const ctpRelationLabel =
    ctpSideRelation === "shared_front_variable_back"
      ? "Oldi umumiy (1 to'plam) + Orqasi har xil qoliplar"
      : ctpSideRelation === "work_and_turn"
      ? "Svoy oborot (Work & Turn - 1 qolipda oldi-orqa)"
      : "Mustaqil (Har bir forma alohida oldi va orqa)";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-zinc-900">
        {/* Modal Header */}
        <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <DialogTitle className="text-sm font-semibold text-zinc-900">
              CTP Texnologik Xaritasi (Job Ticket) — {docNo}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Chop etish (Print)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-zinc-900 print:p-0 print:m-0 print:overflow-visible"
        >
          {/* Header Bar */}
          <div className="border-b-2 border-zinc-800 pb-3 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 uppercase">
                CTP & Bosmaxona Texnologik Xaritasi
              </h1>
              <p className="text-xs text-zinc-600 font-medium">
                Buyurtma: <strong className="text-zinc-900">{orderName}</strong>
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-base font-extrabold text-blue-700 block">
                {docNo}
              </span>
              <span className="text-[10px] text-zinc-500">
                Sana: {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Machine & Specs Grid */}
          <div className="grid grid-cols-4 gap-2 bg-zinc-100 p-3 rounded border border-zinc-300 font-mono text-[11px]">
            <div>
              <span className="text-[9px] uppercase font-sans font-semibold text-zinc-500 block">
                Bosma Mashinasi
              </span>
              <span className="font-bold text-zinc-900">{pressMachine}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-sans font-semibold text-zinc-500 block">
                Qog&apos;oz turi
              </span>
              <span className="font-bold text-zinc-900 truncate block">{paperStock}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-sans font-semibold text-zinc-500 block">
                List & Mahsulot Formati
              </span>
              <span className="font-bold text-zinc-900">
                {sheetW}×{sheetH} mm ({effectivePieces}-up: {prodW}×{prodH} mm)
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-sans font-semibold text-zinc-500 block">
                CTP Tomonlar Rejimi
              </span>
              <span className="font-bold text-blue-700 truncate block">{ctpRelationLabel}</span>
            </div>
          </div>

          {/* Grand Summary KPI Badges */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded border border-zinc-300 bg-zinc-50">
              <span className="text-[10px] font-semibold text-zinc-500 block uppercase">
                Jami CTP Formalar
              </span>
              <span className="text-lg font-mono font-extrabold text-blue-700">
                {totalCtpPlates} dona
              </span>
            </div>
            <div className="p-2.5 rounded border border-zinc-300 bg-zinc-50">
              <span className="text-[10px] font-semibold text-zinc-500 block uppercase">
                Formalar Soni
              </span>
              <span className="text-lg font-mono font-extrabold text-zinc-900">
                {plates.length} ta forma
              </span>
            </div>
            <div className="p-2.5 rounded border border-zinc-300 bg-zinc-50">
              <span className="text-[10px] font-semibold text-zinc-500 block uppercase">
                Jami Bosiladigan List
              </span>
              <span className="text-lg font-mono font-extrabold text-zinc-900">
                {totalSheetsRun.toLocaleString()} list
              </span>
            </div>
            <div className="p-2.5 rounded border border-zinc-300 bg-zinc-50">
              <span className="text-[10px] font-semibold text-zinc-500 block uppercase">
                Haqiqiy Chiqish / Ortiqcha
              </span>
              <span className="text-lg font-mono font-extrabold text-emerald-700">
                {totalProducedYield.toLocaleString()}{" "}
                <span className="text-xs font-normal text-zinc-500 font-mono">
                  (+{totalOverproduction})
                </span>
              </span>
            </div>
          </div>

          {/* CTP Plates Manifest: Front vs Back */}
          <div className="bg-zinc-50 border border-zinc-300 rounded p-3 space-y-2">
            <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>CTP Qoliplari Chiqarish Ro&apos;yxati (Plates Manifest)</span>
              </span>
              <span className="text-blue-700 font-mono font-extrabold">
                {totalCtpPlates} dona CTP qolipi
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Front plates checklist */}
              <div className="border border-blue-200 bg-blue-50/50 p-2.5 rounded text-[11px] font-mono">
                <span className="font-bold text-blue-900 block font-sans text-[10px] uppercase mb-1.5">
                  1. Oldi Tomon Qoliplari (Front Plates) —{" "}
                  {ctpSideRelation === "shared_front_variable_back"
                    ? `${frontColorsCount} CTP (1 ta umumiy forma)`
                    : `${plates.length * frontColorsCount} CTP (${plates.length} ta forma)`}
                </span>
                {ctpSideRelation === "shared_front_variable_back" ? (
                  <div className="text-zinc-700 space-y-1 text-[10px]">
                    <div className="font-semibold text-blue-800">
                      • [{docNo}_FRONT_COMMON] C, M, Y, K ({frontColorsCount} ta qolip)
                    </div>
                    <div className="text-zinc-500 font-sans text-[9px]">
                      Barcha {plates.length} ta forma va {totalSheetsRun.toLocaleString()} list uchun oldi tomon bir xil 1 to&apos;plam qolip bilan bosiladi.
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-700 space-y-1 text-[10px]">
                    {plates.map((p) => (
                      <div key={p.id}>
                        • [{docNo}_{p.name.replace(/\s+/g, "_")}_FRONT] C, M, Y, K ({frontColorsCount} qolip)
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Back plates checklist */}
              <div className="border border-purple-200 bg-purple-50/50 p-2.5 rounded text-[11px] font-mono">
                <span className="font-bold text-purple-900 block font-sans text-[10px] uppercase mb-1.5">
                  2. Orqa Tomon Qoliplari (Back Plates) — {plates.length * backColorsCount} CTP ({plates.length} ta forma)
                </span>
                <div className="text-zinc-700 space-y-1 text-[10px]">
                  {plates.map((p) => (
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="font-semibold text-purple-900">
                        • [{docNo}_{p.name.replace(/\s+/g, "_")}_BACK]
                      </span>
                      <span className="text-zinc-600 text-[9px] font-sans">
                        {p.assignments.length} SKU · {p.requiredSheets} list
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Per Forma */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5 border-b border-zinc-300 pb-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Bosma Qoliplar va Taqsimot Tafsilotlari</span>
            </h2>

            {plates.map((plate) => {
              const usedSlots = effectivePieces - plate.unassignedSlots;
              return (
                <div
                  key={plate.id}
                  className="border border-zinc-300 rounded overflow-hidden"
                >
                  {/* Plate Header Bar */}
                  <div className="bg-zinc-100 px-3 py-1.5 border-b border-zinc-300 flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-900 font-bold">{plate.name}</span>
                      <span className="text-zinc-500 text-[11px] font-mono">
                        ({usedSlots}/{effectivePieces} joy band)
                      </span>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-[11px]">
                      <span>
                        Bosma tiraj:{" "}
                        <strong className="text-blue-700 font-bold">
                          {plate.requiredSheets.toLocaleString()} list
                        </strong>
                      </span>
                      <span>
                        Chiqish: <strong>{plate.totalYield?.toLocaleString() || 0}</strong>
                      </span>
                      <span>
                        Ortiqcha:{" "}
                        <strong className="text-emerald-700">
                          +{plate.totalOverproduction?.toLocaleString() || 0}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Assignments Table */}
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[9px] uppercase font-semibold text-zinc-500">
                        <th className="py-1 px-2 w-8 text-center">#</th>
                        <th className="py-1 px-2">Artikul</th>
                        <th className="py-1 px-2">O&apos;lcham (Size)</th>
                        <th className="py-1 px-2 text-center w-24">Joy (Slots)</th>
                        <th className="py-1 px-2 text-right w-24">Buyurtma</th>
                        <th className="py-1 px-2 text-right w-24">Chiqish (Yield)</th>
                        <th className="py-1 px-2 text-right w-24">Ortiqcha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {plate.assignments.map((a, aIdx) => {
                        const diff = (a.yieldQuantity || 0) - a.targetQuantity;
                        return (
                          <tr key={a.sizeId} className="hover:bg-zinc-50/50">
                            <td className="py-1 px-2 text-center font-mono text-zinc-400">
                              {aIdx + 1}
                            </td>
                            <td className="py-1 px-2 font-mono font-medium text-zinc-900">
                              {a.model || "—"}
                            </td>
                            <td className="py-1 px-2 font-mono font-semibold text-zinc-800">
                              {a.sizeCode || a.sizeLabel}
                            </td>
                            <td className="py-1 px-2 text-center font-mono font-bold text-blue-700">
                              {a.slots} ta joy ({a.slots}x)
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-zinc-600">
                              {a.targetQuantity.toLocaleString()}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-zinc-900">
                              {a.yieldQuantity?.toLocaleString() || 0}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-emerald-700">
                              {diff > 0 ? `+${diff.toLocaleString()}` : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Signatures Footer */}
          <div className="pt-6 border-t-2 border-zinc-800 grid grid-cols-3 gap-6 text-[10px] text-zinc-600">
            <div>
              <span className="block font-semibold text-zinc-900 mb-6">
                CTP Operator (Prepress):
              </span>
              <div className="border-b border-zinc-400 pb-1">Imzo: _______________</div>
            </div>
            <div>
              <span className="block font-semibold text-zinc-900 mb-6">
                Bosmaxona Bosuvchisi (Offset):
              </span>
              <div className="border-b border-zinc-400 pb-1">Imzo: _______________</div>
            </div>
            <div>
              <span className="block font-semibold text-zinc-900 mb-6">
                Sifat Nazorati (OTK):
              </span>
              <div className="border-b border-zinc-400 pb-1">Imzo: _______________</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
