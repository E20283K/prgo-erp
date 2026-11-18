import type { PaperSpec } from "@/store/workspaceStore";

/** Kartochkadagi USD ↔ UZS hisob-kitobi uchun yagona kurs (markaziy kurs manbai ulanguncha). */
export const USD_UZS_RATE = 12850;

export interface Option<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export const PAPER_TYPE_OPTIONS: Option<NonNullable<PaperSpec["paperType"]>>[] = [
  { value: "offset", label: "Ofset", description: "Bo'rsiz, yozishga qulay" },
  { value: "coated", label: "Bo'rlangan", description: "Silliq, rang yorqin" },
  { value: "board", label: "Karton", description: "200 g/m² dan qalin" },
  { value: "kraft", label: "Kraft", description: "Jigarrang, mustahkam" },
  { value: "self_adhesive", label: "Samokleyka", description: "Yelimli etiketka qog'ozi" },
  { value: "designer", label: "Dizayner", description: "Teksturali, rangli" },
  { value: "synthetic", label: "Sintetik", description: "Plastik asosli, suvga chidamli" },
  { value: "newsprint", label: "Gazeta", description: "Arzon, yupqa" },
];

export const BOARD_GRADE_OPTIONS: Option<NonNullable<PaperSpec["boardGrade"]>>[] = [
  { value: "GC1", label: "GC1", description: "Oq orqa, hajmli (FBB)" },
  { value: "GC2", label: "GC2", description: "Krem orqa (FBB)" },
  { value: "GD2", label: "GD2", description: "Kulrang orqa, makulatura" },
  { value: "GD3", label: "GD3", description: "Kulrang orqa, yupqaroq" },
  { value: "GT", label: "GT", description: "Kulrang orqa, triplex" },
  { value: "SBS", label: "SBS", description: "To'liq oq sellyuloza" },
];

export const FINISH_OPTIONS: Option<NonNullable<PaperSpec["finish"]>>[] = [
  { value: "gloss", label: "Glyanets" },
  { value: "matt", label: "Matt" },
  { value: "silk", label: "Silk" },
  { value: "uncoated", label: "Bo'rsiz" },
  { value: "textured", label: "Teksturali" },
];

export const COATED_SIDES_OPTIONS: Option<"0" | "1" | "2">[] = [
  { value: "0", label: "Yo'q" },
  { value: "1", label: "1 tomon" },
  { value: "2", label: "2 tomon" },
];

export const CERTIFICATION_OPTIONS: Option<NonNullable<PaperSpec["certification"]>>[] = [
  { value: "none", label: "Yo'q" },
  { value: "FSC", label: "FSC" },
  { value: "PEFC", label: "PEFC" },
];

