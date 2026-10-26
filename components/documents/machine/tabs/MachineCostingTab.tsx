"use client";

import React, { useState } from "react";
import { MachineRecord } from "../types";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

interface MachineCostingTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineCostingTab({ machine, onUpdate }: MachineCostingTabProps) {
  // Costing settings state (clean defaults, no hardcoded Heidelberg rates)
  const [investment, setInvestment] = useState<number>(machine.costing?.investmentUsd || 0);
  const [deprecYears, setDeprecYears] = useState<number>(machine.costing?.depreciationYears || 8);
  const [annualHours, setAnnualHours] = useState<number>(machine.costing?.annualWorkHours || 2000);
  const [maintenanceFund, setMaintenanceFund] = useState<number>(machine.costing?.hourlyMaintenanceReserveUsd || 0);
  const [operatorWage, setOperatorWage] = useState<number>(machine.costing?.operatorHourlyWageUsd || 0);
  const [assistantWage, setAssistantWage] = useState<number>(machine.costing?.assistantHourlyWageUsd || 0);
  const [factoryOverhead, setFactoryOverhead] = useState<number>(machine.costing?.factoryOverheadUsd || 0);
  const [billingRate, setBillingRate] = useState<number>(machine.costing?.standardHourlyRateUsd || 0);

