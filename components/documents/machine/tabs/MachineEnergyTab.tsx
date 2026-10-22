"use client";

import React, { useState } from "react";
import { MachineRecord } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Zap,
  DollarSign,
  Gauge,
  Flame,
  CheckCircle2,
  RotateCcw,
  Save,
  Sliders,
  TrendingDown,
} from "lucide-react";

interface MachineEnergyTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineEnergyTab({ machine, onUpdate }: MachineEnergyTabProps) {
  const [tariff, setTariff] = useState<number>(machine.energy?.electricityTariffUsd ?? 0.08);
  const [activeLoad, setActiveLoad] = useState<number>(machine.energy?.activePowerKw ?? 0);
  const [monthlyHours, setMonthlyHours] = useState<number>(machine.energy?.monthlyHoursPlanned ?? 176);

  // Computed values
  const hourlyCost = activeLoad * tariff;
  const monthlyKwh = activeLoad * monthlyHours;
  const monthlyCost = monthlyKwh * tariff;

  // Approximate UZS exchange (1 USD = 12,800 UZS)
  const UZS_RATE = 12800;
  const tariffUzs = Math.round(tariff * UZS_RATE);
  const hourlyCostUzs = Math.round(hourlyCost * UZS_RATE);
  const monthlyCostUzs = Math.round(monthlyCost * UZS_RATE);

  // Power distribution calculation
  const dryerPower = machine.energy?.dryerHeatingKw ?? 0;
  const chillerPower = machine.energy?.chillerPowerKw ?? 0;
  const driveMotorPower = Math.max(0, Number((activeLoad - (dryerPower * 0.6) - chillerPower).toFixed(1)));

  const handleApply = () => {
    onUpdate({
      energy: {
        ...machine.energy,
        electricityTariffUsd: tariff,
        activePowerKw: activeLoad,
        monthlyHoursPlanned: monthlyHours,
        hourlyElectricityCostUsd: Number(hourlyCost.toFixed(2)),
        monthlyPowerCostUsd: Number(monthlyCost.toFixed(2)),
      },
      costing: {
        ...machine.costing,
        hourlyElectricityUsd: Number(hourlyCost.toFixed(2)),
        totalBaseCostPerHourUsd: Number(
          (
            (machine.costing?.hourlyDepreciationUsd || 0) +
            hourlyCost +
            (machine.costing?.hourlyMaintenanceReserveUsd || 0) +
            (machine.costing?.operatorHourlyWageUsd || 0) +
            (machine.costing?.assistantHourlyWageUsd || 0) +
            (machine.costing?.factoryOverheadUsd || 0)
          ).toFixed(2)
        ),
      },
    });
  };

  const handleReset = () => {
    setTariff(machine.energy?.electricityTariffUsd ?? 0.08);
    setActiveLoad(machine.energy?.activePowerKw ?? 0);
    setMonthlyHours(machine.energy?.monthlyHoursPlanned ?? 176);
  };

  return (
    <div className="space-y-4">
      {/* 4 Energy KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ishchi Quvvati (Load)
            </span>
            <div className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              {activeLoad}
            </span>
            <span className="text-xs text-muted-foreground">kW/soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            O'rnatilgan quvvat: {machine.energy?.installedPowerKw || activeLoad} kW
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              1 Soatlik Elektr Xarajati
            </span>
            <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ${hourlyCost.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ~{hourlyCostUzs.toLocaleString()} so'm / soat
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Oylik Elektr Iste'moli
            </span>
            <div className="h-7 w-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              {Math.round(monthlyKwh).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">kWh</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Rejadagi ish: {monthlyHours} soat/oy
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Oylik Elektr To'lovi
            </span>
            <div className="h-7 w-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              ${Math.round(monthlyCost).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">/ oy</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ~{monthlyCostUzs.toLocaleString()} so'm / oy
          </div>
        </div>
      </div>

      {/* 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input Parameters */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Energetik Parametrlar & Tarif
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-6 text-[10px] gap-1 px-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Qaytarish
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                className="h-6 text-[10px] gap-1 px-2 bg-primary text-primary-foreground"
              >
                <Save className="w-3 h-3" />
                Qo'llash
              </Button>
            </div>
          </div>

          <div className="p-3.5 space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Faol Elektr Quvvati (Active Load kW):
              </Label>
              <Input
                type="number"
                step="0.5"
                value={activeLoad || ""}
                onChange={(e) => setActiveLoad(Number(e.target.value) || 0)}
                placeholder="0"
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Elektr Tarifi ($ / 1 kWh):
                </Label>
                <Input
                  type="number"
                  step="0.005"
                  value={tariff || ""}
                  onChange={(e) => setTariff(Number(e.target.value) || 0)}
                  placeholder="0.08"
                  className="h-8 text-xs font-mono font-semibold"
                />
                <span className="text-[10px] text-muted-foreground">
                  (~{tariffUzs.toLocaleString()} so'm/kWh)
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Oylik Rejali Ish Soati (soat/oy):
                </Label>
                <Input
                  type="number"
                  value={monthlyHours || ""}
                  onChange={(e) => setMonthlyHours(Number(e.target.value) || 0)}
                  placeholder="176"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auxiliary Power Breakdown */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Ichki Bo'linmalar Quvvati
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-500" />
                Asosiy Dvigatel Quvvati (Drive Motors):
              </span>
              <span className="font-mono font-semibold text-foreground">{driveMotorPower} kW</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Quritgich / Isitish Tizimi:
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-400">{dryerPower} kW</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Sovutish / Chiller Quvvati:</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400">{chillerPower} kW</span>
            </div>

            <div className="flex items-center justify-between py-1 font-semibold text-foreground">
              <span>Jami Hisoblangan Faol Yuklama:</span>
              <span className="font-mono text-primary text-sm">{activeLoad} kW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
