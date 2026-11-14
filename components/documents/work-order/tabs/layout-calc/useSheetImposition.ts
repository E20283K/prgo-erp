"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrderAttachment, PersistedImpositionState } from "../../types";
import type { PrintMethod } from "../../planningEngine";
import type { WarehouseStockRecord } from "@/store/workspaceStore";
import {
  analyzeSheetArtwork,
  calculateSheetLayout,
  generateSheetImposition,
  type AnalyzeVariantSource,
  type ArtworkSource,
} from "@/lib/sheet-imposition/api";
import type {
  AnalyzeResponse,
  CalculateRequest,
  CalculateResponse,
  ColorChannel,
  GenerateResponse,
  LayoutParams,
} from "@/lib/sheet-imposition/types";
import {
  calculateSheetCutOptions,
  doesSheetFitMachine,
  parseFormatString,
  pickOptimalCutOption,
  resolveMachineConstraints,
} from "./parentSheet";
import type { ApplyImpositionPayload, ImpositionVariant, LayoutCalcTabProps, SheetCutOption } from "./types";

export type ImpositionSettings = Omit<PersistedImpositionState, "jobId" | "pdfUrl" | "generatedAt" | "summary">;

const CALC_DEBOUNCE_MS = 300;
const PERSIST_DEBOUNCE_MS = 600;

