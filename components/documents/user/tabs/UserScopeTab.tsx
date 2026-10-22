"use client";

import React from "react";
import { SystemUserRecord, UserScope } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Lock,
  BadgePercent,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

interface UserScopeTabProps {
  data: SystemUserRecord;
  onChange: (updated: Partial<SystemUserRecord>) => void;
}

export function UserScopeTab({ data, onChange }: UserScopeTabProps) {
  const { plants } = useWorkspaceStore();
  const scope: UserScope = data.scope || {
    allPlants: false,
    plantIds: [],
    viewCostPrice: false,
    viewMargin: false,
    maxDiscountPercent: 0,
    ownDocumentsOnly: false,
  };

  const updateScope = (partial: Partial<UserScope>) => {
    onChange({
      scope: {
        ...scope,
        ...partial,
      },
    });
  };

  const handlePlantToggle = (plantId: string) => {
    const current = scope.plantIds || [];
    const exists = current.includes(plantId);
    const next = exists ? current.filter((id) => id !== plantId) : [...current, plantId];
    updateScope({ plantIds: next });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Section 1: Filiallarga Kirish Ko'lami ───────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Korxona Filiallari va Hududiy Ko&apos;lam
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Foydalanuvchi ma&apos;lumotlarni qaysi zavod va filiallar kesimida ko&apos;rishi va boshqarishi mumkin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="all-plants-switch" className="text-xs font-medium cursor-pointer">
              Barcha Filiallarga Ruxsat
            </Label>
            <Switch
              id="all-plants-switch"
              checked={scope.allPlants}
              onCheckedChange={(checked) => updateScope({ allPlants: checked })}
            />
          </div>
        </div>

        <div className="p-4 space-y-3">
          {scope.allPlants ? (
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Foydalanuvchiga tizimdagi barcha korxona filiallari (Bosh ofis, Sergeli zavodi, Chilonzor va boshqalar) bo&apos;yicha ma&apos;lumotlarni ko&apos;rish va boshqarish huquqi berilgan.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-foreground block">
                Ruxsat etilgan alohida filiallar (kamida 1 ta belgilang):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {plants.map((plt) => {
                  const isChecked = (scope.plantIds || []).includes(plt.id);
                  return (
                    <div
                      key={plt.id}
                      onClick={() => handlePlantToggle(plt.id)}
                      className={`p-2.5 rounded-md border flex items-center gap-2.5 cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-background hover:bg-muted/40 border-border text-muted-foreground"
                      }`}
                    >
                      <Checkbox checked={isChecked} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {plt.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {plt.code} • {plt.branchType}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Moliyaviy va Tijoriy Maxfiylik Cheklovlari ──────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-600" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Moliyaviy Maxfiylik va Tijoriy Cheklovlar
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Xomashyo tannarxi, buyurtma marjasi va chegirma vakolatlarini cheklash
            </p>
          </div>
        </div>

        <div className="divide-y divide-border px-4">
          {/* View Cost Price Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-600" />
                <span>Xomashyo va Ishlab Chiqarish Tannarxini Ko&apos;rish</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                O&apos;chirilsa, buyurtma va texnologik xaritadagi xomashyo narxlari hamda soatlik stavkalar yashiriladi.
              </p>
            </div>
            <Switch
              checked={scope.viewCostPrice}
              onCheckedChange={(checked) => updateScope({ viewCostPrice: checked })}
            />
          </div>

          {/* View Margin Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5 text-emerald-600" />
                <span>Savdo Marjasi va Rentabellikni Ko&apos;rish</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Buyurtma va shartnomalardagi sof foyda, marja foizi va korxona ustamasini ko&apos;rsatish.
              </p>
            </div>
            <Switch
              checked={scope.viewMargin}
              onCheckedChange={(checked) => updateScope({ viewMargin: checked })}
            />
          </div>

          {/* Own Documents Only Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>Faqat O&apos;ziga Biriktirilgan Hujjatlar</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Menejer faqat o&apos;zi yaratgan yoki biriktirilgan mijoz va buyurtmalarni ko&apos;radi (boshqalarnikini ko&apos;rmaydi).
              </p>
            </div>
            <Switch
              checked={scope.ownDocumentsOnly}
              onCheckedChange={(checked) => updateScope({ ownDocumentsOnly: checked })}
            />
          </div>

          {/* Max Discount Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5 text-amber-600" />
                <span>Maksimal Ruxsat Etilgan Chegirma Foizi (%)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Menejer buyurtma hisoblagichida mijozga berishi mumkin bo&apos;lgan eng yuqori chegirma (0% = chegirma taqiqlangan).
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                min="0"
                max="100"
                value={scope.maxDiscountPercent}
                onChange={(e) => updateScope({ maxDiscountPercent: Number(e.target.value) || 0 })}
                className="h-8 text-xs font-mono w-20 text-right"
              />
              <span className="text-xs font-mono text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
