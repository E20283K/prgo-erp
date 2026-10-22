"use client";

import React from "react";
import { SystemUserRecord, UserSecurity, UserAuditEntry } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ShieldAlert,
  Clock,
  KeyRound,
  Network,
  History,
  CheckCircle2,
  AlertTriangle,
  Laptop,
  Globe,
} from "lucide-react";

interface UserSecurityTabProps {
  data: SystemUserRecord;
  onChange: (updated: Partial<SystemUserRecord>) => void;
}

export function UserSecurityTab({ data, onChange }: UserSecurityTabProps) {
  const security: UserSecurity = data.security || {
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60,
    allowedIpOnly: false,
    allowedIps: "",
    workHoursOnly: false,
    requirePasswordChange: false,
    auditLog: [],
  };

  const updateSecurity = (partial: Partial<UserSecurity>) => {
    onChange({
      security: {
        ...security,
        ...partial,
      },
    });
  };

  const auditLog: UserAuditEntry[] =
    security.auditLog && security.auditLog.length > 0
      ? security.auditLog
      : [
          {
            id: "AUD-DEF-1",
            action: "Foydalanuvchi akkaunti yaratildi va parametrlari belgilandi",
            ip: "127.0.0.1",
            device: "ERP System Console",
            timestamp: data.createdAt ? new Date(data.createdAt).toLocaleString("uz-UZ") : "Hozirgina",
            status: "success",
          },
        ];

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Section 1: Autentifikatsiya va Parol Siyosati ──────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Autentifikatsiya va Parol Xavfsizligi
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Ikki bosqichli autentifikatsiya (2FA) va parolni yangilash siyosati
            </p>
          </div>
        </div>

        <div className="divide-y divide-border px-4">
          {/* 2FA Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                <span>2FA / Ikki Bosqichli Tasdiqlash</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Tizimga kirishda Telegram yoki SMS orqali bir martalik xavfsizlik kodi talab qilinadi.
              </p>
            </div>
            <Switch
              checked={security.twoFactorEnabled}
              onCheckedChange={(checked) => updateSecurity({ twoFactorEnabled: checked })}
            />
          </div>

          {/* Require Password Change on Next Login */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Keyingi Kirishda Parolni O&apos;zgartirish</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Foydalanuvchi dastlabki login qilganda o&apos;zining shaxsiy doimiy parolini o&apos;rnatishi shart.
              </p>
            </div>
            <Switch
              checked={security.requirePasswordChange}
              onCheckedChange={(checked) => updateSecurity({ requirePasswordChange: checked })}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Tarmoq va Ish Vaqti Cheklovlari ─────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <Network className="w-4 h-4 text-violet-600" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Tarmoq Xavfsizligi va Sessiya Cheklovlari
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Faqat korxona IP manzillaridan kirish va sessiya davomiyligi
            </p>
          </div>
        </div>

        <div className="divide-y divide-border px-4">
          {/* Session Timeout Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Sessiya Davomiyligi (Harakatsizlik Limiti)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Belgilangan muddat davomida harakatsiz qolsa, tizimdan avtomatik chiqiladi.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                min="5"
                max="1440"
                value={security.sessionTimeoutMinutes}
                onChange={(e) =>
                  updateSecurity({ sessionTimeoutMinutes: Number(e.target.value) || 60 })
                }
                className="h-8 text-xs font-mono w-20 text-right"
              />
              <span className="text-xs font-mono text-muted-foreground">daq</span>
            </div>
          </div>

          {/* Work Hours Only Row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5 max-w-2xl">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Faqat Ish Vaqtida Kirishga Ruxsat</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Faqat belgilangan ish grafigida (08:00 - 20:00) kirish mumkin, kechki payt bloklanadi.
              </p>
            </div>
            <Switch
              checked={security.workHoursOnly}
              onCheckedChange={(checked) => updateSecurity({ workHoursOnly: checked })}
            />
          </div>

          {/* IP Whitelist Control Row */}
          <div className="py-3 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 max-w-2xl">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-violet-600" />
                  <span>Faqat Ruxsat Etilgan IP Manzillardan Kirish (Oq Ro&apos;yxat)</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Korxona ofisi yoki sex Wi-Fi tarmog&apos;i tashqarisidan kirishni cheklash.
                </p>
              </div>
              <Switch
                checked={security.allowedIpOnly}
                onCheckedChange={(checked) => updateSecurity({ allowedIpOnly: checked })}
              />
            </div>

            {security.allowedIpOnly && (
              <div className="pt-2 pl-5">
                <Label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Ruxsat etilgan IP manzillar (vergul bilan ajrating):
                </Label>
                <Input
                  value={security.allowedIps}
                  onChange={(e) => updateSecurity({ allowedIps: e.target.value })}
                  placeholder="masalan: 192.168.1.0/24, 213.230.100.42"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Faollik va Kirishlar Audit Jurnali ──────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Faollik va Kirishlar Audit Jurnali
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Foydalanuvchining so&apos;nggi kirishlari, qurilmalari va tizimdagi harakatlari
              </p>
            </div>
          </div>
          {security.lastLoginAt && (
            <div className="text-[11px] text-muted-foreground font-mono">
              Oxirgi kirish: {security.lastLoginAt.replace("T", " ").replace("Z", "")} ({security.lastLoginIp || "Noma'lum IP"})
            </div>
          )}
        </div>

        <div className="divide-y divide-border">
          {auditLog.map((log) => (
            <div
              key={log.id}
              className="px-4 py-2.5 text-xs flex items-center justify-between gap-3 hover:bg-muted/15"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    log.status === "success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-foreground text-xs">{log.action}</div>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {log.ip}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Laptop className="w-3 h-3" /> {log.device}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground font-mono shrink-0">
                {log.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
