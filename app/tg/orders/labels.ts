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
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} ${unitLabel}`;
}
