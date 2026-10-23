"use client";

import React, { useState } from "react";
import { cn } from "cn";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Printer,
  Check,
  History,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  WorkOrderFormData,
  WorkOrderSampleData,
  SampleTestPurpose,
  SampleRevisionRecord,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";

const TEST_PURPOSE_OPTIONS: { value: SampleTestPurpose; label: string }[] = [
  { value: "color_proof", label: "Rang va Pantone sinovi (Цветопроба)" },
  { value: "dieline_structure", label: "Konstruksiya va qolip bichimi (Die-line)" },
  { value: "full_finished", label: "To'liq tayyor namuna (Master Sample)" },
  { value: "substrate_test", label: "Material va kashirovka sinovi" },
];

const REVISION_REASONS: { value: SampleRevisionRecord["reasonCategory"]; label: string }[] = [
  { value: "color_shift", label: "Rang nomuvofiqligi (Delta E / Pantone)" },
  { value: "geometry_dieline", label: "O'lcham yoki konstruksiya xatosi (Bigovka / Qolip)" },
  { value: "text_error", label: "Matn yoki grafika xatosi" },
  { value: "coating_finish", label: "Laminatsiya yoki lak nuqsoni" },
  { value: "client_change", label: "Mijoz tomonidan o'zgartirish kiritildi" },
];

const SAMPLE_PILLS = [1, 3, 5, 10];

interface SampleCardProps {
  formData: WorkOrderFormData;
  sampleData?: WorkOrderSampleData;
  onSampleChange?: (field: keyof WorkOrderSampleData, val: any) => void;
  onFieldChange?: (field: keyof WorkOrderFormData, val: any) => void;
  onApproveAndReleaseMassRun?: () => void;
  onRejectSample?: (reasonCategory: SampleRevisionRecord["reasonCategory"], notes: string) => void;
  className?: string;
}