  // Dynamic calculations
  const electricityRate = machine.energy?.hourlyElectricityCostUsd || 0;
  const totalDeprecHours = Math.max(1, deprecYears * annualHours);
  const hourlyDepreciation = investment > 0 ? Number((investment / totalDeprecHours).toFixed(2)) : 0;
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
      case "lamination":
        return 1000;
      case "jacquard":
        return 5000;
      case "guillotine":
        return 500;
      case "casing-in":
        return 300;
      default:
        return 1000;
    }
  };

  const getSpeedDefault = () => {
    switch (machine.category) {
      case "offset":
        return machine.offsetSpecs?.practicalSpeedSph || 0;
      case "flexo":
        return (machine.flexoSpecs?.practicalSpeedMpm || 0) * 60;
      case "die-cutting":
        return machine.dieCuttingSpecs?.practicalSpeedSph || 0;
      case "lamination":
        return (machine.laminationSpecs?.practicalSpeedMpm || 0) * 60;
      case "jacquard":
        return (machine.jacquardSpecs?.practicalRpm || 0) * 60;
      case "mounting":
        return machine.mountingSpecs?.practicalSpeedSph || 0;
      case "casing-in":
        return machine.casingInSpecs?.speedCyclesPerHour || 0;
      case "guillotine":
        return machine.guillotineSpecs?.cycleTimeSec ? Math.round(3600 / machine.guillotineSpecs.cycleTimeSec) : 0;
      default:
        return 0;
    }
  };

  const getUnitName = () => {
    switch (machine.category) {
      case "flexo":
      case "lamination":
        return "metr";
      case "jacquard":
        return "zarb (picks)";
      case "guillotine":
        return "kesim";
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
    machine.mountingSpecs?.makeReadyMinutes ||
    machine.casingInSpecs?.makeReadyMinutes ||
    0;
  const makeReadyHours = makeReadyMinutes / 60;

  // Simulation computations
  const effectiveSpeed = simSpeedPerHour > 0 ? simSpeedPerHour : (getSpeedDefault() || 1000);
  const simRunHours = effectiveSpeed > 0 ? simRunQty / effectiveSpeed : 0;
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
    setInvestment(machine.costing?.investmentUsd || 0);
    setDeprecYears(machine.costing?.depreciationYears || 8);
    setAnnualHours(machine.costing?.annualWorkHours || 2000);
    setMaintenanceFund(machine.costing?.hourlyMaintenanceReserveUsd || 0);
    setOperatorWage(machine.costing?.operatorHourlyWageUsd || 0);
    setAssistantWage(machine.costing?.assistantHourlyWageUsd || 0);
    setFactoryOverhead(machine.costing?.factoryOverheadUsd || 0);
    setBillingRate(machine.costing?.standardHourlyRateUsd || 0);
  };

  return (
    <div className="space-y-4">
      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tijoriy Soatlik Stavka
            </span>
            <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ${billingRate.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Mijoz kalkulyatsiyasidagi stavka
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              To'liq Tannarx (Base Cost)
            </span>
            <div className="h-7 w-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              ${totalBaseCost.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Sex xarajatlari va ish haqi yig'indisi
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Soatlik Sof Foyda
            </span>
            <div className="h-7 w-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              ${profitMarginUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Marja: {markupPercent}% ustama
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              1,000 dona Tannarxi
            </span>
            <div className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              ${simCostPer1000Base.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ 1k</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Sotish narxi: ${simPricePer1000Billing.toFixed(2)}/1k
          </div>
        </div>
      </div>

      {/* 2-Column: Left Cost Structure Breakdown & Right Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Hourly Cost Matrix Configuration */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs flex flex-col">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Soatlik Xarajatlar Tarkibi (Cost Structure)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetCosting}
                className="h-6 text-[10px] gap-1 px-1.5"
                title="Boshlang'ich holatga qaytarish"
              >
                <RotateCcw className="w-3 h-3" />
                Qaytarish
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCosting}
                className="h-6 text-[10px] gap-1 px-2 bg-primary text-primary-foreground"
              >
                <Save className="w-3 h-3" />
                Saqlash
              </Button>
            </div>
          </div>

          <div className="p-3.5 space-y-3 text-xs flex-1">
            {/* 1. Depreciation */}
            <div className="rounded border border-border/70 p-2.5 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  Uskuna Investitsiyasi va Amortizatsiya
                </span>
                <span className="font-mono font-bold text-foreground">
                  ${hourlyDepreciation.toFixed(2)}/soat
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Investitsiya ($):</Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={investment || ""}
                    onValueChange={(values) => setInvestment(values.floatValue ?? 0)}
                    placeholder="0"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Amortizatsiya (yil):</Label>
                  <Input
                    type="number"
                    value={deprecYears || ""}
                    onChange={(e) => setDeprecYears(Number(e.target.value) || 1)}
                    placeholder="8"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Yillik ish soati:</Label>
                  <Input
                    type="number"
                    value={annualHours || ""}
                    onChange={(e) => setAnnualHours(Number(e.target.value) || 1)}
                    placeholder="2000"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Electricity & Maintenance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded border border-border/70 p-2.5 space-y-1.5 bg-muted/10">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1 text-foreground">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Elektr Energiyasi
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    ${electricityRate.toFixed(2)}/h
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Elektr quvvati va tarifi asosida hisoblanadi
                </p>
              </div>

              <div className="rounded border border-border/70 p-2.5 space-y-1 bg-muted/10">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1 text-foreground">
                    <Wrench className="w-3.5 h-3.5 text-purple-500" />
                    Ta'mir Jamg'armasi
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    ${maintenanceFund.toFixed(2)}/h
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.5"
                  value={maintenanceFund || ""}
                  onChange={(e) => setMaintenanceFund(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>

            {/* 3. Labor Wages */}
            <div className="rounded border border-border/70 p-2.5 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  Ish Haqi (Operator va Yordamchi)
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${(operatorWage + assistantWage).toFixed(2)}/soat
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Bosh operator stavkasi ($/soat):</Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={operatorWage || ""}
                    onValueChange={(values) => setOperatorWage(values.floatValue ?? 0)}
                    placeholder="0"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Yordamchi stavkasi ($/soat):</Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={assistantWage || ""}
                    onValueChange={(values) => setAssistantWage(values.floatValue ?? 0)}
                    placeholder="0"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 4. Overhead & Commercial Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded border border-border/70 p-2.5 space-y-1 bg-muted/10">
                <Label className="text-[10px] font-medium text-muted-foreground">Sex / Zavod Umumiy Xarajati ($/h):</Label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={2}
                  value={factoryOverhead || ""}
                  onValueChange={(values) => setFactoryOverhead(values.floatValue ?? 0)}
                  placeholder="0"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="rounded border border-primary/40 bg-primary/5 p-2.5 space-y-1">
                <Label className="text-[10px] font-semibold text-primary">Tijoriy Sotish Stavkasi ($/h):</Label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={2}
                  value={billingRate || ""}
                  onValueChange={(values) => setBillingRate(values.floatValue ?? 0)}
                  placeholder="0"
                  className="h-7 text-xs font-mono font-bold text-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Real-time Job Costing Calculator */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs flex flex-col">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Tannarx va Narx Simulyatori
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-3 text-xs flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Simulyatsiya Tiraji ({getUnitName()}):
                </Label>
                <Input
                  type="number"
                  step="500"
                  value={simRunQty || ""}
                  onChange={(e) => setSimRunQty(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Tezlik ({getUnitName()}/soat):
                </Label>
                <Input
                  type="number"
                  step="500"
                  value={simSpeedPerHour || ""}
                  onChange={(e) => setSimSpeedPerHour(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono font-medium"
                />
              </div>
            </div>

            <Separator />

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  Priladka Vaqti:
                </span>
                <span className="font-mono text-foreground">
                  {makeReadyMinutes} daqiqa ({makeReadyHours.toFixed(2)} soat)
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Chop Etish / Ish Vaqti:</span>
                <span className="font-mono text-foreground">{simRunHours.toFixed(2)} soat</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50 font-medium">
                <span className="text-foreground">Jami Kerakli Vaqt:</span>
                <span className="font-mono font-bold text-foreground">{simTotalHours.toFixed(2)} soat</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Elektr Sarfi Narxi:
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  ${simPowerCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ishlab Chiqarish Tannarxi (Base):</span>
                <span className="font-mono text-foreground font-semibold">
                  ${simTotalBaseCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 font-bold text-sm bg-muted/20 px-2 rounded">
                <span className="text-primary">Tijoriy Taklif Narxi (Billing):</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${simTotalBillingPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
