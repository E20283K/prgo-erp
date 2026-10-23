/**
 * Professional Pantone & Specialty Spot Ink Catalog for PrintGoo ERP
 * Combines 900+ official Pantone PMS Formula Guide solid coated colors
 * with standard base mixing inks and specialty finishing stations (foils, spot UV, varnishes).
 */

import pantoneData from "pantone-colors";

export interface PantoneColor {
  code: string;       // e.g. "021 C", "Warm Red C", "871 C"
  name: string;       // e.g. "PANTONE 021 C (Neon Orange)"
  hex: string;        // e.g. "#FE5000"
  category: "Base Inks" | "PMS Solid Coated" | "Metallics & Pastels" | "Specialty & Foils";
}

// 1. Core Base Inks used in every print house ink kitchen
export const BASE_PANTONE_INKS: PantoneColor[] = [
  { code: "Yellow C", name: "PANTONE Yellow C", hex: "#FED100", category: "Base Inks" },
  { code: "Yellow 012 C", name: "PANTONE Yellow 012 C", hex: "#FFD700", category: "Base Inks" },
  { code: "Orange 021 C", name: "PANTONE 021 C (Neon Orange)", hex: "#FE5000", category: "Base Inks" },
  { code: "Warm Red C", name: "PANTONE Warm Red C", hex: "#F93822", category: "Base Inks" },
  { code: "Red 032 C", name: "PANTONE Red 032 C", hex: "#EF3340", category: "Base Inks" },
  { code: "Rubine Red C", name: "PANTONE Rubine Red C", hex: "#CE0058", category: "Base Inks" },
  { code: "Rhodamine Red C", name: "PANTONE Rhodamine Red C", hex: "#E10098", category: "Base Inks" },
  { code: "Purple C", name: "PANTONE Purple C", hex: "#BB29BB", category: "Base Inks" },
  { code: "Violet C", name: "PANTONE Violet C", hex: "#440099", category: "Base Inks" },
  { code: "Blue 072 C", name: "PANTONE Blue 072 C", hex: "#10069F", category: "Base Inks" },
  { code: "Reflex Blue C", name: "PANTONE Reflex Blue C", hex: "#0A1172", category: "Base Inks" },
  { code: "Process Blue C", name: "PANTONE Process Blue C", hex: "#0085CA", category: "Base Inks" },
  { code: "Green C", name: "PANTONE Green C", hex: "#00AB84", category: "Base Inks" },
  { code: "Black C", name: "PANTONE Black C", hex: "#2D2926", category: "Base Inks" },
  { code: "Cool Gray 1 C", name: "PANTONE Cool Gray 1 C", hex: "#D9D9D6", category: "Base Inks" },
  { code: "Cool Gray 3 C", name: "PANTONE Cool Gray 3 C", hex: "#C8C9C7", category: "Base Inks" },
  { code: "Cool Gray 5 C", name: "PANTONE Cool Gray 5 C", hex: "#B1B3B3", category: "Base Inks" },
  { code: "Cool Gray 7 C", name: "PANTONE Cool Gray 7 C", hex: "#97999B", category: "Base Inks" },
  { code: "Cool Gray 9 C", name: "PANTONE Cool Gray 9 C", hex: "#75787B", category: "Base Inks" },
  { code: "Cool Gray 11 C", name: "PANTONE Cool Gray 11 C", hex: "#53565A", category: "Base Inks" },
  { code: "Warm Gray 1 C", name: "PANTONE Warm Gray 1 C", hex: "#D7D2CB", category: "Base Inks" },
  { code: "Warm Gray 5 C", name: "PANTONE Warm Gray 5 C", hex: "#AEA8A0", category: "Base Inks" },
  { code: "Warm Gray 9 C", name: "PANTONE Warm Gray 9 C", hex: "#706862", category: "Base Inks" },
];

