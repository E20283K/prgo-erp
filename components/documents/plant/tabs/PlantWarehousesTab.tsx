"use client";

import React from "react";
import { PlantRecord, PlantWarehouseInfo } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Boxes,
  Warehouse,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface PlantWarehousesTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

export function PlantWarehousesTab({ plant, onUpdate }: PlantWarehousesTabProps) {
  const { openTab } = useWorkspaceStore();

  const handleAddWarehouse = () => {
    const newWh: PlantWarehouseInfo = {
      id: `WAR-${Date.now()}`,
      code: `W-NEW-${plant.warehouses.length + 1}`,
      name: "Yangi Ombor Maydoni",
      type: "RawMaterials",
      manager: "Ombor Mudiri",
      phone: "+998 90 000-00-00",
      capacityM2: 1000,
      locationDetails: "Asosiy bino",
      status: "Active",
    };
    onUpdate({ warehouses: [...plant.warehouses, newWh] });
  };

  const handleUpdateWarehouse = (id: string, updated: Partial<PlantWarehouseInfo>) => {
    onUpdate({
      warehouses: plant.warehouses.map((w) => (w.id === id ? { ...w, ...updated } : w)),
    });
  };

  const handleDeleteWarehouse = (id: string) => {
    onUpdate({
      warehouses: plant.warehouses.filter((w) => w.id !== id),
    });
  };

  const handleOpenWarehouseStock = () => {
    openTab({
      id: "tab-warehouse-stock-balance",
      title: "Ombor Qoldiqlari",
      type: "registry",
      module: "warehouse",
    });
  };

  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Warehouses List */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Warehouse className="w-4 h-4 text-primary" />
            <span>Filialga Qarashli Omborlar va Logistika Maydonlari</span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {plant.warehouses.length} ta ombor
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenWarehouseStock}
              className="h-7 text-xs px-2.5 gap-1"
            >
              <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Ombor Qoldiqlariga O&apos;tish</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleAddWarehouse}
              className="h-7 text-xs px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi Ombor</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {plant.warehouses.map((wh) => (
            <div
              key={wh.id}
              className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {wh.code}
                  </Badge>
                  <span className="font-semibold text-foreground">{wh.name}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-primary/10 text-primary font-medium"
                  >
                    {wh.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-600 border-emerald-300"
                  >
                    {wh.status}
                  </Badge>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteWarehouse(wh.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">
                    Ombor Nomi
                  </Label>
                  <Input
                    value={wh.name}
                    onChange={(e) =>
                      handleUpdateWarehouse(wh.id, { name: e.target.value })
                    }
                    className="h-7 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Ombor Turi
                  </Label>
                  <Select
                    value={wh.type}
                    onValueChange={(val: PlantWarehouseInfo["type"] | null) => {
                      if (val) handleUpdateWarehouse(wh.id, { type: val });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RawMaterials">
                        Xom-ashyo (Qog&apos;oz, karton, rulon)
                      </SelectItem>
                      <SelectItem value="FinishedGoods">
                        Tayyor Mahsulotlar Ombori
                      </SelectItem>
                      <SelectItem value="WIP">
                        WIP (Oraliq polufabrikatlar)
                      </SelectItem>
                      <SelectItem value="Chemicals">
                        Bo&apos;yoq va Kimyoviy Moddalar
                      </SelectItem>
                      <SelectItem value="Spares">
                        Ehtiyot Qismlar va Usunalar
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Maydoni (m²)
                  </Label>
                  <Input
                    type="number"
                    value={wh.capacityM2}
                    onChange={(e) =>
                      handleUpdateWarehouse(wh.id, {
                        capacityM2: Number(e.target.value) || 0,
                      })
                    }
                    className="h-7 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">
                    Ombor Mudiri (Moddiy javobgar shaxs)
                  </Label>
                  <Input
                    value={wh.manager}
                    onChange={(e) =>
                      handleUpdateWarehouse(wh.id, { manager: e.target.value })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Mudir Telefoni
                  </Label>
                  <Input
                    value={wh.phone || ""}
                    onChange={(e) =>
                      handleUpdateWarehouse(wh.id, { phone: e.target.value })
                    }
                    className="h-7 text-xs font-mono"
                    placeholder="+998 90 123-45-67"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Joylashuv / Darvoza
                  </Label>
                  <Input
                    value={wh.locationDetails}
                    onChange={(e) =>
                      handleUpdateWarehouse(wh.id, { locationDetails: e.target.value })
                    }
                    className="h-7 text-xs"
                    placeholder="Gate 1, A sektor"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
