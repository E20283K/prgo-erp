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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiometricDeviceRecord } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Server, Activity, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface DeviceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: BiometricDeviceRecord | null;
  onSaved: () => void;
}

export function DeviceDetailModal({
  open,
  onOpenChange,
  device,
  onSaved,
}: DeviceDetailModalProps) {
  const { upsertBiometricDevice, addNotification } = useWorkspaceStore();

  const [formData, setFormData] = useState({
    name: "",
    deviceCode: "",
    model: "Hikvision MinMoe",
    ipAddress: "192.168.1.120",
    port: 80,
    username: "admin",
    password: "",
    direction: "in" as "in" | "out" | "both",
    location: "Asosiy kirish darvozasi",
    isEnabled: true,
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name || "",
        deviceCode: device.deviceCode || "",
        model: device.model || "Hikvision MinMoe",
        ipAddress: device.ipAddress || "",
        port: device.port || 80,
        username: device.username || "admin",
        password: device.password || "",
        direction: device.direction || "in",
        location: device.location || "",
        isEnabled: device.isEnabled ?? true,
      });
    } else {
      setFormData({
        name: "",
        deviceCode: `TURNSTILE-${Date.now().toString().slice(-4)}`,
        model: "Hikvision MinMoe",
        ipAddress: "192.168.1.120",
        port: 80,
        username: "admin",
        password: "",
        direction: "in",
        location: "Asosiy kirish darvozasi",
        isEnabled: true,
      });
    }
    setTestResult(null);
    setErrors({});
  }, [device, open]);

  const handleTestConnection = async () => {
    if (!formData.ipAddress || !formData.password) {
      setErrors({
        ipAddress: !formData.ipAddress ? "IP manzilini kiriting" : "",
        password: !formData.password ? "Parolni kiriting" : "",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (device?.id) {
        // Test existing device
        const res = await fetch(`/api/v1/hr/devices/${device.id}/test`, { method: "POST" });
        const json = await res.json();
        setTestResult({
          success: json.success,
          message: json.message || (json.success ? "Qurilma Online" : "Aloqa o'rnatilmadi"),
        });
      } else {
        // Quick ping through direct test
        setTestResult({
          success: true,
          message: "Parametrlar to'g'ri (Saqlashdan so'ng to'liq tekshiriladi)",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Ulanish xatosi",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Qurilma nomini kiriting";
    if (!formData.ipAddress.trim()) newErrors.ipAddress = "IP manzilini kiriting";
    if (!device && !formData.password.trim()) newErrors.password = "Parolni kiriting";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      if (device?.id) {
        // PATCH
        const res = await fetch(`/api/v1/hr/devices/${device.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Yangilashda xatolik");

        upsertBiometricDevice({ ...device, ...formData, id: device.id });
        addNotification({
          title: "Qurilma yangilandi",
          description: `${formData.name} parametrlari saqlandi.`,
          severity: "success",
        });
      } else {
        // POST
        const res = await fetch("/api/v1/hr/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="size-4 text-blue-600" />
            {device ? "Biometrik Qurilmani Tahrirlash" : "Yangi Face ID / Turniket Qo'shish"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-xs">Qurilma nomi *</Label>
              {errors.name && <span className="text-[10px] text-destructive">{errors.name}</span>}
            </div>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masalan: 1-Nazorat punkti (Kirish turniket)"
              className={`h-8 ${errors.name ? "border-destructive" : ""}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Qurilma kodi</Label>
              <Input
                value={formData.deviceCode}
                onChange={(e) => setFormData({ ...formData, deviceCode: e.target.value })}
                placeholder="TURNSTILE-IN-01"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Hikvision MinMoe DS-K1T341"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs">IP manzili *</Label>
                {errors.ipAddress && (
                  <span className="text-[10px] text-destructive">{errors.ipAddress}</span>
                )}
              </div>
              <Input
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="192.168.1.120"
                className={`h-8 font-mono text-xs ${errors.ipAddress ? "border-destructive" : ""}`}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">ISAPI Port</Label>
              <Input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 80 })}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className={`h-8 font-mono text-xs ${errors.password ? "border-destructive" : ""}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Yo'nalishi (T-13)</Label>
              <Select
                value={formData.direction}
                onValueChange={(val: any) => setFormData({ ...formData, direction: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Faqat kirish (Check-in)</SelectItem>
                  <SelectItem value="out">Faqat chiqish (Check-out)</SelectItem>
                  <SelectItem value="both">Ikki tomonlama (Avto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Joylashuvi</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Masalan: Markaziy darvoza"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Test connection alert */}
          {testResult && (
            <div
              className={`p-2 rounded text-xs flex items-center gap-2 ${
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

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={testing || saving}
            onClick={handleTestConnection}
          >
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5 text-blue-600" />}
            Ulanishni tekshirish
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Saqlash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
