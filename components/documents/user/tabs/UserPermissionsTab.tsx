"use client";

import React from "react";
import {
  SystemUserRecord,
  ModulePermissionKey,
  ActionPermission,
  UserPermissions,
} from "../types";
import { ALL_MODULE_KEYS, EMPTY_PERMISSIONS } from "../data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCheck,
  Ban,
  Eye,
  ShieldCheck,
  Factory,
  Users,
  ShoppingCart,
  Package,
  Banknote,
  Settings2,
  Info,
} from "lucide-react";

interface UserPermissionsTabProps {
  data: SystemUserRecord;
  onChange: (updated: Partial<SystemUserRecord>) => void;
}

interface ModuleMeta {
  key: ModulePermissionKey;
  label: string;
  subLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const MODULE_DEFINITIONS: ModuleMeta[] = [
  {
    key: "crm",
    label: "CRM & Mijozlar",
    subLabel: "Telegram Inbox, Mijozlar bazasi, Lidlar va Murojaatlar",
    icon: Users,
    accentColor: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800",
  },
  {
    key: "trading",
    label: "Savdo va Xaridlar (Trading)",
    subLabel: "Buyurtmalar, Shartnomalar, Akt-sverka, YTT limitlari, Import",
    icon: ShoppingCart,
    accentColor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
  },
  {
    key: "production",
    label: "Ishlab Chiqarish (Production)",
    subLabel: "Buyurtma-naryadlar, Rejalashtirish, Uskunalar, Shtamp va BOM",
    icon: Factory,
    accentColor: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  },
  {
    key: "warehouse",
    label: "Ombor va Zaxiralar (Warehouse)",
    subLabel: "Xomashyo balansi, Ehtiyojlar, Tayyor mahsulot, Kirim/Chiqim",
    icon: Package,
    accentColor: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  },
  {
    key: "finance",
    label: "Moliya va Buxgalteriya (Finance)",
    subLabel: "Schet-fakturalar, To'lovlar, O'zaro hisob-kitoblar, Tannarx",
    icon: Banknote,
    accentColor: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
  },
  {
    key: "hr",
    label: "Kadrlar va Ish Haqi (HR & Payroll)",
    subLabel: "Xodimlar ro'yxati, Tabel T-13, Ishbay ish haqi, Vedomost",
    icon: Users,
    accentColor: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800",
  },
  {
    key: "settings",
    label: "Tizim Sozlamalari (Settings)",
    subLabel: "Filiallar, Foydalanuvchilar va Rollar, Texnologik tariflar",
    icon: Settings2,
    accentColor: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
  },
];

export function UserPermissionsTab({ data, onChange }: UserPermissionsTabProps) {
  const permissions: UserPermissions = data.permissions || EMPTY_PERMISSIONS;

  const handleActionToggle = (modKey: ModulePermissionKey, action: keyof ActionPermission) => {
    const currentMod = permissions[modKey] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approve: false,
      export: false,
    };

    const nextVal = !currentMod[action];
    const updatedMod = { ...currentMod, [action]: nextVal };

    // If granting any modification or action, auto-grant view
    if (nextVal && action !== "view") {
      updatedMod.view = true;
    }
    // If turning off view, auto-turn off all other actions
    if (!nextVal && action === "view") {
      updatedMod.create = false;
      updatedMod.edit = false;
      updatedMod.delete = false;
      updatedMod.approve = false;
      updatedMod.export = false;
    }

    onChange({
      permissions: {
        ...permissions,
        [modKey]: updatedMod,
      },
    });
  };

  const handleRowToggleAll = (modKey: ModulePermissionKey) => {
    const currentMod = permissions[modKey] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approve: false,
      export: false,
    };
    const allOn =
      currentMod.view &&
      currentMod.create &&
      currentMod.edit &&
      currentMod.delete &&
      currentMod.approve &&
      currentMod.export;

