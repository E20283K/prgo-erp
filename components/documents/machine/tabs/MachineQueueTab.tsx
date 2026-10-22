"use client";

import React from "react";
import { MachineRecord } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  Layers,
  ExternalLink,
  Package,
} from "lucide-react";

interface MachineQueueTabProps {
  machine: MachineRecord;
}

export function MachineQueueTab({ machine }: MachineQueueTabProps) {
  const { productionQueue, openTab } = useWorkspaceStore();

  // Find all work order queue items assigned to this machine
  const machineQueue = (productionQueue || []).filter((item) => {
    const press = (item.pressMachine || "").toLowerCase();
    const macName = (machine.name || "").toLowerCase();
    const macCode = (machine.code || "").toLowerCase();
    return (
      (macName && (press.includes(macName) || macName.includes(press))) ||
      (macCode && press.includes(macCode))
    );
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
    (machine.flexoSpecs?.practicalSpeedMpm || 0) * 60 ||
    machine.dieCuttingSpecs?.practicalSpeedSph ||
    (machine.laminationSpecs?.practicalSpeedMpm || 0) * 60 ||
    (machine.jacquardSpecs?.practicalRpm || 0) * 60 ||
    machine.mountingSpecs?.practicalSpeedSph ||
    machine.casingInSpecs?.speedCyclesPerHour ||
    0;

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
              {activeJob ? "1 ta faol jarayonda" : "Hozircha faol buyurtma yo'q"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Rejalashtirilgan Qoldiq Hajm
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {remainingUnits.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {machine.counterUnit || "varaq"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Bajarilgan: {totalCompletedUnits.toLocaleString()} {machine.counterUnit || "varaq"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Taxminiy Ish Vaqti
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                {speedPerHour > 0 ? `~${totalRemainingHours}` : "—"}
              </span>
              <span className="text-xs text-muted-foreground">{speedPerHour > 0 ? "soat" : "Tezlik belgilanmagan"}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {speedPerHour > 0 ? `Tezlik: ${speedPerHour.toLocaleString()}/soat` : "Uskuna tezligi kiritilmagan"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Queue Content List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Uskunaga Biriktirilgan Ishlar Navbati ({machineQueue.length})
          </span>
        </div>

        {machineQueue.length > 0 ? (
          <div className="divide-y divide-border">
            {machineQueue.map((item) => (
              <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{item.id}</span>
                    <span className="font-medium text-foreground">{item.customer}</span>
                    <span className="text-muted-foreground">• {item.product}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Hajm: {(item.plannedSheets || item.quantity || 0).toLocaleString()} {machine.counterUnit || "varaq"} • Holati: {item.stage}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenWorkOrder(item)}
                  className="h-7 text-xs gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ko'rish
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Hozircha ushbu uskunaga biriktirilgan faol yoki navbatdagi buyurtmalar yo'q.
          </div>
        )}
      </div>
    </div>
  );
}
