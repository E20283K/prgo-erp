"use client";

import React, { useState } from "react";
import { MachineRecord } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  DollarSign,
  Gauge,
  Wind,
  ThermometerSnowflake,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Sliders,
  TrendingDown,
  Layers,
} from "lucide-react";

interface MachineEnergyTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineEnergyTab({ machine, onUpdate }: MachineEnergyTabProps) {
  const [tariff, setTariff] = useState<number>(machine.energy.electricityTariffUsd);
  const [activeLoad, setActiveLoad] = useState<number>(machine.energy.activePowerKw);
  const [monthlyHours, setMonthlyHours] = useState<number>(machine.energy.monthlyHoursPlanned);

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
  const dryerPower = machine.energy.dryerHeatingKw;
  const chillerPower = machine.energy.chillerPowerKw;
  const pneumaticsPower = Number((machine.energy.compressedAirCfm * 0.18).toFixed(1));
  const driveMotorPower = Math.max(5, Number((activeLoad - (dryerPower * 0.6) - chillerPower).toFixed(1)));

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
            machine.costing.hourlyDepreciationUsd +
            hourlyCost +
            machine.costing.hourlyMaintenanceReserveUsd +
            machine.costing.operatorHourlyWageUsd +
            machine.costing.assistantHourlyWageUsd +
            machine.costing.factoryOverheadUsd
          ).toFixed(2)
        ),
      },
    });
  };

  const handleReset = () => {
    setTariff(machine.energy.electricityTariffUsd);
    setActiveLoad(machine.energy.activePowerKw);
    setMonthlyHours(machine.energy.monthlyHoursPlanned);
  };

  return (
    <div className="space-y-4">
      {/* 4 Energy KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ulangan Quvvat (Installed)
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              {machine.energy.installedPowerKw}
            </span>
            <span className="text-xs text-muted-foreground">kW</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Kutish holatida: {machine.energy.standbyPowerKw} kW (standby)
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              O'rtacha Ishchi Yuklama
            </span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {activeLoad}
            </span>
            <span className="text-xs text-muted-foreground">kW (faol)</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Yuklama koeffitsiyenti: {Math.round((activeLoad / machine.energy.installedPowerKw) * 100)}%
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Soatlik Elektr Narxi
            </span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ${hourlyCost.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ soat</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ≈ {hourlyCostUzs.toLocaleString()} so'm / soat
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Oylik Elektr Prognozi
            </span>
            <TrendingDown className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              ${monthlyCost.toFixed(0)}
            </span>
            <span className="text-xs text-muted-foreground">/ oy</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {monthlyKwh.toLocaleString()} kWh ({monthlyHours} soat smena)
          </div>
        </div>
      </div>

      {/* Interactive Tariff & Active Load Configurator */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Elektr Tarifi va Hisob-Kitob Sozlamalari
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            1 kWh = ${tariff} (≈ {tariffUzs} so'm)
          </Badge>
        </div>
        <div className="p-3.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Elektr Tarifi ($ / kWh):
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.005"
                  value={tariff}
                  onChange={(e) => setTariff(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground shrink-0">$/kWh</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                O'zbekiston yuridik korxonalari uchun: ~1,000 – 1,150 so'm/kWh
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Ish Vaqtidagi O'rtacha Yuklama (kW):
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.5"
                  value={activeLoad}
                  onChange={(e) => setActiveLoad(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground shrink-0">kW</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Uskuna motori, quritgich va sovutgichning yig'indi sarfi
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Oylik Rejalashtirilgan Ish Soati:
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="8"
                  value={monthlyHours}
                  onChange={(e) => setMonthlyHours(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground shrink-0">soat/oy</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                2 smena: 16 soat/kun × 24 ish kuni = 384 soat
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Bekor Qilish
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApply}
              className="h-7 text-xs gap-1 bg-primary text-primary-foreground"
            >
              <Save className="w-3.5 h-3.5" />
              Tarifni Saqlash & Yangilash
            </Button>
          </div>
        </div>
      </div>

      {/* Energy Consumers Breakdown & Environmental Requirements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Load Distribution by Subsystem */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Elektr Iste'moli Taqsimoti (Subtizimlar Bo'yicha)
            </span>
          </div>
          <div className="p-3.5 space-y-3 text-xs">
            {/* Main Motor Drive */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  Bosh Elektr Dvigatellar & Privodlar:
                </span>
                <span className="font-mono font-medium text-foreground">
                  {driveMotorPower} kW ({Math.round((driveMotorPower / activeLoad) * 100)}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((driveMotorPower / activeLoad) * 100))}%` }}
                />
              </div>
            </div>

            {/* Dryers & UV / IR heating */}
            {dryerPower > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    Quritgich / UV Lampalar & Isitish:
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {dryerPower} kW ({Math.round((dryerPower / machine.energy.installedPowerKw) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((dryerPower / machine.energy.installedPowerKw) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Chiller & Cooling */}
            {chillerPower > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-500" />
                    Chiller & Suv Haroratini Sovutish (UV/Kombinatsiyalash):
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {chillerPower} kW ({Math.round((chillerPower / activeLoad) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((chillerPower / activeLoad) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pneumatics & Compressors */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-emerald-500" />
                  Siqilgan Havo (Kompressor stansiyasi ulushi):
                </span>
                <span className="font-mono font-medium text-foreground">
                  {pneumaticsPower} kW ({Math.round((pneumaticsPower / activeLoad) * 100)}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((pneumaticsPower / activeLoad) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pneumatics & Plant Utility Requirements */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Wind className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Pnevmatika va Muhandislik Talablari
            </span>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Talab Qilingan Ishchi Havo Bosimi:</span>
              <span className="font-mono font-bold text-foreground">
                {machine.energy.compressedAirBar} bar (± 0.2 bar stabil)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Siqilgan Havo Sarfi (Hajm):</span>
              <span className="font-mono font-medium text-foreground">
                {machine.energy.compressedAirCfm} CFM (≈ {(machine.energy.compressedAirCfm * 0.0283).toFixed(2)} m³/min)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Havo Tozalik Standarti:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                ISO 8573-1: Class 1.4.1 (Moy va suvsiz)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Tsex Xona Harorati:</span>
              <span className="font-medium text-foreground">20°C – 24°C (Optimal 22°C)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Tsex Nisbiy Namligi (RH):</span>
              <span className="font-medium text-foreground">50% – 60% RH (Statik elektrni oldini olish)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
