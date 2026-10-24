"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  History,
  Search,
  ArrowRightLeft,
  Boxes,
  Cpu,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  X,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  WorkOrderHistoryEntry,
  HistoryEventCategory,
  WorkOrderFormData,
} from "../types";

interface HistoryTabProps {
  docNo?: string;
  formData?: WorkOrderFormData;
  customEntries?: WorkOrderHistoryEntry[];
  refreshTrigger?: number;
}

export function HistoryTab({ docNo, customEntries, formData, refreshTrigger }: HistoryTabProps) {
  const t = useTranslations("WorkOrderHistory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HistoryEventCategory | "all">("all");
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverEntries, setServerEntries] = useState<WorkOrderHistoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Haqiqiy audit tarixini serverdan yuklash
  const fetchHistory = useCallback(
    async (isManual = false) => {
      const cleanDocNo = (docNo || "").trim();
      if (
        !cleanDocNo ||
        cleanDocNo.startsWith("draft-") ||
        cleanDocNo.startsWith("temp-") ||
        cleanDocNo === "NEW" ||
        cleanDocNo.includes("Qoralama")
      ) {
        return;
      }

      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const res = await fetch(
          `/api/v1/production/work-orders/${encodeURIComponent(cleanDocNo)}/history`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setServerEntries(json.data);
          }
        }
      } catch (err) {
        console.error("[HistoryTab] Fetch error:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [docNo]
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  // Server yoki tashqi yozuvlarni tanlash (fallback: 1 ta boshlang'ich yozuv)
  const rawEntries = useMemo(() => {
    if (customEntries && customEntries.length > 0) return customEntries;
    if (serverEntries && serverEntries.length > 0) return serverEntries;
    if (docNo && !docNo.startsWith("draft-") && !docNo.startsWith("temp-")) {
      return [
        {
          id: `hist-${docNo}-init`,
          timestamp:
            formData?.startDate || new Date().toISOString().slice(0, 19).replace("T", " "),
          author: {
            name: "Tizim / Operator",
            role: "Yaratuvchi",
            initials: "SYS",
          },
          category: "status" as const,
          action: `Buyurtma yaratildi: ${docNo}`,
          details: formData?.customer
            ? `Mijoz: ${formData.customer} • Mahsulot: ${formData.product || "Noma'lum"}`
            : "Yangi buyurtma hujjati ochildi.",
          badgeText: formData?.status || "Draft",
          badgeVariant: "default" as const,
        },
      ];
    }
    return [];
  }, [customEntries, serverEntries, docNo, formData]);

  // Kategoriya va qidiruv bo'yicha filtrlash
  const filteredEntries = useMemo(() => {
    return rawEntries.filter((item) => {
      // Kategoriya filtri
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      // Matnli qidiruv
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchAuthor =
        item.author.name.toLowerCase().includes(q) ||
        item.author.role.toLowerCase().includes(q);
      const matchAction = item.action.toLowerCase().includes(q);
      const matchDetails = item.details?.toLowerCase().includes(q);
      const matchDiff = item.diffs?.some(
        (d) =>
          d.field.toLowerCase().includes(q) ||
          d.fieldLabel.toLowerCase().includes(q) ||
          String(d.newValue).toLowerCase().includes(q) ||
          String(d.oldValue).toLowerCase().includes(q)
      );
      return matchAuthor || matchAction || matchDetails || matchDiff;
    });
  }, [rawEntries, selectedCategory, searchQuery]);

  // Kategoriya bo'yicha hisoblagichlar
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: rawEntries.length,
      status: 0,
      spec: 0,
      material: 0,
      planning: 0,
      system: 0,
    };
    rawEntries.forEach((e) => {
      if (counts[e.category] !== undefined) {
        counts[e.category]++;
      }
    });
    return counts;
  }, [rawEntries]);

  const handleRefresh = () => {
    fetchHistory(true);
  };

  const handleCopyHistory = () => {
    const textLog = filteredEntries
      .map(
        (e) =>
          `[${e.timestamp}] ${e.action} by ${e.author.name} (${e.author.role})${
            e.details ? ` - ${e.details}` : ""
          }${
            e.diffs && e.diffs.length > 0
              ? ` | O'zgarishlar: ${e.diffs.map((d) => `${d.fieldLabel}: ${d.oldValue} -> ${d.newValue}`).join(", ")}`
              : ""
          }`
      )
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCategoryConfig = (category: HistoryEventCategory) => {
    switch (category) {
      case "status":
        return {
          icon: ArrowRightLeft,
          bgClass:
            "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800",
          nodeClass: "bg-blue-600 text-white ring-4 ring-background shadow-xs",
        };
      case "spec":
        return {
          icon: SlidersHorizontal,
          bgClass:
            "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800",
          nodeClass: "bg-purple-600 text-white ring-4 ring-background shadow-xs",
        };
      case "material":
        return {
          icon: Boxes,
          bgClass:
            "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800",
          nodeClass: "bg-amber-600 text-white ring-4 ring-background shadow-xs",
        };
      case "planning":
        return {
          icon: Cpu,
          bgClass:
            "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
          nodeClass: "bg-cyan-600 text-white ring-4 ring-background shadow-xs",
        };
      case "system":
      default:
        return {
          icon: ShieldCheck,
          bgClass:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
          nodeClass: "bg-emerald-600 text-white ring-4 ring-background shadow-xs",
        };
    }
  };

  return (
    <TabsContent
      value="history"
      className="flex-1 min-h-0 flex flex-col p-4 m-0 overflow-hidden bg-background"
    >
      {/* ── TOOLBAR & HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {t("title")}
            </h2>
            {docNo && (
              <Badge variant="outline" className="font-mono text-[11px] h-5 px-1.5 font-normal">
                {docNo}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
              {t("recordsFound", { count: filteredEntries.length })}
            </Badge>
            {isLoading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        {/* Harakat tugmalari */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Qidiruv */}
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 pl-8 pr-7 text-xs bg-card"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Kategoriya filtri */}
          <Select
            value={selectedCategory}
            onValueChange={(val) => setSelectedCategory(val as HistoryEventCategory | "all")}
          >
            <SelectTrigger className="h-8 text-xs w-[160px] bg-card">
              <SelectValue placeholder={t("filterCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("allEvents")} ({categoryCounts.all})
              </SelectItem>
              <SelectItem value="status">
                {t("statusEvents")} ({categoryCounts.status})
              </SelectItem>
              <SelectItem value="spec">
                {t("specEvents")} ({categoryCounts.spec})
              </SelectItem>
              <SelectItem value="material">
                {t("materialEvents")} ({categoryCounts.material})
              </SelectItem>
              <SelectItem value="planning">
                {t("planningEvents")} ({categoryCounts.planning})
              </SelectItem>
              <SelectItem value="system">
                {t("systemEvents")} ({categoryCounts.system})
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Eksport qilish */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyHistory}
                    className="h-8 px-2 text-xs"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="sr-only sm:not-sr-only sm:ml-1.5">{t("exportLog")}</span>
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="text-xs">
                Audit tarixini buferga (clipboard) nusxalash
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Yangilash tugmasi */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-8 w-8 p-0"
            title={t("refresh")}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isRefreshing ? "animate-spin text-primary" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* ── TIMELINE CONTAINER ── */}
      <ScrollArea className="flex-1 min-h-0 mt-3 px-3">
        {isLoading && (!serverEntries || serverEntries.length === 0) ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary/70" />
            <p className="text-xs">Audit tarixi serverdan yuklanmoqda...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground">{t("noRecords")}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Filtrlarni tozalab ko'ring yoki boshqa toifani tanlang.
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-4 h-7 text-xs"
              >
                {t("clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <div className="py-2 pl-3 pr-2 space-y-0">
            {filteredEntries.map((item, idx) => {
              const cfg = getCategoryConfig(item.category);
              const IconComp = cfg.icon;
              const isFirst = idx === 0;
              const isLast = idx === filteredEntries.length - 1;

              return (
                <div key={item.id} className="relative flex items-stretch gap-3 group">
                  {/* Timeline Rail Column */}
                  <div className="relative flex flex-col items-center shrink-0 w-8">
                    {/* Yuqori ulanish chizig'i */}
                    <div className={`w-[2px] h-3 bg-border/80 ${isFirst ? "invisible" : ""}`} />

                    {/* Doira tugun */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.nodeClass} transition-transform group-hover:scale-105 z-10`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                    </div>

                    {/* Pastki ulanish chizig'i */}
                    <div className={`w-[2px] flex-1 bg-border/80 ${isLast ? "invisible" : ""}`} />
                  </div>

                  {/* Hodisa kartochkasi */}
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="p-3 bg-card rounded-md border border-border/80 shadow-2xs hover:border-border transition-colors">
                      {/* Bosh qism */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Muallif Avatari */}
                          <Avatar className="h-6 w-6 border border-border shrink-0">
                            <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                              {item.author.initials || item.author.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex items-baseline gap-1.5 truncate">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {item.author.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              ({item.author.role})
                            </span>
                          </div>
                        </div>

                        {/* O'ng taraf: Holat va Sana */}
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          {item.badgeText && (
                            <Badge
                              variant={item.badgeVariant || "outline"}
                              className="text-[10px] font-medium h-5 px-1.5"
                            >
                              {item.badgeText}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                            <Clock className="w-3 h-3 text-muted-foreground/70" />
                            <span>{item.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      {/* Amal nomi */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {item.action}
                        </span>
                      </div>

                      {/* Tafsilotlar */}
                      {item.details && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {item.details}
                        </p>
                      )}

                      {/* Diffs: O'zgargan parametrlar bloki */}
                      {item.diffs && item.diffs.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/60 bg-muted/20 rounded p-2 text-xs space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
                            <span>{t("diffTitle")}</span>
                          </div>

                          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                            {item.diffs.map((diff, dIdx) => (
                              <div
                                key={dIdx}
                                className="flex flex-wrap items-center gap-2 text-xs bg-background/80 px-2 py-1 rounded border border-border/50"
                              >
                                <span className="font-medium text-foreground text-xs min-w-[140px]">
                                  {diff.fieldLabel}:
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="line-through text-muted-foreground font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                    {diff.oldValue}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                                    {diff.newValue}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </TabsContent>
  );
}