/** Har bir parametr uchun (i) izohi — oddiy tilda, bosmaxona amaliyotidan misol bilan. */
export const FIELD_HINTS = {
  name: "To'liq nom: marka, yuza, zichlik va format. Masalan: Galerie Art Silk 150 g/m² 700×1000. Qidiruv va hujjatlarda shu nom ko'rinadi.",
  sku: "Materialning ombordagi yagona kodi. Yangi kartochkada navbatdagi raqam (MAT-0001) avtomatik taklif qilinadi.",
  category: "Material guruhi. Qog'oz pasporti va otxodlar bo'limi faqat «Paper & Board» toifasida ochiladi.",
  unit: "Qoldiq va narx qaysi birlikda yuritiladi. Listli qog'oz — varaqda, rulon — metr yoki rulonda, bo'yoq va yelim — kg da.",
  format: "Varaqning eni va bo'yi, millimetrda. Keng tarqalgan formatlar: 620×940, 700×1000, 720×1020. Varaq og'irligi va otxoddan nechta detal chiqishi shundan hisoblanadi.",
  grammage: "1 m² qog'ozning og'irligi, grammda. Ofset 70–120, bo'rlangan 90–350, karton 200–450 g/m². Varaq og'irligi va 1 kg narxi shundan hisoblanadi.",
  grain: "Qog'oz tolalarining yo'nalishi. Bukish va bigovka tola bo'ylab qilinsa, qog'oz sinmaydi va yorilmaydi. Uzun tomon — tola varaqning uzun tomoni bo'ylab, qisqa tomon — qisqa tomoni bo'ylab.",
  paperType: "Ofset — bo'rsiz, yozish uchun (blanka, kitob). Bo'rlangan — silliq, rang yorqin chiqadi (buklet, katalog). Karton — qadoq va qutilar. Samokleyka — orqasi yelimli etiketka qog'ozi.",
  boardGrade: "Karton sinfi. GC1/GC2 — oq yoki krem orqali hajmli karton (oziq-ovqat, kosmetika qutilari). GD2/GD3 — kulrang orqali, makulaturadan, arzonroq. GT — ko'p qatlamli kulrang orqa. SBS — butunlay oq sellyuloza, premium qadoq.",
  finish: "Yuza ko'rinishi. Glyanets — yaltiroq, rang to'q chiqadi. Matt — xira, matn o'qishga qulay. Silk — yarim matt. Teksturali — dizayner qog'ozlar (lyon, kanvas).",
  coatedSides: "Bo'r (mel) qatlami nechta tomonga surtilgan. 1 tomon — etiketka va qadoq uchun, 2 tomon — ikkala tomoni bosiladigan buklet va katalog uchun.",
  caliper: "Varaq qalinligi, mikronda (mkm). Bir xil g/m² da qalinroq qog'oz hajmliroq bo'ladi. Bigovka, kitob qalinligi va qutining mustahkamligi shunga bog'liq.",
  whiteness: "Qog'ozning oqligi, CIE shkalasida. 140–170 — juda oq premium qog'oz, 100–130 — oddiy ofset. Ranglar qanchalik toza chiqishiga ta'sir qiladi.",
  opacity: "Varaq orqasidagi bosma qanchalik ko'rinmasligi, foizda. 90% dan yuqori bo'lsa, ikki tomonlama bosma uchun yaxshi. Past bo'lsa, orqa tomondagi rasm ko'rinib turadi.",
  color: "Qog'oz rangi: oq, krem, tabiiy yoki rangli. Asosan ofset va dizayner qog'ozlar uchun.",
  brand: "Qog'ozning savdo nomi (markasi), masalan: Galerie Art, Magno, Invercote. Bir xil zichlikdagi turli markalar sifati va narxi bilan farq qiladi.",
  manufacturer: "Ishlab chiqargan zavod yoki kompaniya, masalan: Sappi, Stora Enso, APP.",
  sheetsPerPack: "Bitta pachkadagi varaqlar soni (odatda 100, 250 yoki 500). Kirimda pachkalab sanash va og'irlikni tekshirish uchun.",
  packsPerPallet: "Bitta palletdagi pachkalar soni. Pallet og'irligi va u ombordagi katakka sig'ishini hisoblash uchun.",
  certification: "Ekologik sertifikat. FSC yoki PEFC — qog'oz mas'uliyat bilan boshqariladigan o'rmondan ekanini tasdiqlaydi. Eksport qadoqlari uchun ko'pincha talab qilinadi.",
  rollWidth: "Rulonning eni, millimetrda. Fleksopechat yoki etiketka mashinasiga sig'ishi shu bilan tekshiriladi.",
  rollLength: "Bitta rulondagi material uzunligi, metrda.",
  stockLevelNew: "Kartochka ochilayotgan paytda ombordagi miqdor. Saqlangandan keyin qoldiq faqat kirim, chiqim va inventarizatsiya hujjatlari orqali o'zgaradi.",
  stockLevel: "Ombordagi jami miqdor. Hujjatlar bo'yicha yuritiladi: qo'lda o'zgartirib bo'lmaydi, farq bo'lsa inventarizatsiya qiling.",
  reorder: "Qoldiq shu miqdorga tushsa, holat «Low Stock» bo'ladi, uning 30% iga tushsa — «Critical». 0 bo'lsa, chegara yo'q.",
  price: `1 birlik (varaq, kg, metr...) narxi. Valyutani tanlang, ikkinchisi kurs bo'yicha hisoblanadi: 1 USD = ${USD_UZS_RATE.toLocaleString("ru-RU")} UZS.`,
  supplier: "Materialni yetkazib beradigan ta'minotchi. «Kirim qilish» bosilganda yangi hujjat shu ta'minotchi bilan ochiladi.",
  batch: "Ishlab chiqaruvchi partiyasi raqami (qadoqda yozilgan). Brak chiqsa, qaysi partiyadan kelganini topish uchun.",
  lastReceived: "Material omborga oxirgi marta kirim qilingan sana.",
  expiry: "Bo'yoq, lak, yelim va samokleykaning yaroqlilik muddati. Muddati o'tgan material bosma sifatini buzadi.",
  warehouse: "Material saqlanadigan ombor. Ombor almashtirilsa, stelaj va katak tanlovi tozalanadi.",
  rack: "Ombordagi stelaj (qator). Tanlansa, pastdagi ro'yxatda faqat shu stelajning kataklari qoladi.",
  bin: "Aniq saqlash joyi: stelaj, qavat va katak kodi (masalan A-01-2-3). Ombordor materialni shu kod bo'yicha topadi.",
  sheetWeight: "1 varaq og'irligi = zichlik × eni × bo'yi. Kirimda tarozida tekshirish uchun.",
  weight1000: "1000 varaqning og'irligi, kg. Qog'oz ko'pincha tonnalab sotiladi — buyurtma hajmini varaqdan kg ga o'tkazish uchun.",
  packWeight: "Bitta pachka og'irligi, kg. Pachkadagi varaqlar soni kiritilganda hisoblanadi.",
  stockWeight: "Ombordagi jami qoldiqning og'irligi, kg. Katak va pallet yuklamasini tekshirish uchun.",
  pricePerKg: "1 varaq narxi varaq og'irligiga bo'linadi. Ta'minotchining kg yoki tonna narxi bilan solishtirish uchun.",
  sheetsPerKg: "1 kg dan nechta varaq chiqadi. Kg da yuritiladigan qog'ozni varaqqa o'tkazish uchun.",
} as const;

