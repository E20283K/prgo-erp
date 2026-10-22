"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCheck,
  Building2,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  Sparkles,
  Save,
  Copy,
  Check,
  DollarSign,
  User,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LeadStatus = "New" | "Contacted" | "Sample Sent" | "Qualified" | "Converted" | "Lost";

export interface LeadRecord {
  id: string;
  company: string;
  tin: string;
  contact: string;
  phone: string;
  email?: string;
  productInterest: string;
  estimatedOrderUsd: number;
  source: string;
  manager: string;
  notes?: string;
  status: LeadStatus;
}

export interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadRecord | null;
  onSave: (lead: LeadRecord) => void;
  onConvertToOrder?: (lead: LeadRecord) => void;
  onDelete?: (leadId: string) => void;
}

const STAGE_CONFIG: Record<
  LeadStatus,
  { label: string; dot: string; badge: string }
> = {
  New: {
    label: "New",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  Contacted: {
    label: "Contacted",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  "Sample Sent": {
    label: "Sample Sent",
    dot: "bg-purple-500",
    badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  Qualified: {
    label: "Qualified",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  Converted: {
    label: "Converted",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  Lost: {
    label: "Lost",
    dot: "bg-rose-500",
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
};

const DEFAULT_SOURCES = [
  "UzPrint Expo 2026",
  "Instagram / Website",
  "Telegram",
  "Tavsiya (Referral)",
  "Sovuq qo'ng'iroq",
  "Tender Portal",
  "Direct Inquiry",
];

const DEFAULT_MANAGERS = [
  "Elena Voronina",
  "T. Alimov",
  "M. Ivanova",
  "Bobur Shokirov",
];

export function LeadDetailModal({
  open,
  onOpenChange,
  lead,
  onSave,
  onConvertToOrder,
  onDelete,
}: LeadDetailModalProps) {
  const t = useTranslations("LeadModal");

  const [formState, setFormState] = useState<LeadRecord | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setFormState({ ...lead });
      setErrorMessage(null);
    } else {
      setFormState(null);
    }
  }, [lead, open]);

  if (!formState) return null;

  const isNew = !lead?.company;

  const handleCopyId = () => {
    if (!formState.id) return;
    navigator.clipboard.writeText(formState.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPhone = () => {
    if (!formState.phone) return;
    navigator.clipboard.writeText(formState.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleAddQuickTag = (tagText: string) => {
    const bulletText = `• ${tagText.replace(/^\+\s*/, "")}`;
    const currentNotes = formState.notes?.trim() || "";
    const updatedNotes = currentNotes ? `${currentNotes}\n${bulletText}` : bulletText;
    setFormState({ ...formState, notes: updatedNotes });
  };

  const handleSave = () => {
    if (!formState.company.trim()) {
      setErrorMessage(t("companyRequired"));
      return;
    }
    setErrorMessage(null);
    onSave(formState);
    onOpenChange(false);
  };

  const handleConvert = () => {
    if (!formState.company.trim()) {
      setErrorMessage(t("companyRequired"));
      return;
    }
    setErrorMessage(null);
    if (onConvertToOrder) {
      onConvertToOrder(formState);
    }
  };

  const quickTags = [
    t("tagSamplesSent"),
    t("tagLayoutPending"),
    t("tagPriceNegotiation"),
    t("tagUrgent"),
    t("tagCallback"),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col !gap-0 !p-0 sm:max-w-[760px] w-full overflow-hidden bg-background border border-border shadow-2xl rounded-xl max-h-[85vh]">
        {/* Compact Header with generous right padding for Dialog close button */}
        <DialogHeader className="px-5 py-3 border-b border-border bg-muted/40 shrink-0 text-left pr-12">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              type="button"
              onClick={handleCopyId}
              title={t("copyId")}
              className="font-mono text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <span>{formState.id}</span>
              {copiedId ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3 opacity-60" />
              )}
            </button>

            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 border flex items-center gap-1.5",
                STAGE_CONFIG[formState.status]?.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full", STAGE_CONFIG[formState.status]?.dot)} />
              <span>{formState.status}</span>
            </Badge>

            {formState.source && (
              <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0.5">
                {formState.source}
              </Badge>
            )}
          </div>

          <DialogTitle className="flex items-center gap-2 text-base font-semibold leading-tight pt-0.5 truncate text-foreground">
            <UserCheck className="size-4 text-primary shrink-0" />
            <span className="truncate">
              {formState.company.trim() || (isNew ? t("newLeadTitle") : t("title"))}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {isNew ? t("newLeadSubtitle") : t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* 2-Column Balanced Form Body (min-h-0 prevents flex overflow clipping) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {errorMessage && (
            <div className="px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Grid: 2 balanced columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {/* Left Column: Company & Contacts */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
                <Building2 className="size-3.5 text-blue-500" />
                <span>{t("companySection")}</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <span>{t("companyName")}</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formState.company}
                  onChange={(e) => {
                    setFormState({ ...formState, company: e.target.value });
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t("companyPlaceholder")}
                  className="h-8 text-xs font-medium bg-background"
                  autoFocus={isNew}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("tin")}</Label>
                  <Input
                    value={formState.tin || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, tin: e.target.value })
                    }
                    placeholder={t("tinPlaceholder")}
                    className="h-8 text-xs font-mono tracking-wider bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("contactPerson")}</Label>
                  <Input
                    value={formState.contact}
                    onChange={(e) =>
                      setFormState({ ...formState, contact: e.target.value })
                    }
                    placeholder={t("contactPlaceholder")}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("phone")}</Label>
                  {formState.phone && (
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="size-2.5 text-emerald-500" />
                          <span className="text-emerald-500 font-medium">{t("copiedPhone")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-2.5 opacity-70" />
                          <span>{t("copyPhone")}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground">
                    <Phone className="size-3.5" />
                  </div>
                  <Input
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState({ ...formState, phone: e.target.value })
                    }
                    placeholder={t("phonePlaceholder")}
                    className="h-8 text-xs font-mono pl-8 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("email")}</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="size-3.5" />
                  </div>
                  <Input
                    value={formState.email || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, email: e.target.value })
                    }
                    placeholder={t("emailPlaceholder")}
                    className="h-8 text-xs pl-8 bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Print Spec & Order Stage */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
                <FileText className="size-3.5 text-blue-500" />
                <span>{t("orderSection")}</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("productInterest")}</Label>
                <Input
                  value={formState.productInterest}
                  onChange={(e) =>
                    setFormState({ ...formState, productInterest: e.target.value })
                  }
                  placeholder={t("productPlaceholder")}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("estimatedValue")}</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground">
                      <DollarSign className="size-3.5" />
                    </div>
                    <Input
                      type="number"
                      value={formState.estimatedOrderUsd || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          estimatedOrderUsd: Number(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono font-semibold pl-8 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("stage")}</Label>
                  <Select
                    value={formState.status}
                    onValueChange={(val) =>
                      val && setFormState({ ...formState, status: val as LeadStatus })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={cn("size-2 rounded-full shrink-0", STAGE_CONFIG[formState.status]?.dot)} />
                        <span className="truncate">{formState.status}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STAGE_CONFIG) as LeadStatus[]).map((st) => (
                        <SelectItem key={st} value={st}>
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", STAGE_CONFIG[st].dot)} />
                            <span>{t(`stages.${st === "Sample Sent" ? "SampleSent" : st}`)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("source")}</Label>
                  <Select
                    value={formState.source}
                    onValueChange={(val) =>
                      val && setFormState({ ...formState, source: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_SOURCES.map((src) => (
                        <SelectItem key={src} value={src}>
                          {src}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("manager")}</Label>
                  <Select
                    value={formState.manager}
                    onValueChange={(val) =>
                      val && setFormState({ ...formState, manager: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{formState.manager}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_MANAGERS.map((mgr) => (
                        <SelectItem key={mgr} value={mgr}>
                          <div className="flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span>{mgr}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width: Negotiation Notes & Quick Action Tags */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between pb-1 border-b border-border/50">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-blue-500" />
                <span>{t("notesSection")}</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {t("notesSubtitle")}
              </span>
            </div>

            <Textarea
              value={formState.notes || ""}
              onChange={(e) =>
                setFormState({ ...formState, notes: e.target.value })
              }
              placeholder={t("notesPlaceholder")}
              className="min-h-[58px] max-h-[85px] text-xs resize-none leading-relaxed bg-background"
            />

            {/* Quick Action Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-muted-foreground font-medium mr-0.5">
                {t("quickTags")}
              </span>
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddQuickTag(tag)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-background hover:bg-primary/10 text-muted-foreground hover:text-primary hover:border-primary/40 border border-border transition-all cursor-pointer font-medium active:scale-95 shadow-2xs"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pinned Footer with generous padding - Never clipped */}
        <div className="shrink-0 px-5 py-3 border-t border-border bg-muted/40 flex sm:flex-row items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              type="button"
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs disabled:opacity-50"
              disabled={!formState.company.trim() || formState.status === "Converted"}
              onClick={handleConvert}
            >
              <Sparkles className="size-3.5" />
              <span>{t("convertToOrder")}</span>
            </Button>

            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                title={t("delete")}
                onClick={() => {
                  if (confirm(t("deleteConfirm") || "Are you sure?")) {
                    onDelete(formState.id);
                    onOpenChange(false);
                  }
                }}
                className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-2.5"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">{t("delete")}</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-8 text-xs bg-background"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              type="button"
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
              onClick={handleSave}
            >
              <Save className="size-3.5" />
              <span>{t("save")}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
