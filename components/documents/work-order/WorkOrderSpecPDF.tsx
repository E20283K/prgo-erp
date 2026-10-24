import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Rect,
  Circle,
  Line,
  Image,
} from "@react-pdf/renderer";
import {
  WorkOrderFormData,
  RouteStep,
  ShiftEvent,
  ShiftNote,
  SpotColorItem,
  SideColorConfig,
  parseModelAndSize,
  calculateKashirovkaTotals,
  getDefaultKashirovkaLayers,
  SkuArtwork,
} from "./types";

// Register local Unicode Roboto font supporting Latin, Uzbek, Turkish, and Cyrillic
Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

export interface WorkOrderSpecPdfProps {
  docNo: string;
  orderData: WorkOrderFormData;
  operations: RouteStep[];
  materials?: { name: string; req: number; unit: string; stock: number }[];
  shiftEvents?: ShiftEvent[];
  labels?: Record<string, string>;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 26,
    paddingHorizontal: 24,
    fontFamily: "Roboto",
    fontSize: 7.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  // Top Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 6,
    marginBottom: 7,
  },
  headerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 0.4,
  },
  badgeDark: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontSize: 6.5,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  badgePriorityUrgent: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    fontSize: 6.5,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  badgePriorityNormal: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: 6.5,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  brandSubtitle: {
    fontSize: 7,
    color: "#475569",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qrBox: {
    width: 38,
    height: 38,
    padding: 2,
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  docMetaBox: {
    alignItems: "flex-end",
  },
  docNoText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  docSubText: {
    fontSize: 6.5,
    color: "#475569",
    marginTop: 1,
  },

  // Requisites & KPI Grid
  reqGrid: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    backgroundColor: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 5,
    gap: 8,
  },
  reqCol: {
    flex: 1,
  },
  reqLabel: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  reqValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0f172a",
  },
  reqSub: {
    fontSize: 6.5,
    color: "#475569",
    marginTop: 0.5,
  },

  kpiStrip: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
    gap: 8,
  },
  kpiValueBlue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1d4ed8",
  },
  kpiValueGreen: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#047857",
  },
  kpiValueDark: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
  },

  // Two-column layouts
  twoColRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  panel: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    padding: 5,
    backgroundColor: "#ffffff",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginBottom: 4,
    borderRadius: 1.5,
  },
  panelHeaderTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  panelHeaderBadge: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#93c5fd",
  },

  // Key-Value rows inside panels
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1.8,
    borderBottomWidth: 0.4,
    borderBottomColor: "#f1f5f9",
  },
  kvLabel: {
    fontSize: 6.8,
    color: "#475569",
  },
  kvVal: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "right",
  },

  // Color channel badges
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  channelPill: {
    paddingHorizontal: 3.5,
    paddingVertical: 1,
    borderRadius: 1.5,
    fontSize: 6,
    fontWeight: "bold",
  },
  spotWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 2,
  },
  spotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    paddingHorizontal: 3.5,
    paddingVertical: 1.2,
  },
  spotSwatch: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },

  // Readiness Gates Strip
  gatesRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
  },
  gateCard: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0.7,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    borderRadius: 2,
    paddingVertical: 3,
    paddingHorizontal: 4.5,
  },
  gateTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  gateSub: {
    fontSize: 5.8,
    color: "#475569",
  },
  gatePassBadge: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
    fontSize: 5.5,
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 1.5,
  },

  // Tables
  table: {
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    overflow: "hidden",
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 0.8,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 2.5,
    paddingHorizontal: 4,
  },
  tdRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 2.2,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  th: {
    fontSize: 6.2,
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  },
  td: {
    fontSize: 6.8,
    color: "#0f172a",
  },
  tdBold: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#0f172a",
  },

  // Shift Notes
  notesGrid: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  noteBox: {
    flex: 1,
    borderWidth: 0.6,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    padding: 3.5,
  },
  noteHeader: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 1,
  },
  noteText: {
    fontSize: 6.2,
    color: "#0f172a",
  },

  // Sign-Off Row
  signoffSection: {
    marginTop: 5,
  },
  signoffRow: {
    flexDirection: "row",
    gap: 5,
  },
  signoffBox: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: "#94a3b8",
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    padding: 4,
    minHeight: 38,
    justifyContent: "space-between",
  },
  signoffTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  signoffSub: {
    fontSize: 5.5,
    color: "#64748b",
  },
  signoffLine: {
    borderBottomWidth: 0.6,
    borderBottomColor: "#64748b",
    borderStyle: "dashed",
    marginTop: 10,
    marginBottom: 2,
  },
  signoffFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 5.5,
    color: "#64748b",
  },

  // Page Footer
  footer: {
    position: "absolute",
    bottom: 10,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 3,
  },
  footerText: {
    fontSize: 6,
    color: "#64748b",
  },
});

