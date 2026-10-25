"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Ruler,
  Layers,
  Palette,
  CircleDot,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  FileCode,
  Tag,
  Shirt,
  Scissors,
  RotateCw,
  Boxes,
  Lock,
  Unlock,
  Info,
} from "lucide-react";
import { requestArtworkColorAnalysis } from "../utils/artworkExtractor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSelect,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { DieLinePreview } from "../DieLinePreview";
import { TextileLabelPreview } from "../TextileLabelPreview";
import { PantoneColorPickerModal, SpotStationSelection } from "../dialogs/PantoneColorPickerModal";
import { searchPantoneColors } from "@/lib/pantone-catalog";
import { extractSvgDimensions } from "../utils/svgContour";
import { useLookupStore } from "@/store/lookupStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  WorkOrderFormData,
  SizeDistribution,
  SpotColorItem,
  KashirovkaMode,
  SubstrateLayer,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
  WorkOrderSampleData,
  OrderAttachment,
  SkuArtwork,
} from "../types";
import { SizeMatrixCard } from "./SizeMatrixCard";

interface SpecificationsTabProps {
  formData: WorkOrderFormData;
  handleFieldChange: (field: string | Record<string, any>, val?: any) => void;
  handleSizesChange?: (newSizes: SizeDistribution[]) => void;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
  sampleData?: WorkOrderSampleData;
  onSampleChange?: (field: keyof WorkOrderSampleData, val: any) => void;
  orderAttachments?: OrderAttachment[];
  setOrderAttachments?: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  skuArtworks?: SkuArtwork[];
  onSkuArtworksChange?: (artworks: SkuArtwork[]) => void;
  docNo?: string;
}

const ITEM_CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: "Hangtag", label: "Hangtag (Yorliq)" },
  { value: "Label", label: "Label (Stiker/Etiketka)" },
  { value: "Card", label: "Business Card / Postcard" },
  { value: "Carton", label: "Carton Box (Quti)" },
  { value: "Flyer", label: "Flyer / Buklet" },
  { value: "Other", label: "Custom Product" },
];

const SHAPE_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "rectangle", label: "To'g'ri to'rtburchak / Kvadrat (Rectangle)" },
  { value: "circle", label: "Doira / Aylana (Circle)" },
  { value: "oval", label: "Oval / Ellips (Oval)" },
  { value: "folded", label: "Buklama (Folded / Booklet)" },
  { value: "carton_box", label: "Quti / Karobka (Carton Box)" },
  { value: "custom_die", label: "Maxsus shtansforma (Custom Die)" },
];

const CORNER_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "Square", label: "To'g'ri burchak (Square)" },
  { value: "Rounded (R3)", label: "Aylana R3 (Rounded)" },
  { value: "Rounded (R5)", label: "Aylana R5 (Rounded)" },
  { value: "Die-cut", label: "Shtansforma (Custom Die)" },
];

const FOLD_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "half_vertical", label: "Tik 1 buklama (Half fold vertical)" },
  { value: "half_horizontal", label: "Yotiq 1 buklama (Half fold horizontal)" },
  { value: "tri_fold", label: "3 buklama / Z-fold" },
  { value: "gate_fold", label: "Eshiksimon buklama (Gate fold)" },
];

const BOX_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "tuck_end", label: "Klassik quti (Straight/Reverse Tuck End)" },
  { value: "auto_lock_bottom", label: "Avtolok tubli (Auto-lock Crash Bottom)" },
  { value: "snap_lock_bottom", label: "1-2-3 qulfli tub (Snap Lock Bottom)" },
  { value: "sleeve_tray", label: "G'ilofli tortma (Sleeve & Tray)" },
];

const HOLE_SIZE_OPTIONS: ComboboxOption[] = [
  { value: "0", label: "0 mm (Teshiksiz)" },
  { value: "3", label: "Ø3 mm (Ip/Shnur)" },
  { value: "4", label: "Ø4 mm (Standart)" },
  { value: "5", label: "Ø5 mm (Katta)" },
  { value: "6", label: "Ø6 mm (Lyuvers grommet)" },
  { value: "8", label: "Ø8 mm (Evro-slott)" },
];

const HOLE_POSITION_OPTIONS: ComboboxOption[] = [
  { value: "none", label: "Yo'q (None)" },
  { value: "top-center", label: "Tepada markazda (Top Center)" },
  { value: "top-left", label: "Tepada chapda (Top Left)" },
  { value: "top-right", label: "Tepada o'ngda (Top Right)" },
  { value: "left-center", label: "Yon chapda (Left Center)" },
  { value: "right-center", label: "Yon o'ngda (Right Center)" },
  { value: "both-sides-fold", label: "Buklama atrofida juft (Both Sides / Fold)" },
];

const LAMINATION_OPTIONS: ComboboxOption[] = [
  { value: "none", label: "Yo'q / Laminatsiyasiz (Uncoated)" },
  { value: "Soft-Touch Matte", label: "Soft-Touch Matte (Baxmal/Velvet 30µm)" },
  { value: "Matte Lamination", label: "Matte Lamination (Xira plyonka 25µm)" },
  { value: "Gloss Lamination", label: "Gloss Lamination (Yaltiroq plyonka 25µm)" },
  { value: "Anti-Scuff Matte", label: "Anti-Scuff Matte (Tirnalishga chidamli 28µm)" },
  { value: "Thermal Metallized Silver", label: "Metallized Silver (Kumush folga plyonka)" },
  { value: "Thermal Metallized Gold", label: "Metallized Gold (Oltin folga plyonka)" },
  { value: "Holographic Film", label: "Golografik plyonka (Holographic)" },
];

const LAMINATION_SIDES_OPTIONS: ComboboxOption[] = [
  { value: "1s", label: "1-tomonlama (Front / 1S / 1+0)" },
  { value: "2s", label: "2-tomonlama (Both sides / 2S / 1+1)" },
];

const LAMINATION_MICRON_OPTIONS: ComboboxOption[] = [
  { value: "24", label: "24 µm (Yengil / Standart BOPP)" },
  { value: "28", label: "28 µm (Mustahkam / O'rtacha)" },
  { value: "30", label: "30 µm (Soft-Touch Velvet PET)" },
  { value: "32", label: "32 µm (Qalin / Qattiq himoya)" },
];

const EMBELLISHMENT_OPTIONS: ComboboxOption[] = [
  { value: "None", label: "Qo'shimcha pardozsiz (None)" },
  { value: "Spot UV (3D)", label: "Tanlanma 3D UF lak (Spot UV)" },
  { value: "Gold Hot Foil", label: "Oltin issiq folga (Gold Foil)" },
  { value: "Silver Hot Foil", label: "Kumush issiq folga (Silver Foil)" },
  { value: "Blind Emboss", label: "Relyefli bosish (Blind Emboss)" },
  { value: "Overall WB Varnish", label: "Umumiy suvli lak (WB Varnish)" },
];

const LABEL_FOLD_OPTIONS: ComboboxOption[] = [
  { value: "center_fold", label: "Markazdan buklama (Center / Loop fold)" },
  { value: "end_fold", label: "Ikki chekkadan buklama (End fold)" },
  { value: "straight_cut", label: "To'g'ri kesim (Straight cut / Dona)" },
  { value: "manhattan_fold", label: "Kitobcha buklama (Manhattan fold)" },
  { value: "mitre_fold", label: "Manjetli buklama (Mitre fold)" },
  { value: "roll", label: "Rulonda uzluksiz (Roll / Kesilmagan)" },
];

const LABEL_CUT_OPTIONS: ComboboxOption[] = [
  { value: "ultrasonic", label: "Ultrasonik kesim (Yumshoq, terini qichitmaydi)" },
  { value: "hot_knife", label: "Issiq pichoq (Hot knife - erigan qirra)" },
  { value: "cold_knife", label: "Sovuq pichoq (Cold knife)" },
  { value: "laser", label: "Lazerli kesim (Laser cut)" },
];

const SEWING_MARGIN_OPTIONS: ComboboxOption[] = [
  { value: "0", label: "0 mm (Xoshiyasiz)" },
  { value: "3", label: "3 mm (Tor chok)" },
  { value: "5", label: "5 mm (Standart tikuv)" },
  { value: "7", label: "7 mm (Keng tikuv)" },
  { value: "10", label: "10 mm (Qalin kiyimlar)" },
];

