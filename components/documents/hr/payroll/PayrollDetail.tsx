"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { PayrollRecord } from "../types";
import {
  DocumentHeader,
  DocumentSidebar,
  DocumentNavItem,
  SidebarSummaryCard,
  InfoRow,
} from "../../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  CreditCard,
  Printer,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Layers,
  Banknote,
  FileCheck,
  User,
} from "lucide-react";

interface PayrollDetailProps {
  tab: DocumentTab;
}

export function PayrollDetail({ tab }: PayrollDetailProps) {
  const { payrolls, upsertPayroll, setTabUnsaved, updateTabData, closeTab, addNotification } =
    useWorkspaceStore();

  const payId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("pay-")) return tab.id.replace("pay-", "");
    return tab.id;
  }, [tab]);

  const initialPayroll: PayrollRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.employeeName) {
      return tab.documentData;
    }
    const found = payrolls.find((p) => p.id === payId);
    return (
      found || {
        id: payId,
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        employeeId: "",
        badgeNumber: "",
        badgeNo: "",
        employeeName: tab.title || "Xodim",
        department: "",
        position: "",
        wageType: "salary",
        baseSalary: 0,
        pieceworkAmount: 0,
        overtimeAmount: 0,
        bonusAmount: 0,
        grossPay: 0,
        advanceDeduction: 0,
        taxDeduction: 0,
        penaltyDeduction: 0,
        totalDeductions: 0,
        netPay: 0,
        status: "draft",
        paymentMethod: "bank_card",
      }
    );
  }, [tab.documentData, payrolls, payId]);

  const [formData, setFormData] = useState<PayrollRecord>(initialPayroll);
  const [activeTab, setActiveTab] = useState<string>("breakdown");

  const handleUpdate = (updated: Partial<PayrollRecord>) => {
    const next = { ...formData, ...updated };
    const gross =
      Number(next.baseSalary || 0) +
      Number(next.pieceworkAmount || 0) +
      Number(next.overtimeAmount || 0) +
      Number(next.bonusAmount || 0);

    const deductions =
      Number(next.advanceDeduction || 0) +
      Number(next.taxDeduction || 0) +
      Number(next.penaltyDeduction || 0);

    const net = Math.max(0, gross - deductions);

    const recalculated = {
      ...next,
      grossPay: gross,
      totalDeductions: deductions,
      netPay: net,
    };

    setFormData(recalculated);
    setTabUnsaved(tab.id, true);
  };

  const handleApprove = () => {
    const updated = { ...formData, status: "approved" as any };
    setFormData(updated);
    upsertPayroll(updated);
    updateTabData(tab.id, updated);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Oylik tasdiqlandi",
      description: `${formData.employeeName} uchun hisob-kitob tasdiqlandi (Проведено).`,
      severity: "success",
    });
  };

  const navItems: DocumentNavItem[] = [
    { id: "breakdown", label: "Hisob-kitob varaqasi", icon: Calculator },
    { id: "accruals", label: "Daromadlar tarkibi", icon: TrendingUp },
    { id: "deductions", label: "Ushlanmalar", icon: TrendingDown },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      <DocumentHeader
        icon={Calculator}
        title={`Hisob varaqasi: ${formData.employeeName}`}
        docNo={`${formData.period} / ${formData.badgeNumber || formData.badgeNo}`}
        status={formData.status}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Chop etish (Расчётный листок)
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              onClick={handleApprove}
            >
              <CheckCircle2 className="size-3.5" />
              Tasdiqlash (Проведено)
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={Calculator}
              title={formData.employeeName}
              subtitle={formData.position || "Xodim"}
            >
              <InfoRow label="Hisob davri">
                <span className="font-mono font-semibold text-primary">{formData.period}</span>
              </InfoRow>
              <InfoRow label="Jami hisoblangan">
                <span className="font-mono font-medium">
                  {formData.grossPay.toLocaleString("uz-UZ")} UZS
                </span>
              </InfoRow>
              <InfoRow label="Jami ushlanmalar">
                <span className="font-mono font-medium text-destructive">
                  -{formData.totalDeductions.toLocaleString("uz-UZ")} UZS
                </span>
              </InfoRow>
              <InfoRow label="Sof to'lov (Net)">
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formData.netPay.toLocaleString("uz-UZ")} UZS
                </span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Bo'limlar"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {/* Accruals Card */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="size-4" />
                    Hisoblangan Daromadlar (+)
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {formData.grossPay.toLocaleString("uz-UZ")} UZS
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs">Asosiy oklad (Sobit stavka)</Label>
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => handleUpdate({ baseSalary: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Ishbay bajarilgan naryadlar (Sdelka)</Label>
                  <Input
                    type="number"
                    value={formData.pieceworkAmount}
                    onChange={(e) => handleUpdate({ pieceworkAmount: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Qo'shimcha ish vaqti (Overtime 1.5x)</Label>
                  <Input
                    type="number"
                    value={formData.overtimeAmount}
                    onChange={(e) => handleUpdate({ overtimeAmount: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Bonuslar va mukofotlar</Label>
                  <Input
                    type="number"
                    value={formData.bonusAmount}
                    onChange={(e) => handleUpdate({ bonusAmount: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Deductions Card */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-destructive">
                  <span className="flex items-center gap-1.5">
                    <TrendingDown className="size-4" />
                    Ushlanmalar va Soliqlar (-)
                  </span>
                  <span className="font-mono font-bold text-sm">
                    -{formData.totalDeductions.toLocaleString("uz-UZ")} UZS
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs">Berilgan avans qaytarilishi</Label>
                  <Input
                    type="number"
                    value={formData.advanceDeduction}
                    onChange={(e) => handleUpdate({ advanceDeduction: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">JShODS Solig'i (12%)</Label>
                  <Input
                    type="number"
                    value={formData.taxDeduction}
                    onChange={(e) => handleUpdate({ taxDeduction: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Jarimalar yoki brak ushlanmasi</Label>
                  <Input
                    type="number"
                    value={formData.penaltyDeduction}
                    onChange={(e) => handleUpdate({ penaltyDeduction: Number(e.target.value) || 0 })}
                    className="h-8 font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grand Net Summary Card */}
          <div className="max-w-4xl p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Xodimga To'lanadigan Sof Ish Haqi (Net Pay)
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {formData.netPay.toLocaleString("uz-UZ")} UZS
              </div>
            </div>

            <div className="text-right space-y-1">
              <Badge variant="outline" className="text-xs bg-background">
                To'lov usuli: {formData.paymentMethod === "cash" ? "Naqd pul" : "Bank kartasi (Uzcard)"}
              </Badge>
              <div className="text-[11px] text-muted-foreground">
                Holati: <strong className="text-foreground">{formData.status}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