const DEFAULT_LABELS: Record<string, string> = {
  title: "Buyurtma Pasporti (Наряд-заказ)",
  subtitle: "Yagona ishlab chiqarish pasporti va texnologik marshrut xaritasi",
  badge: "PASPORT • НАРЯД-ЗАКАЗ",
  customer: "Buyurtmachi / Tashkilot",
  product: "Mahsulot va Turi",
  departmentSite: "Bo'lim va Bino (Tsex)",
  pressMachine: "Asosiy bosma uskunasi",
  netRun: "Netto tiraj",
  grossSheets: "Brutto varaqlar (sozlash bilan)",
  impositionYield: "Varaqqa joylashuv (N-Up)",
  scheduleWindow: "Ish vaqti va Muddat",
  recipe: "Texnologik retsept (BOM)",
  physicalSpecs: "O'lchamlar, xomashyo va pardozlash",
  sampleAndDrawing: "2D Kesim chizmasi va o'lchamlar",
  trimDimensions: "Kesim o'lchami (Eni × Bo'yi)",
  bleedMargin: "Kesim zapasi (Bleed)",
  cornerCut: "Burchak / Shtans shakli",
  holeEyelet: "Teshik / Lyuvers",
  paperSubstrate: "Qog'oz / Xomashyo turi",
  laminationSpec: "Laminatsiya plyonkasi",
  surfaceCoating: "Lak / Qoplama",
  embellishment: "Post-press ishlov",
  inksAndColors: "Bosma bo'yoqlar va rang seksiyalari",
  frontSide: "Old tomon (Yuz)",
  backSide: "Orqa tomon (Orqa)",
  spotStations: "Panton / Spot ranglar",
  kashirovkaTitle: "Ko'p qatlamli kashirovka (Yopishtirish)",
  kashirovkaMode: "Qatlamlar tuzilmasi",
  kashirovkaStrategy: "CTP va montaj usuli",
  kashirovkaTotalGsm: "Umumiy zichlik va qalinlik",
  kashirovkaGlue: "Kley sarfi",
  kashirovkaWastePause: "Sozlash sarfi / Qurish vaqti",
  flexoTitle: "Flekso val va rulon parametrlari",
  flexoTeeth: "Val tishlari soni (Z)",
  flexoWebWidth: "Rulon eni (Web)",
  flexoPlate: "Fotopolimer klishe",
  flexoGap: "Qadam oralig'i (X / Y)",
  sizeBreakdown: "Modellar va o'lchamlar (SKU) taqsimoti",
  colModel: "Model",
  colSize: "O'lcham / SKU",
  colQty: "Miqdori",
  colShare: "Ulushi",
  totalTarget: "Jami tiraj",
  bomMaterials: "Talab etiladigan xomashyolar (BOM)",
  colMaterial: "Xomashyo nomi",
  colReqQty: "Kerakli",
  colWarehouseStock: "Ombor qoldig'i",
  stockOk: "Yetarli",
  stockShortage: "Tanqislik",
  readinessChecklist: "Bosmaga tayyorgarlik nazorati (Stage-Gates)",
  gate1Title: "1-Bosqich: Dizayn va Prepress",
  gate1Sub: "Rang ajratish, Bleed va Maket",
  gate2Title: "2-Bosqich: Qog'oz va Xomashyo",
  gate2Sub: "Kesilgan va stanok oldida tayyor",
  gate3Title: "3-Bosqich: CTP Qolip / Klishe",
  gate3Sub: "Chiqarilgan va tekshirilgan",
  gate4Title: "4-Bosqich: Shtansforma",
  gate4Sub: "Pichoq va bigovka matritsasi tayyor",
  techRoute: "Texnologik ishlab chiqarish marshruti",
  colStep: "Bosqich",
  colOperation: "Operatsiya nomi",
  colMachine: "Stanok / Uskuna",
  colOperator: "Mas'ul operator",
  colDuration: "Reja (s)",
  colStatus: "Holati",
  colSign: "Imzo",
  shiftNotesTitle: "Smena ko'rsatmalari va texnik eslatmalar",
  signOffTitle: "Bo'lim ustalari va OTK tasdiqlash imzolari",
  signPrepress: "1. Prepress va CTP ustasi",
  signPrepressSub: "Qoliplar, RIP va o'lcham tasdiqlandi",
  signPress: "2. Bosma operatori (Pechatnik)",
  signPressSub: "Rang zichligi va registratsiya OK",
  signFinish: "3. Kesim va Post-press ustasi",
  signFinishSub: "Shtans, laminatsiya va bigovka OK",
  signQc: "4. OTK (Sifat) va Ombor",
  signQcSub: "Soni va qadoqlanishi tekshirildi",
  signLabel: "Imzo:",
  dateLabel: "Sana:",
  pass: "TAYYOR",
  footerSystem: "PRINTGOO ERP • YAGONA ISHLAB CHIQARISH BUYURTMA PASPORTI",
  printDate: "SANA",
};

function buildQrModules(workOrderId: string) {
  const size = 21;
  const isFinder = (r: number, c: number) => {
    if (r <= 6 && c <= 6) {
      return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    }
    if (r <= 6 && c >= 14) {
      return r === 0 || r === 6 || c === 14 || c === 20 || (r >= 2 && r <= 4 && c >= 16 && c <= 18);
    }
    if (r >= 14 && c <= 6) {
      return r === 14 || r === 20 || c === 0 || c === 6 || (r >= 16 && r <= 18 && c >= 2 && c <= 4);
    }
    return false;
  };
  const isTiming = (r: number, c: number) => {
    if (r === 6 && c >= 8 && c <= 12) return c % 2 === 0;
    if (c === 6 && r >= 8 && r <= 12) return r % 2 === 0;
    return false;
  };
  const isData = (r: number, c: number) => {
    if ((r <= 7 && c <= 7) || (r <= 7 && c >= 13) || (r >= 13 && c <= 7)) return false;
    if (r === 6 || c === 6) return false;
    const hash = (r * 31 + c * 17 + (workOrderId.charCodeAt(workOrderId.length - 1) || 42)) % 7;
    return hash === 0 || hash === 2 || hash === 5;
  };
  const modules: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c) || isTiming(r, c) || isData(r, c)) {
        modules.push({ r, c });
      }
    }
  }
  return modules;
}