const FLEXO_MATERIAL_OPTIONS: ComboboxOption[] = [
  { value: "nylon_taffeta", label: "Neylon (Nylon Taffeta) — Parvarish va o'lcham yorlig'i" },
  { value: "polyester_satin_white", label: "Oq Satin (Polyester Satin) — Ipaksimon yumshoq" },
  { value: "polyester_satin_black", label: "Qora Satin (Black Satin) — Premium to'qilgan qirra" },
  { value: "cotton_tape", label: "Organik Paxta (Cotton Tape) — Eko mato" },
  { value: "self_adhesive_pp", label: "O'ziyelimli Polipropilen (PP Film)" },
  { value: "semi_gloss_paper", label: "Yarim yaltiroq qog'oz (Semi-gloss)" },
];

const FLEXO_EDGE_OPTIONS: ComboboxOption[] = [
  { value: "woven_edge", label: "To'qilgan qirra (Woven edge — eng mayin)" },
  { value: "hot_slit", label: "Issiq kesilgan (Hot slit edge)" },
  { value: "ultrasonic_slit", label: "Ultrasonik kesilgan (Ultrasonic slit)" },
];

const WASH_RESISTANCE_OPTIONS: ComboboxOption[] = [
  { value: "40c", label: "Standart yuvish (40°C)" },
  { value: "60c", label: "Yuqori harorat (60°C - Kiyimlar)" },
  { value: "90c_boil", label: "Qaynatishga chidamli (90°C - Tibbiy / Ish kiyimlari)" },
  { value: "dry_clean", label: "Kimyoviy tozalash (Dry clean)" },
];

const PRINT_SIDES_OPTIONS: ComboboxOption[] = [
  { value: "1s", label: "1-tomonlama (1+0)" },
  { value: "2s", label: "2-tomonlama (1+1)" },
];

const JACQUARD_MATERIAL_OPTIONS: ComboboxOption[] = [
  { value: "polyester_satin_black", label: "Qora to'qima (Black Damask Base)" },
  { value: "polyester_satin_white", label: "Oq to'qima (White Damask Base)" },
  { value: "cotton_tape", label: "Organik paxta asos (Cotton Jacquard)" },
  { value: "metallic_yarn", label: "Metalllashgan ip bilan (Lurex Jacquard)" },
];

const WEAVE_DENSITY_OPTIONS: ComboboxOption[] = [
  { value: "damask_50d", label: "Damask 50D (High Definition — juda mayda detallar)" },
  { value: "damask_100d", label: "Damask 100D (Standart yuqori sifat)" },
  { value: "woven_satin", label: "Satin to'qish (Woven Satin — atlas jiloli)" },
  { value: "taffeta", label: "Tafta (Taffeta — yengil va tejamkor)" },
  { value: "hd_microfiber", label: "HD Mikrofibra (Ekstra mayin)" },
];

const LUREX_OPTIONS: ComboboxOption[] = [
  { value: "none", label: "Yo'q (Standart poliester ip)" },
  { value: "gold", label: "Oltin Lurex (Gold Metallic)" },
  { value: "silver", label: "Kumush Lurex (Silver Metallic)" },
  { value: "copper", label: "Mis / Bronza (Copper Metallic)" },
];

const CORE_MM_OPTIONS: ComboboxOption[] = [
  { value: "25", label: "25 mm / 1 dyuym (Kichik printerlar)" },
  { value: "40", label: "40 mm (Standart sanoat)" },
  { value: "76", label: "76 mm / 3 dyuym (Katta dastgohlar)" },
];

const WINDING_DIR_OPTIONS: ComboboxOption[] = [
  { value: "out_head", label: "Tashqariga - Bosh qism oldinda (Face Out / Head first)" },
  { value: "out_foot", label: "Tashqariga - Oyoq qism oldinda (Face Out / Foot first)" },
  { value: "in_head", label: "Ichkariga - Bosh qism oldinda (Face In / Head first)" },
  { value: "in_foot", label: "Ichkariga - Oyoq qism oldinda (Face In / Foot first)" },
];