function isPdfUrl(url?: string): url is string {
  if (!url) return false;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  return /\.pdf($|[?#&])/i.test(decoded);
}

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const key = decoded.match(/[?&]key=([^&]+)/)?.[1] ?? decoded.split("?")[0];
    const last = key.split("/").pop();
    return last && last.toLowerCase().endsWith(".pdf") ? last : fallback;
  } catch {
    return fallback;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function hexToCmyk(hex: string): [number, number, number, number] {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [0, 0, 0, 1];
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  const f = (c: number) => Number(((1 - c - k) / (1 - k)).toFixed(3));
  return [f(r), f(g), f(b), Number(k.toFixed(3))];
}

function printMethodToMode(pm: PrintMethod | undefined, hasBack: boolean): ImpositionSettings["mode"] {
  if (pm === "single_sided" || pm === "sheetwise" || pm === "work_and_turn") return pm;
  return hasBack ? "sheetwise" : "single_sided";
}

export function useSheetImposition(props: LayoutCalcTabProps) {
  const {
    sizes = [],
    defaultQuantity,
    docNo,
    orderName,
    defaultProdW,
    defaultProdH,
    defaultBleed,
    shapeType,
    artworkFront,
    artworkBack,
    skuArtworks = [],
    frontColors = { c: true, m: true, y: true, k: true },
    backColors = { c: false, m: false, y: false, k: false },
    spotColors = [],
    printMethod,
    onPrintMethodChange,
    pressMachine,
    activeMachine,
    paperStock,
    warehouseStock = [],
    parentSheetW: propParentW,
    parentSheetH: propParentH,
    pressSheetW: propPressW,
    pressSheetH: propPressH,
    plannedSheets,
    appliedCtpPlates,
    impositionState,
    onImpositionStateChange,
    onApplyToOrder,
    onAddAttachment,
  } = props;

  const machine = useMemo(() => resolveMachineConstraints(pressMachine, activeMachine), [pressMachine, activeMachine]);

  // ---------------------------------------------------------------- colours
  const frontColorCount = useMemo(() => {
    const proc = [frontColors.c, frontColors.m, frontColors.y, frontColors.k].filter(Boolean).length;
    const spot = spotColors.filter((s) => s.side === "front" || s.side === "both").length;
    return Math.max(1, proc + spot);
  }, [frontColors, spotColors]);

  const backColorCount = useMemo(() => {
    const proc = [backColors.c, backColors.m, backColors.y, backColors.k].filter(Boolean).length;
    const spot = spotColors.filter((s) => s.side === "back" || s.side === "both").length;
    return proc + spot;
  }, [backColors, spotColors]);

  /** Ink channels for the colour bar / passport on the sheet (union of both sides). */
  const colorChannels = useMemo<ColorChannel[]>(() => {
    const out: ColorChannel[] = spotColors.map((s) => ({
      name: s.code || s.name,
      is_spot: true,
      cmyk: hexToCmyk(s.hex),
    }));
    const proc: [keyof typeof frontColors, string, ColorChannel["cmyk"]][] = [
      ["c", "Cyan", [1, 0, 0, 0]],
      ["m", "Magenta", [0, 1, 0, 0]],
      ["y", "Yellow", [0, 0, 1, 0]],
      ["k", "Black", [0, 0, 0, 1]],
    ];
    for (const [key, name, cmyk] of proc) {
      if (frontColors[key] || backColors[key]) out.push({ name, is_spot: false, cmyk });
    }
    return out;
  }, [frontColors, backColors, spotColors]);

  // ---------------------------------------------------------------- paper stock
  const paperOptions = useMemo(
    () =>
      warehouseStock.filter(
        (w) =>
          (w.category === "Paper & Board" || w.category === "Offcuts & Scraps") &&
          parseFormatString(w.cutDimensions || w.sheetFormat)
      ),
    [warehouseStock]
  );

  // ---------------------------------------------------------------- settings
  const saved = impositionState?.version === 2 ? impositionState : undefined;

  const [settings, setSettings] = useState<ImpositionSettings>(() => {
    if (saved) {
      const rest: Partial<PersistedImpositionState> = { ...saved };
      delete rest.jobId;
      delete rest.pdfUrl;
      delete rest.generatedAt;
      delete rest.summary;
      return rest as ImpositionSettings;
    }
    const stock = paperStock
      ? warehouseStock.find((w) => [w.name, w.sku].some((x) => x?.toLowerCase() === paperStock.toLowerCase()))
      : undefined;
    const stockDims = parseFormatString(stock?.cutDimensions || stock?.sheetFormat);
    const [pW, pH] =
      propParentW && propParentH
        ? [Math.max(propParentW, propParentH), Math.min(propParentW, propParentH)]
        : stockDims ?? [1000, 700];
    const trimW = defaultProdW || 90;
    const trimH = defaultProdH || 50;
    const gripper = machine.defaultGripper;
    const margins = { top: 10, bottom: gripper, left: 10, right: 10 };
    const best = pickOptimalCutOption(
      calculateSheetCutOptions(pW, pH, { trimW, trimH, gutterX: 3, gutterY: 3, margins }, machine)
    );
    const isDie = !!shapeType && shapeType !== "rectangle";
    return {
      version: 2,
      paperName: stock?.name ?? paperStock,
      parentSheetW: pW,
      parentSheetH: pH,
      cutDivisor: propPressW && propPressH ? Math.max(1, Math.round((pW * pH) / (propPressW * propPressH))) : best.divisor,
      sheetW: propPressW ? Math.max(propPressW, propPressH || 0) : best.pressW,
      sheetH: propPressH ? Math.min(propPressW || propPressH, propPressH) : best.pressH,
      marginTop: margins.top,
      marginBottom: margins.bottom,
      marginLeft: margins.left,
      marginRight: margins.right,
      alignment: "center",
      trimW,
      trimH,
      bleed: defaultBleed ?? 1.5,
      innerBleed: 1.5,
      outerBleed: 3,
      gutterX: 3,
      gutterY: 3,
      cropGap: 1,
      rotation: "auto",
      mode: printMethodToMode(printMethod, backColorCount > 0),
      strategy: "smart_no_split",
      maxOverprintPct: 10,
      fillDirection: "col",
      wasteSheets: 0,
      manualSlots: {},
      category: isDie ? "diecut" : "guillotine",
      cutStyle: "double",
      templateStyle: isDie ? "packaging" : "offset_standard",
      exportSeparate: true,
    };
  });

  const update = useCallback((patch: Partial<ImpositionSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setMode = useCallback(
    (mode: ImpositionSettings["mode"]) => {
      update({ mode });
      onPrintMethodChange?.(mode);
    },
    [update, onPrintMethodChange]
  );

  // Keep mode in sync when the spec's print method changes elsewhere (adjust state during render)
  const [seenPrintMethod, setSeenPrintMethod] = useState(printMethod);
  if (printMethod !== seenPrintMethod) {
    setSeenPrintMethod(printMethod);
    if (printMethod === "single_sided" || printMethod === "sheetwise" || printMethod === "work_and_turn") {
      if (printMethod !== settings.mode) setSettings((prev) => ({ ...prev, mode: printMethod }));
    }
  }

  // ---------------------------------------------------------------- parent sheet cuts
  const gridEstimate = useMemo(
    () => ({
      trimW: settings.trimW,
      trimH: settings.trimH,
      gutterX: settings.gutterX,
      gutterY: settings.gutterY,
      margins: {
        top: settings.marginTop,
        bottom: settings.marginBottom,
        left: settings.marginLeft,
        right: settings.marginRight,
      },
    }),
    [settings.trimW, settings.trimH, settings.gutterX, settings.gutterY, settings.marginTop, settings.marginBottom, settings.marginLeft, settings.marginRight]
  );

  const cutOptions = useMemo<SheetCutOption[]>(
    () => calculateSheetCutOptions(settings.parentSheetW, settings.parentSheetH, gridEstimate, machine),
    [settings.parentSheetW, settings.parentSheetH, gridEstimate, machine]
  );

  const sheetFitsMachine = doesSheetFitMachine(settings.sheetW, settings.sheetH, machine);

  const selectCutOption = useCallback(
    (opt: SheetCutOption) => update({ cutDivisor: opt.divisor, sheetW: opt.pressW, sheetH: opt.pressH }),
    [update]
  );

  const selectPaper = useCallback(
    (stock: WarehouseStockRecord) => {
      const dims = parseFormatString(stock.cutDimensions || stock.sheetFormat);
      if (!dims) return;
      const best = pickOptimalCutOption(calculateSheetCutOptions(dims[0], dims[1], gridEstimate, machine));
      update({
        paperName: stock.name,
        parentSheetW: dims[0],
        parentSheetH: dims[1],
        cutDivisor: best.divisor,
        sheetW: best.pressW,
        sheetH: best.pressH,
      });
    },
    [gridEstimate, machine, update]
  );

  // ---------------------------------------------------------------- variants
  const [localFiles, setLocalFiles] = useState<Record<string, { front?: File; back?: File }>>({});
  const [dielineFile, setDielineFile] = useState<File | undefined>();

  const variants = useMemo<ImpositionVariant[]>(() => {
    const active = sizes.filter((s) => (s.quantity || 0) > 0);
    const base: { key: string; name: string; skuId?: string; quantity: number }[] = active.length
      ? active.map((s) => ({
          key: s.id,
          skuId: s.id,
          name: [s.model, s.sizeCode].filter(Boolean).join(" ") || s.size || s.id,
          quantity: s.quantity,
        }))
      : [{ key: "main", name: orderName || docNo || "Mahsulot", quantity: Math.max(1, defaultQuantity || 1000) }];

    return base.map((b) => {
      const art = skuArtworks.find((a) => a.skuId === b.key);
      const frontUrl = isPdfUrl(art?.frontArtworkUrl) ? art!.frontArtworkUrl : isPdfUrl(artworkFront) ? artworkFront : undefined;
      const backUrl = isPdfUrl(art?.backArtworkUrl) ? art!.backArtworkUrl : isPdfUrl(artworkBack) ? artworkBack : undefined;
      const local = localFiles[b.key] || {};
      return {
        ...b,
        manualSlots: settings.manualSlots[b.key] || undefined,
        frontUrl,
        frontName: art?.frontArtworkName || (frontUrl ? fileNameFromUrl(frontUrl, `${b.name}_oldi.pdf`) : undefined),
        backUrl,
        backName: art?.backArtworkName || (backUrl ? fileNameFromUrl(backUrl, `${b.name}_orqa.pdf`) : undefined),
        frontFile: local.front,
        backFile: local.back,
      };
    });
  }, [sizes, skuArtworks, artworkFront, artworkBack, localFiles, settings.manualSlots, orderName, docNo, defaultQuantity]);

  const setVariantFile = useCallback((key: string, side: "front" | "back", file?: File) => {
    setLocalFiles((prev) => ({ ...prev, [key]: { ...prev[key], [side]: file } }));
  }, []);

  const setManualSlots = useCallback(
    (key: string, slots?: number) => {
      setSettings((prev) => {
        const next = { ...prev.manualSlots };
        if (slots && slots > 0) next[key] = slots;
        else delete next[key];
        return { ...prev, manualSlots: next };
      });
    },
    []
  );

  const hasAllArtwork = variants.every((v) => v.frontFile || v.frontUrl);

  // ---------------------------------------------------------------- /calculate
  const layoutParams = useMemo<LayoutParams>(
    () => ({
      sheet: {
        width_mm: settings.sheetW,
        height_mm: settings.sheetH,
        margin_left_mm: settings.marginLeft,
        margin_right_mm: settings.marginRight,
        margin_top_mm: settings.marginTop,
        margin_bottom_mm: settings.marginBottom,
      },
      bleed: {
        trim_width_mm: settings.trimW,
        trim_height_mm: settings.trimH,
        bleed_mm: settings.bleed,
        inner_bleed_mm: settings.innerBleed,
        outer_bleed_mm: settings.outerBleed,
        gutter_x_mm: settings.gutterX,
        gutter_y_mm: settings.gutterY,
        crop_length_mm: 4,
        crop_gap_mm: settings.cropGap,
        auto_extend_bleed: true,
        alignment: settings.alignment,
      },
      mode: settings.mode,
      strategy: settings.strategy,
      max_overprint_pct: settings.maxOverprintPct,
      fill_direction: settings.fillDirection,
      waste_sheets: settings.wasteSheets,
      allow_rotation: settings.rotation === "auto",
      rotation: settings.rotation === "auto" ? null : settings.rotation,
      manual_grid:
        settings.manualCols && settings.manualRows
          ? { cols: settings.manualCols, rows: settings.manualRows, rotation: settings.rotation === 90 ? 90 : 0 }
          : null,
    }),
    [settings]
  );

  const effectiveParams = layoutParams;

  const variantInputs = useMemo(
    () =>
      variants.map((v) => ({
        name: v.name,
        quantity: Math.max(1, Math.round(v.quantity)),
        manual_slots: v.manualSlots ?? null,
        sku_id: v.skuId ?? null,
      })),
    [variants]
  );

  const calcRequest = useMemo<CalculateRequest>(
    () => ({ ...effectiveParams, variants: variantInputs }),
    [effectiveParams, variantInputs]
  );
  const calcKey = JSON.stringify(calcRequest);

  // Result / error are tagged with the request key they belong to; loading is derived.
  const [calcState, setCalcState] = useState<{ key: string; res: CalculateResponse | null; error: string | null }>({
    key: "",
    res: null,
    error: null,
  });
  const calc = calcState.res;
  const calcError = calcState.key === calcKey ? calcState.error : null;
  const calcLoading = calcState.key !== calcKey;

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      calculateSheetLayout(calcRequest, ctrl.signal)
        .then((res) => setCalcState({ key: calcKey, res, error: null }))
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setCalcState((prev) => ({ key: calcKey, res: prev.res, error: errorMessage(err, "Hisoblashda xatolik") }));
        });
    }, CALC_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcKey]);

  // ---------------------------------------------------------------- production summary
  const summary = useMemo(() => {
    if (!calc) return null;
    const forms = calc.forms.length;
    const pressSheets = calc.total_sheets;
    const divisor = Math.max(1, settings.cutDivisor);
    const parentSheets = Math.ceil(pressSheets / divisor);
    const platesPerForm =
      settings.mode === "single_sided"
        ? frontColorCount
        : settings.mode === "work_and_turn"
          ? Math.max(frontColorCount, backColorCount)
          : frontColorCount + backColorCount;
    const ctpPlates = forms * platesPerForm;
    const produced = calc.forms.reduce((s, f) => s + f.total_produced_qty, 0);
    // Engine semantics: technological overprint excludes free "bonus" slots that cost no extra sheets
    const overprint = calc.forms.reduce((s, f) => s + f.total_overprint_qty, 0);
    const overprintPct = calc.total_order_qty > 0 ? (overprint / calc.total_order_qty) * 100 : 0;
    return {
      forms,
      itemsPerSheet: calc.items_per_sheet,
      pressSheets,
      parentSheets,
      platesPerForm,
      ctpPlates,
      produced,
      overprintPct,
    };
  }, [calc, settings.cutDivisor, settings.mode, frontColorCount, backColorCount]);

  // ---------------------------------------------------------------- analyze / generate
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisKey, setAnalysisKey] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [busy, setBusy] = useState<"analyze" | "generate" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sourceKey = useMemo(
    () =>
      JSON.stringify({
        v: variants.map((v) => [v.key, v.frontFile?.name ?? v.frontUrl, v.backFile?.name ?? v.backUrl, v.frontFile?.lastModified, v.backFile?.lastModified]),
        d: dielineFile ? [dielineFile.name, dielineFile.lastModified] : null,
        t: [settings.trimW, settings.trimH],
      }),
    [variants, dielineFile, settings.trimW, settings.trimH]
  );
  const analysisStale = !analysis || analysisKey !== sourceKey;

  const runAnalyze = useCallback(async (): Promise<AnalyzeResponse | null> => {
    const sources: AnalyzeVariantSource[] = [];
    for (const v of variants) {
      const front: ArtworkSource | undefined = v.frontFile
        ? { file: v.frontFile, name: v.frontFile.name }
        : v.frontUrl
          ? { url: v.frontUrl, name: v.frontName || `${v.name}.pdf` }
          : undefined;
      if (!front) {
        setActionError(`"${v.name}" uchun oldi PDF yo'q`);
        return null;
      }
      const back: ArtworkSource | undefined = v.backFile
        ? { file: v.backFile, name: v.backFile.name }
        : v.backUrl
          ? { url: v.backUrl, name: v.backName || `${v.name}_orqa.pdf` }
          : undefined;
      sources.push({ name: v.name, skuId: v.skuId, quantity: v.quantity, front, back });
    }
    setBusy("analyze");
    setActionError(null);
    try {
      const res = await analyzeSheetArtwork({
        variants: sources,
        dieline: dielineFile ? { file: dielineFile, name: dielineFile.name } : undefined,
        expectedTrim: { w: settings.trimW, h: settings.trimH },
      });
      setAnalysis(res);
      setAnalysisKey(sourceKey);
      setGenerated(null);
      return res;
    } catch (err: unknown) {
      setActionError(errorMessage(err, "Tahlilda xatolik"));
      return null;
    } finally {
      setBusy(null);
    }
  }, [variants, dielineFile, settings.trimW, settings.trimH, sourceKey]);

  const lastPersisted = useRef<string>("");
  const [pdfMeta, setPdfMeta] = useState<Pick<PersistedImpositionState, "jobId" | "pdfUrl" | "generatedAt">>({
    jobId: saved?.jobId,
    pdfUrl: saved?.pdfUrl,
    generatedAt: saved?.generatedAt,
  });

  const runGenerate = useCallback(async () => {
    const an = analysisStale ? await runAnalyze() : analysis;
    if (!an) return;
    setBusy("generate");
    setActionError(null);
    try {
      const res = await generateSheetImposition(an.job_id, {
        ...effectiveParams,
        variants: variantInputs,
        job: {
          order_number: docNo || "",
          job_name: orderName || docNo || "Montaj",
          custom_notes: "",
          category: settings.category,
          cut_style: settings.cutStyle,
          style: settings.templateStyle,
          colors: colorChannels,
        },
        export_separate_files: settings.exportSeparate,
        include_proof_overlay: settings.category === "diecut",
      });
      setGenerated(res);
      const main = res.files.find((f) => f.label === "Montaj") || res.files[0];
      if (main) {
        const now = new Date();
        const safeDoc = (docNo || "buyurtma").replace(/[^a-zA-Z0-9_-]/g, "_");
        setPdfMeta({ jobId: res.job_id, pdfUrl: main.url, generatedAt: now.toISOString() });
        onAddAttachment?.({
          id: `ATT-MONTAJ-${safeDoc}`,
          name: `Montaj_${safeDoc}.pdf`,
          size: `${(main.size_bytes / 1024 / 1024).toFixed(2)} MB`,
          type: "application/pdf",
          date: now.toISOString(),
          category: "proofs",
          url: main.url,
        } satisfies OrderAttachment);
      }
    } catch (err: unknown) {
      setActionError(errorMessage(err, "Montaj yaratishda xatolik"));
    } finally {
      setBusy(null);
    }
  }, [analysisStale, runAnalyze, analysis, effectiveParams, variantInputs, docNo, orderName, settings.category, settings.cutStyle, settings.templateStyle, settings.exportSeparate, colorChannels, onAddAttachment]);

  // ---------------------------------------------------------------- persist settings on the order
  useEffect(() => {
    if (!onImpositionStateChange) return;
    const state: PersistedImpositionState = {
      ...settings,
      ...pdfMeta,
      summary: summary
        ? {
            forms: summary.forms,
            itemsPerSheet: summary.itemsPerSheet,
            pressSheets: summary.pressSheets,
            parentSheets: summary.parentSheets,
            ctpPlates: summary.ctpPlates,
          }
        : saved?.summary,
    };
    const json = JSON.stringify(state);
    if (!lastPersisted.current) {
      // First run: only record the baseline so opening the tab does not mark the order dirty
      lastPersisted.current = saved ? JSON.stringify(saved) : "";
      if (!saved) return;
    }
    if (json === lastPersisted.current) return;
    const t = setTimeout(() => {
      lastPersisted.current = json;
      onImpositionStateChange(state);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, pdfMeta, summary]);

  // ---------------------------------------------------------------- apply to order
  const applyToOrder = useCallback(() => {
    if (!onApplyToOrder || !summary) return;
    const modeLabel =
      settings.mode === "single_sided" ? `${frontColorCount}+0` : `${frontColorCount}+${backColorCount}`;
    const payload: ApplyImpositionPayload = {
      paperStock: settings.paperName,
      parentSheetW: settings.parentSheetW,
      parentSheetH: settings.parentSheetH,
      pressSheetW: settings.sheetW,
      pressSheetH: settings.sheetH,
      plannedParentSheets: summary.parentSheets,
      plannedPressSheets: summary.pressSheets,
      totalCtpPlates: summary.ctpPlates,
      ctpSpecDetails: `${summary.forms} forma × ${summary.platesPerForm} plastina (${modeLabel}) · ${machine.plateW}×${machine.plateH} mm · ${machine.machineName}`,
      printMethod: settings.mode,
    };
    onApplyToOrder(payload);
  }, [onApplyToOrder, summary, settings, frontColorCount, backColorCount, machine]);

  const isApplied =
    !!summary &&
    plannedSheets === summary.parentSheets &&
    (appliedCtpPlates ?? 0) === summary.ctpPlates &&
    propPressW === settings.sheetW &&
    propPressH === settings.sheetH;

  return {
    machine,
    settings,
    update,
    setMode,
    paperOptions,
    selectPaper,
    cutOptions,
    selectCutOption,
    sheetFitsMachine,
    frontColorCount,
    backColorCount,
    variants,
    setVariantFile,
    setManualSlots,
    dielineFile,
    setDielineFile,
    hasAllArtwork,
    calc,
    calcError,
    calcLoading,
    summary,
    analysis,
    analysisStale,
    generated,
    busy,
    actionError,
    runAnalyze,
    runGenerate,
    savedPdfUrl: pdfMeta.pdfUrl,
    applyToOrder,
    canApply: !!onApplyToOrder && !!summary,
    isApplied,
  };
}

export type SheetImpositionController = ReturnType<typeof useSheetImposition>;
