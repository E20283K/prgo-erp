"use client";

import React, { useState } from "react";
import { MachineRecord } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Calculator,
  Percent,
  Clock,
  Zap,
  Wrench,
  Users,
  Building2,
  TrendingUp,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";

interface MachineCostingTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineCostingTab({ machine, onUpdate }: MachineCostingTabProps) {
  // Costing settings state
  const [investment, setInvestment] = useState<number>(machine.costing.investmentUsd);
  const [deprecYears, setDeprecYears] = useState<number>(machine.costing.depreciationYears);
  const [annualHours, setAnnualHours] = useState<number>(machine.costing.annualWorkHours);
  const [maintenanceFund, setMaintenanceFund] = useState<number>(machine.costing.hourlyMaintenanceReserveUsd);
  const [operatorWage, setOperatorWage] = useState<number>(machine.costing.operatorHourlyWageUsd);
  const [assistantWage, setAssistantWage] = useState<number>(machine.costing.assistantHourlyWageUsd);
  const [factoryOverhead, setFactoryOverhead] = useState<number>(machine.costing.factoryOverheadUsd);
  const [billingRate, setBillingRate] = useState<number>(machine.costing.standardHourlyRateUsd);

  // Dynamic calculations
  const electricityRate = machine.energy.hourlyElectricityCostUsd;
  const totalDeprecHours = Math.max(1, deprecYears * annualHours);
  const hourlyDepreciation = Number((investment / totalDeprecHours).toFixed(2));
  const totalBaseCost = Number(
    (
      hourlyDepreciation +
      electricityRate +
      maintenanceFund +
      operatorWage +
      assistantWage +
      factoryOverhead
    ).toFixed(2)
  );
  const profitMarginUsd = Number((billingRate - totalBaseCost).toFixed(2));
  const markupPercent = totalBaseCost > 0 ? Number(((profitMarginUsd / totalBaseCost) * 100).toFixed(1)) : 0;

  // ── Live Unit Production Cost Calculator State ──────────────────────────
  const getDefaultRunQty = () => {
    switch (machine.category) {
      case "flexo":
        return 5000;
      case "jacquard":
        return 10000;
      case "guillotine":
        return 2000;
      default:
        return 10000;
    }
  };

  const getSpeedDefault = () => {
    switch (machine.category) {
      case "offset":
        return machine.offsetSpecs?.practicalSpeedSph || 13500;
      case "flexo":
        return (machine.flexoSpecs?.practicalSpeedMpm || 130) * 60;
      case "die-cutting":
        return machine.dieCuttingSpecs?.practicalSpeedSph || 6500;
      case "lamination":
        return (machine.laminationSpecs?.practicalSpeedMpm || 45) * 60;
      case "jacquard":
        return (machine.jacquardSpecs?.practicalRpm || 720) * 60;
      case "guillotine":
        return 1500;
      default:
        return 5000;
    }
  };

  const getUnitName = () => {
    switch (machine.category) {
      case "flexo":
        return "metr";
      case "jacquard":
        return "pick (urish)";
      case "guillotine":
        return "kesim (zarb)";
      case "casing-in":
        return "kitob";
      default:
        return "varaq";
    }
  };

  const [simRunQty, setSimRunQty] = useState<number>(getDefaultRunQty());
  const [simSpeedPerHour, setSimSpeedPerHour] = useState<number>(getSpeedDefault());

  // Make-ready time in hours
  const makeReadyMinutes =
    machine.offsetSpecs?.makeReadyMinutes ||
    machine.flexoSpecs?.makeReadyMinutes ||
    machine.dieCuttingSpecs?.makeReadyMinutes ||
    machine.laminationSpecs?.makeReadyMinutes ||
    machine.jacquardSpecs?.makeReadyMinutes ||
    20;
  const makeReadyHours = makeReadyMinutes / 60;

  // Simulation computations
  const simRunHours = simSpeedPerHour > 0 ? simRunQty / simSpeedPerHour : 0;
  const simTotalHours = makeReadyHours + simRunHours;

  const simSetupBaseCost = makeReadyHours * totalBaseCost;
  const simSetupBillingPrice = makeReadyHours * billingRate;

  const simRunBaseCost = simRunHours * totalBaseCost;
  const simRunBillingPrice = simRunHours * billingRate;

  const simTotalBaseCost = simTotalHours * totalBaseCost;
  const simTotalBillingPrice = simTotalHours * billingRate;

