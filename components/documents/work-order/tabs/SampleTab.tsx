"use client";

import React, { useState } from "react";
import { cn } from "cn";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Printer,
  Check,
  ShieldCheck,
  History,
  Lock,
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WorkOrderFormData,
  WorkOrderSampleData,
  SampleTestPurpose,
  SampleRevisionRecord,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";

const TEST_PURPOSE_OPTIONS: { value: SampleTestPurpose; label: string; desc: string }[] = [
  {
    value: "color_proof",
    label: "Rang va Pantone sinovi (Цветопроба)",
    desc: "Spektrofotometriya va rang zichligi (CMYK / Spot ink)",
  },
  {
    value: "dieline_structure",
    label: "Konstruksiya va qolip bichimi (Die-line)",
    desc: "Quti yig'ilishi, bigovka chiziqlari va o'lcham aniqligi",
  },
  {
    value: "full_finished",
    label: "To'liq tayyor namuna (Master Sample)",
    desc: "Bosma + Laminatsiya + Lak/Zarhal + Qolipda to'liq bichim",
  },
  {
    value: "substrate_test",
    label: "Material va kashirovka sinovi",
    desc: "Qog'oz zichligi, yelim adgeziyasi va qatlamlar mustahkamligi",
  },
];

const REVISION_REASONS: { value: SampleRevisionRecord["reasonCategory"]; label: string }[] = [
  { value: "color_shift", label: "Rang nomuvofiqligi (Delta E yuqori / Pantone farq qildi)" },
  { value: "geometry_dieline", label: "O'lcham yoki konstruksiya xatosi (Bigovka / Qolip)" },
  { value: "text_error", label: "Matn, shtrix-kod yoki grafika xatosi" },
  { value: "coating_finish", label: "Laminatsiya, lak yoki zarhal nuqsoni" },
  { value: "client_change", label: "Mijoz tomonidan o'zgartirish kiritildi" },
];

const SAMPLE_PILLS = [1, 3, 5, 10, 20];

interface Props {
  formData: WorkOrderFormData;
  sampleData: WorkOrderSampleData;
  handleSampleChange: (field: keyof WorkOrderSampleData, val: any) => void;
  handleFieldChange: (field: keyof WorkOrderFormData, val: any) => void;
  onApproveAndReleaseMassRun: () => void;
  onRejectSample: (reasonCategory: SampleRevisionRecord["reasonCategory"], notes: string) => void;
  tabId: string;
}

