"use client";

import React, { useState } from "react";
import { SystemUserRecord } from "../types";
import { ROLE_TEMPLATES } from "../data";
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
  User,
  Shield,
  KeyRound,
  Building,
  Briefcase,
  Users,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  Globe,
  LayoutDashboard,
} from "lucide-react";

interface UserGeneralTabProps {
  data: SystemUserRecord;
  onChange: (updated: Partial<SystemUserRecord>) => void;
}

export function UserGeneralTab({ data, onChange }: UserGeneralTabProps) {
  const { employees, plants, departmentsList } = useWorkspaceStore();
  const [showPassword, setShowPassword] = useState(false);

  // Generate strong random password
  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChange({ password: pwd });
  };

  // Handle HR employee linkage
  const handleEmployeeSelect = (empId: string | null) => {
    if (!empId || empId === "none") {
      onChange({ linkedEmployeeId: undefined });
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      onChange({
        linkedEmployeeId: emp.id,
        fullName: emp.fullName || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || data.fullName,
        phone: emp.phone || data.phone,
        plant: emp.plant || data.plant,
        department: emp.department || emp.departmentName || data.department,
      });
    }
  };

  // Handle role selection
  const handleRoleSelect = (roleKey: string | null) => {
    if (!roleKey) return;
    const template = ROLE_TEMPLATES[roleKey];
    if (template) {
      onChange({
        role: template.roleName,
        department: template.department || data.department,
        defaultModule: template.defaultModule || data.defaultModule,
        permissions: JSON.parse(JSON.stringify(template.permissions)),
        scope: JSON.parse(JSON.stringify(template.scope)),
      });
    } else {
      onChange({ role: roleKey });
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Section 1: Profil va Autentifikatsiya ─────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Hisob Ma&apos;lumotlari va Login
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Foydalanuvchining shaxsiy hisob rekvizitlari, tizimga kirish logini va paroli
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-mono h-5 ${
              data.status === "Active"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300"
            }`}
          >
            {data.status === "Active" ? "Faol Foydalanuvchi" : "Bloklangan / To'xtatilgan"}
          </Badge>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Username / Login */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Login (Username)</span>
              <span className="text-red-500">*</span>
            </Label>
            <Input
              value={data.username || ""}
              onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
              placeholder="masalan: d.morozov"
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>To&apos;liq F.I.Sh.</span>
              <span className="text-red-500">*</span>
            </Label>
            <Input
              value={data.fullName || ""}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Familiya Ism Sharif"
              className="h-8 text-xs"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Elektron Pochta (Email)</span>
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              value={data.email || ""}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="operator@printgoo.uz"
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground">
              Bog&apos;lanish Telefoni
            </Label>
            <Input
              value={data.phone || ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="+998 90 123-45-67"
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Password with generator */}
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-muted-foreground" />
                <span>Tizim Paroli / Vaqtinchalik Parol</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generatePassword}
                className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Avto-generatsiya</span>
              </Button>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={data.password || ""}
                onChange={(e) => onChange({ password: e.target.value })}
                placeholder="Yangi parol kiriting yoki generatsiya qiling"
                className="h-8 text-xs font-mono pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Tashkiliy Bog'lanish va HR Integratsiyasi ───────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-600" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Tashkiliy Tuzilma, Rol va HR Integratsiyasi
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Korxona filialiga biriktirish, lavozim roli va xodimlar reestri bilan bog&apos;lash
            </p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Role Selection with Preset Templates */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-muted-foreground" />
              <span>Kasbiy Rol / Mansabi</span>
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={
                Object.keys(ROLE_TEMPLATES).find(
                  (k) => ROLE_TEMPLATES[k].roleName === data.role
                ) || data.role
              }
              onValueChange={handleRoleSelect}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Rolni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ROLE_TEMPLATES).map((tmpl) => (
                  <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* HR Employee Linkage */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span>HR Xodimlar Reestridan Bog&apos;lash</span>
            </Label>
            <Select
              value={data.linkedEmployeeId || "none"}
              onValueChange={handleEmployeeSelect}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Xodimni tanlang (ixtiyoriy)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground">
                  — Bog&apos;lanmagan (Mustaqil login) —
                </SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.fullName || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()} ({emp.badgeNumber || emp.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plant / Branch */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <Building className="w-3 h-3 text-muted-foreground" />
              <span>Asosiy Filial / Korxona</span>
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={data.plant || (plants[0]?.name ?? "")}
              onValueChange={(val) => {
                if (val) onChange({ plant: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Filialni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {plants.map((plt) => (
                  <SelectItem key={plt.id} value={plt.name} className="text-xs">
                    {plt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground">
              Bo&apos;lim / Sex (Department)
            </Label>
            <Input
              value={data.department || ""}
              onChange={(e) => onChange({ department: e.target.value })}
              placeholder="masalan: Offset Printing Shop"
              className="h-8 text-xs"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground">
              Foydalanuvchi Holati
            </Label>
            <Select
              value={data.status}
              onValueChange={(val) => {
                if (val) onChange({ status: val as SystemUserRecord["status"] });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active" className="text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Faol (Kirish ochiq)</span>
                  </span>
                </SelectItem>
                <SelectItem value="Suspended" className="text-xs">
                  <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <span>To&apos;xtatilgan / Bloklangan</span>
                  </span>
                </SelectItem>
                <SelectItem value="Pending" className="text-xs">
                  <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <span>Kutilmoqda (Faollashtirilmagan)</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Shaxsiy Tizim Parametrlari ─────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-600" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Foydalanuvchi Interfeys Parametrlari
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Tizimga kirganda dastlab ochiluvchi boshlang&apos;ich modul va interfeys tili
            </p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Language */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <Globe className="w-3 h-3 text-muted-foreground" />
              <span>Afzal Ko&apos;rilgan Tizim Tili</span>
            </Label>
            <Select
              value={data.language}
              onValueChange={(val) => {
                if (val) onChange({ language: val as SystemUserRecord["language"] });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uz" className="text-xs">
                  O&apos;zbekcha (Lotin)
                </SelectItem>
                <SelectItem value="ru" className="text-xs">
                  Русский (Russian)
                </SelectItem>
                <SelectItem value="en" className="text-xs">
                  English (International)
                </SelectItem>
                <SelectItem value="tr" className="text-xs">
                  Türkçe (Turkish)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Initial Module */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <LayoutDashboard className="w-3 h-3 text-muted-foreground" />
              <span>Dastlabki Ochiluvchi Boshlang&apos;ich Modul</span>
            </Label>
            <Select
              value={data.defaultModule}
              onValueChange={(val) => {
                if (val) onChange({ defaultModule: val as SystemUserRecord["defaultModule"] });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production" className="text-xs">
                  Ishlab Chiqarish (Production)
                </SelectItem>
                <SelectItem value="trading" className="text-xs">
                  Savdo va Shartnomalar (Trading / Sales)
                </SelectItem>
                <SelectItem value="crm" className="text-xs">
                  Mijozlar bilan Aloqalar (CRM)
                </SelectItem>
                <SelectItem value="warehouse" className="text-xs">
                  Ombor va Logistika (Warehouse)
                </SelectItem>
                <SelectItem value="finance" className="text-xs">
                  Moliya va Hisob-kitob (Finance)
                </SelectItem>
                <SelectItem value="hr" className="text-xs">
                  Xodimlar va Ish haqi (HR & Payroll)
                </SelectItem>
                <SelectItem value="settings" className="text-xs">
                  Tizim Sozlamalari (Settings)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