  const simPowerCost = simTotalHours * electricityRate;
  const simCostPer1000Base = simRunQty > 0 ? (simTotalBaseCost / simRunQty) * 1000 : 0;
  const simPricePer1000Billing = simRunQty > 0 ? (simTotalBillingPrice / simRunQty) * 1000 : 0;

  const handleSaveCosting = () => {
    onUpdate({
      costing: {
        investmentUsd: investment,
        depreciationYears: deprecYears,
        annualWorkHours: annualHours,
        hourlyDepreciationUsd: hourlyDepreciation,
        hourlyElectricityUsd: electricityRate,
        hourlyMaintenanceReserveUsd: maintenanceFund,
        operatorHourlyWageUsd: operatorWage,
        assistantHourlyWageUsd: assistantWage,
        factoryOverheadUsd: factoryOverhead,
        totalBaseCostPerHourUsd: totalBaseCost,
        standardHourlyRateUsd: billingRate,
        markupPercent: markupPercent,
      },
    });
  };

  const handleResetCosting = () => {
    setInvestment(machine.costing.investmentUsd);
    setDeprecYears(machine.costing.depreciationYears);
    setAnnualHours(machine.costing.annualWorkHours);
    setMaintenanceFund(machine.costing.hourlyMaintenanceReserveUsd);
    setOperatorWage(machine.costing.operatorHourlyWageUsd);
    setAssistantWage(machine.costing.assistantHourlyWageUsd);
    setFactoryOverhead(machine.costing.factoryOverheadUsd);
    setBillingRate(machine.costing.standardHourlyRateUsd);
  };

