// Replaces all machines of PRINTGOO with the shop-floor inventory
// (source: machines/tipografiya_uskunalari.txt, nameplate photos 2026-11-19).
// Linked work-order operations, work rates and flexo cylinders keep their rows;
// their machine reference becomes NULL (FK ON DELETE SET NULL).
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, pgClient } from "../db";
import { companies, flexoMachines, productionMachines } from "../db/schema";
import { getCleanBlankMachine } from "../components/documents/machine/cleanBlankMachine";
import type { MachineCategory, MachineRecord } from "../components/documents/machine/types";

const COMPANY_CODE = "PRINTGOO";

type Seed = {
  code: string;
  name: string;
  category: MachineCategory;
  department?: string;
  manufacturer?: string;
  country?: string;
  year?: number;
  serialNo?: string;
  format?: string;
  speed?: string;
  powerKw?: number;
  specs?: Record<string, unknown>;
  features?: string;
  notes?: string;
};

const JINGDA_CONTACT = "Aloqa: +86-577-65337601, www.cnjdyj.cn, zhong@cnjdyj.cn";
const HEYBETLI_CONTACT = "Aloqa: +90 212 613 33 41, www.heybetlimakina.com, info@heybetlimakina.com";

const MACHINES: Seed[] = [
  // ── Bosma ──
  {
    code: "JR-1221",
    name: "JINGDA JR-1221 Flexo Fabric Label",
    category: "flexo",
    manufacturer: "JINGDA Printing Machinery Co., Ltd.",
    country: "Xitoy",
    year: 2026,
    serialNo: "260604",
    format: "140 x (110–300) mm",
    speed: "0–60 m/min",
    specs: { maxWebWidthMm: 140, repeatMinMm: 110, repeatMaxMm: 300, maxSpeedMpm: 60 },
    features: "Mato yorliqlariga fleksografik bosma; 220V 50/60Hz; CE",
    notes: `Ishlab chiqarilgan: 2026-07. Seriya raqami birkada biroz xira. ${JINGDA_CONTACT}`,
  },
  {
    code: "JR-1541",
    name: "JINGDA JR-1541 Flexo Fabric Label",
    category: "flexo",
    manufacturer: "JINGDA Printing Machinery Co., Ltd.",
    country: "Xitoy",
    year: 2025,
    serialNo: "250720",
    format: "155 x (108–401) mm",
    speed: "0–60 m/min",
    specs: { maxWebWidthMm: 155, repeatMinMm: 108, repeatMaxMm: 401, maxSpeedMpm: 60 },
    features: "Mato yorliqlariga fleksografik bosma; 220V 50/60Hz; CE",
    notes: `Ishlab chiqarilgan: 2025-10. ${JINGDA_CONTACT}`,
  },
  {
    code: "HEI-SM52-1999",
    name: "Heidelberg Speedmaster SM 52-2 (1999)",
    category: "offset",
    manufacturer: "Heidelberger Druckmaschinen AG",
    country: "Germaniya",
    year: 1999,
    serialNo: "203092",
    specs: { printingUnits: 2 },
    features: "2 rangli ofset; ALPHATRONIC 200 poroshok sepish qurilmasi; CE",
    notes: "Korpusda PANO-MAK (www.panomak.com) stikeri bor.",
  },
  {
    code: "HEI-SM52-2002",
    name: "Heidelberg Speedmaster SM 52-2 (2002)",
    category: "offset",
    manufacturer: "Heidelberger Druckmaschinen AG",
    country: "Germaniya",
    year: 2002,
    serialNo: "205068",
    specs: { printingUnits: 2 },
    features: "2 rangli ofset; CE, GS (DP 02053)",
    notes: "Seriya raqami birkada biroz xira.",
  },
  {
    code: "HEI-CYL-4057",
    name: "Original Heidelberg Cylinder 40x57",
    category: "die-cutting",
    manufacturer: "Schnellpressenfabrik AG Heidelberg",
    country: "Germaniya",
    year: 1960,
    format: "400 x 570 mm",
    powerKw: 4,
    specs: { maxSheetMm: "400 x 570" },
    features: "Silindrli bosma / shtanslash; dvigatel Bauknecht D 4/4-SO (Nr. 4293785), 380V 9.6A 4 kW 1380 ayl/min",
    notes: "Yil taxminiy: birkada \"110 Jahre Heidelberger Druckmaschinen 1850-1960\" yubiley belgisi.",
  },

  // ── Kesish ──
  {
    code: "POL-92ED",
    name: "POLAR 92ED gilyotina",
    category: "guillotine",
    manufacturer: "Adolf Mohr Maschinenfabrik (POLAR)",
    country: "Germaniya",
    year: 1996,
    serialNo: "6611109",
    specs: { cuttingWidthMm: 920 },
    features: "CE, GS (DP 95046)",
    notes: "Reduktor moyi CLP220 va gidravlik moy HLP46 02/26 da almashtirilgan.",
  },
  {
    code: "WDL-QZYK920DN",
    name: "WONDLY QZYK920DN gilyotina",
    category: "guillotine",
    manufacturer: "Ruian Wandeli Printing Machinery Co., Ltd.",
    country: "Xitoy",
    year: 2023,
    serialNo: "M23092776",
    format: "920 x 1100 mm",
    specs: { cuttingWidthMm: 920, feedDepthMm: 1100 },
    features: "380V 50Hz 12A",
    notes: "Ishlab chiqarilgan: 2023-09-07. Aloqa: +86 (577) 65607818, www.wondly.com, wdl@wondly.com",
  },
  {
    code: "TAPE-CUT-01",
    name: "Computer tape cutter (lenta kesish)",
    category: "guillotine",
    format: "250 mm gacha",
    features: "Issiq kesish bloki, optik datchik, sensorli panel",
    notes: "Zavod birkasi yo'q — model va ishlab chiqaruvchi aniqlanmagan.",
  },
  {
    code: "SJQ-120",
    name: "SJQ-120 burchak yumaloqlash",
    category: "guillotine",
    manufacturer: "Ruian Light Machinery Co., Ltd.",
    country: "Xitoy",
    features: "Round Corner Cutting Machine",
    notes: "Aloqa: 0577-65677330, http://raqingrui.1688.com, 642754524@qq.com",
  },

  // ── Zarhal, shtans, bigovka ──
  {
    code: "MOS-FOIL-750",
    name: "MOSUN zarhal bosish (Hot Foil)",
    category: "die-cutting",
    manufacturer: "Ruian Mosun Machinery Co., Ltd.",
    country: "Xitoy",
    year: 2023,
    serialNo: "...7087",
    features: "Hot Foil Stamping; 220V 50Hz 3P; o'lcham ~1700 x 1750 x 1780 mm; CE",
    notes: "Model va seriya birkada xira (model \"...750\", seriya \"...7087\"). Ishlab chiqarilgan: 2023-08. Aloqa: +86 577 65591142, www.mosunmachine.com, evawong@aliyun.com",
  },
  {
    code: "FOIL-DIE-01",
    name: "Zarhal + shtans ikki funksiyali",
    category: "die-cutting",
    features: "MPU boshqaruv, LCD (Gold Stamping / Crease-Cutting), 2 x Sinny TCE5-M harorat regulyatori",
    notes: "Zavod birkasi yo'q — model va ishlab chiqaruvchi aniqlanmagan.",
  },
  {
    code: "GAN-272",
    name: "Gandossi & Fossati tigel press",
    category: "die-cutting",
    manufacturer: "Gandossi & F.lli Fossati",
    country: "Italiya",
    serialNo: "272",
    features: "Macchine Grafiche / Cartotecniche, Milano",
    notes: "\"272\" birka raqami; turi taxminiy (kesish-bigovka tigel).",
  },
  {
    code: "CRS-CUT-01",
    name: "Bigovka va kesish uskunasi",
    category: "die-cutting",
    features: "Tekis bosimli; DH-48SAM taymeri, MINGZHUO MZGW-5 hisoblagichi; succession / mon-cut / time lag rejimlari",
    notes: "Zavod birkasi yo'q — faqat boshqaruv paneli suratda.",
  },

  // ── Laminatsiya va yordamchi ──
  {
    code: "AW-AL560F",
    name: "ALL WIN AW-SG-AL560F laminator",
    category: "lamination",
    manufacturer: "Henan Allwin Machinery Co., Ltd.",
    country: "Xitoy",
    serialNo: "AW250912L12",
    powerKw: 7,
    features: "Avtomatik laminatsiya; 220V 50Hz; CE",
    notes: "Aloqa: +86 18272865795, https://allwinmach.en.alibaba.com, MINALU@ALLWIN.WORK",
  },
  {
    code: "LED-EXP-01",
    name: "LED Lamp Printer (klishe ekspozitsiya)",
    category: "mounting",
    department: "Pre-press",
    features: "Raqamli taymer, 2 vakuum rejimi, MPa vakuumometr",
    notes: "Klishe kuydirish uskunasi; toifa vaqtincha \"mounting\". Zavod birkasi yo'q.",
  },
  {
    code: "HEY-GLUE-80",
    name: "Heybetli yelim surtish 80 sm",
    category: "mounting",
    manufacturer: "Heybetli Makina Sanayi",
    country: "Turkiya",
    year: 2023,
    serialNo: "5885",
    powerKw: 0.75,
    specs: { maxSheetMm: "800" },
    features: "Tutkal Sürme Makinası, PASLANMAZ 80CM; 220V 50Hz; 170 kg",
    notes: HEYBETLI_CONTACT,
  },
  {
    code: "HEY-PRS-5272",
    name: "Heybetli gidravlik press 52x72",
    category: "die-cutting",
    manufacturer: "Heybetli Makina Sanayi",
    country: "Turkiya",
    year: 2023,
    serialNo: "5890",
    format: "520 x 720 mm",
    powerKw: 4,
    specs: { maxSheetMm: "520 x 720" },
    features: "Tablalı Hidrolik Pres; 380V 50Hz; ~430 kg",
    notes: HEYBETLI_CONTACT,
  },
];