export function SampleCard({
  formData,
  sampleData,
  onSampleChange,
  onFieldChange,
  onApproveAndReleaseMassRun,
  onRejectSample,
  className,
}: SampleCardProps) {
  const { currentUser } = useWorkspaceStore();
  const [isRevisionBoxOpen, setIsRevisionBoxOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisionReason, setRevisionReason] = useState<SampleRevisionRecord["reasonCategory"]>("color_shift");
  const [revisionNotes, setRevisionNotes] = useState("");

  const isRequired = formData.orderType === "Sample" || Boolean(sampleData?.isRequired);
  const sampleQty = sampleData?.sampleQty || 5;
  const revisions = sampleData?.revisions || [];
  const isApproved = sampleData?.approvalStatus === "approved";
  const isRevisionRequested = sampleData?.approvalStatus === "revision_requested";
  const isProduced = Boolean(sampleData?.isProduced);

  const handleToggleRequired = (checked: boolean) => {
    if (onFieldChange) {
      onFieldChange("orderType", checked ? "Sample" : "Production");
    }
    if (onSampleChange) {
      onSampleChange("isRequired", checked);
      if (checked && (!sampleData?.sampleQty || sampleData.sampleQty === 0)) {
        onSampleChange("sampleQty", 5);
      }
    }
  };

  const handleMarkProduced = () => {
    if (!onSampleChange) return;
    const now = new Date();
    const timeStr = `${now.toISOString().split("T")[0]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    onSampleChange("isProduced", true);
    onSampleChange("producedAt", timeStr);
    onSampleChange("producedBy", currentUser?.name || "Operator");
    if (sampleData?.approvalStatus !== "approved") {
      onSampleChange("approvalStatus", "awaiting_approval");
    }
  };

  const handleConfirmRevision = () => {
    if (!revisionNotes.trim() || !onRejectSample) return;
    onRejectSample(revisionReason, revisionNotes.trim());
    setRevisionNotes("");
    setIsRevisionBoxOpen(false);
  };

  const handleConfirmApproval = () => {
    setIsApproveDialogOpen(false);
    if (onApproveAndReleaseMassRun) {
      onApproveAndReleaseMassRun();
    }
  };

  return (
    <div className={cn("bg-card border border-border rounded-lg p-3.5 space-y-3 shadow-xs", className)}>
      {/* ── CARD HEADER ── */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-500" />
          <h4 className="font-semibold text-xs text-foreground">
            Namuna va Sifat Ko'rigi (Sample)
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Namuna talab etiladi</span>
          <Switch
            checked={isRequired}
            onCheckedChange={handleToggleRequired}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>
      </div>

      {/* ── AGAR NAMUNA TALAB ETILMASA ── */}
      {!isRequired ? (
        <div className="py-2 px-3 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
          <span>Ushbu buyurtmada sinov namunasi talab etilmaydi. To'g'ridan-to'g'ri ishlab chiqarishga yo'naltiriladi.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleToggleRequired(true)}
            className="h-6 text-[11px] text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 px-2"
          >
            Namuna qo'shish
          </Button>
        </div>
      ) : (
        /* ── AGAR NAMUNA TALAB ETILSA ── */
        <div className="space-y-3">
          {/* Yuqori parametrlar: Adad va Maqsad */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Sinov adadi */}
            <div className="sm:col-span-6 flex items-center gap-2">
              <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
                Adad:
              </span>
              <div className="flex items-center gap-1 flex-1">
                {SAMPLE_PILLS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={sampleQty === n ? "default" : "outline"}
                    onClick={() => onSampleChange?.("sampleQty", n)}
                    className={cn(
                      "flex-1 h-7 text-[11px] font-medium px-0",
                      sampleQty === n
                        ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                max={500}
                value={sampleQty}
                onChange={(e) => onSampleChange?.("sampleQty", Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 h-7 text-xs text-center bg-background font-mono"
              />
            </div>

            {/* Sinov maqsadi */}
            <div className="sm:col-span-6">
              <Select
                value={sampleData?.testPurpose || "color_proof"}
                onValueChange={(val) => onSampleChange?.("testPurpose", val)}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_PURPOSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* O'lcham tanlovi (agar ko'p o'lchamli bo'lsa) */}
          {formData.sizes && formData.sizes.length > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <span className="text-[11px] text-muted-foreground">Namunada bosiladigan o'lcham:</span>
              <Select
                value={sampleData?.sampleTargetSize || formData.sizes[0]?.size || "all"}
                onValueChange={(val) => {
                  onSampleChange?.("sampleTargetSize", val);
                  onFieldChange?.("sampleTargetSize", val);
                }}
              >
                <SelectTrigger className="w-48 h-7 text-xs bg-background font-mono">
                  <SelectValue placeholder="O'lchamni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha o'lchamlar</SelectItem>
                  {formData.sizes.map((s) => (
                    <SelectItem key={s.id} value={s.size} className="font-mono text-xs">
                      {s.size} ({s.quantity.toLocaleString()} ta)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Maxsus mijoz ko'rsatmasi (ixtiyoriy) */}
          <div>
            <Input
              value={sampleData?.technicalNotes || ""}
              onChange={(e) => onSampleChange?.("technicalNotes", e.target.value)}
              placeholder="Mijozning namuna bo'yicha maxsus talabi (masalan: Delta E < 2.0)..."
              className="h-7 text-xs bg-background"
            />
          </div>

          {/* ── SEX VA MIJOZ STATUS PANELI ── */}
          <div className="p-2.5 rounded-md bg-muted/40 border border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-center">
            {/* Sex holati */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium text-[11px]">Sexda namuna:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    isProduced
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isProduced ? "Chop etildi" : "Kutilmoqda"}
                </Badge>
              </div>

              {isProduced ? (
                <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>{sampleData?.producedAt || "—"} ({sampleData?.producedBy || "Operator"})</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkProduced}
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Qayta belgilash
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkProduced}
                  className="w-full h-7 text-xs bg-background"
                >
                  <Printer className="w-3 h-3 mr-1.5" />
                  <span>Namuna chop etildi</span>
                </Button>
              )}
            </div>

            {/* Mijoz tasdiqlashi */}
            <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium text-[11px]">Mijoz qarori:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    isApproved
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : isRevisionRequested
                      ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400"
                      : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400"
                  )}
                >
                  {isApproved
                    ? "Tasdiqlangan"
                    : isRevisionRequested
                    ? "Qayta ishlashda"
                    : "Kutilmoqda"}
                </Badge>
              </div>

              {isApproved ? (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                  <span className="truncate">Tirajga ruxsat berilgan</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onSampleChange?.("approvalStatus", "awaiting_approval");
                      onFieldChange?.("orderType", "Sample");
                    }}
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Bekor qilish
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsApproveDialogOpen(true)}
                    className="flex-1 h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    <span>Mijoz tasdiqladi</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRevisionBoxOpen(!isRevisionBoxOpen)}
                    className="h-7 text-[11px] border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── QAYTA ISHLASH (REVIZIYA) FORMASI ── */}
          {isRevisionBoxOpen && (
            <div className="p-2.5 rounded-md bg-muted/60 border border-border space-y-2 text-xs animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] text-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Mijoz o'zgartirish talabi</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                <Input
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Nima o'zgarishi kerak? (masalan: quti kengligi...)"
                  className="h-7 text-xs bg-background"
                />
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRevisionBoxOpen(false)}
                  className="h-6 text-[10px]"
                >
                  Bekor qilish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmRevision}
                  disabled={!revisionNotes.trim()}
                  className="h-6 text-[10px] bg-red-600 hover:bg-red-700 text-white"
                >
                  Qayta ishlashga yuborish
                </Button>
              </div>
            </div>
          )}

          {/* ── REVIZIYALAR TARIXI (COLLAPSIBLE) ── */}
          {revisions.length > 0 && (
            <div className="border-t border-border/60 pt-1.5">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-[10px] text-muted-foreground hover:text-foreground font-medium py-0.5"
              >
                <span className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  O'zgartirishlar tarixi ({revisions.length})
                </span>
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showHistory && (
                <div className="mt-1.5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-1.5 rounded bg-muted/40 border border-border/60 text-[10px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-muted-foreground font-mono">
                        <span>Reviziya #{rev.revisionNumber}</span>
                        <span>{rev.date}</span>
                      </div>
                      <p className="text-foreground">{rev.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TASDIQLASH DIALOGI ── */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Asosiy tirajga ruxsat berasizmi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Mijoz namunani tasdiqlaganini tasdiqlaysiz. Buyurtma to'liq adad (
              <strong className="text-foreground">
                {formData.quantity.toLocaleString()} {formData.unit || "dona"}
              </strong>
              ) bilan asosiy ishlab chiqarish jadvalida ruxsat oladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3">
            <AlertDialogCancel className="h-8 text-xs">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApproval}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Ha, Tasdiqlash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