  return (
    <div className="space-y-4">
      {/* 4 Costing KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ichki Tannarx (Base Cost)
            </span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              ${totalBaseCost.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Amortizatsiya + Elektr + Oylik + Tsex xarajati
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tijoriy Stavka (Kalkulyatsiya)
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ${billingRate.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Mijozga taqdim etiladigan rasmiy soatlik narx
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Sof Uskuna Marjasi
            </span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              +${profitMarginUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Ustama: +{markupPercent}% (Foydalilik ko'rsatkichi)
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Uskuna Investitsiyasi
            </span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              ${(investment / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {deprecYears} yillik muddat ({annualHours.toLocaleString()} soat/yil)
          </div>
        </div>
      </div>

      {/* Main 2-Column: Hourly Cost Breakdown Table vs Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: 1C Hourly Cost Breakdown Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
            <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Soatlik Ishlab Chiqarish Tannarxi Strukturasi
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                1C Standart
              </Badge>
            </div>
            <div className="p-3.5 space-y-2.5 text-xs">
              {/* 1. Depreciation */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    1. Uskuna Amortizatsiyasi:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    ${investment.toLocaleString()} ÷ ({deprecYears} yil × {annualHours.toLocaleString()} h)
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-foreground">
                    ${hourlyDepreciation.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground"> / soat</span>
                </div>
              </div>

              {/* 2. Electricity */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    2. Elektr Energiyasi Sarfi:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {machine.energy.activePowerKw} kW × ${machine.energy.electricityTariffUsd}/kWh
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    ${electricityRate.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground"> / soat</span>
                </div>
              </div>

              {/* 3. Maintenance Fund */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    3. Texnik Xizmat & Ehtiyot Qismlar Fondi:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Vallar, rezinamatolar, moylar va filtrlar zaxirasi
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={maintenanceFund}
                    onChange={(e) => setMaintenanceFund(Number(e.target.value) || 0)}
                    className="w-20 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-muted-foreground">$/h</span>
                </div>
              </div>

              {/* 4. Operator Wage */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    4. Mas'ul Bosmachi / Operator Oyligi:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    1-darajali bosh mutaxassis stavkasi
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={operatorWage}
                    onChange={(e) => setOperatorWage(Number(e.target.value) || 0)}
                    className="w-20 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-muted-foreground">$/h</span>
                </div>
              </div>

              {/* 5. Assistant Wage */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    5. Yordamchi / Taqlovchi Xodim Oyligi:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Qog'oz beruvchi yoki qabul qiluvchi yordamchi
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={assistantWage}
                    onChange={(e) => setAssistantWage(Number(e.target.value) || 0)}
                    className="w-20 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-muted-foreground">$/h</span>
                </div>
              </div>

              {/* 6. Factory Overhead */}
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    6. Tsex & Ma'muriy Umumiy Xarajatlar:
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Maydon ijarasi, yoritish, shamollatish, sug'urta ulushi
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={factoryOverhead}
                    onChange={(e) => setFactoryOverhead(Number(e.target.value) || 0)}
                    className="w-20 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-muted-foreground">$/h</span>
                </div>
              </div>

              {/* Total Base Hourly Rate Row */}
              <div className="flex items-center justify-between p-2 rounded bg-muted/60 font-semibold text-xs mt-2">
                <span>Jami Mashina Soatlik Tannarxi (Net Cost):</span>
                <span className="font-mono text-sm text-foreground">
                  ${totalBaseCost.toFixed(2)} / soat
                </span>
              </div>

              {/* Standard Commercial Billing Rate */}
              <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/20 font-semibold text-xs mt-2">
                <div className="space-y-0.5">
                  <span className="text-emerald-700 dark:text-emerald-300">
                    Mijozga Hisoblanadigan Tijoriy Narx (Billing Rate):
                  </span>
                  <span className="text-[10px] text-muted-foreground block font-normal">
                    Foyda marjasi: +${profitMarginUsd.toFixed(2)}/h ({markupPercent}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="5"
                    value={billingRate}
                    onChange={(e) => setBillingRate(Number(e.target.value) || 0)}
                    className="w-24 h-8 text-xs font-mono font-bold text-right text-emerald-600 dark:text-emerald-400 bg-background"
                  />
                  <span className="text-xs text-muted-foreground">$/h</span>
                </div>
              </div>

              {/* Save / Reset Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetCosting}
                  className="h-7 text-xs gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Qaytarish
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveCosting}
                  className="h-7 text-xs gap-1 bg-primary text-primary-foreground"
                >
                  <Save className="w-3.5 h-3.5" />
                  Stavkani Saqlash
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Unit Cost Production Simulator */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
            <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Jonli Tiraj & Birlik Narxi Kalkulyatori
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                1,000 {getUnitName()} hisobi
              </Badge>
            </div>
            <div className="p-3.5 space-y-4 text-xs">
              {/* Simulation Controls */}
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Tiraj Hajmi ({getUnitName()}):
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="1000"
                      value={simRunQty}
                      onChange={(e) => setSimRunQty(Number(e.target.value) || 0)}
                      className="w-28 h-7 text-xs font-mono text-right"
                    />
                    <span className="text-xs text-muted-foreground">{getUnitName()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Ishlash Tezligi ({getUnitName()}/soat):
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="500"
                      value={simSpeedPerHour}
                      onChange={(e) => setSimSpeedPerHour(Number(e.target.value) || 0)}
                      className="w-28 h-7 text-xs font-mono text-right"
                    />
                    <span className="text-xs text-muted-foreground">/ soat</span>
                  </div>
                </div>
              </div>

              {/* Simulation Results Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">
                    Priladka (Setup) Vaqti & Narxi:
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-medium text-foreground">
                      {makeReadyMinutes} daq (${simSetupBillingPrice.toFixed(2)})
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Tannarxi: ${simSetupBaseCost.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">
                    Asosiy Chop Etish Vaqti:
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-medium text-foreground">
                      {simRunHours.toFixed(2)} soat ({Math.round(simRunHours * 60)} daq)
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Chop narxi: ${simRunBillingPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">
                    Jami Uskuna Bandlik Vaqti:
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {simTotalHours.toFixed(2)} soat ({Math.round(simTotalHours * 60)} daq)
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">
                    Ushbu Tirajda Elektr Xarajati:
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                    ${simPowerCost.toFixed(2)} ({Number((simTotalHours * machine.energy.activePowerKw).toFixed(1))} kWh)
                  </span>
                </div>

                {/* 1,000 units highlighted cards */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg border border-border bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      1,000 {getUnitName()} Tannarxi:
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-lg font-bold font-mono text-foreground">
                        ${simCostPer1000Base.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Jami tannarx: ${simTotalBaseCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                      1,000 {getUnitName()} Mijoz Narxi:
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        ${simPricePer1000Billing.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                      Jami hisob: ${simTotalBillingPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Profit contribution indicator */}
                <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      Uskunadan Olingan Sof Yalpi Foyda:
                    </span>
                  </div>
                  <span className="text-sm font-bold font-mono text-purple-600 dark:text-purple-400">
                    +${(simTotalBillingPrice - simTotalBaseCost).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