export function SpecificationsTab({
  formData,
  handleFieldChange,
  handleSizesChange,
  onMarkUnsaved,
  isOperator = false,
  onSwitchTab,
  sampleData,
  onSampleChange,
  orderAttachments,
  setOrderAttachments,
  skuArtworks,
  onSkuArtworksChange,
  docNo,
}: SpecificationsTabProps) {
  const tDie = useTranslations("DieLine");
  const { paperStocks, addPaperStock, coatings, addCoating } = useLookupStore();
  const { warehouseStock, loadWarehouseStock, addNotification } = useWorkspaceStore();

  useEffect(() => {
    if (warehouseStock.length === 0 && loadWarehouseStock) {
      loadWarehouseStock();
    }
  }, [warehouseStock.length, loadWarehouseStock]);

  // Paper stock options for Base UI Combobox (connected to Real Warehouse Stock)
  const [paperInput, setPaperInput] = useState(formData.paperStock || "");

  React.useEffect(() => {
    setPaperInput(formData.paperStock || "");
  }, [formData.paperStock]);

  const paperStockOptions = useMemo<ComboboxOption[]>(() => {
    const options: ComboboxOption[] = [];
    const seen = new Set<string>();

    // 1. Primary: Real Warehouse Stock items (Paper, Board, Roll)
    if (warehouseStock && warehouseStock.length > 0) {
      warehouseStock
        .filter(
          (w) =>
            w.category === "Paper & Board" ||
            w.category === "Roll & Label" ||
            w.category === "Offcuts & Scraps"
        )
        .forEach((ws) => {
          const val = ws.name;
          const key = val.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            const formatStr = ws.sheetFormat
              ? `Format: ${ws.sheetFormat}`
              : ws.rollWidthMm
              ? `Eni: ${ws.rollWidthMm}mm`
              : "";
            const gsmStr = ws.grammage ? `${ws.grammage} g/m²` : "";
            const avail = ws.available ?? ws.stockLevel ?? 0;
            const stockStr = `Omborda: ${avail.toLocaleString()} ${ws.unit || "birlik"} (${ws.status || "In Stock"})`;
            const desc = [formatStr, gsmStr, stockStr].filter(Boolean).join(" • ");
            options.push({
              value: val,
              label: val,
              description: desc,
            });
          }
        });
    }

    // 2. Secondary: Fallback shared lookup catalogue
    paperStocks.forEach((p) => {
      const val = typeof p === "string" ? p : p.value || p.label;
      const key = val?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        const desc = typeof p === "string" ? undefined : p.description;
        options.push({
          value: val,
          label: val,
          description: desc,
        });
      }
    });

    // 3. Current custom value if not present in lists
    if (formData.paperStock && !seen.has(formData.paperStock.toLowerCase().trim())) {
      options.unshift({
        value: formData.paperStock,
        label: formData.paperStock,
        description: "Maxsus / Joriy kiritilgan xomashyo",
      });
    }

    return options;
  }, [warehouseStock, paperStocks, formData.paperStock]);

  const matchedStockItem = useMemo(() => {
    if (!formData.paperStock) return null;
    const clean = formData.paperStock.toLowerCase().trim();
    return (
      warehouseStock.find(
        (w) => w.name.toLowerCase().trim() === clean || w.sku.toLowerCase().trim() === clean
      ) || null
    );
  }, [formData.paperStock, warehouseStock]);
  const [isPantoneModalOpen, setIsPantoneModalOpen] = useState(false);
  const [pantoneTargetSide, setPantoneTargetSide] = useState<"front" | "back" | "both">("front");
  const [frontQuickInput, setFrontQuickInput] = useState("");
  const [backQuickInput, setBackQuickInput] = useState("");
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);
  const [svgInputDraft, setSvgInputDraft] = useState(formData.customSvgPath || "");
  const detectedSvgDims = useMemo(() => extractSvgDimensions(svgInputDraft), [svgInputDraft]);

  // Aspect ratio lock (Proportional dimension scaling)
  const [isAspectLocked, setIsAspectLocked] = useState(false);
  const lockedRatioRef = React.useRef<number | null>(null);

  const toggleAspectLock = () => {
    setIsAspectLocked((prev) => {
      const next = !prev;
      if (next) {
        const w = Number(formData.width) || 0;
        const h = Number(formData.height) || 0;
        lockedRatioRef.current = w > 0 && h > 0 ? h / w : 1;
      } else {
        lockedRatioRef.current = null;
      }
      return next;
    });
  };

  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string || "").trim();
      const dims = extractSvgDimensions(text);
      if (dims && dims.width > 0 && dims.height > 0) {
        handleFieldChange({
          customSvgPath: text,
          width: dims.width,
          height: dims.height,
        });
        lockedRatioRef.current = dims.height / dims.width;
        setIsAspectLocked(true);
        addNotification({
          title: "SVG o'lchamlari yangilandi",
          description: `Mahsulot o'lchami SVG fayldan olindi: ${dims.width} × ${dims.height} mm`,
          severity: "success",
        });
      } else {
        handleFieldChange("customSvgPath", text);
      }
      setSvgInputDraft(text);
      onMarkUnsaved();
    };
    reader.readAsText(file);
  };

  const handleOpenPantoneModal = (side: "front" | "back") => {
    if (isOperator) return;
    setPantoneTargetSide(side);
    setIsPantoneModalOpen(true);
  };

  // Department technology flags
  const isFlexo = formData.department === "Flexo" || (formData.recipe ? formData.recipe.startsWith("FLEXO_") : false);
  const isJacquard = formData.department === "Jacquard" || (formData.recipe ? formData.recipe.startsWith("JACQ_") : false);
  const isOffset = !isFlexo && !isJacquard;

  // Hole calculation
  const effectiveHoleSize = formData.holeSize !== undefined
    ? formData.holeSize
    : (formData.itemCategory === "Hangtag" ? 4 : 0);
  const effectiveHolePos = (formData.holePosition || (formData.itemCategory === "Hangtag" ? "top-center" : "none")) as
    | "top-center"
    | "top-left"
    | "top-right"
    | "left-center"
    | "right-center"
    | "both-sides-fold"
    | "none";
  const effectiveHoleOffset = formData.holeOffset ?? 6;

  // Lamination active check
  const currentLamination = formData.lamination || "Soft-Touch Matte";
  const isLaminationActive = currentLamination !== "none" && currentLamination !== "None / Uncoated";
  const laminationSides = formData.laminationSides || "1s";
  const laminationMicron = formData.laminationMicron || 0;
  const embellishment = formData.embellishment || "";

  // Color config helpers
  const frontColors = formData.frontColors || { c: false, m: false, y: false, k: false };
  const backColors = formData.backColors || { c: false, m: false, y: false, k: false };
  const spotColorItems: SpotColorItem[] = (formData.spotColorItems && formData.spotColorItems.length > 0)
    ? formData.spotColorItems
    : (formData.spotColors && formData.spotColors.length > 0
        ? formData.spotColors.map((name, i) => ({
            id: `spot-${i}`,
            name,
            code: name.replace(/^PANTONE\s+/i, ""),
            hex: name.includes("021") ? "#fe5000" : name.includes("871") ? "#84754e" : "#2563eb",
            side: "front" as const,
          }))
        : []);

  const frontSpots = spotColorItems.filter((s) => s.side === "front" || s.side === "both");
  const backSpots = spotColorItems.filter((s) => s.side === "back" || s.side === "both");
  const frontProcessCount = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
  const backProcessCount = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
  const frontTotalCount = frontProcessCount + frontSpots.length;
  const backTotalCount = backProcessCount + backSpots.length;

  const handleToggleFrontColor = (color: "c" | "m" | "y" | "k") => {
    if (isOperator) return;
    const updated = { ...frontColors, [color]: !frontColors[color] };
    const newProcessCount = (updated.c ? 1 : 0) + (updated.m ? 1 : 0) + (updated.y ? 1 : 0) + (updated.k ? 1 : 0);
    const newColorsConfig = `${newProcessCount + frontSpots.length}+${backTotalCount}`;
    handleFieldChange({
      frontColors: updated,
      colorsConfig: newColorsConfig,
    });
    onMarkUnsaved();
  };

  const handleToggleBackColor = (color: "c" | "m" | "y" | "k") => {
    if (isOperator) return;
    const updated = { ...backColors, [color]: !backColors[color] };
    const newProcessCount = (updated.c ? 1 : 0) + (updated.m ? 1 : 0) + (updated.y ? 1 : 0) + (updated.k ? 1 : 0);
    const newColorsConfig = `${frontTotalCount}+${newProcessCount + backSpots.length}`;
    handleFieldChange({
      backColors: updated,
      colorsConfig: newColorsConfig,
    });
    onMarkUnsaved();
  };

  const handleAddSpotColor = (selection: SpotStationSelection) => {
    const newItem: SpotColorItem = {
      id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: selection.name,
      code: selection.code,
      hex: selection.hex,
      side: selection.side,
    };
    const updated = [...spotColorItems, newItem];
    const newFrontSpots = updated.filter((s) => s.side === "front" || s.side === "both");
    const newBackSpots = updated.filter((s) => s.side === "back" || s.side === "both");
    const newColorsConfig = `${frontProcessCount + newFrontSpots.length}+${backProcessCount + newBackSpots.length}`;

    handleFieldChange({
      spotColorItems: updated,
      spotColors: updated.map((s) => s.name),
      colorsConfig: newColorsConfig,
    });
    onMarkUnsaved();
  };

  const [detectedColorPrompt, setDetectedColorPrompt] = useState<{
    formula: string;
    frontCount: number;
    backCount: number;
    frontSummary: string;
    backSummary: string;
    frontColors: any;
    backColors: any;
    printMethod: string;
    spotColors?: any[];
  } | null>(null);

  const triggerArtworkColorAnalysis = async (frontData?: string, backData?: string) => {
    if (!frontData && !backData) return;
    try {
      const result = await requestArtworkColorAnalysis({
        dataUrl: frontData?.startsWith("data:") ? frontData : undefined,
        url: frontData && !frontData.startsWith("data:") ? frontData : undefined,
        backDataUrl: backData?.startsWith("data:") ? backData : undefined,
        backUrl: backData && !backData.startsWith("data:") ? backData : undefined,
      });

      if (!result || !result.success) return;

      const df = result.front;
      const db = result.back;
      const formula = result.detectedFormula;

      const newFrontColors = {
        c: df.c,
        m: df.m,
        y: df.y,
        k: df.k,
      };

      const newBackColors = db && db.hasContent
        ? { c: db.c, m: db.m, y: db.y, k: db.k }
        : { c: false, m: false, y: false, k: false };

      const newPrintMethod = db && db.hasContent
        ? (formData.printMethod === "work_and_turn" ? "work_and_turn" : "sheetwise")
        : "single_sided";

      const commercialSpots = result.commercialSpotColors || [];
      const newSpotItems = [...(formData.spotColorItems || [])];
      const existingSpotNames = new Set(newSpotItems.map((s) => s.name.toLowerCase().trim()));
      commercialSpots.forEach((sName) => {
        if (!existingSpotNames.has(sName.toLowerCase().trim())) {
          newSpotItems.push({
            id: `spot-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: sName,
            code: sName,
            hex: "#2563eb",
            side: db && db.hasContent ? "both" : "front",
          });
        }
      });

      const applyAction = () => {
        handleFieldChange({
          frontColors: newFrontColors,
          backColors: newBackColors,
          colorsConfig: formula,
          printMethod: newPrintMethod,
          spotColorItems: newSpotItems,
          spotColors: newSpotItems.map((s) => s.name),
        });
        setDetectedColorPrompt(null);
        addNotification({
          severity: "success",
          title: "Rang profili qo'llandi",
          description: `Maketdan ${formula} (${df.colorCount} oldi + ${db?.colorCount || 0} orqa) ranglar tatbiq etildi`,
        });
        onMarkUnsaved();
      };

      // Check if colors were empty or default initial (e.g. only 1 color or 0)
      const isFrontEmptyOrInitial =
        !formData.frontColors ||
        (frontProcessCount <= 1 && !formData.frontColors.c && !formData.frontColors.m && !formData.frontColors.y);
      const isBackEmptyOrInitial = !formData.backColors || backProcessCount === 0;

      if (isFrontEmptyOrInitial && isBackEmptyOrInitial) {
        applyAction();
      } else {
        setDetectedColorPrompt({
          formula,
          frontCount: df.colorCount,
          backCount: db?.colorCount || 0,
          frontSummary: df.k && !df.c ? "K (Qora)" : (df.c || df.m ? "CMYK" : "1 rang"),
          backSummary: db && db.hasContent ? (db.k && !db.c ? "K (Qora)" : "CMYK") : "bo'sh (0 rang)",
          frontColors: newFrontColors,
          backColors: newBackColors,
          printMethod: newPrintMethod,
          spotColors: newSpotItems,
        });
      }
    } catch (err) {
      console.warn("[SpecificationsTab] Color analysis failed:", err);
    }
  };

  const handleRemoveSpotColor = (id: string) => {
    if (isOperator) return;
    const updated = spotColorItems.filter((s) => s.id !== id);
    const newFrontSpots = updated.filter((s) => s.side === "front" || s.side === "both");
    const newBackSpots = updated.filter((s) => s.side === "back" || s.side === "both");
    const newColorsConfig = `${frontProcessCount + newFrontSpots.length}+${backProcessCount + newBackSpots.length}`;

    handleFieldChange({
      spotColorItems: updated,
      spotColors: updated.map((s) => s.name),
      colorsConfig: newColorsConfig,
    });
    onMarkUnsaved();
  };

  const handleQuickAddPantone = (side: "front" | "back") => {
    if (isOperator) return;
    const raw = (side === "front" ? frontQuickInput : backQuickInput).trim();
    if (!raw) return;

    const matches = searchPantoneColors(raw, 5);
    const matched = matches[0];

    const newItem: SpotColorItem = {
      id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: matched ? matched.name : (raw.toUpperCase().startsWith("PANTONE") ? raw : `PANTONE ${raw}`),
      code: matched ? matched.code : raw,
      hex: matched ? matched.hex : "#2563eb",
      side,
    };

    const updated = [...spotColorItems, newItem];
    const newFrontSpots = updated.filter((s) => s.side === "front" || s.side === "both");
    const newBackSpots = updated.filter((s) => s.side === "back" || s.side === "both");
    const newColorsConfig = `${frontProcessCount + newFrontSpots.length}+${backProcessCount + newBackSpots.length}`;

    handleFieldChange({
      spotColorItems: updated,
      spotColors: updated.map((s) => s.name),
      colorsConfig: newColorsConfig,
    });
    if (side === "front") setFrontQuickInput("");
    else setBackQuickInput("");
    onMarkUnsaved();
  };

  // Kashirovka Mounting state and calculations
  const kashirovkaMode: KashirovkaMode = formData.kashirovkaMode || "none";
  const kashirovkaLayers: SubstrateLayer[] = useMemo(() => {
    if (kashirovkaMode === "none") return [];
    if (formData.kashirovkaLayers && formData.kashirovkaLayers.length > 0) {
      return formData.kashirovkaLayers;
    }
    return getDefaultKashirovkaLayers(kashirovkaMode, formData.paperStock, formData.coating);
  }, [kashirovkaMode, formData.kashirovkaLayers, formData.paperStock, formData.coating]);

  const kashirovkaTotals = useMemo(
    () => calculateKashirovkaTotals(kashirovkaMode, kashirovkaLayers, formData.kashirovkaGlueGsm ?? 25),
    [kashirovkaMode, kashirovkaLayers, formData.kashirovkaGlueGsm]
  );

  const handleKashirovkaModeChange = (mode: KashirovkaMode) => {
    if (isOperator) return;
    const updates: Record<string, any> = { kashirovkaMode: mode };
    if (mode === "none") {
      updates.kashirovkaLayers = [];
    } else {
      const nextLayers = getDefaultKashirovkaLayers(mode, formData.paperStock, formData.coating);
      updates.kashirovkaLayers = nextLayers;
      if (!formData.kashirovkaStrategy) {
        updates.kashirovkaStrategy = "split_half_sheet";
      }
      if (formData.kashirovkaGlueGsm === undefined) {
        updates.kashirovkaGlueGsm = 25;
      }
      if (formData.kashirovkaMakeReadySheets === undefined) {
        updates.kashirovkaMakeReadySheets = 50;
      }
      if (formData.kashirovkaCuringHours === undefined) {
        updates.kashirovkaCuringHours = 12;
      }
    }
    handleFieldChange(updates);
    onMarkUnsaved();
  };

  // Size Breakdown state
  const sizes = formData.sizes || [];

  return (
    <TabsContent value="specs" className="@container flex-1 overflow-y-auto p-4 m-0 space-y-4">
      {/* Pantone Modal */}
      <PantoneColorPickerModal
        isOpen={isPantoneModalOpen}
        onOpenChange={setIsPantoneModalOpen}
        onSelectColor={handleAddSpotColor}
        defaultSide={pantoneTargetSide}
      />

      {/* Custom Vector SVG Upload Modal */}
      <Dialog open={isSvgModalOpen} onOpenChange={setIsSvgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              <span>{tDie("svgUploadTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {tDie("svgUploadDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {tDie("uploadSvg")} (.svg)
              </label>
              <Input
                type="file"
                accept=".svg"
                disabled={isOperator}
                onChange={handleSvgFileUpload}
                className="h-8 text-xs file:mr-2 file:h-6 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground block">
                {tDie("customSvgPlaceholder")}
              </label>
              <textarea
                value={svgInputDraft}
                disabled={isOperator}
                onChange={(e) => setSvgInputDraft(e.target.value)}
                placeholder="M 10 10 L 90 10 L 90 90 L 10 90 Z"
                rows={4}
                className="w-full p-2 rounded-md border border-input bg-background font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {detectedSvgDims && detectedSvgDims.width > 0 && detectedSvgDims.height > 0 && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Aniqlangan SVG o&apos;lchami:
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Eni (Width): <span className="font-bold text-foreground">{detectedSvgDims.width} mm</span>, Bo&apos;yi (Height): <span className="font-bold text-foreground">{detectedSvgDims.height} mm</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  {detectedSvgDims.unit || "mm"}
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {formData.customSvgPath && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => {
                  handleFieldChange("customSvgPath", "");
                  setSvgInputDraft("");
                  setIsSvgModalOpen(false);
                  onMarkUnsaved();
                }}
              >
                {tDie("clearSvg")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs cursor-pointer"
              onClick={() => {
                const trimmed = svgInputDraft.trim();
                if (detectedSvgDims && detectedSvgDims.width > 0 && detectedSvgDims.height > 0) {
                  handleFieldChange({
                    customSvgPath: trimmed,
                    width: detectedSvgDims.width,
                    height: detectedSvgDims.height,
                  });
                  lockedRatioRef.current = detectedSvgDims.height / detectedSvgDims.width;
                  setIsAspectLocked(true);
                  addNotification({
                    title: "SVG o'lchamlari yangilandi",
                    description: `Mahsulot o'lchami SVG dan olindi: ${detectedSvgDims.width} × ${detectedSvgDims.height} mm`,
                    severity: "success",
                  });
                } else {
                  handleFieldChange("customSvgPath", trimmed);
                }
                setIsSvgModalOpen(false);
                onMarkUnsaved();
              }}
            >
              Saqlash (Apply)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── First Section: Model & O'lchamlar taqsimoti (Size & Model Matrix) ── */}
      <SizeMatrixCard
        sizes={sizes}
        unit={formData.unit || "pcs"}
        totalQuantity={formData.quantity}
        width={formData.width}
        height={formData.height}
        workOrderId={docNo || (formData as any).docNo}
        skuArtworks={skuArtworks || formData.skuArtworks || []}
        setOrderAttachments={setOrderAttachments}
        onSkuArtworksChange={(artworks) => {
          if (onSkuArtworksChange) {
            onSkuArtworksChange(artworks);
          } else {
            handleFieldChange("skuArtworks", artworks);
          }
          const latest = artworks[artworks.length - 1];
          if (latest) {
            void triggerArtworkColorAnalysis(
              latest.frontArtworkUrl || latest.frontArtworkThumb,
              latest.backArtworkUrl || latest.backArtworkThumb
            );
          }
          onMarkUnsaved();
        }}
        printSides={
          formData.labelPrintSides ||
          (formData.colorsConfig && !formData.colorsConfig.endsWith("+0") ? "2s" : "1s")
        }
        isOperator={isOperator}
        onQuantityChange={(qty) => {
          handleFieldChange("quantity", qty);
          onMarkUnsaved();
        }}
        onSwitchTab={isJacquard ? undefined : onSwitchTab}
        impositionTabKey={isFlexo ? "flexo" : "layout"}
        impositionLabel={isFlexo ? "Flexo Imposition (Silindr & Tasma)" : "Spusk / Qoliplarga bo'lish (Imposition)"}
        orderType={formData.orderType}
        sampleTargetSize={sampleData?.sampleTargetSize || formData.sampleTargetSize}
        onSampleTargetSizeChange={(size) => {
          handleFieldChange("sampleTargetSize", size);
          onSampleChange?.("sampleTargetSize", size);
          onMarkUnsaved();
        }}
        sampleQty={sampleData?.sampleQty || 5}
        onSampleQtyChange={(q) => {
          onSampleChange?.("sampleQty", q);
          onMarkUnsaved();
        }}
        onSizesChange={(nextSizes) => {
          if (handleSizesChange) {
            handleSizesChange(nextSizes);
          } else {
            handleFieldChange("sizes", nextSizes);
            const total = nextSizes.reduce((acc, s) => acc + (s.quantity || 0), 0);
            if (nextSizes.length > 0) {
              handleFieldChange("quantity", total);
            }
          }
          onMarkUnsaved();
        }}
      />

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        {/* Left Column: Dimensions, Substrate & Multi-Layer Mounting */}
        <div className="space-y-3">
          {/* ════════════════════════════════════════════════════════════════
              1. FLEXO TEXTILE & RIBBON LABEL CARDS (NYLON, SATIN, COTTON)
          ════════════════════════════════════════════════════════════════ */}
          {isFlexo && (
            <>
              {/* Flexo Card 1: Ribbon Dimensions & Label Fold */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      Flexo lenta o&apos;lchamlari va Buklash (Label Geometry)
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Tasma: {formData.width ?? 30}mm × {formData.height ?? 70}mm
                  </Badge>
                </div>

                {/* Primary Ribbon Width & Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Tasma kengligi (Ribbon Width mm):
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">Standart kengliklar</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[15, 20, 25, 30, 35, 40, 50, 60, 70].map((w) => {
                      const active = (formData.width ?? 30) === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          disabled={isOperator}
                          onClick={() => {
                            handleFieldChange("width", w);
                            handleFieldChange("flexoWebWidth", w);
                            onMarkUnsaved();
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-colors cursor-pointer",
                            active
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          {w}mm
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid: Cut Length, Fold Type, Cut Technology, Sewing Margin */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesim uzunligi (Cut Length mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.height ?? 70}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("height", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                      placeholder="Masalan: 70"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Buklash turi (Fold Type):
                    </label>
                    <ComboboxSelect
                      items={LABEL_FOLD_OPTIONS}
                      value={formData.labelFoldType || "center_fold"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelFoldType", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Buklash turini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesish usuli (Cut Method):
                    </label>
                    <ComboboxSelect
                      items={LABEL_CUT_OPTIONS}
                      value={formData.labelCutType || "ultrasonic"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelCutType", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Kesish usulini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Tikish xoshiyasi (Sewing Margin):
                    </label>
                    <ComboboxSelect
                      items={SEWING_MARGIN_OPTIONS}
                      value={String(formData.labelSewingMarginMm ?? 5)}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelSewingMarginMm", Number(val));
                        onMarkUnsaved();
                      }}
                      placeholder="Xoshiyani tanlang..."
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Flexo Card 2: Textile Substrate, Ink & Wash Care */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      Lenta xomashyosi va Bo&apos;yoq (Textile Substrate & Inks)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.labelPrintSides === "2s" ? "2-tomonlama (1+1)" : "1-tomonlama (1+0)"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lenta turi (Ribbon Material):
                    </label>
                    <ComboboxSelect
                      items={FLEXO_MATERIAL_OPTIONS}
                      value={formData.labelMaterialType || (formData.paperStock?.toLowerCase().includes("satin") ? "polyester_satin_white" : "nylon_taffeta")}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        if (!val) return;
                        handleFieldChange("labelMaterialType", val);
                        const labelStockMap: Record<string, string> = {
                          nylon_taffeta: "Nylon Taffeta Care Ribbon",
                          polyester_satin_white: "Satin Ribbon (White Woven Edge)",
                          polyester_satin_black: "Satin Ribbon (Black Dyed Woven Edge)",
                          cotton_tape: "Organic Cotton Tape (Herringbone)",
                          self_adhesive_pp: "Self-Adhesive PP Roll Film",
                          semi_gloss_paper: "Semi-Gloss Label Paper",
                        };
                        handleFieldChange("paperStock", labelStockMap[val] || val);
                        onMarkUnsaved();
                      }}
                      placeholder="Lenta turini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lenta qirrasi (Ribbon Edge):
                    </label>
                    <ComboboxSelect
                      items={FLEXO_EDGE_OPTIONS}
                      value={formData.labelEdgeType || "woven_edge"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelEdgeType", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Lenta qirrasini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Yuvishga bardoshlilik (Wash Resistance):
                    </label>
                    <ComboboxSelect
                      items={WASH_RESISTANCE_OPTIONS}
                      value={formData.labelWashResistance || "60c"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelWashResistance", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Haroratni tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Bosma tomoni (Print Sides):
                    </label>
                    <ComboboxSelect
                      items={[
                        { value: "1s", label: "1-tomonlama (1+0 / Faqat yuzi)" },
                        { value: "2s", label: "2-tomonlama (1+1 / Oldi logotip, orqasi tarkib)" },
                      ]}
                      value={formData.labelPrintSides || "1s"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelPrintSides", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Bosma tomonini tanlang..."
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              2. JACQUARD WOVEN LABEL CARDS (DAMASK, SATIN, TAFFETA)
          ════════════════════════════════════════════════════════════════ */}
          {isJacquard && (
            <>
              {/* Jacquard Card 1: Woven Label Geometry & Fold */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      To&apos;qima etiketka o&apos;lchamlari va Buklash (Woven Geometry)
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                    To&apos;qima: {formData.width ?? 35}mm × {formData.height ?? 65}mm
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kenglik (Width mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.width ?? 35}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("width", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesim uzunligi (Cut Length mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.height ?? 65}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("height", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Buklash turi (Fold Type):
                    </label>
                    <ComboboxSelect
                      items={LABEL_FOLD_OPTIONS}
                      value={formData.labelFoldType || "end_fold"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelFoldType", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Buklash turini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Qirralarni kesish (Edge Processing):
                    </label>
                    <ComboboxSelect
                      items={LABEL_CUT_OPTIONS}
                      value={formData.labelCutType || "ultrasonic"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelCutType", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Kesish turini tanlang..."
                    />
                  </div>
                </div>
              </div>

              {/* Jacquard Card 2: Weave Quality & Thread Specs */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      To&apos;qish sifati va Iplar (Weave & Thread Specs)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.weaveQuality || "damask_50d"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      To&apos;qish zichligi (Weave Quality):
                    </label>
                    <ComboboxSelect
                      items={WEAVE_DENSITY_OPTIONS}
                      value={formData.weaveQuality || "damask_50d"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("weaveQuality", val);
                        onMarkUnsaved();
                      }}
                      placeholder="To'qish zichligini tanlang..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lurex metall ip (Metallic Thread):
                    </label>
                    <ComboboxSelect
                      items={LUREX_OPTIONS}
                      value={formData.lurexColor || "none"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("lurexColor", val);
                        handleFieldChange("hasLurexThread", val !== "none");
                        onMarkUnsaved();
                      }}
                      placeholder="Lurex ip turini tanlang..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              3. OFFSET PACKAGING & SHEETFED PRINT CARDS
          ════════════════════════════════════════════════════════════════ */}
          {isOffset && (
            <>
              {/* Card 1: Geometry & Dimensions */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Size & shape
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Kesim chegarasi: +{formData.bleed ?? 2}mm
              </span>
            </div>

            {/* Row 1: Primary Dimensions & Shape */}
            <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Type
                </label>
                <ComboboxSelect
                  items={ITEM_CATEGORY_OPTIONS}
                  value={formData.itemCategory || "Hangtag"}
                  disabled={isOperator}
                  onValueChange={(val) => {
                    if (val === "Hangtag") {
                      handleFieldChange({
                        itemCategory: val,
                        holeSize: 4,
                        holePosition: "top-center",
                      });
                    } else if (val === "Carton") {
                      handleFieldChange({
                        itemCategory: val,
                        shapeType: "carton_box",
                      });
                    } else if (val === "Flyer") {
                      handleFieldChange({
                        itemCategory: val,
                        shapeType: "folded",
                      });
                    } else {
                      handleFieldChange("itemCategory", val);
                    }
                    onMarkUnsaved();
                  }}
                  placeholder="Mahsulot turini tanlang..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {tDie("shape")}
                </label>
                <ComboboxSelect
                  items={SHAPE_TYPE_OPTIONS}
                  value={formData.shapeType || "rectangle"}
                  disabled={isOperator}
                  onValueChange={(val) => {
                    if (!val) return;
                    if (val === "circle") {
                      handleFieldChange({
                        shapeType: val,
                        height: formData.width ?? 50,
                      });
                    } else {
                      handleFieldChange("shapeType", val);
                    }
                    onMarkUnsaved();
                  }}
                  placeholder="Shaklni tanlang..."
                />
              </div>

              <div className="col-span-2 grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {formData.shapeType === "circle" ? `Diameter (${formData.dimensionUnit || "mm"})` : `Width (${formData.dimensionUnit || "mm"})`}
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.width ?? 50}
                    disabled={isOperator}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (valStr === "") {
                        handleFieldChange("width", 0);
                        onMarkUnsaved();
                        return;
                      }
                      const num = Number(valStr);
                      if (isNaN(num)) return;

                      const prevW = Number(formData.width) || 0;
                      const prevH = Number(formData.height) || 0;

                      if (formData.shapeType === "circle") {
                        handleFieldChange({ width: num, height: num });
                      } else if (isAspectLocked && num > 0) {
                        const ratio = lockedRatioRef.current || (prevW > 0 && prevH > 0 ? prevH / prevW : 1);
                        lockedRatioRef.current = ratio;
                        const rawH = num * ratio;
                        const newH = Math.round(rawH * 10) / 10;
                        handleFieldChange({ width: num, height: newH });
                      } else {
                        handleFieldChange("width", num);
                      }
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                  />
                </div>

                <div className="pb-0.5">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant={isAspectLocked ? "secondary" : "ghost"}
                          size="icon"
                          disabled={isOperator || formData.shapeType === "circle"}
                          onClick={toggleAspectLock}
                          className={cn(
                            "h-8 w-8 rounded-md transition-all cursor-pointer",
                            isAspectLocked
                              ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 shadow-2xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                          )}
                          title={isAspectLocked ? tDie("unlockAspectRatio") : tDie("lockAspectRatio")}
                        >
                          {isAspectLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent side="top">
                      <span className="text-xs">
                        {formData.shapeType === "circle"
                          ? "Doira o'lchamlari doim 1:1 nisbatda"
                          : isAspectLocked
                          ? `${tDie("unlockAspectRatio")} (${Number(formData.width) || 0} : ${Number(formData.height) || 0})`
                          : tDie("lockAspectRatio")}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Height ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.shapeType === "circle" ? (formData.width ?? 50) : (formData.height ?? 90)}
                    disabled={isOperator || formData.shapeType === "circle"}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (valStr === "") {
                        handleFieldChange("height", 0);
                        onMarkUnsaved();
                        return;
                      }
                      const num = Number(valStr);
                      if (isNaN(num)) return;

                      const prevW = Number(formData.width) || 0;
                      const prevH = Number(formData.height) || 0;

                      if (isAspectLocked && num > 0) {
                        const ratio = lockedRatioRef.current || (prevW > 0 && prevH > 0 ? prevH / prevW : 1);
                        lockedRatioRef.current = ratio;
                        const rawW = ratio > 0 ? num / ratio : num;
                        const newW = Math.round(rawW * 10) / 10;
                        handleFieldChange({ height: num, width: newW });
                      } else {
                        handleFieldChange("height", num);
                      }
                      onMarkUnsaved();
                    }}
                    className={cn(
                      "h-8 text-xs font-mono font-semibold",
                      formData.shapeType === "circle" ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-muted/20"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Secondary Shape & Finishing Parameters (Dynamic per shape) */}
            <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3 pt-1 border-t border-border/50">
              {/* Secondary Field 1 */}
              {(formData.shapeType === "rectangle" || !formData.shapeType) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Corners
                  </label>
                  <ComboboxSelect
                    items={CORNER_TYPE_OPTIONS}
                    value={formData.cornerType || "Square"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange("cornerType", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Burchakni tanlang..."
                  />
                </div>
              )}

              {formData.shapeType === "circle" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Contour
                  </label>
                  <div className="h-8 px-2.5 rounded-md bg-muted/30 border border-border flex items-center text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    Doira 360° (Ø{formData.width ?? 50}mm)
                  </div>
                </div>
              )}

              {formData.shapeType === "oval" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Contour
                  </label>
                  <div className="h-8 px-2.5 rounded-md bg-muted/30 border border-border flex items-center text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium truncate">
                    Oval {formData.width ?? 50}×{formData.height ?? 90}
                  </div>
                </div>
              )}

              {formData.shapeType === "folded" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("foldType")}
                  </label>
                  <ComboboxSelect
                    items={FOLD_TYPE_OPTIONS}
                    value={formData.foldType || "half_vertical"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("foldType", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Buklamani tanlang..."
                  />
                </div>
              )}

              {formData.shapeType === "carton_box" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("boxType")}
                  </label>
                  <ComboboxSelect
                    items={BOX_TYPE_OPTIONS}
                    value={formData.boxType || "tuck_end"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("boxType", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Quti modelini tanlang..."
                  />
                </div>
              )}

              {formData.shapeType === "custom_die" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("customShape")}
                  </label>
                  <ComboboxSelect
                    items={[
                      { value: "arch", label: "Arka (Arch shape)" },
                      { value: "hexagon", label: "Oltiburchak (Hexagon)" },
                      { value: "star", label: "Yulduz (Star shape)" },
                      { value: "pillow", label: "Yostiqcha (Pillow box)" },
                      { value: "vector_svg", label: "Vektor SVG yuklash (Custom Vector)" },
                    ]}
                    value={formData.customShape || "arch"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("customShape", val);
                      if (val === "vector_svg") {
                        setIsSvgModalOpen(true);
                      }
                      onMarkUnsaved();
                    }}
                    placeholder="Qolip shaklini tanlang..."
                  />
                </div>
              )}

              {/* Secondary Field 2 */}
              {formData.shapeType === "carton_box" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("boxDepth")} ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.boxDepth ?? 40}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("boxDepth", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                  />
                </div>
              ) : formData.shapeType === "folded" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Corners
                  </label>
                  <ComboboxSelect
                    items={CORNER_TYPE_OPTIONS}
                    value={formData.cornerType || "Square"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange("cornerType", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Burchakni tanlang..."
                  />
                </div>
              ) : formData.shapeType === "custom_die" && formData.customShape === "vector_svg" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    SVG Data
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSvgInputDraft(formData.customSvgPath || "");
                      setIsSvgModalOpen(true);
                    }}
                    className="h-8 w-full text-xs gap-1.5 cursor-pointer justify-start font-mono truncate"
                  >
                    <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{formData.customSvgPath ? `SVG OK (${formData.width || 0}×${formData.height || 0} mm)` : tDie("uploadSvg")}</span>
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Bleed ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.bleed ?? 2}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("bleed", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono"
                  />
                </div>
              )}

              {/* Secondary Field 3 */}
              {(formData.shapeType === "carton_box" || formData.shapeType === "folded" || (formData.shapeType === "custom_die" && formData.customShape === "vector_svg")) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Bleed ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.bleed ?? 2}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("bleed", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Drill Hole Specifications */}
            <div className="pt-2.5 space-y-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-primary" />
                  <span>Teshik / Lyuvers (Drill Hole & Eyelet Punch)</span>
                </label>
                {effectiveHoleSize > 0 && effectiveHolePos !== "none" ? (
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Ø{effectiveHoleSize}mm • {effectiveHolePos} (+{effectiveHoleOffset}mm)
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">Teshiksiz (None)</span>
                )}
              </div>

              <div className="grid grid-cols-1 @md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Hole size
                  </label>
                  <ComboboxSelect
                    items={HOLE_SIZE_OPTIONS}
                    value={String(effectiveHoleSize)}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      const num = Number(val);
                      if (num === 0) {
                        handleFieldChange({ holeSize: 0, holePosition: "none" });
                      } else if (effectiveHolePos === "none") {
                        handleFieldChange({ holeSize: num, holePosition: "top-center" });
                      } else {
                        handleFieldChange("holeSize", num);
                      }
                      onMarkUnsaved();
                    }}
                    placeholder="Teshik diametrini tanlang..."
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Position
                  </label>
                  <ComboboxSelect
                    items={HOLE_POSITION_OPTIONS}
                    value={effectiveHolePos}
                    disabled={isOperator || effectiveHoleSize === 0}
                    onValueChange={(val) => {
                      handleFieldChange("holePosition", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Joylashuvni tanlang..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Offset
                  </label>
                  <Input
                    type="number"
                    value={effectiveHoleOffset}
                    disabled={isOperator || effectiveHoleSize === 0}
                    onChange={(e) => {
                      handleFieldChange("holeOffset", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Substrate & Dedicated Lamination / Finishing */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Material & lamination
                </span>
              </div>
              {isLaminationActive ? (
                <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  {currentLamination} · {laminationSides.toUpperCase()} ({laminationMicron}µm)
                </Badge>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground">
                  No lamination
                </span>
              )}
            </div>

            {/* Paper Stock Row */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Paper / material
              </label>
              <ComboboxSelect
                items={paperStockOptions}
                value={formData.paperStock}
                onValueChange={(val) => {
                  const updates: Record<string, any> = { paperStock: val };
                  const matched = warehouseStock.find(
                    (w) =>
                      w.name.toLowerCase() === val.toLowerCase() ||
                      w.sku.toLowerCase() === val.toLowerCase()
                  );
                  if (matched) {
                    if (matched.sheetFormat) {
                      const dims = matched.sheetFormat
                        .split(/[×xX*]/)
                        .map((s) => parseFloat(s.trim()))
                        .filter(Boolean);
                      if (dims.length >= 2 && !isNaN(dims[0]) && !isNaN(dims[1])) {
                        updates.parentSheetW = dims[0];
                        updates.parentSheetH = dims[1];
                      }
                    }
                    if (matched.grammage) {
                      updates.paperDensity = matched.grammage;
                    }
                  }
                  handleFieldChange(updates);
                  onMarkUnsaved();
                }}
                onAddNew={(newStock) => addPaperStock(newStock)}
                placeholder="Ombordagi qog'oz yoki xomashyoni qidiring..."
                disabled={isOperator}
                allowCustom={!isOperator}
                className="font-mono"
              />
              {formData.paperStock && (
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                  {matchedStockItem ? (
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        Omborda:{" "}
                        <strong className="text-foreground">
                          {(matchedStockItem.available ?? matchedStockItem.stockLevel ?? 0).toLocaleString()}{" "}
                          {matchedStockItem.unit || "varaq"}
                        </strong>
                        {matchedStockItem.sheetFormat ? ` (${matchedStockItem.sheetFormat} mm)` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Omborda mavjud emas / Maxsus material (BOM bo&apos;limida boshqariladi)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* DEDICATED LAMINATION & FINISHING SECTION */}
            <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Lamination
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Holati:</span>
                  <Badge
                    variant={isLaminationActive ? "default" : "outline"}
                    className={cn(
                      "text-[10px] font-mono",
                      isLaminationActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {isLaminationActive ? "Aktiv" : "Yo'q"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Film type
                  </label>
                  <ComboboxSelect
                    items={LAMINATION_OPTIONS}
                    value={currentLamination}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange({ lamination: val, coating: val });
                      onMarkUnsaved();
                    }}
                    placeholder="Laminatsiya turini tanlang..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Sides
                  </label>
                  <ComboboxSelect
                    items={LAMINATION_SIDES_OPTIONS}
                    value={laminationSides}
                    disabled={isOperator || !isLaminationActive}
                    onValueChange={(val) => {
                      handleFieldChange("laminationSides", val);
                      onMarkUnsaved();
                    }}
                    placeholder="Tomonlarni tanlang..."
                    className="font-mono"
                  />
                </div>
              </div>

              {isLaminationActive && (
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Thickness (µm)
                    </label>
                    <ComboboxSelect
                      items={LAMINATION_MICRON_OPTIONS}
                      value={String(laminationMicron)}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("laminationMicron", Number(val));
                        onMarkUnsaved();
                      }}
                      placeholder="Qalinlikni tanlang..."
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Finishing
                    </label>
                    <ComboboxSelect
                      items={EMBELLISHMENT_OPTIONS}
                      value={embellishment}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("embellishment", val);
                        onMarkUnsaved();
                      }}
                      placeholder="Pardoz turini tanlang..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Multi-Layer Substrate & Kashirovka (Duplex / Triplex) */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Multi-layer mounting (Кашировка)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {kashirovkaMode !== "none" && (
                  <Badge variant="outline" className="font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-300">
                    {kashirovkaMode === "triplex" ? "3-Ply Triplex" : "2-Ply Duplex"} · {kashirovkaTotals.totalMountedGsm}g/m²
                  </Badge>
                )}
                <Switch
                  checked={kashirovkaMode !== "none"}
                  disabled={isOperator}
                  onCheckedChange={(checked) => {
                    handleKashirovkaModeChange(checked ? "duplex" : "none");
                  }}
                />
              </div>
            </div>

            {kashirovkaMode !== "none" ? (
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Mounting Type:</span>
                  <div className="inline-flex items-center bg-muted p-0.5 rounded-full border border-border">
                    <button
                      type="button"
                      disabled={isOperator}
                      onClick={() => handleKashirovkaModeChange("duplex")}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                        kashirovkaMode === "duplex"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Duplex (2-Ply)
                    </button>
                    <button
                      type="button"
                      disabled={isOperator}
                      onClick={() => handleKashirovkaModeChange("triplex")}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                        kashirovkaMode === "triplex"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Triplex (3-Ply Sandwich)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Net Paper Stock:</span>
                    <span className="font-mono font-bold text-foreground">{kashirovkaTotals.netPaperGsm} gsm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Adhesive Bond:</span>
                    <span className="font-mono font-bold text-foreground">+{kashirovkaTotals.totalGlueGsm} gsm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Caliper:</span>
                    <span className="font-mono font-bold text-primary">~{kashirovkaTotals.estimatedCaliperMm} mm</span>
                  </div>
                </div>

                {/* Substrate Layers Breakdown */}
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Mounted Layers Composition:
                  </span>
                  <div className="space-y-1">
                    {kashirovkaLayers.map((layer, idx) => (
                      <div
                        key={layer.id || idx}
                        className="flex items-center justify-between p-1.5 rounded bg-background border border-border text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono shrink-0">
                            L{idx + 1}
                          </Badge>
                          <span className="font-medium truncate text-foreground">{layer.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground shrink-0">
                          <span>{layer.grammage} gsm</span>
                          <span className="text-border">|</span>
                          <Badge variant="outline" className="h-3.5 px-1 text-[9px]">
                            {layer.colors}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic bg-muted/10 p-2.5 rounded border border-dashed border-border text-center">
                Standard single-ply substrate (No mounting/lamination onto secondary carrier).
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Right Column: Visual Die-Line / Textile Label Preview, Print Inks & Sizes */}
        <div className="space-y-3">
          {/* Visual Preview: 2D Die-Line (Offset) OR Textile Care Label Preview (Flexo / Jacquard) */}
          {isOffset ? (
            <DieLinePreview
              width={formData.width ?? 50}
              height={formData.height ?? 90}
              bleed={formData.bleed ?? 2}
              dimensionUnit={formData.dimensionUnit || "mm"}
              cornerType={formData.cornerType || "Square"}
              itemCategory={formData.itemCategory || ""}
              shapeType={formData.shapeType || "rectangle"}
              foldType={formData.foldType || undefined}
              boxType={formData.boxType || undefined}
              boxDepth={formData.boxDepth || 0}
              customShape={formData.customShape || undefined}
              customSvgPath={formData.customSvgPath || ""}
              totalQuantity={formData.quantity || 0}
              paperStock={formData.paperStock || ""}
              holeSize={effectiveHoleSize}
              holePosition={effectiveHolePos}
              holeOffset={effectiveHoleOffset}
              artworkFront={
                (formData.skuArtworks && (formData.skuArtworks[0]?.frontArtworkThumb || formData.skuArtworks[0]?.frontArtworkUrl)) ||
                formData.artworkFront ||
                undefined
              }
              artworkBack={
                (formData.skuArtworks && (formData.skuArtworks[0]?.backArtworkThumb || formData.skuArtworks[0]?.backArtworkUrl)) ||
                formData.artworkBack ||
                undefined
              }
              skuArtworks={formData.skuArtworks}
              artworkBleedIncluded={formData.artworkBleedIncluded}
              artworkDielineOpacity={formData.artworkDielineOpacity}
              onArtworkChange={(front, back, sourcePdf, detectedW, detectedH, rawFile) => {
                const updates: Record<string, any> = { artworkFront: front };
                if (back) updates.artworkBack = back;
                if (sourcePdf) updates.artworkSourcePdf = sourcePdf;
                if (detectedW && detectedH && detectedW > 0 && detectedH > 0) {
                  updates.width = detectedW;
                  updates.height = detectedH;
                }
                handleFieldChange(updates);
                void triggerArtworkColorAnalysis(front, back);

                // Keep photoUrl and production artwork cleanly separated
                if (rawFile && setOrderAttachments) {
                  setOrderAttachments((prev) => [
                    {
                      id: `att-art-${Date.now()}`,
                      name: rawFile.name,
                      size: `${(rawFile.size / 1024).toFixed(1)} KB`,
                      type: rawFile.type || "application/pdf",
                      date: new Date().toISOString().slice(0, 16).replace("T", " "),
                      isImage: rawFile.type.startsWith("image/"),
                      url: front,
                    },
                    ...prev,
                  ]);
                }
                if (detectedW && detectedH && detectedW > 0 && detectedH > 0) {
                  addNotification({
                    severity: "success",
                    title: "PDF o'lchami qo'llandi",
                    description: `Yuklangan fayldan o'lchamlar aniqlandi: ${detectedW} × ${detectedH} mm`,
                  });
                }
                onMarkUnsaved();
              }}
              onFlipOrientation={!isOperator && formData.shapeType !== "circle" ? () => {
                const currentW = formData.width ?? 50;
                const currentH = formData.height ?? 90;
                handleFieldChange({ width: currentH, height: currentW });
                if (lockedRatioRef.current && lockedRatioRef.current > 0) {
                  lockedRatioRef.current = 1 / lockedRatioRef.current;
                }
                onMarkUnsaved();
              } : undefined}
            />
          ) : (
            <TextileLabelPreview
              width={formData.width ?? (isFlexo ? 30 : 35)}
              height={formData.height ?? (isFlexo ? 70 : 65)}
              materialType={formData.labelMaterialType || (formData.paperStock?.toLowerCase().includes("satin") ? "polyester_satin_white" : isJacquard ? "polyester_satin_black" : "nylon_taffeta")}
              foldType={formData.labelFoldType || (isFlexo ? "center_fold" : "end_fold")}
              cutType={formData.labelCutType || "ultrasonic"}
              sewingMarginMm={formData.labelSewingMarginMm ?? 5}
              printSides={formData.labelPrintSides || "1s"}
              department={formData.department}
              weaveQuality={formData.weaveQuality || "damask_50d"}
              hasLurex={formData.hasLurexThread || false}
              lurexColor={formData.lurexColor || "gold"}
              colorsConfig={formData.colorsConfig || "1+0"}
              brandName={formData.product || (isJacquard ? "DAMASK WOVEN" : "CARE INSTRUCTION")}
            />
          )}

          {/* Card 3: Color Stations & Inks */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Print colors
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs">
                <span className="font-bold text-foreground">
                  {frontTotalCount}+{backTotalCount}
                </span>
                <span className="text-[11px] text-muted-foreground font-sans">
                  ({frontProcessCount + backProcessCount} CMYK{spotColorItems.length > 0 ? ` + ${spotColorItems.length} Spot` : ""})
                </span>
              </div>
            </div>

            {detectedColorPrompt && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded border border-blue-500/30 bg-blue-500/10 text-xs">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-foreground">Maket tahlili: </span>
                    <span className="font-bold text-blue-600 font-mono">{detectedColorPrompt.formula}</span>
                    <span className="text-muted-foreground ml-1">
                      (Oldi: {detectedColorPrompt.frontSummary}, Orqa: {detectedColorPrompt.backSummary})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-6 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    onClick={() => {
                      handleFieldChange({
                        frontColors: detectedColorPrompt.frontColors,
                        backColors: detectedColorPrompt.backColors,
                        colorsConfig: detectedColorPrompt.formula,
                        printMethod: detectedColorPrompt.printMethod,
                        spotColorItems: detectedColorPrompt.spotColors,
                        spotColors: (detectedColorPrompt.spotColors || []).map((s: any) => s.name),
                      });
                      setDetectedColorPrompt(null);
                      addNotification({
                        severity: "success",
                        title: "Rang profili yangilandi",
                        description: `${detectedColorPrompt.formula} ranglari tasdiqlandi va qo'llandi`,
                      });
                      onMarkUnsaved();
                    }}
                  >
                    Qo'llash ({detectedColorPrompt.formula})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setDetectedColorPrompt(null)}
                  >
                    Bekor qilish
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              {/* Front Colors (Old tomon) */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Old tomon (Front)</span>
                    <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                      {frontTotalCount} ta rang
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {frontProcessCount > 0 ? `${frontProcessCount} CMYK` : "0 CMYK"}
                    {frontSpots.length > 0 ? ` + ${frontSpots.length} Spot` : ""}
                  </span>
                </div>

                {/* CMYK Buttons */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "c", label: "C", bg: "bg-cyan-500", text: "text-white" },
                    { key: "m", label: "M", bg: "bg-pink-500", text: "text-white" },
                    { key: "y", label: "Y", bg: "bg-yellow-400", text: "text-black" },
                    { key: "k", label: "K", bg: "bg-zinc-900", text: "text-white" },
                  ].map((ink) => {
                    const active = (frontColors as any)[ink.key];
                    return (
                      <button
                        key={ink.key}
                        type="button"
                        disabled={isOperator}
                        onClick={() => handleToggleFrontColor(ink.key as any)}
                        className={cn(
                          "flex-1 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer border",
                          active
                            ? `${ink.bg} ${ink.text} border-transparent shadow-xs scale-[1.02]`
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {ink.label}
                      </button>
                    );
                  })}
                </div>

                {/* Front Pantone Spot Colors */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Pantone / Spot ({frontSpots.length})
                    </span>
                    {!isOperator && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPantoneModal("front")}
                        className="h-5 px-1.5 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Palette className="w-3 h-3" />
                        <span>Katalog (PMS)</span>
                      </Button>
                    )}
                  </div>

                  {/* Active Front Spot Chips */}
                  {frontSpots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {frontSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded border border-border bg-card text-xs font-medium shadow-2xs group"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: spot.hex }}
                          />
                          <span className="font-mono text-[11px] font-semibold text-foreground truncate max-w-[150px]">
                            {spot.name}
                          </span>
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSpotColor(spot.id)}
                              title="O'chirish"
                              className="text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Direct Input & Quick Add Row */}
                  {!isOperator && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Input
                        value={frontQuickInput}
                        onChange={(e) => setFrontQuickInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAddPantone("front");
                          }
                        }}
                        placeholder="Old tomonga Pantone (021, Warm Red, 485)..."
                        className="h-7 text-xs flex-1 bg-background"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleQuickAddPantone("front")}
                        disabled={!frontQuickInput.trim()}
                        className="h-7 px-2 text-xs gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Qo&apos;shish</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Back Colors (Orqa tomon) */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Orqa tomon (Back)</span>
                    <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                      {backTotalCount} ta rang
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {backProcessCount > 0 ? `${backProcessCount} CMYK` : "0 CMYK"}
                    {backSpots.length > 0 ? ` + ${backSpots.length} Spot` : ""}
                  </span>
                </div>

                {/* CMYK Buttons */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "c", label: "C", bg: "bg-cyan-500", text: "text-white" },
                    { key: "m", label: "M", bg: "bg-pink-500", text: "text-white" },
                    { key: "y", label: "Y", bg: "bg-yellow-400", text: "text-black" },
                    { key: "k", label: "K", bg: "bg-zinc-900", text: "text-white" },
                  ].map((ink) => {
                    const active = (backColors as any)[ink.key];
                    return (
                      <button
                        key={ink.key}
                        type="button"
                        disabled={isOperator}
                        onClick={() => handleToggleBackColor(ink.key as any)}
                        className={cn(
                          "flex-1 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer border",
                          active
                            ? `${ink.bg} ${ink.text} border-transparent shadow-xs scale-[1.02]`
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {ink.label}
                      </button>
                    );
                  })}
                </div>

                {/* Back Pantone Spot Colors */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Pantone / Spot ({backSpots.length})
                    </span>
                    {!isOperator && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPantoneModal("back")}
                        className="h-5 px-1.5 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Palette className="w-3 h-3" />
                        <span>Katalog (PMS)</span>
                      </Button>
                    )}
                  </div>

                  {/* Active Back Spot Chips */}
                  {backSpots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {backSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded border border-border bg-card text-xs font-medium shadow-2xs group"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: spot.hex }}
                          />
                          <span className="font-mono text-[11px] font-semibold text-foreground truncate max-w-[150px]">
                            {spot.name}
                          </span>
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSpotColor(spot.id)}
                              title="O'chirish"
                              className="text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Direct Input & Quick Add Row */}
                  {!isOperator && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Input
                        value={backQuickInput}
                        onChange={(e) => setBackQuickInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAddPantone("back");
                          }
                        }}
                        placeholder="Orqa tomonga Pantone (021, Warm Red, 485)..."
                        className="h-7 text-xs flex-1 bg-background"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleQuickAddPantone("back")}
                        disabled={!backQuickInput.trim()}
                        className="h-7 px-2 text-xs gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Qo&apos;shish</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