    const nextState = !allOn;
    onChange({
      permissions: {
        ...permissions,
        [modKey]: {
          view: nextState,
          create: nextState,
          edit: nextState,
          delete: nextState,
          approve: nextState,
          export: nextState,
        },
      },
    });
  };

  const setAllModules = (preset: "full" | "readonly" | "none") => {
    const next: UserPermissions = {} as UserPermissions;
    ALL_MODULE_KEYS.forEach((k) => {
      if (preset === "full") {
        next[k] = { view: true, create: true, edit: true, delete: true, approve: true, export: true };
      } else if (preset === "readonly") {
        next[k] = { view: true, create: false, edit: false, delete: false, approve: false, export: true };
      } else {
        next[k] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
      }
    });
    onChange({ permissions: next });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Seamless Table with Toolbar Header ─────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Granular Ruxsatlar Matritsasi
              </h4>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Har bir modul va operatsiya bo&apos;yicha foydalanuvchi vakolatlarini sozlash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllModules("full")}
              className="h-6 text-[10px] px-2 gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
            >
              <CheckCheck className="w-3 h-3" />
              <span>To&apos;liq Ruxsat</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllModules("readonly")}
              className="h-6 text-[10px] px-2 gap-1 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <Eye className="w-3 h-3" />
              <span>Faqat Ko&apos;rish</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllModules("none")}
              className="h-6 text-[10px] px-2 gap-1 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50"
            >
              <Ban className="w-3 h-3" />
              <span>Tozalash</span>
            </Button>
          </div>
        </div>

        {/* Permissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                <th className="py-2.5 px-3 w-72">Modul va Bo&apos;lim</th>
                <th className="py-2.5 px-2 text-center w-20">Ko&apos;rish</th>
                <th className="py-2.5 px-2 text-center w-20">Yaratish</th>
                <th className="py-2.5 px-2 text-center w-20">Tahrirlash</th>
                <th className="py-2.5 px-2 text-center w-20">O&apos;chirish</th>
                <th className="py-2.5 px-2 text-center w-24">Tasdiqlash (1C)</th>
                <th className="py-2.5 px-2 text-center w-20">Eksport</th>
                <th className="py-2.5 px-2 text-right w-20 pr-3">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MODULE_DEFINITIONS.map((mod) => {
                const Icon = mod.icon;
                const p = permissions[mod.key] || {
                  view: false,
                  create: false,
                  edit: false,
                  delete: false,
                  approve: false,
                  export: false,
                };
                const allActive = p.view && p.create && p.edit && p.delete && p.approve && p.export;
                const anyActive = p.view || p.create || p.edit || p.delete || p.approve || p.export;

                return (
                  <tr
                    key={mod.key}
                    className={`hover:bg-muted/20 transition-colors ${
                      anyActive ? "bg-background" : "bg-muted/5 opacity-75"
                    }`}
                  >
                    {/* Module title & description */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${mod.accentColor}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground text-xs flex items-center gap-1.5">
                            <span>{mod.label}</span>
                            {allActive && (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300"
                              >
                                To&apos;liq
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {mod.subLabel}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* View */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.view}
                          onCheckedChange={() => handleActionToggle(mod.key, "view")}
                        />
                      </div>
                    </td>

                    {/* Create */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.create}
                          onCheckedChange={() => handleActionToggle(mod.key, "create")}
                        />
                      </div>
                    </td>

                    {/* Edit */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.edit}
                          onCheckedChange={() => handleActionToggle(mod.key, "edit")}
                        />
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.delete}
                          onCheckedChange={() => handleActionToggle(mod.key, "delete")}
                        />
                      </div>
                    </td>

                    {/* Approve / Provodka */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.approve}
                          onCheckedChange={() => handleActionToggle(mod.key, "approve")}
                        />
                      </div>
                    </td>

                    {/* Export */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.export}
                          onCheckedChange={() => handleActionToggle(mod.key, "export")}
                        />
                      </div>
                    </td>

                    {/* Row quick toggle */}
                    <td className="py-2 px-2 text-right pr-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRowToggleAll(mod.key)}
                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {allActive ? "O'chirish" : "Yoqish"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Informational Note on 1C / ERP Terms ─────────────────────── */}
      <div className="p-3 bg-muted/20 border border-border rounded-lg flex items-start gap-2.5 text-xs">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            <strong className="text-foreground">Tasdiqlash (1C Provodka):</strong> Hujjatni hisobga olish, ishlab chiqarishga qabul qilish, ombor qoldig&apos;ini o&apos;zgartirish yoki rasmiy akt-sverkani tasdiqlash huquqini beradi.
          </p>
          <p>
            <strong className="text-foreground">Eksport va Chop etish:</strong> Buyurtma naryadlarini, hisob-fakturalarni chop etish va ma&apos;lumotlarni Excel/PDF formatda yuklab olish huquqi.
          </p>
        </div>
      </div>
    </div>
  );
}
