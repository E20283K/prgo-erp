"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrderAttachment, PersistedImpositionState, SkuArtwork } from "../../types";
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
import { PresignUnavailableError, uploadOrderFile } from "@/lib/client/uploadOrderFile";
import {
  calculateSheetCutOptions,
  doesSheetFitMachine,
  parseFormatString,
  pickOptimalCutOption,
  resolveMachineConstraints,
} from "./parentSheet";
import {
  buildParentCut,
  parentSheetFit,
  snapshotCutPlans,
  type CutPlanSnapshot,
  type ParentCutSnapshot,
} from "./cutPlan";
import { renderCutPlanSvg } from "./cutPlanSvg";
import type { ApplyImpositionPayload, ImpositionVariant, LayoutCalcTabProps, SheetCutOption } from "./types";
import {
  dielineFileCandidates,
  resolveDieline,
  type DielineSpec,
  type ResolvedDieline,
} from "../../utils/dielineGeometry";

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

/**
 * Finds a variant's artwork in the Specifications SKU table. The table keys rows its own way
 * (e.g. "size-std-1", "sku-0-std"), so after an exact skuId match fall back to model + size code;
 * a single-product order (no size breakdown) takes the "Standart" (STD) row or the only row.
 */
function matchSkuArtwork(
  arts: SkuArtwork[],
  v: { key: string; model?: string; sizeCode?: string },
  singleProduct: boolean
): SkuArtwork | undefined {
  const byId = arts.find((a) => a.skuId === v.key);
  if (byId) return byId;
  const norm = (s?: string) => (s || "").trim().toLowerCase();
  if (singleProduct) return arts.find((a) => norm(a.sizeCode) === "std") ?? (arts.length === 1 ? arts[0] : undefined);
  if (!v.sizeCode) return undefined;
  return (
    arts.find((a) => norm(a.sizeCode) === norm(v.sizeCode) && norm(a.model) === norm(v.model)) ??
    arts.find((a) => norm(a.sizeCode) === norm(v.sizeCode) && !a.model)
  );
}

