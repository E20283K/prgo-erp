"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComboboxSelect } from "@/components/ui/combobox";
import { BiometricDeviceRecord } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Server,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  DoorOpen,
  Globe,
  Network,
} from "lucide-react";

interface DeviceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: BiometricDeviceRecord | null;
  onSaved: () => void;
}

interface BranchItem {
  id: string;
  code: string;
  name: string;
}

export function DeviceDetailModal({
  open,
  onOpenChange,
  device,
  onSaved,
}: DeviceDetailModalProps) {
  const { upsertBiometricDevice, addNotification } = useWorkspaceStore();

  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);
  const [connectionMode, setConnectionMode] = useState<"isup" | "isapi">("isup");

  const [formData, setFormData] = useState({
    name: "",
    branchId: "",
    deviceCode: "",
    model: "",
    // Lokal / ISAPI
    ipAddress: "",
    port: 80,
    protocol: "http" as "http" | "https",
    username: "admin",
    password: "",
    // ISUP 5.0
    isupDeviceId: "",
    isupKey: "",
    // Parametrlar
    direction: "" as "in" | "out" | "both" | "",
    syncScope: "branch" as "branch" | "all",
    location: "",
    isEnabled: true,
  });

  const [testing, setTesting] = useState(false);
  const [triggeringRelay, setTriggeringRelay] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filiallar ro'yxatini yuklash
  useEffect(() => {
    let active = true;
    async function loadBranches() {
      try {
        const res = await fetch("/api/v1/branches");
        const json = await res.json();
        if (active && json.success && Array.isArray(json.data)) {
          setBranchesList(json.data);
        }
      } catch {
        // Filiallar yuklanmasa bo'sh qoladi
      }
    }
    loadBranches();
    return () => {
      active = false;
    };
  }, []);

  // Formani to'ldirish yoki tozalash (Oldindan fake qiymatlar to'ldirilmasin)
  useEffect(() => {
    if (device) {
      const meta = device.metadata || {};
      const mode = meta.connectionMode || (device.port === 7660 ? "isup" : "isapi");
      setConnectionMode(mode);

      setFormData({
        name: device.name || "",
        branchId: device.branchId || "all",
        deviceCode: device.deviceCode || "",
        model: device.model || "",
        ipAddress: device.ipAddress === "ISUP-CLOUD" ? "" : device.ipAddress || "",
        port: device.port || (mode === "isup" ? 7660 : 80),
        protocol: meta.protocol || "http",
        username: device.username || "admin",
        password: device.password || "",
        isupDeviceId: meta.isupDeviceId || device.deviceCode || "",
        isupKey: meta.isupKey || "",
        direction: (device.direction as any) || "in",
        syncScope: meta.syncScope || "branch",
        location: device.location || "",
        isEnabled: device.isEnabled ?? true,
      });
    } else {
      // Yangi qo'shishda barcha maydonlar bo'sh bo'ladi
      setConnectionMode("isup");
      setFormData({
        name: "",
        branchId: "",
        deviceCode: "",
        model: "",
        ipAddress: "",
        port: 80,
        protocol: "http",
        username: "admin",
        password: "",
        isupDeviceId: "",
        isupKey: "",
        direction: "",
        syncScope: "branch",
        location: "",
        isEnabled: true,
      });
    }
    setTestResult(null);
    setErrors({});
  }, [device, open]);

  // ISUP sozlama matnini nusxalash
  const handleCopyIsupConfig = () => {
    const currentHost = typeof window !== "undefined" ? window.location.hostname : "erp.printgo.uz";
    const text = `Server: ${currentHost}\nPort: 7660\nDevice ID: ${formData.isupDeviceId || formData.deviceCode || "..."}\nKey: ${formData.isupKey || "..."}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Ulanishni tekshirish (Ping)
  const handleTestConnection = async () => {
    const newErrors: Record<string, string> = {};
    if (connectionMode === "isapi") {
      if (!formData.ipAddress.trim()) newErrors.ipAddress = "IP manzilini kiriting";
      if (!device && !formData.password.trim()) newErrors.password = "Parolni kiriting";
    } else {
      if (!formData.isupDeviceId.trim()) newErrors.isupDeviceId = "Device ID kiriting";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (device?.id) {
        const res = await fetch(`/api/v1/hr/devices/${device.id}/test`, { method: "POST" });
        const json = await res.json();
        setTestResult({
          success: json.success,
          message: json.message || (json.success ? "Qurilma Online" : "Aloqa o'rnatilmadi"),
        });
      } else {
        setTestResult({
          success: true,
          message:
            connectionMode === "isup"
              ? "Parametrlar qabul qilindi. Terminal ulanganda avtomatik online bo'ladi."
              : "Parametrlar to'g'ri. Saqlashdan so'ng to'liq tekshiriladi.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Ulanishda xatolik yuz berdi",
      });
    } finally {
      setTesting(false);
    }
  };

  // Turniket relayini sinash (Eshikni ochish)
  const handleTriggerRelay = async () => {
    if (!device?.id) {
      setTestResult({
        success: false,
        message: "Avval qurilmani saqlang, so'ngra turniketni sinash mumkin.",
      });
      return;
    }

    setTriggeringRelay(true);
    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}/open-relay`, { method: "POST" });
      const json = await res.json();
      setTestResult({
        success: json.success,
        message: json.message || (json.success ? "Turniket ochildi" : "Ochib bo'lmadi"),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Turniketga buyruq uzatib bo'lmadi",
      });
    } finally {
      setTriggeringRelay(false);
    }
  };

  // Saqlash (Barcha majburiy maydonlar qat'iy tekshiriladi)
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Qurilma nomini kiriting";
    if (!formData.branchId) newErrors.branchId = "Filialni tanlang";
    if (!formData.deviceCode.trim()) newErrors.deviceCode = "Qurilma kodini kiriting";
    if (!formData.direction) newErrors.direction = "Yo'nalishni tanlang";
    if (!formData.location.trim()) newErrors.location = "O'rnatilgan joyini kiriting";

    if (connectionMode === "isapi") {
      if (!formData.ipAddress.trim()) newErrors.ipAddress = "IP manzilini kiriting";
      if (!device && !formData.password.trim()) newErrors.password = "Parolni kiriting";
    } else {
      if (!formData.isupDeviceId.trim()) newErrors.isupDeviceId = "Device ID kiriting";
      if (!formData.isupKey.trim()) newErrors.isupKey = "Registratsiya kalitini kiriting";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branchId: formData.branchId === "all" ? null : formData.branchId,
        name: formData.name.trim(),
        deviceCode: (connectionMode === "isup" ? formData.isupDeviceId : formData.deviceCode).trim(),
        model: formData.model.trim() || "Hikvision MinMoe",
        ipAddress: connectionMode === "isup" ? "ISUP-CLOUD" : formData.ipAddress.trim(),
        port: connectionMode === "isup" ? 7660 : Number(formData.port) || 80,
        username: connectionMode === "isup" ? "isup" : formData.username.trim(),
        password: connectionMode === "isup" ? formData.isupKey.trim() : formData.password.trim(),
        direction: formData.direction || "in",
        location: formData.location.trim(),
        isEnabled: formData.isEnabled,
        metadata: {
          connectionMode,
          isupDeviceId: formData.isupDeviceId.trim(),
          isupKey: formData.isupKey.trim(),
          protocol: formData.protocol,
          syncScope: formData.syncScope,
          enrolledUsersCount: device?.metadata?.enrolledUsersCount || 0,
          enrolledFacesCount: device?.metadata?.enrolledFacesCount || 0,
        },
      };

      if (device?.id) {
        const res = await fetch(`/api/v1/hr/devices/${device.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Yangilashda xatolik");

        upsertBiometricDevice({ ...device, ...payload, id: device.id });
        addNotification({
          title: "Qurilma yangilandi",
          description: `${formData.name} parametrlari saqlandi.`,
          severity: "success",
        });
      } else {
        const res = await fetch("/api/v1/hr/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Saqlashda xatolik");

        if (json.data) upsertBiometricDevice(json.data);
        addNotification({
          title: "Qurilma qo'shildi",
          description: `${formData.name} muvaffaqiyatli ro'yxatga olindi.`,
          severity: "success",
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "erp.printgo.uz";

  // Filiallar combobox variantlari
  const branchOptions = [
    { value: "all", label: "Barcha filiallar (Umumiy boshqaruv)" },
    ...branchesList.map((b) => ({
      value: b.id,
      label: b.name,
      description: b.code,
    })),
  ];

  // Yo'nalish variantlari
  const directionOptions = [
    { value: "in", label: "Kirish (Check-in turniketi)" },
    { value: "out", label: "Chiqish (Check-out turniketi)" },
    { value: "both", label: "Ikki tomonlama (Aqlli avto-almashtirish)" },
  ];

  // Qamrov variantlari
  const syncScopeOptions = [
    { value: "branch", label: "Faqat shu filial xodimlari" },
    { value: "all", label: "Barcha filial xodimlari (Global)" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl w-full text-xs p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border bg-card">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="size-4 text-blue-600" />
            {device ? "Biometrik Qurilmani Sozlash" : "Yangi Face ID Qurilmasini Qo'shish"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* 1. Asosiy identifikatorlar (Qurilma nomi va Filial) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">Qurilma nomi *</Label>
                {errors.name && <span className="text-[10px] text-destructive">{errors.name}</span>}
              </div>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="Masalan: Zangiota-1 Kirish turniket"
                className={`h-8 text-xs ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">Filial / Korxona *</Label>
                {errors.branchId && <span className="text-[10px] text-destructive">{errors.branchId}</span>}
              </div>
              <ComboboxSelect
                items={branchOptions}
                value={formData.branchId}
                onValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, branchId: val }));
                  if (errors.branchId) setErrors((prev) => ({ ...prev, branchId: "" }));
                }}
                placeholder="Filialni tanlang..."
                className={`h-8 text-xs ${errors.branchId ? "border-destructive" : ""}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">Qurilma kodi *</Label>
                {errors.deviceCode && <span className="text-[10px] text-destructive">{errors.deviceCode}</span>}
              </div>
              <Input
                value={formData.deviceCode}
                onChange={(e) => {
                  setFormData({ ...formData, deviceCode: e.target.value });
                  if (errors.deviceCode) setErrors((prev) => ({ ...prev, deviceCode: "" }));
                }}
                placeholder="Masalan: TURNSTILE-01"
                className={`h-8 font-mono text-xs ${errors.deviceCode ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Masalan: Hikvision MinMoe DS-K1T341"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* 2. Ulanish usuli (ISUP 5.0 vs Lokal Tablar) */}
          <div className="pt-1">
            <Label className="text-xs mb-1.5 block font-medium">Ulanish usuli</Label>
            <Tabs
              value={connectionMode}
              onValueChange={(val) => setConnectionMode(val as "isup" | "isapi")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 h-8 w-full p-0.5 bg-muted">
                <TabsTrigger
                  value="isup"
                  className="h-7 text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-card"
                >
                  <Globe className="size-3.5 text-blue-600" />
                  ISUP 5.0 (Bulut / Internet)
                </TabsTrigger>
                <TabsTrigger
                  value="isapi"
                  className="h-7 text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-card"
                >
                  <Network className="size-3.5 text-blue-600" />
                  Lokal / VPN (ISAPI)
                </TabsTrigger>
              </TabsList>

              {/* ISUP 5.0 Tab */}
              <TabsContent value="isup" className="space-y-3 pt-3 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs">Device ID *</Label>
                      {errors.isupDeviceId && (
                        <span className="text-[10px] text-destructive">{errors.isupDeviceId}</span>
                      )}
                    </div>
                    <Input
                      value={formData.isupDeviceId}
                      onChange={(e) => {
                        setFormData({ ...formData, isupDeviceId: e.target.value });
                        if (errors.isupDeviceId) setErrors((prev) => ({ ...prev, isupDeviceId: "" }));
                      }}
                      placeholder="Masalan: TERM-01"
                      className={`h-8 font-mono text-xs ${errors.isupDeviceId ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs">Registratsiya kaliti *</Label>
                      {errors.isupKey && (
                        <span className="text-[10px] text-destructive">{errors.isupKey}</span>
                      )}
                    </div>
                    <Input
                      value={formData.isupKey}
                      onChange={(e) => {
                        setFormData({ ...formData, isupKey: e.target.value });
                        if (errors.isupKey) setErrors((prev) => ({ ...prev, isupKey: "" }));
                      }}
                      placeholder="Masalan: StrongPass@2026"
                      className={`h-8 font-mono text-xs ${errors.isupKey ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                </div>

                {/* ISUP terminal sozlamalari nusxalash yordamchisi */}
                <div className="bg-muted/40 border border-border rounded p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-foreground">
                      Terminal sozlamasiga kiritish uchun parametrlar:
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2.5 gap-1 shadow-none"
                      onClick={handleCopyIsupConfig}
                    >
                      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                      {copied ? "Nusxalandi" : "Nusxa olish"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground bg-background/60 p-2 rounded border border-border/50">
                    <div>
                      Server manzili: <span className="text-foreground font-semibold">{currentHost}</span>
                    </div>
                    <div>
                      Server porti: <span className="text-foreground font-semibold">7660</span>
                    </div>
                    <div>
                      Device ID:{" "}
                      <span className="text-foreground font-semibold">
                        {formData.isupDeviceId || formData.deviceCode || "..."}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Lokal / ISAPI Tab */}
              <TabsContent value="isapi" className="space-y-3 pt-3 mt-0">
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="col-span-1">
                    <Label className="text-xs mb-1 block">Protokol</Label>
                    <ComboboxSelect
                      items={[
                        { value: "http", label: "HTTP" },
                        { value: "https", label: "HTTPS" },
                      ]}
                      value={formData.protocol}
                      onValueChange={(val) => setFormData({ ...formData, protocol: (val as any) || "http" })}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs">IP / Host *</Label>
                      {errors.ipAddress && (
                        <span className="text-[10px] text-destructive">{errors.ipAddress}</span>
                      )}
                    </div>
                    <Input
                      value={formData.ipAddress}
                      onChange={(e) => {
                        setFormData({ ...formData, ipAddress: e.target.value });
                        if (errors.ipAddress) setErrors((prev) => ({ ...prev, ipAddress: "" }));
                      }}
                      placeholder="192.168.1.120 yoki filial.printgo.uz"
                      className={`h-8 font-mono text-xs ${errors.ipAddress ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="text-xs mb-1 block">Port</Label>
                    <Input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 80 })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Login (Admin)</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="admin"
                      className="h-8 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs">{device ? "Yangi parol (ixtiyoriy)" : "Parol *"}</Label>
                      {errors.password && (
                        <span className="text-[10px] text-destructive">{errors.password}</span>
                      )}
                    </div>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                      }}
                      placeholder="••••••••"
                      className={`h-8 font-mono text-xs ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 3. Yo'nalish, Xodimlar qamrovi va Joylashuv */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">Yo'nalishi (T-13) *</Label>
                {errors.direction && (
                  <span className="text-[10px] text-destructive">{errors.direction}</span>
                )}
              </div>
              <ComboboxSelect
                items={directionOptions}
                value={formData.direction}
                onValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, direction: val as any }));
                  if (errors.direction) setErrors((prev) => ({ ...prev, direction: "" }));
                }}
                placeholder="Yo'nalishni tanlang..."
                className={`h-8 text-xs ${errors.direction ? "border-destructive" : ""}`}
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Xodimlar qamrovi</Label>
              <ComboboxSelect
                items={syncScopeOptions}
                value={formData.syncScope}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, syncScope: val as any }))}
                placeholder="Qamrovni tanlang..."
                className="h-8 text-xs"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">O'rnatilgan joyi *</Label>
                {errors.location && (
                  <span className="text-[10px] text-destructive">{errors.location}</span>
                )}
              </div>
              <Input
                value={formData.location}
                onChange={(e) => {
                  setFormData({ ...formData, location: e.target.value });
                  if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
                }}
                placeholder="Masalan: Markaziy darvoza"
                className={`h-8 text-xs ${errors.location ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
            </div>
          </div>

          {/* 4. Test va diagnostika xabari */}
          {testResult && (
            <div
              className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-destructive" />
              )}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer paneli (Body kontenti bilan 100% bir xil px-5 chiziqda) */}
        <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={testing || saving || triggeringRelay}
              onClick={handleTestConnection}
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5 text-blue-600" />}
              Aloqani tekshirish
            </Button>

            {device?.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={testing || saving || triggeringRelay}
                onClick={handleTriggerRelay}
                title="Turniket relayini 3 soniyaga ochish"
              >
                {triggeringRelay ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <DoorOpen className="size-3.5 text-emerald-600" />
                )}
                Turniketni ochish
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => onOpenChange(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
              Saqlash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