export function SampleTab({
  formData,
  sampleData,
  handleSampleChange,
  handleFieldChange,
  onApproveAndReleaseMassRun,
  onRejectSample,
  tabId,
}: Props) {
  const { currentUser } = useWorkspaceStore();
  const [isRevisionBoxOpen, setIsRevisionBoxOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState<SampleRevisionRecord["reasonCategory"]>("color_shift");
  const [revisionNotes, setRevisionNotes] = useState("");

  const isDirectProduction = formData.orderType === "Production";
  const sampleQty = sampleData.sampleQty || 5;
  const revisions = sampleData.revisions || [];

  const handleConfirmRevision = () => {
    if (!revisionNotes.trim()) return;
    onRejectSample(revisionReason, revisionNotes.trim());
    setRevisionNotes("");
    setIsRevisionBoxOpen(false);
  };

  const handleMarkProduced = () => {
    const now = new Date();
    const timeStr = `${now.toISOString().split("T")[0]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    handleSampleChange("isProduced", true);
    handleSampleChange("producedAt", timeStr);
    handleSampleChange("producedBy", currentUser?.name || "Operator (Press Dept)");
    if (sampleData.approvalStatus !== "approved") {
      handleSampleChange("approvalStatus", "awaiting_approval");
    }
  };

  const handleToggleQc = () => {
    const nextVal = !sampleData.qcPassed;
    handleSampleChange("qcPassed", nextVal);
    if (nextVal && !sampleData.isProduced) {
      handleMarkProduced();
    }
  };

  return (
    <div className="space-y-4">
      {/* ── TOP HEADER / WORKFLOW PROGRESS BAR ── */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Step Indicators */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* Step 1: Mode */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border transition-colors",
              isDirectProduction
                ? "bg-muted text-muted-foreground border-border"
                : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            )}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>1. Namuna rejimi</span>
            {!isDirectProduction && <Check className="w-3 h-3 stroke-[3]" />}
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

          {/* Step 2: Produced & QC */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border transition-colors",
              isDirectProduction
                ? "bg-muted text-muted-foreground border-border"
                : sampleData.isProduced && sampleData.qcPassed
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : sampleData.isProduced
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                : "bg-muted/40 text-muted-foreground border-border/60"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Sex & OTK</span>
            {sampleData.isProduced && sampleData.qcPassed && !isDirectProduction && (
              <Check className="w-3 h-3 stroke-[3]" />
            )}
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

          {/* Step 3: Approval Gate */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border transition-colors",
              isDirectProduction
                ? "bg-muted text-muted-foreground border-border"
                : sampleData.approvalStatus === "approved"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : sampleData.approvalStatus === "revision_requested"
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                : "bg-muted/40 text-muted-foreground border-border/60"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>3. Tasdiq darvozasi</span>
            {sampleData.approvalStatus === "approved" && <Check className="w-3 h-3 stroke-[3]" />}
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

          {/* Step 4: Mass Production */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border transition-colors",
              isDirectProduction || sampleData.approvalStatus === "approved"
                ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                : "bg-muted/40 text-muted-foreground border-border/60"
            )}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>4. Asosiy ishlab chiqarish</span>
            {(isDirectProduction || sampleData.approvalStatus === "approved") && (
              <Check className="w-3 h-3 stroke-[3]" />
            )}
          </div>
        </div>

        {/* Quick Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => {
              handleFieldChange("orderType", "Sample");
              handleSampleChange("isRequired", true);
            }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              !isDirectProduction
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
            <span>Dastlab namuna (Sample First)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleFieldChange("orderType", "Production");
              handleSampleChange("isRequired", false);
            }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              isDirectProduction
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Printer className="w-3.5 h-3.5 text-blue-500" />
            <span>To'g'ridan-to'g'ri ishlab chiqarish</span>
          </button>
        </div>
      </div>

      {/* ── STATE A: DIRECT PRODUCTION VIEW ── */}
      {isDirectProduction ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800">
            <Printer className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h4 className="font-semibold text-sm text-foreground">
              To'g'ridan-to'g'ri ishlab chiqarish rejimi
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ushbu buyurtmada jismoniy sinov namunasi (test run) talab etilmaydi. Buyurtma to'liq adad{" "}
              <strong className="text-foreground">
                {formData.quantity.toLocaleString()} {formData.unit}
              </strong>{" "}
              bilan bevosita ishlab chiqarish jadvalida faol.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleFieldChange("orderType", "Sample");
                handleSampleChange("isRequired", true);
                if (sampleData.approvalStatus === "approved") {
                  handleSampleChange("approvalStatus", "pending_production");
                }
              }}
              className="text-xs gap-1.5 border-dashed border-amber-500/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Namunaviy sinov rejimiga o'tkazish</span>
            </Button>
          </div>
        </div>
      ) : (
        /* ── STATE B: SAMPLE FIRST WORKFLOW VIEW ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): Production Specs & Floor QC */}
          <div className="lg:col-span-7 space-y-4">
            {/* Card 1: Technical Sample Parameters */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-xs text-foreground">
                    1. Sinov namunasi parametrlari (Sample Specs)
                  </h4>
                </div>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  {sampleQty} {formData.unit || "dona"} sinov
                </Badge>
              </div>

              {/* Sample Qty Selector (Synced with LayoutCalcTab) */}
              <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-md border border-border/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-foreground">Sinov adadi (SSOT):</span>
                  <span className="text-muted-foreground font-mono">
                    Umumiy tiraj: {formData.quantity.toLocaleString()} {formData.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    {SAMPLE_PILLS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleSampleChange("sampleQty", n)}
                        className={cn(
                          "flex-1 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer",
                          sampleQty === n
                            ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={sampleQty}
                    onChange={(e) => handleSampleChange("sampleQty", Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-7 text-xs text-center bg-background font-mono"
                  />
                </div>

                {/* Target Single Size for Sample if multi-size matrix exists */}
                {formData.sizes && formData.sizes.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <label className="text-[11px] font-medium text-foreground block">
                        Namunada bosiladigan o'lcham:
                      </label>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        Matritsadagi barcha razmerlar emas, faqat tanlangan razmer sinovdan o'tkaziladi
                      </span>
                    </div>
                    <Select
                      value={sampleData.sampleTargetSize || formData.sizes[0]?.size || "all"}
                      onValueChange={(val) => {
                        handleSampleChange("sampleTargetSize", val);
                        handleFieldChange("sampleTargetSize", val);
                      }}
                    >
                      <SelectTrigger className="w-40 h-7 text-xs bg-background font-mono">
                        <SelectValue placeholder="O'lchamni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Barcha o'lchamlar (Mikro-tiraj)</SelectItem>
                        {formData.sizes.map((s) => (
                          <SelectItem key={s.id} value={s.size} className="font-mono text-xs">
                            {s.size} (Aslida: {s.quantity.toLocaleString()} ta)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Test Purpose & Machine Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground font-medium block text-[11px] mb-1">
                    Sinov maqsadi (Purpose)
                  </label>
                  <Select
                    value={sampleData.testPurpose || "color_proof"}
                    onValueChange={(val) => handleSampleChange("testPurpose", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEST_PURPOSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <div>
                            <span className="font-medium">{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block text-[11px] mb-1">
                    Sinov uskunasi (Machine / Line)
                  </label>
                  <Input
                    value={sampleData.testMachine || formData.pressMachine || ""}
                    onChange={(e) => handleSampleChange("testMachine", e.target.value)}
                    placeholder="Uskuna nomi..."
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Substrate Source & Tech Instruction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-muted-foreground font-medium block text-[11px] mb-1">
                    Qog'oz / xomashyo manbasi
                  </label>
                  <Select
                    value={sampleData.substrateSource || "precut"}
                    onValueChange={(val) => handleSampleChange("substrateSource", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="precut" className="text-xs">
                        Pre-cut tayyor varaqlar (Ombordan)
                      </SelectItem>
                      <SelectItem value="parent_sheet" className="text-xs">
                        Katta formatli listdan kesish (Offcut)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block text-[11px] mb-1">
                    Texnologik talab / Ko'rsatma
                  </label>
                  <Input
                    value={sampleData.technicalNotes || ""}
                    onChange={(e) => handleSampleChange("technicalNotes", e.target.value)}
                    placeholder="Masalan: Delta E < 2.0, zichlik 1.45..."
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Shop-Floor Execution & QC Inspection */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-xs text-foreground">
                    2. Sex va Sifat Nazorati (OTK Inspection)
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      sampleData.qcPassed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400"
                    )}
                  >
                    {sampleData.qcPassed ? "✓ OTK Tasdiqladi" : "OTK Tekshiruvi Kutilmoqda"}
                  </Badge>
                </div>
              </div>

              {/* Status rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Floor Production Status */}
                <div className="p-3 bg-muted/40 border border-border rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Namuna chop etilishi:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        sampleData.isProduced
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {sampleData.isProduced ? "Chop etildi" : "Kutilmoqda"}
                    </Badge>
                  </div>
                  {sampleData.isProduced ? (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
                      <div>Vaqt: <strong className="text-foreground">{sampleData.producedAt || "—"}</strong></div>
                      <div>Mas'ul: <strong className="text-foreground">{sampleData.producedBy || "Operator"}</strong></div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Uskunada sinov varaqlarini chiqarib, tugmani bosing.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant={sampleData.isProduced ? "outline" : "default"}
                    size="sm"
                    onClick={handleMarkProduced}
                    className="w-full h-7 text-xs mt-1"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span>{sampleData.isProduced ? "Qayta chop etish" : "Namuna chop etildi deb belgilash"}</span>
                  </Button>
                </div>

                {/* QC Inspection Status */}
                <div className="p-3 bg-muted/40 border border-border rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">OTK tekshiruvi:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        sampleData.qcPassed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {sampleData.qcPassed ? "Qabul qilindi" : "Tekshirilmagan"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Rang balansi, bigovka, razmer va chop defektlari yo'qligini tasdiqlash.
                  </p>
                  <Button
                    type="button"
                    variant={sampleData.qcPassed ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggleQc}
                    className={cn(
                      "w-full h-7 text-xs mt-1",
                      sampleData.qcPassed
                        ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                    <span>{sampleData.qcPassed ? "OTK bekor qilish" : "OTK Sifatini Tasdiqlash"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Decision Gate & Revision History */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card 3: Decision Gate (Approve or Reject) */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-semibold text-xs text-foreground">
                    3. Tasdiqlash va Ruxsat Darvozasi (Approval Gate)
                  </h4>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold",
                    sampleData.approvalStatus === "approved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : sampleData.approvalStatus === "revision_requested"
                      ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400"
                      : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400"
                  )}
                >
                  {sampleData.approvalStatus === "approved"
                    ? "✓ Tasdiqlangan"
                    : sampleData.approvalStatus === "revision_requested"
                    ? "Qayta ishlashda"
                    : "Tasdiq kutilmoqda"}
                </Badge>
              </div>

              {/* Status explanation */}
              {sampleData.approvalStatus === "approved" ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Namuna to'liq tasdiqlangan</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                    Naryad to'liq tiraj (<strong>{formData.quantity.toLocaleString()} {formData.unit}</strong>) bilan
                    ishlab chiqarish jadvaliga yo'naltirildi. Mashina va navbat qulfdan chiqarildi.
                  </p>
                  {sampleData.approvedAt && (
                    <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 pt-1 border-t border-emerald-500/20">
                      Sana: {sampleData.approvedAt} • Tasdiqladi: {sampleData.approvedBy || "Bosh Texnolog"}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Asosiy tiraj bloklangan 🔒</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                    Namuna tasdiqlanmaguncha asosiy bosma (<strong>{formData.quantity.toLocaleString()} {formData.unit}</strong>)
                    mashina navbatida ruxsat ololmaydi.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {sampleData.approvalStatus !== "approved" ? (
                  <>
                    <Button
                      type="button"
                      onClick={onApproveAndReleaseMassRun}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Tasdiqlash & Asosiy Tirajga Ruxsat Berish</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsRevisionBoxOpen(!isRevisionBoxOpen)}
                      className="w-full h-8 text-xs border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Qayta ishlash / Reviziya talab qilish</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleSampleChange("approvalStatus", "awaiting_approval");
                      handleFieldChange("orderType", "Sample");
                    }}
                    className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    <span>Tasdiqni bekor qilish (Qayta ko'rib chiqish)</span>
                  </Button>
                )}
              </div>

              {/* Inline Revision Input Form */}
              {isRevisionBoxOpen && (
                <div className="p-3 bg-muted/60 border border-border rounded-md space-y-2.5 text-xs animate-in fade-in-50 duration-200">
                  <div className="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Reviziya sababi va texnik izoh</span>
                  </div>

                  <div>
                    <label className="text-muted-foreground text-[10px] block mb-1">Xatolik toifasi</label>
                    <Select
                      value={revisionReason}
                      onValueChange={(val: any) => setRevisionReason(val)}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVISION_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="text-xs">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-muted-foreground text-[10px] block mb-1">
                      Tuzatish bo'yicha ko'rsatma (Sex va operator uchun)
                    </label>
                    <Input
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      placeholder="Masalan: Cyan zichligini 10% kamaytirish, qolip siljigan..."
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRevisionBoxOpen(false)}
                      className="h-7 text-xs"
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirmRevision}
                      disabled={!revisionNotes.trim()}
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                    >
                      Qayta ishlashga yuborish
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Technical Revision Log / History */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Reviziyalar jurnali ({revisions.length})</span>
                </div>
              </div>

              {revisions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center italic">
                  Hozircha hech qanday reviziya qayd etilmagan.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-2.5 rounded-md bg-muted/40 border border-border text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          Reviziya #{rev.revisionNumber}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{rev.date}</span>
                      </div>
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                        {REVISION_REASONS.find((r) => r.value === rev.reasonCategory)?.label || rev.reasonCategory}
                      </div>
                      <p className="text-muted-foreground leading-tight pt-0.5">{rev.notes}</p>
                      <div className="text-[9px] text-muted-foreground/80 pt-0.5">
                        Kiritdi: {rev.reportedBy}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
