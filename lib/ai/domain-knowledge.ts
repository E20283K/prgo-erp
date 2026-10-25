/**
 * PrintGoo ERP — Printing Industry Domain Knowledge & Expert Playbook
 * 
 * Encodes enterprise printing rules, document numbering standards, 1C accumulation register
 * logic, technological calculation formulas (Offset & Flexo), and multilingual terminology.
 */

export interface PrintingCalculationInput {
  technology: "offset" | "flexo" | "digital";
  quantity: number;
  productFormatWidthMm?: number;
  productFormatHeightMm?: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  upsCount?: number;
  colorsFront?: number;
  colorsBack?: number;
  paperGsm?: number;
  paperCostPerKgUsd?: number;
  plateCostUsd?: number;
  varnish?: boolean;
  lamination?: "none" | "matte_1s" | "gloss_1s" | "matte_2s" | "gloss_2s";
  dieCutting?: boolean;
  // Flexo specific
  cylinderTeeth?: number;
  webWidthMm?: number;
  labelsAcross?: number;
}

export interface PrintingCalculationResult {
  technology: "offset" | "flexo" | "digital";
  orderQuantity: number;
  netUnits: number;
  makeReadyWaste: number;
  runningWaste: number;
  totalGrossUnits: number;
  unitType: "sheets" | "meters";
  platesCount: number;
  estimatedPaperWeightKg?: number;
  costBreakdown: {
    paperCostUsd: number;
    platesCostUsd: number;
    printRunCostUsd: number;
    finishingCostUsd: number;
    totalEstimatedUsd: number;
    unitCostUsd: number;
  };
  explanation: string;
}

export const PRINTGOO_DOCUMENT_PREFIXES: Record<string, { label: string; module: string; subModule: string; tabType: string }> = {
  WOOF: { label: "Ofset ishlab chiqarish buyrug'i", module: "production", subModule: "queue", tabType: "work-order" },
  WOFL: { label: "Fleksografiya ishlab chiqarish buyrug'i", module: "production", subModule: "queue", tabType: "work-order" },
  WODG: { label: "Raqamli bosma ishlab chiqarish buyrug'i", module: "production", subModule: "queue", tabType: "work-order" },
  SPEC: { label: "Mahsulot texnologik spetsifikatsiyasi / BOM", module: "production", subModule: "specifications", tabType: "product-spec" },
  RCV: { label: "Omborga kirim orderi (M-4)", module: "warehouse", subModule: "receipts", tabType: "warehouse-receipt" },
  SHP: { label: "Ombordan chiqim orderi (M-11 / Nakladnaya)", module: "warehouse", subModule: "shipments", tabType: "warehouse-shipment" },
  ACT: { label: "Bajarilgan ishlar topshirish dalolatnomasi / Schet-faktura", module: "finance", subModule: "delivery-acts", tabType: "delivery-act" },
  INV: { label: "To'lov uchun hisobvaraq (Invoys)", module: "finance", subModule: "invoices", tabType: "registry" },
  TRF: { label: "Ishlab chiqarish operatsiyasi tarifi", module: "settings", subModule: "tariffs", tabType: "tariff-detail" },
};

/**
 * Ofset va Flekso bosma hisoblash motori
 */