/** The order's die as an upload source for /analyze (generated SVG or an existing file). */
function dieSource(die: ResolvedDieline): ArtworkSource | undefined {
  if (die.source === "spec") {
    return { file: new File([die.built.svg], "pichoq.svg", { type: "image/svg+xml" }), name: "pichoq.svg" };
  }
  if (die.source === "file") return { url: die.url, name: die.name };
  return undefined;
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
    kashirovkaPlates,
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
    dieSpec,
    dieline,
    onDielineChange,
    orderAttachments,
    toolingItems,
  } = props;

  const machine = useMemo(() => resolveMachineConstraints(pressMachine, activeMachine), [pressMachine, activeMachine]);

  // ---------------------------------------------------------------- die (noj): one source for the order
  const spec = useMemo<DielineSpec>(
    () => ({ ...dieSpec, width: defaultProdW, height: defaultProdH, shapeType }),
    [dieSpec, defaultProdW, defaultProdH, shapeType]
  );
  const dieCandidates = useMemo(
    () => dielineFileCandidates(orderAttachments ?? [], toolingItems ?? []),
    [orderAttachments, toolingItems]
  );
  const resolvedDie = useMemo(() => resolveDieline(dieline, spec, dieCandidates), [dieline, spec, dieCandidates]);
  const dieKey =
    resolvedDie.source === "spec" ? `spec:${resolvedDie.built.svg}` : resolvedDie.source === "file" ? `file:${resolvedDie.url}` : "none";

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
      delete rest.previewUrl;
      delete rest.storedPdfUrl;
      delete rest.storedPreviewUrl;
      delete rest.summary;
      // The order spec owns the product size; a saved layout must not keep a stale/swapped trim
      if (defaultProdW && defaultProdH) {
        rest.trimW = defaultProdW;
        rest.trimH = defaultProdH;
      }
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
    const isDie = resolvedDie.source !== "none";
    return {
      version: 2,
      paperName: stock?.name ?? paperStock,
      // Not found yet (stock still loading): leave unsynced so the sheet is picked once it arrives
      specPaperStock: stock || (propParentW && propParentH) ? paperStock : undefined,
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
      cropLineWidth: 0.12,
      gripper: true,
      rotation: "auto",
      mode: printMethodToMode(printMethod, backColorCount > 0),
      strategy: "smart_no_split",
      maxOverprintPct: 10,
      allowancePct: 0,
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

  // Follow the spec's product size / bleed when they change (e.g. read from the uploaded PDF)
  const specSizeKey = `${defaultProdW ?? ""}x${defaultProdH ?? ""}|${defaultBleed ?? ""}`;
  const [seenSpecSize, setSeenSpecSize] = useState(specSizeKey);
  if (specSizeKey !== seenSpecSize) {
    setSeenSpecSize(specSizeKey);
    setSettings((prev) => ({
      ...prev,
      ...(defaultProdW && defaultProdH ? { trimW: defaultProdW, trimH: defaultProdH } : {}),
      ...(defaultBleed != null ? { bleed: defaultBleed } : {}),
    }));
  }

  // When the order's die appears or goes away, switch the job type to match (user can still override)
  const hasDie = resolvedDie.source !== "none";
  const [seenHasDie, setSeenHasDie] = useState(hasDie);
  if (hasDie !== seenHasDie) {
    setSeenHasDie(hasDie);
    setSettings((prev) => ({
      ...prev,
      category: hasDie ? "diecut" : "guillotine",
      templateStyle: hasDie ? "packaging" : "offset_standard",
    }));
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

  // The specification's paper is the order's source of truth: when it changes (even while this
  // tab was closed) re-pick the paper and its sheet. A choice made here stays until the spec changes.
  if (paperStock && paperStock !== settings.specPaperStock && warehouseStock.length > 0) {
    const key = paperStock.toLowerCase();
    const stock = warehouseStock.find((w) => [w.name, w.sku].some((x) => x?.toLowerCase() === key));
    const name = stock?.name ?? paperStock;
    const dims = stock ? parseFormatString(stock.cutDimensions || stock.sheetFormat) : null;
    if (name === settings.paperName || !dims) {
      setSettings((prev) => ({ ...prev, specPaperStock: paperStock, paperName: name }));
    } else {
      const best = pickOptimalCutOption(calculateSheetCutOptions(dims[0], dims[1], gridEstimate, machine));
      setSettings((prev) => ({
        ...prev,
        specPaperStock: paperStock,
        paperName: name,
        parentSheetW: dims[0],
        parentSheetH: dims[1],
        cutDivisor: best.divisor,
        sheetW: best.pressW,
        sheetH: best.pressH,
      }));
    }
  }

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

  const variants = useMemo<ImpositionVariant[]>(() => {
    const active = sizes.filter((s) => (s.quantity || 0) > 0);
    const base: { key: string; name: string; skuId?: string; quantity: number; model?: string; sizeCode?: string }[] =
      active.length
        ? active.map((s) => ({
            key: s.id,
            skuId: s.id,
            name: [s.model, s.sizeCode].filter(Boolean).join(" ") || s.size || s.id,
            quantity: s.quantity,
            model: s.model,
            sizeCode: s.sizeCode,
          }))
        : [{ key: "main", name: orderName || docNo || "Mahsulot", quantity: Math.max(1, defaultQuantity || 1000) }];

    return base.map((b) => {
      const art = matchSkuArtwork(skuArtworks, b, active.length === 0);
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
        gripper_enabled: settings.gripper !== false,
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
        crop_line_width_mm: settings.cropLineWidth ?? 0.12,
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

  // Tiraj allowance: every variant is planned with its extra run (10 000 + 5% = 10 500)
  const allowancePct = Math.max(0, settings.allowancePct ?? 0);
  const variantInputs = useMemo(
    () =>
      variants.map((v) => ({
        name: v.name,
        // Round the product first: 10 000 × 1.05 is 10 500.000…2 in floating point
        quantity: Math.max(1, Math.ceil(Math.round(Math.round(v.quantity) * (100 + allowancePct)) / 100)),
        manual_slots: v.manualSlots ?? null,
        sku_id: v.skuId ?? null,
      })),
    [variants, allowancePct]
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

  // ---------------------------------------------------------------- guillotine cutting plan
  // Only from a result that matches the current settings; a stale one has other cell positions
  const freshCalc = calcState.key === calcKey ? calc : null;
  const cutPlans = useMemo<CutPlanSnapshot[] | undefined>(
    () =>
      settings.category === "guillotine" && freshCalc
        ? snapshotCutPlans(freshCalc.forms, settings.sheetW, settings.sheetH)
        : undefined,
    [settings.category, settings.sheetW, settings.sheetH, freshCalc]
  );

  // ---------------------------------------------------------------- production summary
  /** Press sheets that fit the parent sheet by geometry, to check the divisor against */
  const parentFit = useMemo(
    () => parentSheetFit(settings.parentSheetW, settings.parentSheetH, settings.sheetW, settings.sheetH).fit,
    [settings.parentSheetW, settings.parentSheetH, settings.sheetW, settings.sheetH]
  );
  const summary = useMemo(() => {
    if (!calc) return null;
    const forms = calc.forms.length;
    const pressSheets = calc.total_sheets;
    // A divisor above what fits would under-issue paper: never plan more press sheets per parent than fit
    const divisor = parentFit > 0 ? Math.min(Math.max(1, settings.cutDivisor), parentFit) : Math.max(1, settings.cutDivisor);
    const parentSheets = Math.ceil(pressSheets / divisor);
    const platesPerForm =
      typeof kashirovkaPlates === "number"
        ? kashirovkaPlates
        : settings.mode === "single_sided"
        ? frontColorCount
        : settings.mode === "work_and_turn"
          ? Math.max(frontColorCount, backColorCount)
          : frontColorCount + backColorCount;
    const ctpPlates = forms * platesPerForm;
    const produced = calc.forms.reduce((s, f) => s + f.total_produced_qty, 0);
    // Engine semantics: technological overprint excludes free "bonus" slots that cost no extra sheets
    const overprint = calc.forms.reduce((s, f) => s + f.total_overprint_qty, 0);
    const overprintPct = calc.total_order_qty > 0 ? (overprint / calc.total_order_qty) * 100 : 0;
    // Everything printed above the order: the tiraj allowance plus the engine's overprint
    const orderedQty = variants.reduce((sum, v) => sum + Math.max(1, Math.round(v.quantity)), 0);
    const extraPct = orderedQty > 0 ? ((calc.total_order_qty - orderedQty + overprint) / orderedQty) * 100 : 0;
    return {
      forms,
      itemsPerSheet: calc.items_per_sheet,
      pressSheets,
      parentSheets,
      platesPerForm,
      ctpPlates,
      produced,
      overprintPct,
      extraPct,
    };
  }, [calc, variants, settings.cutDivisor, parentFit, settings.mode, frontColorCount, backColorCount, kashirovkaPlates]);

  // ---------------------------------------------------------------- parent sheet cut
  const parentCut = useMemo<ParentCutSnapshot | undefined>(() => {
    if (!freshCalc || !summary) return undefined;
    return buildParentCut({
      parentW: settings.parentSheetW,
      parentH: settings.parentSheetH,
      pressW: settings.sheetW,
      pressH: settings.sheetH,
      divisor: Math.max(1, settings.cutDivisor),
      pressSheets: summary.pressSheets,
      runSheets: freshCalc.forms.reduce((s, f) => s + f.sheet_run, 0),
      parentSheets: summary.parentSheets,
      paperName: settings.paperName,
    });
  }, [freshCalc, summary, settings.parentSheetW, settings.parentSheetH, settings.sheetW, settings.sheetH, settings.cutDivisor, settings.paperName]);

  // ---------------------------------------------------------------- analyze / generate
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisKey, setAnalysisKey] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [busy, setBusy] = useState<"analyze" | "generate" | "apply" | "applyPaper" | "attachCut" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sourceKey = useMemo(
    () =>
      JSON.stringify({
        v: variants.map((v) => [v.key, v.frontFile?.name ?? v.frontUrl, v.backFile?.name ?? v.backUrl, v.frontFile?.lastModified, v.backFile?.lastModified]),
        d: dieKey,
        t: [settings.trimW, settings.trimH],
      }),
    [variants, dieKey, settings.trimW, settings.trimH]
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
        dieline: dieSource(resolvedDie),
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
  }, [variants, resolvedDie, settings.trimW, settings.trimH, sourceKey]);

  const lastPersisted = useRef<string>("");
  const persistReady = useRef(false);
  const pendingPersist = useRef<{ json: string; state: PersistedImpositionState } | null>(null);
  const persistCb = useRef(onImpositionStateChange);
  useEffect(() => {
    persistCb.current = onImpositionStateChange;
  });
  const flushPersist = useCallback(() => {
    const pending = pendingPersist.current;
    if (!pending) return;
    pendingPersist.current = null;
    lastPersisted.current = pending.json;
    persistCb.current?.(pending.state);
  }, []);
  const [pdfMeta, setPdfMeta] = useState<
    Pick<PersistedImpositionState, "jobId" | "pdfUrl" | "previewUrl" | "generatedAt" | "storedPdfUrl" | "storedPreviewUrl">
  >({
    jobId: saved?.jobId,
    pdfUrl: saved?.pdfUrl,
    previewUrl: saved?.previewUrl,
    generatedAt: saved?.generatedAt,
    storedPdfUrl: saved?.storedPdfUrl,
    storedPreviewUrl: saved?.storedPreviewUrl,
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
        setPdfMeta({ jobId: res.job_id, pdfUrl: main.url, previewUrl: res.pages[0]?.url, generatedAt: now.toISOString() });
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
      // Kept on the order for the guillotine operator's terminal
      cutPlans: settings.category === "guillotine" ? (cutPlans ?? saved?.cutPlans) : undefined,
      // Cutting the stock sheet down to the press sheet, for the passport
      parentCut: parentCut ?? saved?.parentCut,
    };
    const json = JSON.stringify(state);
    if (!persistReady.current) {
      // First run: only record the baseline so opening the tab does not mark the order dirty
      persistReady.current = true;
      lastPersisted.current = saved ? JSON.stringify(saved) : json;
    }
    if (json === lastPersisted.current) return;
    pendingPersist.current = { json, state };
    const t = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, pdfMeta, summary, cutPlans, parentCut]);

  // Leaving the tab unmounts it: write any debounced change before it is lost
  useEffect(() => () => flushPersist(), [flushPersist]);

  /** Saves the printable cutting plan card (one SVG per form) to the order's files. */
  const attachCutPlans = useCallback(async () => {
    if (!cutPlans?.length || !docNo) return;
    setBusy("attachCut");
    setActionError(null);
    const safeDoc = docNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      for (const plan of cutPlans) {
        const suffix = cutPlans.length > 1 ? `_F${plan.formIndex}` : "";
        const name = `Kesish_${safeDoc}${suffix}.svg`;
        const svg = renderCutPlanSvg(plan, { docNo, jobName: orderName, totalForms: cutPlans.length });
        const file = new File([svg], name, { type: "image/svg+xml" });
        const att = await uploadOrderFile(docNo, file, { category: "docs", skipOrderPhoto: true });
        onAddAttachment?.({ ...att, id: `ATT-KESISH-${safeDoc}${suffix}` });
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof PresignUnavailableError
          ? "Fayl ombori sozlanmagan"
          : errorMessage(err, "Kesish rejasini saqlab bo'lmadi")
      );
    } finally {
      setBusy(null);
    }
  }, [cutPlans, docNo, orderName, onAddAttachment]);

  // ---------------------------------------------------------------- apply to order
  /**
   * Copies the generated montaj (PDF + first page preview) from the doc-service cache into the
   * order's storage folder, so the CTP tooling item and Files & Documents get permanent links.
   * Reuses the copies already made for the same generation.
   */
  const storeMontaj = useCallback(async (): Promise<ApplyImpositionPayload["montaj"]> => {
    if (!pdfMeta.pdfUrl) return undefined;
    const safeDoc = (docNo || "buyurtma").replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfName = `Montaj_${safeDoc}.pdf`;
    const previewName = `Montaj_${safeDoc}_preview.png`;
    if (pdfMeta.storedPdfUrl) {
      return { fileUrl: pdfMeta.storedPdfUrl, fileName: pdfName, imageUrl: pdfMeta.storedPreviewUrl };
    }
    if (!docNo) return { fileUrl: pdfMeta.pdfUrl, fileName: pdfName, imageUrl: pdfMeta.previewUrl };

    const copy = async (url: string, name: string, type: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Montaj faylini olib bo'lmadi: ${name}`);
      const file = new File([await res.blob()], name, { type });
      return uploadOrderFile(docNo, file, { category: "docs", skipOrderPhoto: true });
    };

    try {
      const pdfAtt = await copy(pdfMeta.pdfUrl, pdfName, "application/pdf");
      const previewAtt = pdfMeta.previewUrl
        ? await copy(pdfMeta.previewUrl, previewName, "image/png").catch(() => null)
        : null;
      // Same id/name as the cache entry added on generate, so the permanent copy replaces it
      onAddAttachment?.({ ...pdfAtt, id: `ATT-MONTAJ-${safeDoc}` });
      if (previewAtt) onAddAttachment?.({ ...previewAtt, id: `ATT-MONTAJ-PREVIEW-${safeDoc}` });
      setPdfMeta((prev) => ({ ...prev, storedPdfUrl: pdfAtt.url, storedPreviewUrl: previewAtt?.url }));
      return { fileUrl: pdfAtt.url!, fileName: pdfName, imageUrl: previewAtt?.url };
    } catch (err: unknown) {
      // Storage not configured: keep the cache links, the order save persists them server-side
      if (err instanceof PresignUnavailableError) {
        return { fileUrl: pdfMeta.pdfUrl, fileName: pdfName, imageUrl: pdfMeta.previewUrl };
      }
      throw err;
    }
  }, [pdfMeta, docNo, onAddAttachment]);

  const applyToOrder = useCallback(async () => {
    if (!onApplyToOrder || !summary) return;
    setBusy("apply");
    setActionError(null);
    let montaj: ApplyImpositionPayload["montaj"];
    try {
      montaj = await storeMontaj();
    } catch (err: unknown) {
      setActionError(errorMessage(err, "Montaj faylini saqlab bo'lmadi"));
      setBusy(null);
      return;
    }
    setBusy(null);
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
      ctpSides:
        typeof kashirovkaPlates === "number" || settings.mode === "work_and_turn"
          ? [{ side: "set", plates: summary.ctpPlates }]
          : settings.mode === "single_sided"
          ? [{ side: "front", plates: summary.forms * frontColorCount }]
          : [
              { side: "front", plates: summary.forms * frontColorCount },
              { side: "back", plates: summary.forms * backColorCount },
            ],
      ctpSpecDetails: `${summary.forms} forma × ${summary.platesPerForm} plastina (${modeLabel}) · ${machine.plateW}×${machine.plateH} mm · ${machine.machineName}`,
      printMethod: settings.mode,
      montaj,
    };
    onApplyToOrder(payload);
  }, [onApplyToOrder, summary, settings, frontColorCount, backColorCount, machine, storeMontaj, kashirovkaPlates]);

  /** Paper consumption only: sheet sizes and counts go to the order, CTP tooling stays untouched. */
  const applyPaperToOrder = useCallback(() => {
    if (!onApplyToOrder || !summary) return;
    setActionError(null);
    onApplyToOrder({
      paperStock: settings.paperName,
      parentSheetW: settings.parentSheetW,
      parentSheetH: settings.parentSheetH,
      pressSheetW: settings.sheetW,
      pressSheetH: settings.sheetH,
      plannedParentSheets: summary.parentSheets,
      plannedPressSheets: summary.pressSheets,
      totalCtpPlates: 0,
      ctpSides: [],
      ctpSpecDetails: "",
      paperOnly: true,
    });
  }, [onApplyToOrder, summary, settings]);

  const isPaperApplied =
    !!summary &&
    plannedSheets === summary.parentSheets &&
    propPressW === settings.sheetW &&
    propPressH === settings.sheetH;

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
    resolvedDie,
    dieCard: {
      spec,
      value: dieline,
      onChange: onDielineChange,
      attachments: orderAttachments,
      toolingItems,
      docNo,
      onAddAttachment,
    },
    hasAllArtwork,
    calc,
    cutPlans,
    attachCutPlans,
    parentFit,
    docNo,
    orderName,
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
    applyPaperToOrder,
    canApply: !!onApplyToOrder && !!summary,
    isApplied,
    isPaperApplied,
  };
}

export type SheetImpositionController = ReturnType<typeof useSheetImposition>;
