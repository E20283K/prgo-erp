"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PlantRecord } from "../types";
import { MachineRecord } from "@/components/documents/machine/types";
import { DepartmentRecord } from "@/components/documents/hr/types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Cpu,
  ExternalLink,
  Users,
} from "lucide-react";

interface PlantDepartmentsTabProps {
  plant: PlantRecord;
  onUpdate?: (updated: Partial<PlantRecord>) => void;
}

export function PlantDepartmentsTab({ plant }: PlantDepartmentsTabProps) {
  const {
    machines,
    loadMachines,
    departmentsList,
    setDepartmentsList,
    openTab,
  } = useWorkspaceStore();

  const [isLoadingHr, setIsLoadingHr] = useState(false);

  // 1. Ensure machines are loaded from DB
  useEffect(() => {
    if (machines.length === 0 && loadMachines) {
      loadMachines();
    }
  }, [machines.length, loadMachines]);

  // 2. Ensure HR departments are loaded from DB
  useEffect(() => {
    if (departmentsList.length === 0) {
      setIsLoadingHr(true);
      fetch("/api/v1/hr/departments")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setDepartmentsList(json.data);
          }
        })
        .catch((err) => console.error("Error fetching HR departments:", err))
        .finally(() => setIsLoadingHr(false));
    }
  }, [departmentsList.length, setDepartmentsList]);

  // 3. Filter real HR departments assigned to this plant
  const assignedDepartments = useMemo(() => {
    const pId = (plant.id || "").toLowerCase();
    const pName = (plant.name || "").toLowerCase();
    const pShort = (plant.shortName || "").toLowerCase();
    const pCode = (plant.code || "").toLowerCase();
    const isMain = Boolean(plant.isMain || plant.id === "PLT-001" || pName.includes("bosh"));

    return departmentsList.filter((d) => {
      // Direct branchId match
      if (d.branchId && (d.branchId === plant.id || d.branchId.toLowerCase() === pId)) {
        return true;
      }
      // Match by branch name / code
      if (d.plant) {
        const dp = d.plant.toLowerCase();
        if (
          (pName && dp.includes(pName)) ||
          (pName && pName.includes(dp)) ||
          (pShort && dp.includes(pShort)) ||
          (pCode && dp.includes(pCode))
        ) {
          return true;
        }
      }
      // Default fallback for main factory
      if (
        isMain &&
        (!d.branchId ||
          !d.plant ||
          d.plant.toLowerCase().includes("bosh") ||
          d.plant.toLowerCase().includes("tashkent"))
      ) {
        return true;
      }
      return false;
    });
  }, [departmentsList, plant]);

  // 4. Filter real machines assigned to this plant
  const assignedMachines = useMemo(() => {
    const pName = (plant.name || "").toLowerCase();
    const pShort = (plant.shortName || "").toLowerCase();
    const pCode = (plant.code || "").toLowerCase();
    const isMain = Boolean(plant.isMain || plant.id === "PLT-001" || pName.includes("bosh"));

    return machines.filter((m) => {
      const loc = (m.location || "").toLowerCase();
      if (loc) {
        if (
          (pName && loc.includes(pName)) ||
          (pName && pName.includes(loc)) ||
          (pShort && loc.includes(pShort)) ||
          (pCode && loc.includes(pCode))
        ) {
          return true;
        }
      }
      // If main factory, also match default / unassigned machines
      if (isMain && (!m.location || loc.includes("tashkent") || loc.includes("main") || loc.includes("bosh"))) {
        return true;
      }
      return false;
    });
  }, [machines, plant]);

  const handleOpenDepartmentDetail = (dept: DepartmentRecord) => {
    openTab({
      id: `dept-${dept.id}`,
      title: dept.name,
      type: "department-detail",
      module: "hr",
      documentData: dept,
    });
  };

  const handleOpenMachineDetail = (mac: MachineRecord) => {
    openTab({
      id: `machine-${mac.id}`,
      title: mac.name,
      type: "machine-detail",
      module: "production",
      documentData: mac,
    });
  };

  const handleOpenHrModule = () => {
    openTab({
      id: "departments",
      title: "Sexlar va bo'limlar",
      type: "registry",
      module: "hr",
    });
  };

  const handleOpenProductionModule = () => {
    openTab({
      id: "machines",
      title: "Mashinalar",
      type: "registry",
      module: "production",
    });
  };

  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Assigned HR Departments */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers className="w-4 h-4 text-primary" />
            <span>Biriktirilgan Sexlar va Bo&apos;limlar (HR)</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {assignedDepartments.length} ta
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenHrModule}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>HR Bo&apos;limlari</span>
          </Button>
        </div>

        {isLoadingHr && assignedDepartments.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Bo&apos;limlar yuklanmoqda...
          </div>
        ) : assignedDepartments.length === 0 ? (
          <div className="py-6 px-4 text-center rounded border border-dashed border-border bg-muted/10 space-y-2">
            <p className="text-xs text-muted-foreground">
              Ushbu filialga biriktirilgan sexlar yoki bo&apos;limlar mavjud emas.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenHrModule}
              className="h-7 text-xs gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>HR modulida yaratish</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {assignedDepartments.map((dept) => (
              <div
                key={dept.id}
                onClick={() => handleOpenDepartmentDetail(dept)}
                className="group relative rounded-md border border-border bg-muted/20 hover:bg-muted/40 p-3 text-xs flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {dept.code}
                    </Badge>
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {dept.name}
                    </span>
                  </div>

                  <Badge
                    variant={dept.isActive !== false ? "outline" : "secondary"}
                    className={`text-[10px] ${
                      dept.isActive !== false
                        ? "text-emerald-600 border-emerald-300"
                        : "text-zinc-500"
                    }`}
                  >
                    {dept.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{dept.staffCount || 0} xodim</span>
                  </div>

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

      {/* 2. Assigned Production Machinery */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Cpu className="w-4 h-4 text-primary" />
            <span>Biriktirilgan Sanoat Uskunalari Parki (Production)</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {assignedMachines.length} ta stanok
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenProductionModule}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mashinalar reyestri</span>
          </Button>
        </div>

        {assignedMachines.length === 0 ? (
          <div className="py-6 px-4 text-center rounded border border-dashed border-border bg-muted/10 space-y-2">
            <p className="text-xs text-muted-foreground">
              Ushbu korxonaga biriktirilgan uskunalar mavjud emas.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenProductionModule}
              className="h-7 text-xs gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Production modulida ro&apos;yxatdan o&apos;tkazish</span>
            </Button>
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
