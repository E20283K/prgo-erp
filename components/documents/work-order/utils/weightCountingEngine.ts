import { KashirovkaMode, SubstrateLayer, calculateKashirovkaTotals } from "../types";

export interface TheoreticalWeightParams {
  widthMm?: number;
  heightMm?: number;
  paperDensity?: number;
  kashirovkaMode?: KashirovkaMode;
  kashirovkaLayers?: SubstrateLayer[];
  lamination?: string;
  coating?: string;
}

/**
 * 1 dona mahsulotning nazariy vaznini hisoblash (grammda).
 * Formula: Maydon (m²) × Zichlik (g/m²) × Pardoz koeffitsienti
 */
export function calculateTheoreticalUnitWeight(params: TheoreticalWeightParams): number {
  const w = Number(params.widthMm) || 50;
  const h = Number(params.heightMm) || 90;
  const areaM2 = (w * h) / 1000000;

  let gsm = Number(params.paperDensity) || 300;

  // Agar kashirovka (duplex/triplex) mavjud bo'lsa
  if (params.kashirovkaMode && params.kashirovkaMode !== "none" && params.kashirovkaLayers && params.kashirovkaLayers.length > 0) {
    const totals = calculateKashirovkaTotals(params.kashirovkaMode, params.kashirovkaLayers);
    if (totals.totalMountedGsm > 0) {
      gsm = totals.totalMountedGsm;
    }
  }

  const baseWeightGrams = areaM2 * gsm;

  // Kraska va pardoz / laminatsiya qo'shimchasi (taxminan 3-6%)
  let finishMultiplier = 1.0;
  const lam = (params.lamination || "").toLowerCase();
  if (lam && lam !== "none" && lam !== "yo'q") {
    finishMultiplier += 0.04; // ~4% plyonka va yelim og'irligi
  }
  const coat = (params.coating || "").toLowerCase();
  if (coat && coat !== "none" && coat !== "yo'q") {
    finishMultiplier += 0.02; // ~2% lak qoplami
  }

  const finalWeight = baseWeightGrams * finishMultiplier;
  return Number(finalWeight.toFixed(3));
}

/**
 * Tarozida tortilgan etalon namuna orqali 1 dona vaznini kalibrovka qilish.
 * @param samplePcs Etalon donasi (masalan, 50 yoki 100 dona)
 * @param sampleWeightGrams Tarozidagi sof vazn (masalan, 142.5 gramm)
 * @returns 1 dona mahsulot sof vazni (grammda)
 */
export function calibrateFromScaleSample(samplePcs: number, sampleWeightGrams: number): number {
  if (samplePcs <= 0 || sampleWeightGrams <= 0) return 0;
  const unit = sampleWeightGrams / samplePcs;
  return Number(unit.toFixed(3));
}

/**
 * Tarozidagi quti sof vaznidan (Netto kg) mahsulot donasini hisoblash.
 * @param netWeightKg Tarozidagi sof og'irlik (kg)
 * @param unitWeightGrams 1 dona sof vazni (gramm)
 * @returns Butun sonli dona miqdori
 */
export function calculatePiecesFromWeight(netWeightKg: number, unitWeightGrams: number): number {
  if (netWeightKg <= 0 || unitWeightGrams <= 0) return 0;
  const totalGrams = netWeightKg * 1000;
  return Math.round(totalGrams / unitWeightGrams);
}

/**
 * Mahsulot donasidan qutining hisoblangan sof vaznini (Netto kg) aniqlash.
 * @param pieces Mahsulot donasi
 * @param unitWeightGrams 1 dona sof vazni (gramm)
 * @returns Quti og'irligi (kg da, 2 ta kasr xonali)
 */
export function calculateWeightFromPieces(pieces: number, unitWeightGrams: number): number {
  if (pieces <= 0 || unitWeightGrams <= 0) return 0;
  const totalKg = (pieces * unitWeightGrams) / 1000;
  return Number(totalKg.toFixed(2));
}
