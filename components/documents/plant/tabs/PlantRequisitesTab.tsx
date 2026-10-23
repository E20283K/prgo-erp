"use client";

import React from "react";
import { PlantRecord, PlantBankAccount } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scale,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";

interface PlantRequisitesTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

export function PlantRequisitesTab({ plant, onUpdate }: PlantRequisitesTabProps) {
  const handleAddAccount = () => {
    const newAcc: PlantBankAccount = {
      id: `ACC-${Date.now()}`,
      bankName: "",
      mfo: "",
      accountNumber: "",
      currency: "UZS",
      isPrimary: plant.bankAccounts.length === 0,
    };
    onUpdate({ bankAccounts: [...plant.bankAccounts, newAcc] });
  };

  const handleUpdateAccount = (id: string, updated: Partial<PlantBankAccount>) => {
    const nextAccounts = plant.bankAccounts.map((acc) => {
      if (acc.id === id) {
        return { ...acc, ...updated };
      }
      if (updated.isPrimary) {
        return { ...acc, isPrimary: false };
      }
      return acc;
    });
    onUpdate({ bankAccounts: nextAccounts });
  };

  const handleDeleteAccount = (id: string) => {
    if (plant.bankAccounts.length <= 1) return;
    onUpdate({
      bankAccounts: plant.bankAccounts.filter((acc) => acc.id !== id),
    });
  };

  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Legal Entity & Tax Registrations */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <Scale className="w-4 h-4 text-primary" />
          <span>Yuridik Shaxs Ma&apos;lumotlari va Soliq Rekvizitlari</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px] font-medium text-muted-foreground">
              To&apos;liq Yuridik Nomi (Shartnoma va schet-fakturalar uchun) *
            </Label>
            <Input
              value={plant.legalEntityName}
              onChange={(e) => onUpdate({ legalEntityName: e.target.value })}
              className="h-8 text-xs font-medium"
              placeholder="'PrintGoo Industrial Group' Mas'uliyati Cheklangan Jamiyati"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Yuridik Ro&apos;yxatdan O&apos;tgan Manzili (Ustav bo&apos;yicha)
            </Label>
            <Input
              value={plant.legalAddress}
              onChange={(e) => onUpdate({ legalAddress: e.target.value })}
              className="h-8 text-xs"
              placeholder="12 Amir Temur ko'chasi, Yunusobod tumani, Toshkent shahri, 100084"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              STIR / INN (Soliq to&apos;lovchining identifikatsiya raqami) *
            </Label>
            <Input
              value={plant.tin}
              onChange={(e) => onUpdate({ tin: e.target.value.replace(/\D/g, "").slice(0, 9) })}
              className="h-8 text-xs font-mono font-semibold"
              placeholder="9 xonali STIR (masalan: 305112890)"
              maxLength={9}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              QQS To&apos;lovchisi Ro&apos;yxat Kodi (VAT Registration Code)
            </Label>
            <Input
              value={plant.vatNumber || ""}
              onChange={(e) => onUpdate({ vatNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })}
              className="h-8 text-xs font-mono"
              placeholder="12 xonali QQS kodi"
              maxLength={12}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              OKED (Iqtisodiy faoliyat turi kodi)
            </Label>
            <Input
              value={plant.oked || ""}
              onChange={(e) => onUpdate({ oked: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="18.12.0"
              maxLength={10}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Aloqa Telefoni (Hisob-kitoblar bo&apos;yicha)
            </Label>
            <Input
              type="tel"
              value={plant.phone}
              onChange={(e) => onUpdate({ phone: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="+998 71 200-55-11"
            />
          </div>
        </div>
      </div>

      {/* 2. Bank Accounts */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <CreditCard className="w-4 h-4 text-primary" />
            <span>Bank Hisob-Raqamlari (20208 / 20214 / Valyuta)</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {plant.bankAccounts.length} ta hisob
            </Badge>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAddAccount}
            className="h-7 text-xs px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi Bank Hisobi</span>
          </Button>
        </div>

        <div className="space-y-2.5">
          {plant.bankAccounts.length === 0 ? (
            <div className="py-6 px-4 text-center rounded border border-dashed border-border bg-muted/10 space-y-2">
              <p className="text-xs text-muted-foreground">
                Hozircha bank hisob-raqamlari kiritilmagan.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAccount}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Birinchi hisob-raqamni kiritish</span>
              </Button>
            </div>
          ) : (
            plant.bankAccounts.map((account, index) => (
              <div
                key={account.id}
                className={`rounded-md border p-3 text-xs space-y-2.5 transition-colors ${
                  account.isPrimary
                    ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                    : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      #{index + 1}
                    </span>
                    <Badge
                      variant={account.isPrimary ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {account.isPrimary ? "Asosiy Hisob-Raqam" : "Qo'shimcha"}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {account.currency}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {!account.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateAccount(account.id, { isPrimary: true })}
                        className="h-6 text-[11px] px-2 text-primary hover:text-primary"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Asosiy qilib belgilash
                      </Button>
                    )}
                    {plant.bankAccounts.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAccount(account.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-[10px] text-muted-foreground">
                      Xizmat Ko&apos;rsatuvchi Bank Nomi
                    </Label>
                    <Input
                      value={account.bankName}
                      onChange={(e) =>
                        handleUpdateAccount(account.id, { bankName: e.target.value })
                      }
                      className="h-7 text-xs"
                      placeholder="Bank nomi (masalan: Kapitalbank, Ipak Yo'li)"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Bank MFO Kodi (5 xonali)
                    </Label>
                    <Input
                      value={account.mfo}
                      onChange={(e) =>
                        handleUpdateAccount(account.id, { mfo: e.target.value.replace(/\D/g, "").slice(0, 5) })
                      }
                      className="h-7 text-xs font-mono font-medium"
                      placeholder="01087"
                      maxLength={5}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Hisob Valyutasi
                    </Label>
                    <Select
                      value={account.currency}
                      onValueChange={(val: PlantBankAccount["currency"] | null) => {
                        if (val) handleUpdateAccount(account.id, { currency: val });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UZS">UZS — O&apos;zbek so&apos;mi</SelectItem>
                        <SelectItem value="USD">USD — AQSH dollari</SelectItem>
                        <SelectItem value="EUR">EUR — Yevro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-[10px] text-muted-foreground">
                      Hisob-Raqam (20 xonali) *
                    </Label>
                    <Input
                      value={account.accountNumber}
                      onChange={(e) =>
                        handleUpdateAccount(account.id, { accountNumber: e.target.value.replace(/\D/g, "").slice(0, 20) })
                      }
                      className="h-7 text-xs font-mono font-semibold tracking-wider"
                      placeholder="20208000..."
                      maxLength={20}
                      inputMode="numeric"
                    />
                  </div>

                  {account.currency !== "UZS" && (
                    <div className="space-y-1 md:col-span-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Tranzit Hisobi (22616)
                      </Label>
                      <Input
                        value={account.transitAccount || ""}
                        onChange={(e) =>
                          handleUpdateAccount(account.id, { transitAccount: e.target.value.replace(/\D/g, "").slice(0, 20) })
                        }
                        className="h-7 text-xs font-mono"
                        placeholder="22616840..."
                        maxLength={20}
                        inputMode="numeric"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
