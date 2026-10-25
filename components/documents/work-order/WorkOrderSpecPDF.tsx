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
      frontSrc: art?.frontArtworkUrl || art?.frontArtworkThumb,
      backSrc: art?.backArtworkUrl || art?.backArtworkThumb,
      frontName: art?.frontArtworkName,
      backName: art?.backArtworkName,
      hasArtwork: Boolean(art && (art.frontArtworkUrl || art.frontArtworkThumb || art.backArtworkUrl || art.backArtworkThumb)),
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
        frontSrc: a.frontArtworkUrl || a.frontArtworkThumb,
        backSrc: a.backArtworkUrl || a.backArtworkThumb,
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
      {/* ══════════════════════════════════════════════════════════════════════════
          PAGE 1: REQUISITES, KPIS, 3-CARD PHYSICAL PROOFS, COATINGS & SIGN-OFFS
          ══════════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* 1. TOP HEADER WITH ENLARGED LOGO & BARCODE */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image src="/printgoo_logo.png" style={{ width: 115, height: 28, objectFit: "contain" }} />
          </View>

          {/* 1D Center Barcode */}
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 110, height: 24, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
              <Svg viewBox="0 0 110 24" style={{ width: 105, height: 20 }}>
                {Array.from({ length: 32 }).map((_, i) => (
                  <Rect
                    key={i}
                    x={i * 3.3 + (i % 3 === 0 ? 0.8 : 0)}
                    y={0}
                    width={i % 4 === 0 ? 2.0 : i % 2 === 0 ? 1.4 : 0.8}
                    height={20}
                    fill="#000000"
                  />
                ))}
              </Svg>
            </View>
            <Text style={{ fontSize: 7, fontWeight: "bold", color: "#000000", marginTop: 1 }}>{docNo}</Text>
          </View>

          {/* Right Doc Meta & QR */}
          <View style={styles.headerRight}>
            <View style={styles.docMetaBox}>
              <Text style={styles.docNoText}>{docNo || "WOOF-26-0351"}</Text>
              <Text style={styles.docSubText}>{new Date().toISOString().slice(0, 10)}</Text>
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
                    fill="#000000"
                  />
                ))}
              </Svg>
            </View>
          </View>
        </View>

        {/* 2. CORE REQUISITES & STATUS/PRIORITY STRIP */}
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
            <Text style={styles.reqSub}>{L.recipe}: {orderData.recipe || "STD_V1"}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.status || "HOLATI"}</Text>
            <View style={{ backgroundColor: "#f1f5f9", borderWidth: 0.5, borderColor: "#cbd5e1", borderRadius: 2, paddingVertical: 1.5, paddingHorizontal: 4, alignSelf: "flex-start", marginTop: 1 }}>
              <Text style={{ fontSize: 6.5, fontWeight: "bold", color: "#0f172a" }}>
                {(orderData.status || "Active").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.reqSub}>{new Date().toISOString().slice(0, 10)}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.priority || "MUHIMLIGI"}</Text>
            <View style={{
              backgroundColor: orderData.priority === "Urgent" || orderData.priority === "High" ? "#fef2f2" : "#eff6ff",
              borderWidth: 0.5,
              borderColor: orderData.priority === "Urgent" || orderData.priority === "High" ? "#fca5a5" : "#bfdbfe",
              borderRadius: 2,
              paddingVertical: 1.5,
              paddingHorizontal: 4,
              alignSelf: "flex-start",
              marginTop: 1
            }}>
              <Text style={{
                fontSize: 6.5,
                fontWeight: "bold",
                color: orderData.priority === "Urgent" || orderData.priority === "High" ? "#dc2626" : "#1d4ed8"
              }}>
                {(orderData.priority || "NORMAL").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.reqSub}>{orderData.deadline || "—"}</Text>
          </View>
        </View>

        {/* KPI Strip */}
        <View style={styles.kpiStrip}>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.netRun}</Text>
            <Text style={styles.kpiValueBlue}>{netQuantity.toLocaleString()} {orderData.unit || "pcs"}</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.grossSheets}</Text>
            <Text style={styles.kpiValueDark}>{grossSheets.toLocaleString()} sht</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.impositionYield}</Text>
            <Text style={styles.kpiValueGreen}>{yieldPerSheet} pcs / sht ({cols}×{rows})</Text>
          </View>
          <View style={styles.reqCol}>
            <Text style={styles.reqLabel}>{L.scheduleWindow}</Text>
            <Text style={styles.kpiValueDark}>{orderData.startDate || "—"} → {orderData.deadline || "—"}</Text>
          </View>
        </View>

        {/* 3. PHYSICAL GEOMETRY (3 CARDS: FRONT, BACK, DIELINE CAD) */}
        <View style={[styles.panel, { marginBottom: 6 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelHeaderTitle}>{L.physicalSpecs}</Text>
            <Text style={styles.panelHeaderBadge}>{width}×{height} {dimUnit} (+{bleed}{dimUnit}) • {orderData.shapeType || "STANDARD"}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 5 }}>
            {/* Card 1: Front */}
            <View style={{ flex: 1, borderWidth: 0.6, borderColor: "#cbd5e1", borderRadius: 2, backgroundColor: "#f8fafc", overflow: "hidden" }}>
              <View style={{ backgroundColor: "#0f172a", paddingHorizontal: 4, paddingVertical: 2, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#ffffff", fontSize: 5.8, fontWeight: "bold" }}>OLDI / FRONT</Text>
                <Text style={{ color: "#93c5fd", fontSize: 5.2, fontWeight: "bold" }}>1:1 PREPRESS</Text>
              </View>
              <View style={{ height: 62, alignItems: "center", justifyContent: "center", padding: 2 }}>
                {effectiveArtworkFront ? (
                  <Image src={effectiveArtworkFront} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <Text style={{ fontSize: 5.5, color: "#94a3b8" }}>FRONT ARTWORK</Text>
                )}
              </View>
              <Text style={{ fontSize: 4.8, fontWeight: "bold", color: "#475569", textAlign: "center", paddingBottom: 2 }}>OLD YUZI • {width}×{height}{dimUnit}</Text>
            </View>

            {/* Card 2: Back */}
            <View style={{ flex: 1, borderWidth: 0.6, borderColor: "#cbd5e1", borderRadius: 2, backgroundColor: "#f8fafc", overflow: "hidden" }}>
              <View style={{ backgroundColor: "#0f172a", paddingHorizontal: 4, paddingVertical: 2, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#ffffff", fontSize: 5.8, fontWeight: "bold" }}>ORQA / BACK</Text>
                <Text style={{ color: effectiveArtworkBack ? "#93c5fd" : "#cbd5e1", fontSize: 5.2, fontWeight: "bold" }}>{effectiveArtworkBack ? "2-SIDED" : "1-SIDED"}</Text>
              </View>
              <View style={{ height: 62, alignItems: "center", justifyContent: "center", padding: 2 }}>
                {effectiveArtworkBack ? (
                  <Image src={effectiveArtworkBack} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <Text style={{ fontSize: 5.0, color: "#94a3b8" }}>1-TOMONLI (ORQASI OQ)</Text>
                )}
              </View>
              <Text style={{ fontSize: 4.8, fontWeight: "bold", color: "#475569", textAlign: "center", paddingBottom: 2 }}>
                {effectiveArtworkBack ? `ORQA YUZI • ${width}×${height}${dimUnit}` : "ORQA BOSMA MAVJUD EMAS"}
              </Text>
            </View>

            {/* Card 3: Dieline CAD */}
            <View style={{ flex: 1, borderWidth: 0.6, borderColor: "#cbd5e1", borderRadius: 2, backgroundColor: "#f8fafc", overflow: "hidden" }}>
              <View style={{ backgroundColor: "#0f172a", paddingHorizontal: 4, paddingVertical: 2, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#ffffff", fontSize: 5.8, fontWeight: "bold" }}>DIELINE / SHTANS</Text>
                <Text style={{ color: "#93c5fd", fontSize: 5.2, fontWeight: "bold" }}>CAD 1:1</Text>
              </View>
              <View style={{ height: 62, alignItems: "center", justifyContent: "center", padding: 2 }}>
                <Svg viewBox="0 0 86 64" style={{ width: 78, height: 56 }}>
                  <Rect x={trimX - 3} y={trimY - 3} width={drawW + 6} height={drawH + 6} fill="#fef2f2" stroke="#ef4444" strokeWidth={0.7} strokeDasharray="2,2" />
                  <Rect x={trimX} y={trimY} width={drawW} height={drawH} rx={orderData.cornerType?.toLowerCase().includes("round") ? 3 : 0} fill="#ffffff" stroke="#1d4ed8" strokeWidth={1.1} />
                  <Line x1={trimX + 3} y1={trimY + drawH / 2} x2={trimX + drawW - 3} y2={trimY + drawH / 2} stroke="#d946ef" strokeWidth={0.7} strokeDasharray="2.5,1.5" />
                  {holeSize > 0 && holePos !== "none" && (
                    <Circle cx={trimX + drawW / 2} cy={trimY + 5} r={2.2} fill="#eff6ff" stroke="#2563eb" strokeWidth={0.9} />
                  )}
                </Svg>
              </View>
              <Text style={{ fontSize: 4.8, fontWeight: "bold", color: "#475569", textAlign: "center", paddingBottom: 2 }}>
                SHTAMP: {orderData.selectedToolingName || "Standart pichoq"} (+{bleed}mm)
              </Text>
            </View>
          </View>

          {/* Specs Bar */}
          <View style={{ flexDirection: "row", backgroundColor: "#f8fafc", borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 2, padding: 3, gap: 6 }}>
            <View style={{ flex: 1 }}><Text style={styles.reqLabel}>{L.trimDimensions}</Text><Text style={styles.tdBold}>{width} × {height} {dimUnit} (+{bleed}{dimUnit})</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.reqLabel}>{L.cornerCut}</Text><Text style={styles.tdBold}>{orderData.cornerType || "Square"}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.reqLabel}>{L.holeEyelet}</Text><Text style={styles.tdBold}>{holeSize > 0 && holePos !== "none" ? `Ø${holeSize}mm • ${holePos}` : "—"}</Text></View>
            <View style={{ flex: 1.5 }}><Text style={styles.reqLabel}>{L.paperSubstrate}</Text><Text style={styles.tdBold}>{orderData.paperStock || "—"}</Text></View>
          </View>
        </View>

        {/* 4. TECHNICAL COATINGS, LAK & KASHIROVKA SPECIFICATION */}
        <View style={[styles.panel, { marginBottom: 6 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelHeaderTitle}>TEXNOLOGIK QOPLAMALAR, LAK VA KASHIROVKA SPECIFIKATSIYASI</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {/* Left: Lamination, Varnish, Inks */}
            <View style={{ flex: 1, gap: 4 }}>
              {/* Lamination */}
              <View style={{ borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 2, padding: 3, backgroundColor: "#f8fafc" }}>
                <Text style={{ fontSize: 6, fontWeight: "bold", color: "#0f172a" }}>LAMINATSIYA (LAMINATION FILM)</Text>
                <Text style={{ fontSize: 6.2, fontWeight: "bold", color: "#1d4ed8", marginTop: 1 }}>{orderData.lamination || "None"}</Text>
                <Text style={{ fontSize: 5.5, color: "#475569" }}>
                  Tomoni: {(orderData.laminationSides || "1s").toUpperCase()} • Qalinligi: {orderData.laminationMicron || 28} μm • BOPP Thermal
                </Text>
              </View>

              {/* Varnish / Coating */}
              <View style={{ borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 2, padding: 3, backgroundColor: "#f8fafc" }}>
                <Text style={{ fontSize: 6, fontWeight: "bold", color: "#0f172a" }}>LAK VA PARDOZLASH (COATING & EMBELLISHMENT)</Text>
                <Text style={{ fontSize: 6.2, fontWeight: "bold", color: "#0f172a", marginTop: 1 }}>{orderData.coating || "—"}</Text>
                <Text style={{ fontSize: 5.5, color: "#475569" }}>Maxsus effekt: {orderData.embellishment || "None"}</Text>
              </View>

              {/* Inks & CMYK */}
              <View style={{ borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 2, padding: 3, backgroundColor: "#f8fafc" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 6, fontWeight: "bold", color: "#0f172a" }}>BO'YOQLAR (CMYK + SPOT)</Text>
                  <Text style={{ fontSize: 5.5, fontWeight: "bold", color: "#1d4ed8" }}>{orderData.colorsConfig || "4+0"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Text style={{ fontSize: 5.5, color: "#475569" }}>Old:</Text>
                  {(["c", "m", "y", "k"] as const).map(ch => (
                    <Text key={ch} style={[styles.channelPill, { backgroundColor: frontColors[ch] ? (ch === "c" ? "#06b6d4" : ch === "m" ? "#ec4899" : ch === "y" ? "#eab308" : "#0f172a") : "#e2e8f0", color: frontColors[ch] ? "#fff" : "#94a3b8" }]}>
                      {ch.toUpperCase()}
                    </Text>
                  ))}
                  <Text style={{ fontSize: 5.5, color: "#475569", marginLeft: 4 }}>Orqa:</Text>
                  {(["c", "m", "y", "k"] as const).map(ch => (
                    <Text key={ch} style={[styles.channelPill, { backgroundColor: backColors[ch] ? (ch === "c" ? "#06b6d4" : ch === "m" ? "#ec4899" : ch === "y" ? "#eab308" : "#0f172a") : "#e2e8f0", color: backColors[ch] ? "#fff" : "#94a3b8" }]}>
                      {ch.toUpperCase()}
                    </Text>
                  ))}
                </View>
                {spotColorItems.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {spotColorItems.map(sp => (
                      <View key={sp.id} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                        <View style={{ width: 5, height: 5, backgroundColor: sp.hex || "#fe5000", borderRadius: 1 }} />
                        <Text style={{ fontSize: 5.2, fontWeight: "bold", color: "#0f172a" }}>{sp.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Right: Kashirovka / Substrate */}
            <View style={{ flex: 1.1, borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 2, padding: 4, backgroundColor: "#f8fafc" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={{ fontSize: 6.2, fontWeight: "bold", color: "#0f172a" }}>KASHIROVKA VA QATLAMLAR MATRITSASI</Text>
                <Text style={{ fontSize: 5.8, fontWeight: "bold", color: "#1d4ed8" }}>{kashirovkaMode.toUpperCase()}</Text>
              </View>
              {kashirovkaMode !== "none" ? (
                <View>
                  <Text style={{ fontSize: 5.5, color: "#64748b" }}>
                    Yelim: {orderData.kashirovkaGlueGsm || 25} g/m² • Quritish: {orderData.kashirovkaCuringHours || 12}h • Priladka: {orderData.kashirovkaMakeReadySheets || 50} sht
                  </Text>
                  <View style={{ marginTop: 2, borderWidth: 0.5, borderColor: "#cbd5e1", borderRadius: 1.5, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", backgroundColor: "#e2e8f0", padding: 2 }}>
                      <Text style={{ width: "35%", fontSize: 5.2, fontWeight: "bold" }}>QATLAM (ROLE)</Text>
                      <Text style={{ width: "45%", fontSize: 5.2, fontWeight: "bold" }}>QOG'OZ MARKASI</Text>
                      <Text style={{ width: "20%", fontSize: 5.2, fontWeight: "bold", textAlign: "right" }}>GSM</Text>
                    </View>
                    {kashirovkaLayers.map((ly, idx) => (
                      <View key={idx} style={{ flexDirection: "row", padding: 2, borderTopWidth: 0.3, borderTopColor: "#e2e8f0" }}>
                        <Text style={{ width: "35%", fontSize: 5.5, fontWeight: "bold", color: "#0f172a" }}>{ly.label}</Text>
                        <Text style={{ width: "45%", fontSize: 5.2, color: "#475569" }}>{ly.paperStock}</Text>
                        <Text style={{ width: "20%", fontSize: 5.2, fontWeight: "bold", textAlign: "right" }}>{ly.grammage}g</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ marginTop: 3, backgroundColor: "#eff6ff", padding: 3, borderRadius: 2 }}>
                    <Text style={{ fontSize: 6, fontWeight: "bold", color: "#1d4ed8" }}>
                      Jami qalinlik: ~{kashirovkaTotals.estimatedCaliperMm} mm • Jami zichlik: {kashirovkaTotals.totalMountedGsm} g/m²
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 6.5, fontWeight: "bold", color: "#0f172a" }}>YAGONA ASOSIY QOG'OZ</Text>
                  <Text style={{ fontSize: 6, color: "#475569" }}>Marka: {orderData.paperStock || "Coated Cardboard 300g/m²"}</Text>
                  <Text style={{ fontSize: 5.5, color: "#64748b" }}>Bichim listi: {orderData.pressSheetW || 700} × {orderData.pressSheetH || 1000} mm</Text>
                  <Text style={{ fontSize: 5.5, color: "#64748b" }}>Tolalar: Bo'ylama (Long Grain ||) • Namlik: 50-55% RH</Text>
                  <View style={{ marginTop: 2, backgroundColor: "#f1f5f9", padding: 2, borderRadius: 1.5 }}>
                    <Text style={{ fontSize: 5.5, color: "#0f172a", fontWeight: "bold" }}>Standart monip qog'oz (kashirovka talab etilmaydi)</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 5. PRE-FLIGHT STAGE-GATES */}
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

        {/* 6. TECHNOLOGICAL MANUFACTURING ROUTE (ALL OPERATIONS) */}
        <View style={[styles.panel, { marginBottom: 6 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelHeaderTitle}>{L.techRoute}</Text>
            <Text style={styles.panelHeaderBadge}>{operations.length} BOSQICHLAR</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { width: "7%" }]}>№</Text>
              <Text style={[styles.th, { width: "35%" }]}>{L.colOperation}</Text>
              <Text style={[styles.th, { width: "23%" }]}>{L.colMachine}</Text>
              <Text style={[styles.th, { width: "15%" }]}>OPERATOR</Text>
              <Text style={[styles.th, { width: "7%", textAlign: "right" }]}>VAQT</Text>
              <Text style={[styles.th, { width: "8%", textAlign: "center" }]}>HOLAT</Text>
              <Text style={[styles.th, { width: "10%", textAlign: "center" }]}>IMZO</Text>
            </View>
            {operations.map((op, idx) => (
              <View key={op.id || idx} style={[styles.tdRow, { backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }]}>
                <Text style={[styles.tdBold, { width: "7%", color: "#475569" }]}>#{op.stepNumber}</Text>
                <Text style={[styles.tdBold, { width: "35%" }]}>{op.name}</Text>
                <Text style={[styles.td, { width: "23%", color: "#334155" }]}>{op.machine}</Text>
                <Text style={[styles.td, { width: "15%", color: "#475569" }]}>{op.operator}</Text>
                <Text style={[styles.tdBold, { width: "7%", textAlign: "right" }]}>{op.duration}h</Text>
                <View style={{ width: "8%", alignItems: "center" }}>
                  <Text style={{
                    fontSize: 4.8,
                    fontWeight: "bold",
                    paddingVertical: 1,
                    paddingHorizontal: 3,
                    borderRadius: 1.5,
                    backgroundColor: op.status === "Finished" ? "#dcfce7" : op.status === "In Progress" ? "#fef9c3" : "#f1f5f9",
                    color: op.status === "Finished" ? "#15803d" : op.status === "In Progress" ? "#a16207" : "#475569",
                  }}>
                    {op.status?.toUpperCase() || "QUEUED"}
                  </Text>
                </View>
                <View style={{ width: "10%", paddingHorizontal: 3 }}>
                  <View style={{ borderBottomWidth: 0.6, borderBottomColor: "#94a3b8", borderStyle: "dashed", height: 7 }} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 7. PAGE 1 FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{L.footerSystem} • DOC: {docNo} • MAXSULOT PASPORTI</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${L.printDate}: ${new Date().toISOString().slice(0, 10)} • Sahifa ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════════
          PAGE 2: FULL TECH ROUTE, SHIFT NOTES, BOM MATERIALS & SKU PREPRESS GALLERY
          ══════════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* Unified Header Page 2 */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image src="/printgoo_logo.png" style={{ width: 115, height: 28, objectFit: "contain" }} />
          </View>

          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 110, height: 24, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
              <Svg viewBox="0 0 110 24" style={{ width: 105, height: 20 }}>
                {Array.from({ length: 32 }).map((_, i) => (
                  <Rect
                    key={i}
                    x={i * 3.3 + (i % 3 === 0 ? 0.8 : 0)}
                    y={0}
                    width={i % 4 === 0 ? 2.0 : i % 2 === 0 ? 1.4 : 0.8}
                    height={20}
                    fill="#000000"
                  />
                ))}
              </Svg>
            </View>
            <Text style={{ fontSize: 7, fontWeight: "bold", color: "#000000", marginTop: 1 }}>{docNo}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.docMetaBox}>
              <Text style={styles.docNoText}>{docNo || "WOOF-26-0351"}</Text>
              <Text style={styles.docSubText}>{new Date().toISOString().slice(0, 10)}</Text>
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
                    fill="#000000"
                  />
                ))}
              </Svg>
            </View>
          </View>
        </View>

        {/* Shift Handover Notes */}
        {shiftNotes.length > 0 && (
          <View style={[styles.panel, { marginBottom: 6 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.shiftNotesTitle}</Text>
            </View>
            <View style={[styles.notesGrid, { padding: 4 }]}>
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

        {/* 9. SIDE-BY-SIDE: SIZE MATRIX & BOM MATERIALS */}
        <View style={styles.twoColRow}>
          {/* Left: Size Matrix */}
          <View style={[styles.panel, { flex: 1 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelHeaderTitle}>{L.sizeBreakdown}</Text>
              <Text style={styles.panelHeaderBadge}>{orderData.sizes?.length || 1} SKU</Text>
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
                      <Text style={[styles.td, { width: "28%", color: "#475569" }]}>{parsed.model || "STD"}</Text>
                      <Text style={[styles.tdBold, { width: "27%" }]}>{parsed.sizeCode || s.size}</Text>
                      <Text style={[styles.tdBold, { width: "27%", textAlign: "right" }]}>{s.quantity.toLocaleString()}</Text>
                      <Text style={[styles.td, { width: "18%", textAlign: "right", color: "#64748b" }]}>{pct}%</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.tdRow}>
                  <Text style={[styles.td, { width: "28%" }]}>STD</Text>
                  <Text style={[styles.tdBold, { width: "27%" }]}>ALL</Text>
                  <Text style={[styles.tdBold, { width: "27%", textAlign: "right" }]}>{netQuantity.toLocaleString()}</Text>
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
                    <Text style={[styles.tdBold, { width: "24%", textAlign: "right" }]}>{m.req.toLocaleString()} {m.unit}</Text>
                    <Text style={[styles.td, { width: "30%", textAlign: "right", color: isShort ? "#dc2626" : "#047857", fontWeight: "bold" }]}>
                      {m.stock.toLocaleString()} ({isShort ? L.stockShortage : L.stockOk})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* 10. SKU ARTWORK PREPRESS GALLERY */}
        <View style={[styles.panel, { flex: 1 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelHeaderTitle}>SKU ARTWORK PASPORTI (1:1 PREPRESS PROOFLAR)</Text>
            <Text style={styles.panelHeaderBadge}>{itemsWithArtwork.length || normalizedSkuCards.length} SKU</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(itemsWithArtwork.length > 0 ? itemsWithArtwork : normalizedSkuCards).map((card, idx) => {
              const cardWidth =
                (itemsWithArtwork.length > 0 ? itemsWithArtwork.length : normalizedSkuCards.length) <= 4
                  ? `${Math.floor((100 - ((itemsWithArtwork.length || 1) - 1) * 2) / (itemsWithArtwork.length || 1))}%`
                  : "31%";
              return (
                <View key={card.id || idx} style={{ width: cardWidth, borderWidth: 0.5, borderColor: "#cbd5e1", borderRadius: 2, overflow: "hidden", backgroundColor: "#ffffff" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#0f172a", paddingHorizontal: 4, paddingVertical: 2 }}>
                    <Text style={{ color: "#ffffff", fontSize: 5.8, fontWeight: "bold" }}>{`${card.model} • ${card.sizeCode}`.toUpperCase()}</Text>
                    <Text style={{ color: "#93c5fd", fontSize: 5.2, fontWeight: "bold" }}>
                      {card.quantity > 0 ? `${card.quantity.toLocaleString()} pcs` : "NAMUNA"}
                    </Text>
                  </View>
                  <View style={{ height: 60, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", padding: 3 }}>
                    {card.frontSrc ? (
                      <Image src={card.frontSrc} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <Text style={{ fontSize: 6, color: "#94a3b8" }}>1:1 PROOF</Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: "#f8fafc", borderTopWidth: 0.4, borderTopColor: "#e2e8f0", paddingVertical: 2, alignItems: "center" }}>
                    <Text style={{ color: "#047857", fontSize: 5.0, fontWeight: "bold" }}>1:1 PREPRESS OK</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 11. PAGE 2 FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{L.footerSystem} • DOC: {docNo} • ISHLAB CHIQARISH MARSHRUTI</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${L.printDate}: ${new Date().toISOString().slice(0, 10)} • Sahifa ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
