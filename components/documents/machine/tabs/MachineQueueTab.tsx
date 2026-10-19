"use client";

import React from "react";
import { MachineRecord } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
  User,
  Palette,
  Package,
  Plus,
  FileText,
} from "lucide-react";

interface MachineQueueTabProps {
  machine: MachineRecord;
}

export function MachineQueueTab({ machine }: MachineQueueTabProps) {
  const { productionQueue, openTab } = useWorkspaceStore();

  // Find all work order queue items assigned to this machine
  const machineQueue = productionQueue.filter((item) => {
    const press = (item.pressMachine || "").toLowerCase();
    const macName = machine.name.toLowerCase();
    const macCode = machine.code.toLowerCase();
    return press.includes(macName) || macName.includes(press) || press.includes(macCode);
  });

  // Active running job vs upcoming queue
  const activeJob = machineQueue.find((i) => i.stage === "In Production");
  const upcomingJobs = machineQueue
    .filter((i) => i.stage !== "In Production" && i.stage !== "Completed")
    .sort((a, b) => a.queueOrder - b.queueOrder);

  // Compute total queued units & hours
  const totalPlannedUnits = machineQueue.reduce(
    (acc, curr) => acc + (curr.plannedSheets || curr.quantity || 0),
    0
  );
  const totalCompletedUnits = machineQueue.reduce(
    (acc, curr) => acc + (curr.completedSheets || 0),
    0
  );
  const remainingUnits = Math.max(0, totalPlannedUnits - totalCompletedUnits);

  const speedPerHour =
    machine.offsetSpecs?.practicalSpeedSph ||
    (machine.flexoSpecs?.practicalSpeedMpm || 130) * 60 ||
    machine.dieCuttingSpecs?.practicalSpeedSph ||
    (machine.laminationSpecs?.practicalSpeedMpm || 45) * 60 ||
    (machine.jacquardSpecs?.practicalRpm || 720) * 60 ||
    8000;

  const totalRemainingHours = speedPerHour > 0 ? Number((remainingUnits / speedPerHour).toFixed(1)) : 0;

  const handleOpenWorkOrder = (item: (typeof machineQueue)[0]) => {
    openTab({
      id: item.id,
      title: `${item.id}: ${item.product.slice(0, 18)}...`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: item.id,
        customer: item.customer,
        product: item.product,
        quantity: item.quantity,
        pressMachine: item.pressMachine,
        status: item.stage,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Queue Summary Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Navbatdagi Buyurtmalar
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-foreground">
                {machineQueue.length}
              </span>
              <span className="text-xs text-muted-foreground">ta buyurtma</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeJob ? "1 ta faol jarayonda" : "Barcha buyurtmalar kutishda"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Rejalashtirilgan Hajm
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {remainingUnits.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {machine.counterUnit}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Bajarilgan: {totalCompletedUnits.toLocaleString()} {machine.counterUnit}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Taxminiy Bandlik Vaqti
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                ~{totalRemainingHours}
              </span>
              <span className="text-xs text-muted-foreground">soat</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Ishlash tezligi: {speedPerHour.toLocaleString()}/soat
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Running Job Section */}
      {activeJob ? (
        <div className="rounded-lg border border-emerald-500/30 bg-card shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="py-2.5 px-3.5 border-b border-border bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Hozir Chop Etilmoqda (Faol Buyurtma)
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenWorkOrder(activeJob)}
              className="h-6 text-[11px] gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <ExternalLink className="w-3 h-3" />
              Work Orderni Ochish
            </Button>
          </div>
          <div className="p-3.5 space-y-3 text-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-foreground">
                    {activeJob.id}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">
                    In Production
                  </Badge>
                  {activeJob.priority === "Urgent" && (
                    <Badge variant="destructive" className="text-[10px]">
                      Urgent
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-foreground text-sm mt-0.5">
                  {activeJob.product}
                </p>
                <p className="text-muted-foreground text-xs">
                  Mijoz: {activeJob.customer}
                </p>
              </div>

              <div className="text-left md:text-right space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">
                  Mas'ul Operator:
                </span>
                <span className="font-medium text-foreground flex items-center md:justify-end gap-1">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  {activeJob.operator || machine.leadOperator}
                </span>
                {activeJob.colors && (
                  <span className="text-[11px] text-muted-foreground flex items-center md:justify-end gap-1 font-mono">
                    <Palette className="w-3 h-3 text-purple-500" />
                    Ranglar: {activeJob.colors}
                  </span>
                )}
              </div>
            </div>

            {/* Real Progress Bar */}
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Ishlab Chiqarish Jarayoni:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {(activeJob.completedSheets || 0).toLocaleString()} / {(activeJob.plannedSheets || activeJob.quantity).toLocaleString()} {machine.counterUnit} (
                  {Math.round(
                    ((activeJob.completedSheets || 0) /
                      (activeJob.plannedSheets || activeJob.quantity || 1)) *
                      100
                  )}
                  %)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((activeJob.completedSheets || 0) /
                          (activeJob.plannedSheets || activeJob.quantity || 1)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-center space-y-1 shadow-xs">
          <p className="text-xs font-medium text-foreground">
            Hozirda bu mashinada faol chop etish jarayoni ketmayapti.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Quyidagi navbatdagi buyurtmalardan birini boshlashingiz mumkin.
          </p>
        </div>
      )}

      {/* Upcoming Scheduled Queue Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Navbatdagi Rejalashtirilgan Buyurtmalar ({upcomingJobs.length})
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Ketma-ketlik tartibida
          </Badge>
        </div>
        <div>
          {upcomingJobs.length > 0 ? (
            <div className="divide-y divide-border">
              {upcomingJobs.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-mono font-bold text-muted-foreground shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground">
                          {item.id}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-medium text-foreground truncate">
                          {item.customer}
                        </span>
                        {item.priority === "Urgent" && (
                          <Badge variant="destructive" className="text-[9px] h-4">
                            Urgent
                          </Badge>
                        )}
                        {item.priority === "High" && (
                          <Badge variant="outline" className="text-[9px] h-4 border-amber-500/40 text-amber-600">
                            High
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate mt-0.5">
                        {item.product}
                      </p>

                      {/* Readiness Gate Checkpoints */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                            item.checks.designReady
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Dizayn
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                            item.checks.paperReady
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {item.checks.paperReady ? "Qog'oz Tayyor" : "Qog'oz Kutilmoqda"}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                            item.checks.platesReady
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          CTP Forma
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-9 md:pl-0">
                    <div className="text-left md:text-right">
                      <span className="font-mono font-bold text-foreground">
                        {(item.plannedSheets || item.quantity).toLocaleString()} {machine.counterUnit}
                      </span>
                      <span className="text-[10px] text-muted-foreground block flex items-center md:justify-end gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        Muddat: {item.deadline}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenWorkOrder(item)}
                      className="h-7 text-xs gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ochish
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-xs">
              Bu mashina uchun rejalashtirilgan navbat mavjud emas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
