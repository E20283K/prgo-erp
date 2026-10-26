"use client";

import React, { useState } from "react";
import { MachineRecord, MachineMaintenanceRecord } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wrench,
  Clock,
  Plus,
  Activity,
  Gauge,
  Thermometer,
  Flame,
  Save,
} from "lucide-react";

interface MachineMaintenanceTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineMaintenanceTab({ machine, onUpdate }: MachineMaintenanceTabProps) {
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [logType, setLogType] = useState<MachineMaintenanceRecord["type"]>("Routine Oil/Lube");
  const [technician, setTechnician] = useState("");
  const [downtime, setDowntime] = useState<number>(1);
  const [cost, setCost] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [nextDue, setNextDue] = useState("");

  const handleSaveNewLog = () => {
    if (!description.trim()) return;

    const logs = machine.maintenanceLogs || [];
    const newRecord: MachineMaintenanceRecord = {
      id: `MNT-0${101 + logs.length}`,
      date: new Date().toISOString().split("T")[0],
      type: logType,
      meterReading: `${(machine.totalLifetimeCounter || 0).toLocaleString()} ${machine.counterUnit || "sheets"}`,
      technician: technician.trim() || machine.leadOperator || "Mexanik",
      costUsd: cost,
      downtimeHours: downtime,
      description: description.trim(),
      nextDueAt: nextDue.trim() || "",
    };

    onUpdate({
      maintenanceLogs: [newRecord, ...logs],
    });

    setIsAddingLog(false);
    setDescription("");
    setTechnician("");
    setCost(0);
    setDowntime(1);
    setNextDue("");
  };

  return (
    <div className="space-y-4">
      {/* 4 Telemetry & Health Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Umumiy Odometer
            </span>
            <Gauge className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-foreground">
              {(((machine.totalLifetimeCounter || 0) / 1000000)).toFixed(1)}M
            </span>
            <span className="text-xs text-muted-foreground">{machine.counterUnit || "sheets"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Jami: {(machine.totalLifetimeCounter || 0).toLocaleString()} {machine.counterUnit || "sheets"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Moylash Bosimi
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {machine.telemetry?.oilPressureBar || 0} bar
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Gidravlika & moy tizimi
          </div>
        </div>

        {machine.telemetry?.uvLampHoursUsed !== undefined && (
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                UV Chiroqlar Resursi
              </span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {machine.telemetry?.uvLampHoursUsed}
              </span>
              <span className="text-xs text-muted-foreground">
                / {machine.telemetry?.uvLampMaxHours || 1000} soat
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Ishlatilgan soatlar
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Harorat & Tebranish
            </span>
            <Thermometer className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-foreground">
              {machine.telemetry?.temperatureC ?? 0}°C
            </span>
            <span className="text-xs text-muted-foreground">
              / {machine.telemetry?.vibrationMmS ?? 0} mm/s
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Datchik telemetriyasi
          </div>
        </div>
      </div>

      {/* New Maintenance Entry Form */}
      {isAddingLog && (
        <div className="rounded-lg border border-primary/40 bg-card shadow-sm overflow-hidden">
          <div className="py-2.5 px-3.5 border-b border-border bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Yangi Texnik Xizmat / Ta'mirlash Yozuvini Qo'shish
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingLog(false)}
              className="h-6 text-xs"
            >
              Yopish
            </Button>
          </div>
          <div className="p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Xizmat Turi:</Label>
                <Select
                  value={logType}
                  onValueChange={(val: any) => setLogType(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Routine Oil/Lube">Rejali Moylash / Filtr</SelectItem>
                    <SelectItem value="Roller Replacement">Val / Rezina Almashtirish</SelectItem>
                    <SelectItem value="UV Lamp Change">UV Lampa / Isitgich Yangilash</SelectItem>
                    <SelectItem value="Blade Sharpening">Pichoq O'tkirlash / Almashtirish</SelectItem>
                    <SelectItem value="Bearing/Sensor Repair">Podshipnik / Datchik Ta'miri</SelectItem>
                    <SelectItem value="General Overhaul">Katta Kapital Ta'mir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Usta / Texnik Xodim:</Label>
                <Input
                  placeholder="Texnik F.I.Sh."
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">To'xtab Qolish (soat):</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={downtime || ""}
                  onChange={(e) => setDowntime(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Xarajat ($):</Label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={2}
                  value={cost || ""}
                  onValueChange={(values) => setCost(values.floatValue ?? 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bajarilgan Ish Tavsifi / Almashtirilgan Ehtiyot Qismlar:</Label>
              <Textarea
                placeholder="Amalga oshirilgan servis ishlari, almashtirilgan detallar yoki moy turlari..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Keyingi Xizmat Ko'rsatish Ko'rsatkichi:</Label>
                <Input
                  placeholder="Masalan: 3 oydan so'ng yoki +500,000 varaq"
                  value={nextDue}
                  onChange={(e) => setNextDue(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-end justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingLog(false)}
                  className="h-8 text-xs"
                >
                  Bekor Qilish
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveNewLog}
                  className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
                >
                  <Save className="w-3.5 h-3.5" />
                  Yozuvni Saqlash
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance History Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Texnik Xizmat va Ta'mirlash Tarixi ({(machine.maintenanceLogs || []).length})
            </span>
          </div>
          {!isAddingLog && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingLog(true)}
              className="h-6 text-[11px] gap-1"
            >
              <Plus className="w-3 h-3" />
              Yangi Servis Yozuvi
            </Button>
          )}
        </div>
        <div>
          {(machine.maintenanceLogs || []).length > 0 ? (
            <div className="divide-y divide-border">
              {(machine.maintenanceLogs || []).map((log) => (
                <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors text-xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-foreground">
                        {log.id}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {log.type}
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3" />
                        {log.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                      <span>Usta: <strong className="text-foreground">{log.technician}</strong></span>
                      <span>To'xtash: <strong className="text-foreground font-mono">{log.downtimeHours}h</strong></span>
                      <span>Xarajat: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">${log.costUsd}</strong></span>
                    </div>
                  </div>
                  <p className="text-foreground text-[11px] bg-muted/20 p-2 rounded">
                    {log.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Odometer: <span className="font-mono">{log.meterReading}</span></span>
                    {log.nextDueAt && (
                      <span>Rejadagi keyingi servis: <strong className="text-primary">{log.nextDueAt}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Hozircha ushbu uskuna bo'yicha texnik xizmat ko'rsatish yozuvlari kiritilmagan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