export const WorkOrderSpecPDF: React.FC<WorkOrderSpecPdfProps> = ({
  docNo,
  orderData,
  operations = [],
  materials = [],
  labels: customLabels,
}) => {
  const L = { ...DEFAULT_LABELS, ...(customLabels || {}) };

  const width = orderData.width || 50;
  const height = orderData.height || 90;
  const dimUnit = orderData.dimensionUnit || "mm";
  const bleed = orderData.bleed ?? 2;
  const itemW = width + 2 * bleed;
  const itemH = height + 2 * bleed;

  const cols = Math.max(1, Math.floor(960 / (itemW + 2)));
  const rows = Math.max(1, Math.floor(660 / (itemH + 2)));
  const yieldPerSheet = Math.max(1, cols * rows);
  const netQuantity = orderData.quantity || 5000;
  const skuArtworks = orderData.skuArtworks || [];
  const skuArtworksMap: Record<string, SkuArtwork> = {};
  skuArtworks.forEach((a) => {
    if (a.skuId) skuArtworksMap[a.skuId] = a;
    if (a.sizeCode) skuArtworksMap[a.sizeCode.trim().toUpperCase()] = a;
    if (a.model && a.sizeCode) skuArtworksMap[`${a.model.trim()}___${a.sizeCode.trim().toUpperCase()}`] = a;
  });

  const rawSizes = orderData.sizes || [{ size: "ALL", quantity: netQuantity }];
  const normalizedSkuCards = rawSizes.map((s, idx) => {
    const sId = (s as any).id || `sku-${idx}`;
    const sStr = s.size || "ALL";
    const sModel = (s as any).model || (sStr.includes(" - ") ? sStr.split(" - ")[0] : "STD");
    const sCode = (sStr.includes(" - ") ? sStr.split(" - ")[1] : sStr).trim().toUpperCase();
    const art = skuArtworksMap[sId] || skuArtworksMap[`${sModel}___${sCode}`] || skuArtworksMap[sCode];
    const sQty = Number(s.quantity) || 0;
    const share = netQuantity > 0 ? Math.round((sQty / netQuantity) * 100) : 100;
    return {
      id: sId,
      model: sModel,
      sizeCode: sCode,
      quantity: sQty,
      share,
      frontSrc: art?.frontArtworkThumb || art?.frontArtworkUrl,
      backSrc: art?.backArtworkThumb || art?.backArtworkUrl,
      frontName: art?.frontArtworkName,
      backName: art?.backArtworkName,
      hasArtwork: Boolean(art && (art.frontArtworkThumb || art.frontArtworkUrl || art.backArtworkThumb || art.backArtworkUrl)),
    };
  });

  const seenKeys = new Set(normalizedSkuCards.map((c) => `${c.model}___${c.sizeCode}`));
  skuArtworks.forEach((a) => {
    const aModel = a.model || "STD";
    const aCode = (a.sizeCode || "").trim().toUpperCase();
    const key = `${aModel}___${aCode}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      normalizedSkuCards.push({
        id: a.skuId,
        model: aModel,
        sizeCode: aCode,
        quantity: 0,
        share: 0,
        frontSrc: a.frontArtworkThumb || a.frontArtworkUrl,
        backSrc: a.backArtworkThumb || a.backArtworkUrl,
        frontName: a.frontArtworkName,
        backName: a.backArtworkName,
        hasArtwork: Boolean(a.frontArtworkThumb || a.frontArtworkUrl || a.backArtworkThumb || a.backArtworkUrl),
      });
    }
  });

  const itemsWithArtwork = normalizedSkuCards.filter((c) => c.hasArtwork);
  const primarySkuArt = itemsWithArtwork[0];
  const effectiveArtworkFront = orderData.artworkFront || primarySkuArt?.frontSrc;
  const effectiveArtworkBack = orderData.artworkBack || primarySkuArt?.backSrc;
  const grossSheets = Math.ceil((netQuantity / yieldPerSheet) * 1.05) + (orderData.kashirovkaMakeReadySheets || 50);

  // Hole specs
  const holeSize =
    orderData.holeSize !== undefined
      ? orderData.holeSize
      : orderData.itemCategory === "Hangtag"
      ? 4
      : 0;
  const holePos = orderData.holePosition || (orderData.itemCategory === "Hangtag" ? "top-center" : "none");
  const holeOffset = orderData.holeOffset ?? 6;

  // Colors & Spot Stations
  const frontColors: SideColorConfig = orderData.frontColors || { c: true, m: true, y: true, k: true };
  const backColors: SideColorConfig = orderData.backColors || { c: false, m: false, y: false, k: false };
  const spotColorItems: SpotColorItem[] =
    orderData.spotColorItems && orderData.spotColorItems.length > 0
      ? orderData.spotColorItems
      : orderData.spotColors && orderData.spotColors.length > 0
      ? orderData.spotColors.map((name, i) => ({
          id: `spot-${i}`,
          name,
          code: name.split(" ")[1] || "PMS",
          hex: name.includes("021") ? "#fe5000" : name.includes("871") ? "#84754e" : "#2563eb",
          side: "front" as const,
        }))
      : [];

  // Kashirovka
  const kashirovkaMode = orderData.kashirovkaMode || "none";
  const kashirovkaLayers =
    kashirovkaMode === "none"
      ? []
      : orderData.kashirovkaLayers && orderData.kashirovkaLayers.length > 0
      ? orderData.kashirovkaLayers
      : getDefaultKashirovkaLayers(kashirovkaMode, orderData.paperStock, orderData.coating);
  const kashirovkaTotals = calculateKashirovkaTotals(
    kashirovkaMode,
    kashirovkaLayers,
    orderData.kashirovkaGlueGsm ?? 25
  );

  // Shift Notes
  const shiftNotes: ShiftNote[] =
    orderData.shiftNotes && orderData.shiftNotes.length > 0
      ? orderData.shiftNotes
      : [
          {
            id: "sn-1",
            author: "M. Ivanova (Press Lead)",
            shift: "Morning",
            time: "11:45",
            text: "CMYK densities locked at 1.45 D. Viscosity 23s DIN4. Speed 14,000 sht/h.",
          },
          {
            id: "sn-2",
            author: "S. Petrov (Die-Cut)",
            shift: "Evening",
            time: "19:30",
            text: "Cutting rule aligned with 0.4mm crease channel. First sample signed off.",
          },
        ];

  const qrModules = buildQrModules(docNo || "WOOF-26-0351");

  // 2D Schematic proportional scaling inside a 90x72 viewport
  const maxBoxW = 54;
  const maxBoxH = 52;
  const aspect = width / Math.max(1, height);
  const drawW = aspect >= 1 ? maxBoxW : Math.max(20, Math.round(maxBoxH * aspect));
  const drawH = aspect >= 1 ? Math.max(20, Math.round(maxBoxW / aspect)) : maxBoxH;
  const trimX = Math.round((86 - drawW) / 2);
  const trimY = Math.round((64 - drawH) / 2);

  type PdfHole = { cx: number; cy: number };
  const pdfHoles: PdfHole[] = [];
  if (holePos === "both-sides-fold") {
    if (orderData.foldType === "half_horizontal") {
      pdfHoles.push({ cx: trimX + drawW / 2, cy: trimY + drawH / 2 - 5 });
      pdfHoles.push({ cx: trimX + drawW / 2, cy: trimY + drawH / 2 + 5 });
    } else {
      pdfHoles.push({ cx: trimX + drawW / 2 - 6, cy: trimY + 6 });
      pdfHoles.push({ cx: trimX + drawW / 2 + 6, cy: trimY + 6 });
    }
  } else if (holePos === "top-left") {
    pdfHoles.push({ cx: trimX + 6, cy: trimY + 6 });
  } else if (holePos === "top-right") {
    pdfHoles.push({ cx: trimX + drawW - 6, cy: trimY + 6 });
  } else if (holePos === "left-center") {
    pdfHoles.push({ cx: trimX + 6, cy: trimY + drawH / 2 });
  } else if (holePos === "right-center") {
    pdfHoles.push({ cx: trimX + drawW - 6, cy: trimY + drawH / 2 });
  } else {
    pdfHoles.push({ cx: trimX + drawW / 2, cy: trimY + 6 });
  }

  return (
    <Document title={`${L.title} - ${docNo}`} author="PrintGoo ERP">
      <Page size="A4" style={styles.page}>
        {/* 1. TOP HEADER WITH QR CODE */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>PRINTGOO ERP</Text>
              <Text style={styles.badgeDark}>{L.badge}</Text>
              <Text
                style={
                  orderData.priority === "Urgent" || orderData.priority === "High"
                    ? styles.badgePriorityUrgent
                    : styles.badgePriorityNormal
                }
              >
                {(orderData.priority || "NORMAL").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.brandSubtitle}>{L.subtitle}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.docMetaBox}>
              <Text style={styles.docNoText}>{docNo || "WOOF-26-0351"}</Text>
              <Text style={styles.docSubText}>
                {orderData.status || "Active"} • {new Date().toISOString().slice(0, 10)}
              </Text>
              {orderData.linkedOrderId && (
                <Text style={styles.docSubText}>Ref: {orderData.linkedOrderId}</Text>
              )}
            </View>
            <View style={styles.qrBox}>
              <Svg viewBox="0 0 21 21">
                {qrModules.map((m, idx) => (
                  <Rect
                    key={idx}
                    x={m.c}
                    y={m.r}
                    width={1.02}
                    height={1.02}
                    fill="#0f172a"
                  />
                ))}
              </Svg>
            </View>
          </View>
        </View>

        {/* 2. CORE REQUISITES & TARGET RUN KPI STRIP */}
        <View style={styles.reqGrid}>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.customer}</Text>
            <Text style={styles.reqValue}>{orderData.customer || "—"}</Text>
            <Text style={styles.reqSub}>{orderData.orderType || "Production Order"}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.product}</Text>
            <Text style={styles.reqValue}>{orderData.product || "—"}</Text>
            <Text style={styles.reqSub}>{orderData.itemCategory || "Commercial Print"}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.departmentSite}</Text>
            <Text style={styles.reqValue}>{orderData.department || "Offset"}</Text>
            <Text style={styles.reqSub}>{orderData.site || "Building 1"}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.pressMachine}</Text>
            <Text style={styles.reqValue}>{orderData.pressMachine || "—"}</Text>
            <Text style={styles.reqSub}>
              {L.recipe}: {orderData.recipe || "STD_V1"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStrip}>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.netRun}</Text>
            <Text style={styles.kpiValueBlue}>
              {netQuantity.toLocaleString()} {orderData.unit || "pcs"}
            </Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.grossSheets}</Text>
            <Text style={styles.kpiValueDark}>{grossSheets.toLocaleString()} sht</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.impositionYield}</Text>
            <Text style={styles.kpiValueGreen}>
              {yieldPerSheet} pcs / sht ({cols}×{rows})
            </Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.scheduleWindow}</Text>
            <Text style={styles.kpiValueDark}>
              {orderData.startDate || "—"} → {orderData.deadline || "—"}
            </Text>
          </View>
        </View>

        {/* 3. PHYSICAL GEOMETRY & 2D SCHEMATIC + INKS & COLOR STATIONS */}
        <View style={styles.twoColRow}>
          {/* Left Panel: Physical Geometry, 2D Schematic & Substrate */}
          <View style={[styles.panel, { flex: 1.15 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.physicalSpecs}</Text>
              <Text style={styles.panelHeaderBadge}>
                {width}×{height} {dimUnit} (+{bleed}{dimUnit})
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {/* Real Artwork Proof (Front & Back Side-by-Side) */}
              {effectiveArtworkFront ? (
                <View
                  style={{
                    width: 126,
                    minHeight: 80,
                    borderWidth: 0.6,
                    borderColor: "#cbd5e1",
                    backgroundColor: "#f8fafc",
                    borderRadius: 3,
                    padding: 3,
                    flexDirection: "row",
                    justifyContent: "space-around",
                    alignItems: "flex-end",
                  }}
                >
                  {/* Front Side */}
                  <View style={{ alignItems: "center", width: 56 }}>
                    {holeSize > 0 && holePos !== "none" && (
                      <Text style={{ fontSize: 4.2, color: "#dc2626", fontWeight: "bold", marginBottom: 1 }}>
                        ↓ {holeOffset || 5.5}mm (Ø{holeSize}mm)
                      </Text>
                    )}
                    <View
                      style={{
                        width: 50,
                        height: 60,
                        borderWidth: 0.6,
                        borderColor: "#10b981",
                        borderRadius: orderData.cornerType?.toLowerCase().includes("round") ? 3 : 1,
                        overflow: "hidden",
                        backgroundColor: "#18181b",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Image
                        src={effectiveArtworkFront}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </View>
                    <Text style={{ fontSize: 4.8, fontWeight: "bold", color: "#0f172a", marginTop: 2 }}>
                      {primarySkuArt && !orderData.artworkFront ? `Oldi (${primarySkuArt.sizeCode})` : "Oldi (Front)"}
                    </Text>
                    <Text style={{ fontSize: 3.6, color: "#64748b" }}>
                      Yuz tomon
                    </Text>
                  </View>

                  {/* Back Side */}
                  <View style={{ alignItems: "center", width: 56 }}>
                    <View
                      style={{
                        width: 50,
                        height: 60,
                        borderWidth: 0.6,
                        borderColor: "#10b981",
                        borderRadius: orderData.cornerType?.toLowerCase().includes("round") ? 3 : 1,
                        overflow: "hidden",
                        backgroundColor: "#18181b",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {effectiveArtworkBack ? (
                        <Image
                          src={effectiveArtworkBack}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <View style={{ alignItems: "center", justifyContent: "center", padding: 2 }}>
                          <Text style={{ fontSize: 4.2, color: "#94a3b8", textAlign: "center" }}>
                            1-TOMONLAMA
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 4.8, fontWeight: "bold", color: "#0f172a", marginTop: 2 }}>
                      {primarySkuArt && !orderData.artworkBack ? `Orqa (${primarySkuArt.sizeCode})` : "Orqa (Back)"}
                    </Text>
                    <Text style={{ fontSize: 3.6, color: "#64748b" }}>
                      Orqa tomon
                    </Text>
                  </View>
                </View>
              ) : (
                /* 2D Vector Cut & Bleed Schematic (Fallback when no artwork) */
                <View
                  style={{
                    width: 86,
                    height: 76,
                    borderWidth: 0.6,
                    borderColor: "#cbd5e1",
                    backgroundColor: "#f8fafc",
                    borderRadius: 2,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Svg viewBox="0 0 86 66" style={{ width: 82, height: 62 }}>
                    {/* Outer Bleed Box */}
                    <Rect
                      x={trimX - 3}
                      y={trimY - 3}
                      width={drawW + 6}
                      height={drawH + 6}
                      fill="#fef2f2"
                      stroke="#ef4444"
                      strokeWidth={0.7}
                      strokeDasharray="2,2"
                    />
                    {/* Trim Cut Box */}
                    <Rect
                      x={trimX}
                      y={trimY}
                      width={drawW}
                      height={drawH}
                      rx={orderData.cornerType?.toLowerCase().includes("round") ? 3 : 0}
                      fill="#ffffff"
                      stroke="#1d4ed8"
                      strokeWidth={1.1}
                    />
                    {/* Center Crosshair */}
                    <Line
                      x1={trimX + 4}
                      y1={trimY + drawH / 2}
                      x2={trimX + drawW - 4}
                      y2={trimY + drawH / 2}
                      stroke="#cbd5e1"
                      strokeWidth={0.5}
                      strokeDasharray="1.5,1.5"
                    />
                    <Line
                      x1={trimX + drawW / 2}
                      y1={trimY + 4}
                      x2={trimX + drawW / 2}
                      y2={trimY + drawH - 4}
                      stroke="#cbd5e1"
                      strokeWidth={0.5}
                      strokeDasharray="1.5,1.5"
                    />
                    {/* Drill Hole if present */}
                    {holeSize > 0 && holePos !== "none" && pdfHoles.map((ph, phIdx) => (
                      <Circle
                        key={phIdx}
                        cx={ph.cx}
                        cy={ph.cy}
                        r={2.5}
                        fill="#eff6ff"
                        stroke="#2563eb"
                        strokeWidth={0.9}
                      />
                    ))}
                  </Svg>
                  <Text style={{ fontSize: 5.5, fontWeight: "bold", color: "#334155" }}>
                    {width}×{height} {dimUnit} {holeSize > 0 && holePos !== "none" ? `• Ø${holeSize}mm` : ""}
                  </Text>
                </View>
              )}

              {/* Specs List */}
              <View style={{ flex: 1 }}>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.trimDimensions}:</Text>
                  <Text style={styles.kvVal}>
                    {width} × {height} {dimUnit} ({L.bleedMargin}: +{bleed}{dimUnit})
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.cornerCut}:</Text>
                  <Text style={styles.kvVal}>{orderData.cornerType || "Square"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.holeEyelet}:</Text>
                  <Text style={styles.kvVal}>
                    {holeSize > 0 && holePos !== "none"
                      ? `Ø${holeSize}mm • ${holePos} (${holeOffset}mm)`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.paperSubstrate}:</Text>
                  <Text style={styles.kvVal}>{orderData.paperStock || "—"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.laminationSpec}:</Text>
                  <Text style={styles.kvVal}>
                    {orderData.lamination && orderData.lamination !== "None"
                      ? `${orderData.lamination} (${(orderData.laminationSides || "1s").toUpperCase()}, ${
                          orderData.laminationMicron || 28
                        }μm)`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.surfaceCoating}:</Text>
                  <Text style={styles.kvVal}>
                    {orderData.coating || "—"}
                    {orderData.embellishment && orderData.embellishment !== "None"
                      ? ` • ${orderData.embellishment}`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Panel: Inks & Color Stations + Kashirovka / Flexo */}
          <View style={[styles.panel, { flex: 0.95 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.inksAndColors}</Text>
              <Text style={styles.panelHeaderBadge}>{orderData.colorsConfig || "4+0 (CMYK)"}</Text>
            </View>

            {/* Front & Back CMYK Channels */}
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>{L.frontSide}:</Text>
              <View style={styles.channelRow}>
                {(["c", "m", "y", "k"] as const).map((ch) => {
                  const active = frontColors[ch];
                  const bg =
                    ch === "c"
                      ? "#06b6d4"
                      : ch === "m"
                      ? "#ec4899"
                      : ch === "y"
                      ? "#eab308"
                      : "#0f172a";
                  return (
                    <Text
                      key={ch}
                      style={[
                        styles.channelPill,
                        {
                          backgroundColor: active ? bg : "#e2e8f0",
                          color: active ? "#ffffff" : "#94a3b8",
                        },
                      ]}
                    >
                      {ch.toUpperCase()}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>{L.backSide}:</Text>
              <View style={styles.channelRow}>
                {(["c", "m", "y", "k"] as const).map((ch) => {
                  const active = backColors[ch];
                  const bg =
                    ch === "c"
                      ? "#06b6d4"
                      : ch === "m"
                      ? "#ec4899"
                      : ch === "y"
                      ? "#eab308"
                      : "#0f172a";
                  return (
                    <Text
                      key={ch}
                      style={[
                        styles.channelPill,
                        {
                          backgroundColor: active ? bg : "#e2e8f0",
                          color: active ? "#ffffff" : "#94a3b8",
                        },
                      ]}
                    >
                      {ch.toUpperCase()}
                    </Text>
                  );
                })}
              </View>
            </View>

            {/* Spot / Pantone Swatches */}
            <View style={{ marginTop: 2, marginBottom: 3 }}>
              <Text style={styles.reqLabel}>{L.spotStations}:</Text>
              {spotColorItems.length > 0 ? (
                <View style={styles.spotWrap}>
                  {spotColorItems.map((sp) => (
                    <View key={sp.id} style={styles.spotChip}>
                      <View style={[styles.spotSwatch, { backgroundColor: sp.hex || "#fe5000" }]} />
                      <Text style={{ fontSize: 6.2, fontWeight: "bold", color: "#0f172a" }}>
                        {sp.name} ({sp.side.toUpperCase()})
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 6.5, color: "#64748b" }}>—</Text>
              )}
            </View>

            {/* Conditional Kashirovka or Flexo Technical Specs */}
            {kashirovkaMode !== "none" && (
              <View
                style={{
                  borderTopWidth: 0.6,
                  borderTopColor: "#cbd5e1",
                  paddingTop: 3,
                  marginTop: 2,
                }}
              >
                <Text style={[styles.reqLabel, { color: "#1d4ed8" }]}>
                  {L.kashirovkaTitle}: {kashirovkaMode.toUpperCase()} ({kashirovkaTotals.totalMountedGsm} g/m² • ~
                  {kashirovkaTotals.estimatedCaliperMm}mm)
                </Text>
                <Text style={{ fontSize: 6, color: "#334155", marginTop: 1 }}>
                  {orderData.kashirovkaStrategy === "split_half_sheet"
                    ? "1-CTP Work & Mount"
                    : "2-CTP Sheet-to-Sheet"}{" "}
                  • {L.kashirovkaGlue}: {orderData.kashirovkaGlueGsm ?? 25}g/m² • Pause:{" "}
                  {orderData.kashirovkaCuringHours ?? 12}h
                </Text>
                {kashirovkaLayers.map((ly, i) => (
                  <Text key={ly.id || i} style={{ fontSize: 5.8, color: "#475569", marginTop: 0.5 }}>
                    • L{i + 1}: {ly.paperStock} ({ly.grammage}g, {ly.colors})
                  </Text>
                ))}
              </View>
            )}

            {orderData.department === "Flexo" && (
              <View
                style={{
                  borderTopWidth: 0.6,
                  borderTopColor: "#cbd5e1",
                  paddingTop: 3,
                  marginTop: 2,
                }}
              >
                <Text style={[styles.reqLabel, { color: "#1d4ed8" }]}>{L.flexoTitle}</Text>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.flexoTeeth} / {L.flexoWebWidth}:</Text>
                  <Text style={styles.kvVal}>
                    {orderData.flexoCylinderTeeth || 100}T • {orderData.flexoWebWidth || 35}mm
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{L.flexoPlate} / {L.flexoGap}:</Text>
                  <Text style={styles.kvVal}>
                    {orderData.flexoPlateThickness || 1.7}mm • {orderData.flexoGapX ?? 2}×{orderData.flexoGapY ?? 2.5}mm
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 4. PRE-FLIGHT STAGE-GATES STRIP */}
        <View style={styles.gatesRow}>
          {[
            { title: L.gate1Title, sub: L.gate1Sub },
            { title: L.gate2Title, sub: L.gate2Sub },
            { title: L.gate3Title, sub: L.gate3Sub },
            { title: L.gate4Title, sub: L.gate4Sub },
          ].map((g, i) => (
            <View key={i} style={styles.gateCard}>
              <View>
                <Text style={styles.gateTitle}>{g.title}</Text>
                <Text style={styles.gateSub}>{g.sub}</Text>
              </View>
              <Text style={styles.gatePassBadge}>{L.pass}</Text>
            </View>
          ))}
        </View>

        {/* 5. SIDE-BY-SIDE: SIZE/SKU MATRIX & BOM RAW MATERIALS */}
        <View style={styles.twoColRow}>
          {/* Left: Size / Model Breakdown */}
          <View style={[styles.panel, { flex: 1 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.sizeBreakdown}</Text>
              <Text style={styles.panelHeaderBadge}>
                {orderData.sizes?.length || 1} SKU • {netQuantity.toLocaleString()} {orderData.unit || "pcs"}
              </Text>
            </View>
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { width: "28%" }]}>{L.colModel}</Text>
                <Text style={[styles.th, { width: "27%" }]}>{L.colSize}</Text>
                <Text style={[styles.th, { width: "27%", textAlign: "right" }]}>{L.colQty}</Text>
                <Text style={[styles.th, { width: "18%", textAlign: "right" }]}>{L.colShare}</Text>
              </View>
              {orderData.sizes && orderData.sizes.length > 0 ? (
                orderData.sizes.map((s, idx) => {
                  const parsed = parseModelAndSize(s);
                  const pct = netQuantity > 0 ? Math.round((s.quantity / netQuantity) * 100) : 0;
                  return (
                    <View key={s.id || idx} style={styles.tdRow}>
                      <Text style={[styles.td, { width: "28%", color: "#475569" }]}>
                        {parsed.model || "STD"}
                      </Text>
                      <Text style={[styles.tdBold, { width: "27%" }]}>{parsed.sizeCode || s.size}</Text>
                      <Text style={[styles.tdBold, { width: "27%", textAlign: "right" }]}>
                        {s.quantity.toLocaleString()}
                      </Text>
                      <Text style={[styles.td, { width: "18%", textAlign: "right", color: "#64748b" }]}>
                        {pct}%
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.tdRow}>
                  <Text style={[styles.td, { width: "28%" }]}>STD</Text>
                  <Text style={[styles.tdBold, { width: "27%" }]}>ALL</Text>
                  <Text style={[styles.tdBold, { width: "27%", textAlign: "right" }]}>
                    {netQuantity.toLocaleString()}
                  </Text>
                  <Text style={[styles.td, { width: "18%", textAlign: "right" }]}>100%</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: BOM Materials */}
          <View style={[styles.panel, { flex: 1.15 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.bomMaterials}</Text>
              <Text style={styles.panelHeaderBadge}>{orderData.recipe || "OFFSET_STD_V1"}</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { width: "46%" }]}>{L.colMaterial}</Text>
                <Text style={[styles.th, { width: "24%", textAlign: "right" }]}>{L.colReqQty}</Text>
                <Text style={[styles.th, { width: "30%", textAlign: "right" }]}>{L.colWarehouseStock}</Text>
              </View>
              {materials.map((m, idx) => {
                const isShort = m.req > m.stock;
                return (
                  <View key={idx} style={styles.tdRow}>
                    <Text style={[styles.tdBold, { width: "46%" }]}>{m.name}</Text>
                    <Text style={[styles.tdBold, { width: "24%", textAlign: "right" }]}>
                      {m.req.toLocaleString()} {m.unit}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        {
                          width: "30%",
                          textAlign: "right",
                          color: isShort ? "#dc2626" : "#047857",
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {m.stock.toLocaleString()} ({isShort ? L.stockShortage : L.stockOk})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* 6. TECHNOLOGICAL MANUFACTURING ROUTE */}
        <View style={[styles.panel, { marginBottom: 5 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelHeaderTitle}>{L.techRoute}</Text>
            <Text style={styles.panelHeaderBadge}>{operations.length} Steps</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { width: "9%" }]}>{L.colStep}</Text>
              <Text style={[styles.th, { width: "31%" }]}>{L.colOperation}</Text>
              <Text style={[styles.th, { width: "25%" }]}>{L.colMachine}</Text>
              <Text style={[styles.th, { width: "14%" }]}>{L.colOperator}</Text>
              <Text style={[styles.th, { width: "8%", textAlign: "right" }]}>{L.colDuration}</Text>
              <Text style={[styles.th, { width: "13%", textAlign: "center" }]}>{L.colSign}</Text>
            </View>
            {operations.map((op, idx) => (
              <View key={op.id || idx} style={styles.tdRow}>
                <Text style={[styles.tdBold, { width: "9%", color: "#475569" }]}>#{op.stepNumber}</Text>
                <Text style={[styles.tdBold, { width: "31%" }]}>{op.name}</Text>
                <Text style={[styles.td, { width: "25%" }]}>{op.machine}</Text>
                <Text style={[styles.td, { width: "14%", color: "#475569" }]}>{op.operator}</Text>
                <Text style={[styles.tdBold, { width: "8%", textAlign: "right" }]}>{op.duration}h</Text>
                <View style={{ width: "13%", paddingHorizontal: 4 }}>
                  <View
                    style={{
                      borderBottomWidth: 0.6,
                      borderBottomColor: "#94a3b8",
                      borderStyle: "dashed",
                      height: 8,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Shift Handover Notes inside route panel */}
          {shiftNotes.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.reqLabel}>{L.shiftNotesTitle}:</Text>
              <View style={styles.notesGrid}>
                {shiftNotes.slice(0, 2).map((n) => (
                  <View key={n.id} style={styles.noteBox}>
                    <Text style={styles.noteHeader}>
                      [{n.shift}] {n.author} ({n.time})
                    </Text>
                    <Text style={styles.noteText}>{n.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 7. 4-STAGE SHOP-FLOOR SIGN-OFF STAMPS */}
        <View style={styles.signoffSection}>
          <View style={styles.signoffRow}>
            {[
              { title: L.signPrepress, sub: L.signPrepressSub },
              { title: L.signPress, sub: L.signPressSub },
              { title: L.signFinish, sub: L.signFinishSub },
              { title: L.signQc, sub: L.signQcSub },
            ].map((b, i) => (
              <View key={i} style={styles.signoffBox}>
                <View>
                  <Text style={styles.signoffTitle}>{b.title}</Text>
                  <Text style={styles.signoffSub}>{b.sub}</Text>
                </View>
                <View style={styles.signoffLine} />
                <View style={styles.signoffFooter}>
                  <Text>{L.signLabel}</Text>
                  <Text>{L.dateLabel}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 8. FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {L.footerSystem} • DOC: {docNo}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${L.printDate}: ${new Date().toISOString().slice(0, 10)} • Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ─── PAGE 2: SKU ARTWORK PROOFS (If SKU Artworks exist) ─── */}
      {itemsWithArtwork.length > 0 && (
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.brandRow}>
                <Text style={styles.brandTitle}>PRINTGOO ERP</Text>
                <Text style={styles.badgeDark}>SKU ARTWORK PASPORTI (1:1 PROOF)</Text>
              </View>
              <Text style={styles.brandSubtitle}>
                Buyurtmachi: {orderData.customer || "—"} • Mahsulot: {orderData.product || "—"} • {width}×{height} {dimUnit} (+{bleed}{dimUnit} bleed)
              </Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.docMetaBox}>
                <Text style={styles.docNoText}>{docNo}</Text>
                <Text style={styles.docSubText}>
                  Jami {itemsWithArtwork.length} ta razmer • {new Date().toISOString().slice(0, 10)}
                </Text>
              </View>
            </View>
          </View>

          {/* Grid of SKU Cards */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {itemsWithArtwork.map((card, idx) => (
              <View
                key={card.id || idx}
                style={{
                  width: "48.5%",
                  borderWidth: 0.6,
                  borderColor: "#cbd5e1",
                  borderRadius: 2,
                  backgroundColor: "#ffffff",
                  marginBottom: 6,
                  overflow: "hidden",
                }}
              >
                {/* Card Header Bar */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#0f172a",
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 7, fontWeight: "bold" }}>
                    {`${card.model} • ${card.sizeCode}`.toUpperCase()}
                  </Text>
                  <Text style={{ color: "#93c5fd", fontSize: 6.2, fontWeight: "bold" }}>
                    {card.quantity > 0 ? `${card.quantity.toLocaleString()} pcs (${card.share}%)` : "NAMUNA"}
                  </Text>
                </View>

                {/* Proof Body (Side-by-side Front & Back) */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    alignItems: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    backgroundColor: "#f8fafc",
                  }}
                >
                  {/* Front */}
                  <View style={{ alignItems: "center", width: "46%" }}>
                    <View
                      style={{
                        width: 64,
                        height: 74,
                        borderWidth: 0.8,
                        borderColor: "#10b981",
                        borderRadius: orderData.cornerType?.toLowerCase().includes("round") ? 3 : 1,
                        overflow: "hidden",
                        backgroundColor: "#ffffff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {card.frontSrc ? (
                        <Image src={card.frontSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <Text style={{ fontSize: 4.8, color: "#94a3b8" }}>YUKLANMAGAN</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 5, fontWeight: "bold", color: "#0f172a", marginTop: 2 }}>
                      Oldi (Front)
                    </Text>
                    {card.frontName && (
                      <Text style={{ fontSize: 4.2, color: "#64748b" }}>{card.frontName}</Text>
                    )}
                  </View>

                  {/* Back */}
                  <View style={{ alignItems: "center", width: "46%" }}>
                    <View
                      style={{
                        width: 64,
                        height: 74,
                        borderWidth: 0.8,
                        borderColor: "#10b981",
                        borderRadius: orderData.cornerType?.toLowerCase().includes("round") ? 3 : 1,
                        overflow: "hidden",
                        backgroundColor: "#ffffff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {card.backSrc ? (
                        <Image src={card.backSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <View style={{ alignItems: "center", justifyContent: "center", padding: 4 }}>
                          <Text style={{ fontSize: 4.5, color: "#94a3b8", textAlign: "center" }}>
                            1-TOMONLAMA (OQ)
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 5, fontWeight: "bold", color: "#0f172a", marginTop: 2 }}>
                      Orqa (Back)
                    </Text>
                    {card.backName && (
                      <Text style={{ fontSize: 4.2, color: "#64748b" }}>{card.backName}</Text>
                    )}
                  </View>
                </View>

                {/* Card Footer Bar */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#f1f5f9",
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderTopWidth: 0.6,
                    borderTopColor: "#cbd5e1",
                  }}
                >
                  <Text style={{ fontSize: 5.5, color: "#475569" }}>
                    {width}×{height} {dimUnit} (+{bleed}{dimUnit}) • {orderData.cornerType || "Square"}
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#16a34a",
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      borderRadius: 2,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 4.8, fontWeight: "bold" }}>
                      1:1 PREPRESS OK
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              {L.footerSystem} • DOC: {docNo} • SKU ARTWORK SPECIFICATION
            </Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `${L.printDate}: ${new Date().toISOString().slice(0, 10)} • Page ${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      )}
    </Document>
  );
};
