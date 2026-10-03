"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import UniverPresetSheetsCoreRuRU from "@univerjs/preset-sheets-core/locales/ru-RU";
import "@univerjs/preset-sheets-core/lib/index.css";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { xlsxToUniverWorkbook } from "./xlsx-to-univer";
import { ViewerLoading, ViewerError } from "./ViewerState";

/** Read-only XLSX viewer powered by Univer Sheets (loaded client-side only). */
export default function XlsxViewer({ url, name }: { url: string; name: string }) {
  const t = useTranslations("FileViewer");
  const locale = useLocale();
  const isDark = useWorkspaceStore((s) => s.theme === "dark");
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ReturnType<typeof createUniver>["univerAPI"] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let instance: ReturnType<typeof createUniver> | null = null;
    setStatus("loading");
    setError(null);

    const univerLocale = locale === "ru" ? LocaleType.RU_RU : LocaleType.EN_US;

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const snapshot = await xlsxToUniverWorkbook(buffer, name, univerLocale);
        if (disposed) return;

        instance = createUniver({
          locale: univerLocale,
          locales: {
            [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
            [LocaleType.RU_RU]: mergeLocales(UniverPresetSheetsCoreRuRU),
          },
          darkMode: isDark,
          presets: [
            UniverSheetsCorePreset({
              container,
              header: true,
              toolbar: false,
              contextMenu: false,
              formulaBar: true,
              disableAutoFocus: true,
            }),
          ],
        });
        apiRef.current = instance.univerAPI;

        const workbook = instance.univerAPI.createWorkbook(snapshot);
        workbook.setEditable(false);
        setStatus("ready");
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();

    return () => {
      disposed = true;
      apiRef.current = null;
      instance?.univer.dispose();
    };
    // Dark mode is applied separately below without re-creating the workbook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, name, locale]);

  useEffect(() => {
    apiRef.current?.toggleDarkMode(isDark);
  }, [isDark, status]);

  return (
    <div className="relative h-full w-full min-h-0">
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" && (
        <div className="absolute inset-0 bg-background z-10">
          {status === "loading" ? (
            <ViewerLoading label={t("loading")} />
          ) : (
            <ViewerError message={t("loadError")} detail={error ?? undefined} />
          )}
        </div>
      )}
    </div>
  );
}