// 2. Specialty Stations & Foil Stampings
export const SPECIALTY_STATIONS: PantoneColor[] = [
  { code: "Foil Gold", name: "Hot Stamping Foil (Mirror Gold)", hex: "#D4AF37", category: "Specialty & Foils" },
  { code: "Foil Silver", name: "Hot Stamping Foil (Mirror Silver)", hex: "#E5E7EB", category: "Specialty & Foils" },
  { code: "Foil Rose Gold", name: "Hot Stamping Foil (Rose Gold)", hex: "#B76E79", category: "Specialty & Foils" },
  { code: "Foil Holographic", name: "Holographic Rainbow Foil", hex: "#67E8F9", category: "Specialty & Foils" },
  { code: "Foil Copper", name: "Hot Stamping Foil (Metallic Copper)", hex: "#C87533", category: "Specialty & Foils" },
  { code: "Spot UV Gloss", name: "Spot UV Gloss Varnish (УФ-лак)", hex: "#38BDF8", category: "Specialty & Foils" },
  { code: "Spot UV Matte", name: "Spot UV Matte Silk Varnish", hex: "#94A3B8", category: "Specialty & Foils" },
  { code: "Drip-Off", name: "Drip-Off Twin Effect Varnish", hex: "#A855F7", category: "Specialty & Foils" },
  { code: "Scratch-Off", name: "Scratch-Off Security Ink Silver", hex: "#9CA3AF", category: "Specialty & Foils" },
  { code: "871 C", name: "PANTONE 871 C (Metallic Gold)", hex: "#86734C", category: "Metallics & Pastels" },
  { code: "872 C", name: "PANTONE 872 C (Rich Pale Gold)", hex: "#85714D", category: "Metallics & Pastels" },
  { code: "877 C", name: "PANTONE 877 C (Metallic Silver)", hex: "#8A8D8F", category: "Metallics & Pastels" },
];

// 3. Extract 900+ numbered Solid Coated colors from pantone-colors package
const extractNpmPantoneColors = (): PantoneColor[] => {
  const dict = ((pantoneData as any)?.default || pantoneData) as Record<string, string>;
  if (!dict || typeof dict !== "object") return [];

  return Object.entries(dict).map(([pmsNumber, hex]) => {
    const isMetallic = Number(pmsNumber) >= 800 && Number(pmsNumber) <= 899;
    return {
      code: `${pmsNumber} C`,
      name: `PANTONE ${pmsNumber} C`,
      hex: hex.toLowerCase(),
      category: isMetallic ? "Metallics & Pastels" : "PMS Solid Coated",
    };
  });
};

export const ALL_PANTONE_COLORS: PantoneColor[] = [
  ...BASE_PANTONE_INKS,
  ...SPECIALTY_STATIONS,
  ...extractNpmPantoneColors(),
];

/**
 * Search Pantone catalog by query string (matching code, name, or number)
 */
export function searchPantoneColors(query: string, maxResults = 50): PantoneColor[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_PANTONE_COLORS.slice(0, maxResults);

  const cleanNum = q.replace(/^(pantone|pms)\s*/i, "").trim().toLowerCase();

  const exactMatches: PantoneColor[] = [];
  const primaryMatches: PantoneColor[] = [];
  const secondaryMatches: PantoneColor[] = [];

  for (const p of ALL_PANTONE_COLORS) {
    const codeL = p.code.toLowerCase();
    const nameL = p.name.toLowerCase();

    // 1. Exact match by code or name
    if (codeL === q || codeL === cleanNum || nameL === q) {
      exactMatches.push(p);
      continue;
    }

    // 2. Starts with / prefix match
    if (
      codeL.startsWith(cleanNum) ||
      codeL.startsWith(q) ||
      nameL.startsWith(q) ||
      nameL.startsWith(`pantone ${cleanNum}`)
    ) {
      primaryMatches.push(p);
      continue;
    }

    // 3. Substring match
    if (nameL.includes(q) || codeL.includes(cleanNum) || nameL.includes(cleanNum)) {
      secondaryMatches.push(p);
    }
  }

  return [...exactMatches, ...primaryMatches, ...secondaryMatches].slice(0, maxResults);
}