/** "700×1000", "700x1000", "70 х 100" kabi yozuvdan eni va bo'yini (mm) oladi. */
export function parseFormat(format?: string | null): { w: number; h: number } | null {
  if (!format) return null;
  const m = format.match(/(\d+(?:[.,]\d+)?)\s*[x×х*]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1].replace(",", "."));
  const h = Number(m[2].replace(",", "."));
  return w > 0 && h > 0 ? { w, h } : null;
}

export function composeFormat(w?: number, h?: number): string {
  if (!w && !h) return "";
  return `${w || ""}×${h || ""}`;
}

/** Bitta varaqqa nechta detal sig'adi (ikkala burilishdan eng ko'pi). */
export function fitCount(sheetW: number, sheetH: number, itemW: number, itemH: number): number {
  const a = Math.floor(sheetW / itemW) * Math.floor(sheetH / itemH);
  const b = Math.floor(sheetW / itemH) * Math.floor(sheetH / itemW);
  return Math.max(a, b);
}

export interface SheetMetrics {
  sheetWeightG: number;
  kgPer1000: number;
  packWeightKg?: number;
  stockWeightKg?: number;
  pricePerKgUsd?: number;
  sheetsPerKg: number;
}

/** Zichlik va formatdan varaq og'irligi, pachka og'irligi va kg narxini hisoblaydi. */
export function computeSheetMetrics(input: {
  grammage?: number;
  format?: string | null;
  sheetsPerPack?: number;
  stockLevel?: number;
  unit?: string;
  unitPriceUsd?: number;
}): SheetMetrics | null {
  const f = parseFormat(input.format);
  const gsm = Number(input.grammage) || 0;
  if (!f || gsm <= 0) return null;

  const sheetWeightG = (gsm * f.w * f.h) / 1_000_000;
  const isSheets = input.unit === "sheets";
  const price = Number(input.unitPriceUsd) || 0;

  return {
    sheetWeightG,
    kgPer1000: sheetWeightG,
    sheetsPerKg: 1000 / sheetWeightG,
    packWeightKg: input.sheetsPerPack ? (sheetWeightG * input.sheetsPerPack) / 1000 : undefined,
    stockWeightKg: isSheets && input.stockLevel ? (sheetWeightG * input.stockLevel) / 1000 : undefined,
    pricePerKgUsd: isSheets && price > 0 ? price / (sheetWeightG / 1000) : undefined,
  };
}
