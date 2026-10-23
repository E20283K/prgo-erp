"use client";

import React from "react";
import { PlantRecord, PlantDepartment } from "../types";
import { MachineRecord } from "@/components/documents/machine/types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Cpu,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface PlantDepartmentsTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

export function PlantDepartmentsTab({ plant, onUpdate }: PlantDepartmentsTabProps) {
  const { machines, openTab } = useWorkspaceStore();

  const handleAddDepartment = () => {
    const newDep: PlantDepartment = {
      id: `DEP-${Date.now()}`,
      code: `DEP-0${plant.departments.length + 1}`,
      name: "",
      headPerson: "",
      phone: "",
      staffCount: 0,
      machinesCount: 0,
      operations: [],
      status: "Active",
    };
    onUpdate({ departments: [...plant.departments, newDep] });
  };

  const handleUpdateDepartment = (id: string, updated: Partial<PlantDepartment>) => {
    onUpdate({
      departments: plant.departments.map((d) => (d.id === id ? { ...d, ...updated } : d)),
    });
  };

  const handleDeleteDepartment = (id: string) => {
    onUpdate({
      departments: plant.departments.filter((d) => d.id !== id),
    });
  };

  // Find machines that match this plant's name or code
  const assignedMachines = React.useMemo(() => {
    return machines.filter((m) => {
      const loc = (m.location || "").toLowerCase();
      const pName = plant.name.toLowerCase();
      const pShort = plant.shortName.toLowerCase();
      const pCode = plant.code.toLowerCase();
      return (
        loc.includes(pName) ||
        pName.includes(loc) ||
        loc.includes(pShort) ||
        loc.includes(pCode) ||
        // If Tashkent Main Factory, also match default factory machines
        (plant.id === "PLT-001" && (loc.includes("tashkent") || loc.includes("main") || !m.location))
      );
    });
  }, [machines, plant]);

  const handleOpenMachineDetail = (mac: MachineRecord) => {
    openTab({
      id: `machine-${mac.id}`,
      title: mac.name,
      type: "machine-detail",
      module: "production",
      documentData: mac,
    });
  };

  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Production Departments */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers className="w-4 h-4 text-primary" />
            <span>Sexlar va Bo&apos;limlar Tuzilmasi</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {plant.departments.length} ta sex
            </Badge>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAddDepartment}
            className="h-7 text-xs px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi Sex Qo&apos;shish</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {plant.departments.length === 0 ? (
            <div className="py-6 px-4 text-center rounded border border-dashed border-border bg-muted/10 space-y-2">
              <p className="text-xs text-muted-foreground">
                Hozircha ishlab chiqarish sexlari yoki bo&apos;limlari kiritilmagan.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDepartment}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Birinchi sexni kiritish</span>
              </Button>
            </div>
          ) : (
            plant.departments.map((dept) => (
              <div
                key={dept.id}
                className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {dept.code}
                    </Badge>
                    <span className="font-semibold text-foreground">{dept.name || "Nomsiz sex"}</span>
                    <Badge
                      variant={dept.status === "Active" ? "outline" : "secondary"}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300"
                    >
                      {dept.status}
                    </Badge>
                  </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDepartment(dept.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">
                    Sex / Bo&apos;lim Nomi
                  </Label>
                  <Input
                    value={dept.name}
                    onChange={(e) =>
                      handleUpdateDepartment(dept.id, { name: e.target.value })
                    }
                    className="h-7 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Sex Masteri / Boshlig&apos;i
                  </Label>
                  <Input
                    value={dept.headPerson}
                    onChange={(e) =>
                      handleUpdateDepartment(dept.id, { headPerson: e.target.value })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Xodimlar Soni (Shtat)
                  </Label>
                  <Input
                    type="number"
                    value={dept.staffCount}
                    onChange={(e) =>
                      handleUpdateDepartment(dept.id, {
                        staffCount: Number(e.target.value) || 0,
                      })
                    }
                    className="h-7 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 md:col-span-4">
                  <Label className="text-[10px] text-muted-foreground">
                    Bajariladigan Texnologik Operatsiyalar (Vergul bilan ajrating)
                  </Label>
                  <Input
                    value={dept.operations?.join(", ") || ""}
                    onChange={(e) =>
                      handleUpdateDepartment(dept.id, {
                        operations: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="h-7 text-xs"
                    placeholder="Masalan: Sheet-to-Sheet Mounting, Die-Cutting, UV Lacquer"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

      {/* 2. Assigned Production Machinery (Cross-linked to MachineDetail) */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Cpu className="w-4 h-4 text-primary" />
            <span>Biriktirilgan Sanoat Uskunalari Parki</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {assignedMachines.length} ta stanok
            </Badge>
          </div>

          <span className="text-[11px] text-muted-foreground">
            Stanok kartochkasini to&apos;liq ochish uchun qator ustiga bosing
          </span>
        </div>

        {assignedMachines.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-md">
            Ushbu korxonaga hali stanoklar biriktirilmagan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {assignedMachines.map((mac) => (
              <div
                key={mac.id}
                onClick={() => handleOpenMachineDetail(mac)}
                className="group relative rounded-md border border-border bg-muted/20 hover:bg-muted/40 p-3 text-xs flex flex-col justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-xs">
                      {mac.code.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {mac.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {mac.manufacturer} ({mac.year}) • {mac.department}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={mac.status === "Running" ? "outline" : "secondary"}
                    className={`text-[10px] ${
                      mac.status === "Running"
                        ? "text-emerald-600 border-emerald-300"
                        : mac.status === "Maintenance"
                        ? "text-amber-600 border-amber-300"
                        : ""
                    }`}
                  >
                    {mac.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
                  <span>
                    OEE: <strong className="text-foreground">{mac.overallEfficiency}%</strong>
                  </span>
                  <span>
                    Stavka:{" "}
                    <strong className="text-foreground font-mono">
                      ${mac.costing?.standardHourlyRateUsd || 45}/h
                    </strong>
                  </span>
                  <div className="flex items-center gap-1 text-primary text-[10px] font-medium group-hover:underline">
                    <span>Ochish</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