export function calculatePrintingTechnology(input: PrintingCalculationInput): PrintingCalculationResult {
  const {
    technology = "offset",
    quantity = 1000,
    productFormatWidthMm = 210,
    productFormatHeightMm = 297,
    sheetWidthMm = 700,
    sheetHeightMm = 1000,
    colorsFront = 4,
    colorsBack = 0,
    paperGsm = 150,
    paperCostPerKgUsd = 1.6,
    plateCostUsd = 12.5,
    varnish = false,
    lamination = "none",
    dieCutting = false,
    cylinderTeeth = 96,
    labelsAcross = 3,
  } = input;

  if (technology === "flexo") {
    // Repeat length: 1 tooth = 1/8 inch = 3.175 mm
    const repeatMm = cylinderTeeth * 3.175;
    const labelsAcrossWeb = Math.max(1, labelsAcross);
    const repeatsNeeded = Math.ceil(quantity / labelsAcrossWeb);
    const netMeters = Math.ceil((repeatsNeeded * repeatMm) / 1000);

    const colorsCount = (colorsFront || 4) + (varnish ? 1 : 0);
    // Standard flexo make-ready waste: 60 linear meters per color station
    const makeReadyWaste = colorsCount * 60;
    // Running waste: 2.5%
    const runningWaste = Math.ceil(netMeters * 0.025);
    const totalGrossMeters = netMeters + makeReadyWaste + runningWaste;

    const paperCostUsd = Math.round(totalGrossMeters * 0.18 * 100) / 100;
    const platesCostUsd = colorsCount * 45; // photopolymer plate
    const printRunCostUsd = Math.round(totalGrossMeters * 0.08 * 100) / 100;
    const finishingCostUsd = dieCutting ? Math.round(totalGrossMeters * 0.04 * 100) / 100 : 0;
    const totalEstimatedUsd = Math.round((paperCostUsd + platesCostUsd + printRunCostUsd + finishingCostUsd) * 100) / 100;
    const unitCostUsd = quantity > 0 ? Math.round((totalEstimatedUsd / quantity) * 10000) / 10000 : 0;

    return {
      technology: "flexo",
      orderQuantity: quantity,
      netUnits: netMeters,
      makeReadyWaste,
      runningWaste,
      totalGrossUnits: totalGrossMeters,
      unitType: "meters",
      platesCount: colorsCount,
      costBreakdown: {
        paperCostUsd,
        platesCostUsd,
        printRunCostUsd,
        finishingCostUsd,
        totalEstimatedUsd,
        unitCostUsd,
      },
      explanation: `Fleksografiya hisobi: ${quantity} dona etiketka, eniga ${labelsAcrossWeb} ta. Takrorlanish (repeat) = ${cylinderTeeth}Z (${Math.round(repeatMm)} mm). Netto = ${netMeters} metr, priladka = ${makeReadyWaste} m (${colorsCount} ta seksiyaga 60 m dan), tiraj isrofi = ${runningWaste} m (2.5%). Jami material = ${totalGrossMeters} metr.`,
    };
  }

  // Ofset hisobi
  let ups = input.upsCount;
  if (!ups || ups < 1) {
    const fit1 = Math.floor(sheetWidthMm / (productFormatWidthMm + 4)) * Math.floor(sheetHeightMm / (productFormatHeightMm + 4));
    const fit2 = Math.floor(sheetWidthMm / (productFormatHeightMm + 4)) * Math.floor(sheetHeightMm / (productFormatWidthMm + 4));
    ups = Math.max(1, Math.max(fit1, fit2));
  }

  const netSheets = Math.ceil(quantity / ups);
  const totalColors = (colorsFront || 4) + (colorsBack || 0) + (varnish ? 1 : 0);
  const platesCount = Math.max(1, totalColors);

  // Offset standard make-ready: 50 sheets per plate
  const makeReadyWaste = platesCount * 50;
  // Offset running waste: 2.0%
  const runningWaste = Math.ceil(netSheets * 0.02);
  const totalGrossSheets = netSheets + makeReadyWaste + runningWaste;

  // Paper weight calculation: Area (m2) * gsm * sheets / 1000
  const sheetAreaM2 = (sheetWidthMm * sheetHeightMm) / 1_000_000;
  const paperWeightKg = Math.round(((sheetAreaM2 * paperGsm * totalGrossSheets) / 1000) * 10) / 10;
  const paperCostUsd = Math.round(paperWeightKg * paperCostPerKgUsd * 100) / 100;
  const platesCostUsd = platesCount * plateCostUsd;
  const printRunCostUsd = Math.round(((totalGrossSheets / 1000) * 18.0) * 100) / 100; // $18/1k impressions

  let finishingCostUsd = 0;
  if (lamination !== "none") {
    const lamSides = lamination.includes("2s") ? 2 : 1;
    finishingCostUsd += Math.round(totalGrossSheets * sheetAreaM2 * 0.12 * lamSides * 100) / 100;
  }
  if (dieCutting) {
    finishingCostUsd += Math.round(30 + (totalGrossSheets / 1000) * 8.0 * 100) / 100;
  }

  const totalEstimatedUsd = Math.round((paperCostUsd + platesCostUsd + printRunCostUsd + finishingCostUsd) * 100) / 100;
  const unitCostUsd = quantity > 0 ? Math.round((totalEstimatedUsd / quantity) * 10000) / 10000 : 0;

  return {
    technology: "offset",
    orderQuantity: quantity,
    netUnits: netSheets,
    makeReadyWaste,
    runningWaste,
    totalGrossUnits: totalGrossSheets,
    unitType: "sheets",
    platesCount,
    estimatedPaperWeightKg: paperWeightKg,
    costBreakdown: {
      paperCostUsd,
      platesCostUsd,
      printRunCostUsd,
      finishingCostUsd,
      totalEstimatedUsd,
      unitCostUsd,
    },
    explanation: `Varaqli ofset hisobi: ${quantity} dona mahsulot, varaqda ${ups} ta joylashuv. Netto bosma = ${netSheets} varaq. CTP plastinalar = ${platesCount} dona (${colorsFront}+${colorsBack}${varnish ? "+lak" : ""}). Priladka isrofi = ${makeReadyWaste} varaq, tiraj isrofi = ${runningWaste} varaq (2.0%). Jami brutto = ${totalGrossSheets} varaq (${paperWeightKg} kg, ${paperGsm} g/m²).`,
  };
}

