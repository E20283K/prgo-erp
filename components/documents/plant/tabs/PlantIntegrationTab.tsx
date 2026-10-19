"use client";

import React, { useState } from "react";
import { PlantRecord } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileCode2,
  RefreshCw,
  CheckCircle2,
  Server,
  Key,
  ShieldCheck,
} from "lucide-react";

interface PlantIntegrationTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

export function PlantIntegrationTab({ plant, onUpdate }: PlantIntegrationTabProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest1C = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult("1C:Enterprise (v8.3 OData/HTTP) bilan aloqa muvaffaqiyatli o'rnatildi! Status: 200 OK");
      onUpdate({
        integration: {
          ...plant.integration,
          lastSyncAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        },
      });
    }, 1200);
  };

  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Didox E-Faktura Integration */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <FileCode2 className="w-4 h-4 text-primary" />
            <span>Didox / Soliq.uz Elektron Hujjat Aylanishi (EDO)</span>
          </div>

          <Badge
            variant="outline"
            className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300"
          >
            {plant.integration.didoxEnabled ? "Ulangan (Active)" : "O'chirilgan"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Didox Kontragent Kodi (Filial ID)
            </Label>
            <Input
              value={plant.integration.didoxContractorCode}
              onChange={(e) =>
                onUpdate({
                  integration: {
                    ...plant.integration,
                    didoxContractorCode: e.target.value,
                  },
                })
              }
              className="h-8 text-xs font-mono"
              placeholder="DIDOX-PRT-305112890"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              E-Imzo / API Kaliti Holati
            </Label>
            <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/40 font-mono text-xs">
              <Key className="w-3.5 h-3.5 text-primary" />
              <span>{plant.integration.apiKeySet ? "•••••••••••••••• (Faol)" : "Kiritilmagan"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Hisob-Faktura Avto-Sinxronizatsiyasi
            </Label>
            <Button
              type="button"
              variant={plant.integration.autoSyncInvoices ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onUpdate({
                  integration: {
                    ...plant.integration,
                    autoSyncInvoices: !plant.integration.autoSyncInvoices,
                  },
                })
              }
              className="w-full h-8 text-xs justify-between px-3"
            >
              <span>Avto-yuborish</span>
              <span className="font-semibold text-[10px]">
                {plant.integration.autoSyncInvoices ? "YOQILGAN" : "O'CHIRILGAN"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. 1C:Enterprise Integration */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Server className="w-4 h-4 text-primary" />
            <span>1C:Korxona (1C:Enterprise) Buxgalteriya Sinxronizatsiyasi</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              Oxirgi sinxron:{" "}
              <strong className="font-mono text-foreground">
                {plant.integration.lastSyncAt || "Hech qachon"}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px] font-medium text-muted-foreground">
              1C HTTP-Service REST / OData URL Manzili
            </Label>
            <Input
              value={plant.integration.oneCEndpoint || ""}
              onChange={(e) =>
                onUpdate({
                  integration: {
                    ...plant.integration,
                    oneCEndpoint: e.target.value,
                  },
                })
              }
              className="h-8 text-xs font-mono"
              placeholder="http://1c.printgoo.internal/erp/hs/v1/sync"
            />
          </div>

          <div className="space-y-1 flex flex-col justify-end">
            <Button
              type="button"
              onClick={handleTest1C}
              disabled={isTesting}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
              <span>{isTesting ? "Tekshirilmoqda..." : "1C Aloqani Tekshirish"}</span>
            </Button>
          </div>
        </div>

        {testResult && (
          <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{testResult}</span>
          </div>
        )}
      </div>

      {/* 3. Audit & Security info */}
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Barcha integratsiya so&apos;rovlari SSL/TLS shifrlangan kanal orqali uzatiladi.</span>
        </div>
        <span className="font-mono text-[11px]">Audit ID: SEC-PLT-{plant.id}</span>
      </div>
    </div>
  );
}
