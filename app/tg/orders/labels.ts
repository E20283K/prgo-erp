export const STAGE_LABEL: Record<string, string> = {
  Queue: "Navbatda",
  "Ready to Print": "Bosmaga tayyor",
  "In Production": "Chop etilmoqda",
  "Post-press": "Ishlov",
  Packaging: "Qadoqlash",
  Completed: "Tayyor",
  "On Hold": "To'xtatilgan",
};

export const STATUS_LABEL: Record<string, string> = {
  Draft: "Qoralama",
  Active: "Faol",
  "In Production": "Ishlab chiqarishda",
  Completed: "Tayyor",
  Cancelled: "Bekor qilingan",
};

export const STEP_LABEL: Record<string, string> = {
  pending: "Kutilmoqda",
  in_progress: "Jarayonda",
  paused: "Pauza",
  completed: "Bajarildi",
  done: "Bajarildi",
  skipped: "O'tkazildi",
};

export const EVENT_LABEL: Record<string, string> = {
  Setup: "Sozlash",
  Run: "Ish",
  Waste: "Brak",
  QC: "Nazorat",
  Delay: "To'xtalish",
  Maintenance: "Ta'mirlash",
  SetupStart: "Sozlash",
  RunStart: "Ishga tushdi",
  Finish: "Yakunlandi",
  Correction: "Tuzatish",
};

export const PRIORITY_LABEL: Record<string, string> = {
  Normal: "Oddiy",
  High: "Yuqori",
  Urgent: "Shoshilinch",
};

/** Tone of a stage badge: neutral, running, finished or stopped. */
export function stageTone(stage: string, status: string): "muted" | "run" | "ok" | "stop" {
  if (status === "Cancelled" || stage === "On Hold") return "stop";
  if (stage === "Completed" || status === "Completed") return "ok";
  if (stage === "In Production" || stage === "Post-press" || stage === "Packaging") return "run";
  return "muted";
}

export const TONE_CLASS: Record<ReturnType<typeof stageTone>, string> = {
  muted: "border-border bg-muted text-muted-foreground",
  run: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  stop: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-11-25" → "25-noy" */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "";
  return `${Number(m[3])}-${MONTHS[Number(m[2]) - 1] ?? m[2]}`;
}

export function formatQty(n: number, unit: string): string {
  const unitLabel = unit === "pcs" ? "dona" : unit;
  return `${formatNum(n)} ${unitLabel}`;
}

export const ORDER_TYPE_LABEL: Record<string, string> = {
  Production: "Ishlab chiqarish",
  Sample: "Namuna",
  Reprint: "Qayta bosma",
};

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  Draft: "Qoralama",
  Reserved: "Band",
  Picking: "Terilmoqda",
  Packed: "Tayyor yuk",
  Dispatched: "Jo'natildi",
  "In Transit": "Yo'lda",
  Delivered: "Yetkazildi",
  Cancelled: "Bekor",
};

export const ATTACHMENT_LABEL: Record<string, string> = {
  proofs: "Korrektura",
  artwork: "Maket",
  dieline: "Shtamp",
  docs: "Hujjat",
};

export const SAMPLE_APPROVAL_LABEL: Record<string, string> = {
  pending_production: "Tayyorlanmoqda",
  awaiting_approval: "Tasdiq kutilmoqda",
  approved: "Tasdiqlandi",
  revision_requested: "Qayta ishlash",
};

export const SAMPLE_PURPOSE_LABEL: Record<string, string> = {
  color_proof: "Rang sinovi",
  dieline_structure: "Konstruksiya",
  full_finished: "To'liq tayyor",
  substrate_test: "Material sinovi",
};

export const PRINT_METHOD_LABEL: Record<string, string> = {
  single_sided: "Bir tomonlama",
  sheetwise: "Ikki tomonlama",
  work_and_turn: "O'z oboroti",
  work_and_tumble: "Ag'darma",
  kashirovka: "Kashirovka",
};

export const SIDES_LABEL: Record<string, string> = {
  "1s": "1 tomon",
  "2s": "2 tomon",
};

/** 1234567.5 → "1 234 567,5": space-grouped thousands, comma decimals. */
export function formatNum(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function formatMoney(n: number, currency: string): string {
  return `${formatNum(n)} ${currency === "UZS" ? "so'm" : currency}`;
}

export const SHAPE_LABEL: Record<string, string> = {
  rectangle: "To'rtburchak",
  circle: "Doira",
  oval: "Oval",
  folded: "Buklama",
  carton_box: "Quti",
  custom_die: "Maxsus shtamp",
};

export const CORNER_LABEL: Record<string, string> = {
  Square: "To'g'ri burchak",
  "Rounded (R3)": "Yumaloq R3",
  "Rounded (R5)": "Yumaloq R5",
  "Die-cut": "Shtamp",
};

export const ITEM_CATEGORY_LABEL: Record<string, string> = {
  Hangtag: "Yorliq",
  Label: "Etiketka",
  Card: "Vizitka",
  Carton: "Quti",
  Flyer: "Buklet",
  Other: "Boshqa",
};

/** 135 → "2 soat 15 daq" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} soat ${m} daq`;
  if (h) return `${h} soat`;
  return `${m} daq`;
}

/** ISO timestamp → "25-noy 14:30" in the viewer's time zone. */
export function shortDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${shortDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