// JINGDA flexo presses also feed the flexo imposition engine (gear table).
const FLEXO_ENGINE = [
  { code: "JR-1221", name: "JINGDA JR-1221 Flexo Fabric Label", model: "JR-1221", maxPrintWidth: "140.00" },
  { code: "JR-1541", name: "JINGDA JR-1541 Flexo Fabric Label", model: "JR-1541", maxPrintWidth: "155.00" },
];

function specKey(category: MachineCategory): keyof MachineRecord {
  const map: Record<MachineCategory, keyof MachineRecord> = {
    offset: "offsetSpecs",
    flexo: "flexoSpecs",
    "die-cutting": "dieCuttingSpecs",
    lamination: "laminationSpecs",
    guillotine: "guillotineSpecs",
    "casing-in": "casingInSpecs",
    jacquard: "jacquardSpecs",
    mounting: "mountingSpecs",
  };
  return map[category];
}

async function main() {
  const [company] = await db.select().from(companies).where(eq(companies.code, COMPANY_CODE));
  if (!company) throw new Error(`Company ${COMPANY_CODE} not found`);

  const oldProd = await db.select().from(productionMachines).where(eq(productionMachines.companyId, company.id));
  const oldFlexo = await db.select().from(flexoMachines).where(eq(flexoMachines.companyId, company.id));
  const backupPath = process.argv[2];
  if (backupPath) {
    writeFileSync(backupPath, JSON.stringify({ productionMachines: oldProd, flexoMachines: oldFlexo }, null, 2));
    console.log(`Backup: ${backupPath}`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(productionMachines).where(eq(productionMachines.companyId, company.id));
    await tx.delete(flexoMachines).where(eq(flexoMachines.companyId, company.id));
    console.log(`Deleted ${oldProd.length} production + ${oldFlexo.length} flexo machines`);

    for (const s of MACHINES) {
      const blank = getCleanBlankMachine(undefined, {
        code: s.code,
        name: s.name,
        category: s.category,
        ...(s.department ? { department: s.department as MachineRecord["department"] } : {}),
      });
      const key = specKey(s.category);
      const specs = { ...((blank[key] as object) ?? {}), ...(s.specs ?? {}) };
      const energy = { ...blank.energy, installedPowerKw: s.powerKw ?? 0, activePowerKw: s.powerKw ?? 0 };

      await tx.insert(productionMachines).values({
        companyId: company.id,
        code: s.code,
        name: s.name,
        department: blank.department,
        category: s.category,
        speed: s.speed ?? null,
        format: s.format ?? null,
        features: s.features ?? null,
        manufacturer: s.manufacturer ?? null,
        country: s.country ?? null,
        year: s.year ?? null,
        serialNo: s.serialNo ?? null,
        hourlyRate: "0",
        powerKw: String(s.powerKw ?? 0),
        overallEfficiency: 90,
        totalLifetimeCounter: "0",
        counterUnit: blank.counterUnit,
        specs,
        energy,
        costing: blank.costing,
        telemetry: blank.telemetry,
        maintenanceLogs: [],
        notes: s.notes ?? null,
        status: "Idle",
        isAvailable: true,
      });
      console.log(`+ [${s.code}] ${s.name} (${blank.department} / ${s.category})`);
    }

    for (const f of FLEXO_ENGINE) {
      await tx.insert(flexoMachines).values({
        companyId: company.id,
        code: f.code,
        name: f.name,
        model: f.model,
        // Gear pitch not on the nameplate; JINGDA JR line uses the JR-1521 gear. Verify on the floor.
        gearSystem: "JINGDA JR Pitch 2.7107mm",
        gearPitch: "2.7107",
        minWebWidth: "10.00",
        maxWebWidth: f.maxPrintWidth,
        maxPrintWidth: f.maxPrintWidth,
        colorStations: 4,
        speedMpm: "60.00",
        status: "active",
        hourlyRate: "0",
      });
      console.log(`+ flexo engine [${f.code}]`);
    }
  });

  console.log(`Done: ${MACHINES.length} production + ${FLEXO_ENGINE.length} flexo machines`);
  await pgClient.end();
}

main().catch(async (err) => {
  console.error("Seed error:", err);
  await pgClient.end();
  process.exit(1);
});
