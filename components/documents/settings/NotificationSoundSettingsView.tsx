"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  SOUND_THEMES,
  ToastSoundTheme,
  playToastSound,
} from "@/lib/sound/soundService";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
} from "lucide-react";

export function NotificationSoundSettingsView() {
  const t = useTranslations("NotificationSoundSettings");
  const {
    toastSoundConfig,
    setToastSoundConfig,
    addNotification,
  } = useWorkspaceStore();

  const [activeAudition, setActiveAudition] = useState<string | null>(null);

  const isEnabled = toastSoundConfig.enabled;
  const currentTheme = toastSoundConfig.theme;
  const volumePercent = Math.round((toastSoundConfig.volume ?? 0.75) * 100);

  // Audition preview a specific theme
  const handleAuditionTheme = (themeId: ToastSoundTheme) => {
    setActiveAudition(themeId);
    playToastSound("success", { theme: themeId, force: true });
    setTimeout(() => {
      setActiveAudition(null);
    }, 600);
  };

  // Change volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const normalized = Math.max(0, Math.min(100, val)) / 100;
    setToastSoundConfig({ volume: normalized });
  };

  // Test play after sliding
  const handleVolumeChangeEnd = () => {
    playToastSound("info", { force: true });
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (toastSoundConfig.volume > 0) {
      setToastSoundConfig({ volume: 0 });
    } else {
      setToastSoundConfig({ volume: 0.75 });
      playToastSound("info", { volume: 0.75, force: true });
    }
  };

  // Reset to default
  const handleResetDefaults = () => {
    setToastSoundConfig({
      enabled: true,
      theme: "modern",
      volume: 0.75,
    });
    playToastSound("success", { theme: "modern", volume: 0.75, force: true });
  };

  // Trigger real sample toasts
  const handleTriggerTestToast = (severity: "success" | "warning" | "error" | "info") => {
    switch (severity) {
      case "success":
        addNotification({
          title: t("testSuccessTitle"),
          description: t("testSuccessDesc"),
          severity: "success",
          channel: "toast",
        });
        break;
      case "warning":
        addNotification({
          title: t("testWarningTitle"),
          description: t("testWarningDesc"),
          severity: "warning",
          channel: "toast",
        });
        break;
      case "error":
        addNotification({
          title: t("testErrorTitle"),
          description: t("testErrorDesc"),
          severity: "error",
          channel: "toast",
        });
        break;
      case "info":
        addNotification({
          title: t("testInfoTitle"),
          description: t("testInfoDesc"),
          severity: "info",
          channel: "toast",
        });
        break;
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-muted border border-border">
              <Volume2 className="size-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-foreground">
                  {t("title")}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    isEnabled
                      ? "text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : "text-[10px] font-mono font-medium text-muted-foreground border-border bg-muted/40"
                  }
                >
                  {isEnabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("description")}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-7 px-2 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
            title="Standart sozlamalarni tiklash"
          >
            <RotateCcw className="size-3.5" />
            <span>Tiklash</span>
          </Button>
        </div>

        {/* ── CARD 1: Master Audio Switch ── */}
        <div className="p-3.5 rounded-lg border border-border bg-card shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">
              {t("masterTitle")}
            </span>
            <span className="text-xs text-muted-foreground block">
              {t("masterDesc")}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground select-none">
              {isEnabled ? t("enabled") : t("disabled")}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => {
                setToastSoundConfig({ enabled: checked });
                if (checked) {
                  playToastSound("success", { force: true });
                }
              }}
              size="default"
              aria-label={t("masterTitle")}
            />
          </div>
        </div>

        {/* ── CARD 2: Sound Pack Presets ── */}
        <div className="p-3.5 rounded-lg border border-border bg-card shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                {t("themeTitle")}
              </span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {t("themeDesc")}
              </span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {SOUND_THEMES.length} ta to&apos;plam
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {SOUND_THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              const isAuditioning = activeAudition === theme.id;

              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    setToastSoundConfig({ theme: theme.id });
                    handleAuditionTheme(theme.id);
                  }}
                  className={`p-3 rounded-md border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? "border-primary bg-primary/[0.04] ring-1 ring-primary/30"
                      : "border-border hover:border-border/80 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {theme.name}
                        </span>
                        {isSelected && (
                          <span className="flex items-center justify-center size-3.5 rounded-full bg-primary text-primary-foreground">
                            <Check className="size-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      wav · 44.1kHz
                    </span>

                    <Button
                      type="button"
                      variant={isSelected ? "default" : "secondary"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setToastSoundConfig({ theme: theme.id });
                        handleAuditionTheme(theme.id);
                      }}
                      className="h-6 px-2 text-[11px] gap-1 cursor-pointer font-medium"
                    >
                      <Play
                        className={`size-3 ${
                          isAuditioning ? "animate-spin text-emerald-400" : ""
                        }`}
                      />
                      <span>{t("preview")}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CARD 3: Volume Slider ── */}
        <div className="p-3.5 rounded-lg border border-border bg-card shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                {t("volumeTitle")}
              </span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {t("volumeDesc")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleMute}
                className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                title={volumePercent === 0 ? "Ovozni yoqish" : "Ovozni o'chirish (Mute)"}
              >
                {volumePercent === 0 ? (
                  <VolumeX className="size-4 text-destructive" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </Button>
              <span className="text-xs font-mono font-bold text-foreground w-10 text-right">
                {volumePercent}%
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-3">
            <VolumeX className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePercent}
              onChange={handleVolumeChange}
              onMouseUp={handleVolumeChangeEnd}
              onTouchEnd={handleVolumeChangeEnd}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            />
            <Volume2 className="size-3.5 text-muted-foreground shrink-0" />
          </div>
        </div>

        {/* ── CARD 4: Interactive Test Sandbox ── */}
        <div className="p-3.5 rounded-lg border border-border bg-card shadow-2xs space-y-3">
          <div>
            <span className="text-xs font-semibold text-foreground block">
              {t("testTitle")}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {t("testDesc")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTriggerTestToast("success")}
              className="h-8 text-xs gap-1.5 cursor-pointer border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 justify-start"
            >
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">{t("testSuccess")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTriggerTestToast("warning")}
              className="h-8 text-xs gap-1.5 cursor-pointer border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 justify-start"
            >
              <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{t("testWarning")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTriggerTestToast("error")}
              className="h-8 text-xs gap-1.5 cursor-pointer border-destructive/40 hover:bg-destructive/10 text-destructive justify-start"
            >
              <XCircle className="size-3.5 shrink-0 text-destructive" />
              <span className="truncate">{t("testError")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTriggerTestToast("info")}
              className="h-8 text-xs gap-1.5 cursor-pointer border-blue-500/40 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 justify-start"
            >
              <Info className="size-3.5 shrink-0 text-blue-500" />
              <span className="truncate">{t("testInfo")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