/**
 * PrintGoo ERP System Prompt & Core Playbook
 */
export const PRINTGOO_SYSTEM_PROMPT = `
Siz — PrintGoo ERP tizimining professional In-App AI Yordamchisi (Industrial Printing & Enterprise Copilot).
Sizning vazifangiz — matbaa va qadoqlash korxonasi xodimlariga (dispetcherlar, texnologlar, ombor mudirlari, hisobchilar va sotuvchilarga) real vaqtda operativ tahlil berish, buyurtmalar, qoldiqlar, stanoklar va moliyaviy registrlarni tekshirish hamda hujjatlarni 1-bosishda ochish yoki qoralama shakllantirishda ko'maklashish.

QAT'IY ANTI-SLOP VA DISPIRATSIYA STANDARTLARI:
1. FOYDALANUVCHI INTERFEYSIDA EMOJILAR TAQIQLANGAN: Javoblarda va tavsiyalarda emojilardan (📦, ⚠️, 🖨️, 💵, ✅, 🚀 kabi) MUTLAQO FOYDALANMANG. Professional 1C:Enterprise / Linear / SAP B1 sanoat uslubiga amal qiling.
2. SUHBAT VA PROZA BO'LMASIN: Ortiqcha kirish so'zlari ("Assalomu alaykum, men sizga yordam berishdan mamnunman" yoki "Umid qilamanki bu sizga yordam beradi") yozmang. Darhol lo'nda, aniq, faktik ma'lumotni strukturalangan ko'rinishda bering.
3. SANALAR VA RAQAMLAR: Monospace / aniq raqamlar bilan yozing (masalan, 5,000 dona, $14,850.00 USD, 42 varaq).
4. HUJJAT STANDARTLARI:
   - WOOF-: Ofset buyurtmalari (varaqli ofset, kitob, katalog, quti)
   - WOFL-: Flekso buyurtmalari (rulonli etiketka, plyonka)
   - WODG-: Raqamli bosma (kichik tirajlar)
   - SPEC-: Texnologik karta / Master retsept / BOM
   - RCV-: Omborga kirim orderi (M-4)
   - SHP-: Ombordan chiqim / yuklash (M-11 / Nakladnaya)
   - ACT-: Schet-faktura va topshirish dalolatnomasi
5. 1C REGISTRLAR MANTIG'I:
   - Ombor erkin qoldig'i (Free Stock) = Mavjud fizik qoldiq (Total Stock) - Buyurtmalarga band qilingan qoldiq (Reserved).
   - Agar erkin qoldiq minimal chegara (safety reorder point) dan past bo'lsa, xomashyo yetishmovchiligi (Critical Shortage) deb hisoblanadi.
   - Mijoz qarzdorligi (Client Settlement) = Berilgan yuklar (Debit) - To'langan mablag'lar (Credit).
6. TILLAR: Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering (O'zbekcha / Русский / English / Türkçe). Default til: O'zbekcha.
7. STRUKTURALANGAN HUJJAT KARTOCHKASI (ENTITY CARD FORMATI):
   Agar muayyan buyurtma yoki hujjat so'ralsa, uni doimo quyidagi ixcham kalit-qiymat kartochka formatida taqdim eting:
   **[Hujjat kodi] buyurtma kartochkasi ma'lumotlari:**
   • **Hujjat raqami**: [kod]
   • **Mijoz**: [mijoz nomi]
   • **Mahsulot**: [mahsulot nomi]
   • **Tiraj**: [soni] [birligi]
   • **Bo'lim**: [bo'lim]
   • **Uskuna**: [dastgoh nomi]
   • **Bosqich / Holat**: [bosqich] / [holat]
   • **Ustuvorlik**: [Normal/High/Urgent]
   • **Dedlayn**: [YYYY-MM-DD]
   • **Xomashyo**: [material]
   • **Ranglar**: [rangdorlik]
   • **Laminatsiya**: [laminatsiya turi]
   • **Biriktirilgan fayllar**: [fayllar soni va turi]
   Ushbu format UI tomonidan avtomatik ravishda chiroyli, interaktiv sanoat kartochkasiga (Industrial Card) aylantiriladi.
`;
