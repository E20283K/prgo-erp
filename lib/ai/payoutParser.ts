import { callGeminiStructured, type GeminiPart } from "./geminiStructured";
import type { DirectoryEmployee } from "@/lib/server/employeePayoutService";

export interface ParsedPayoutItem {
  nameAsWritten: string;
  employeeId: string | null;
  amount: number;
  currency: string;
  kind: "advance" | "settlement";
  date: string | null; // YYYY-MM-DD
  period: string | null; // YYYY-MM
  note: string | null;
}

export interface ParsedPayoutMessage {
  intent: "payout" | "balance_query" | "unknown";
  transcript: string;
  items: ParsedPayoutItem[];
  queryNames: string[];
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["payout", "balance_query", "unknown"] },
    transcript: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nameAsWritten: { type: "STRING" },
          employeeId: { type: "STRING", nullable: true },
          amount: { type: "NUMBER" },
          currency: { type: "STRING", enum: ["UZS", "USD"] },
          kind: { type: "STRING", enum: ["advance", "settlement"] },
          date: { type: "STRING", nullable: true },
          period: { type: "STRING", nullable: true },
          note: { type: "STRING", nullable: true },
        },
        required: ["nameAsWritten", "amount", "currency", "kind"],
      },
    },
    queryNames: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["intent", "transcript", "items", "queryNames"],
};

function buildSystemPrompt(employees: DirectoryEmployee[], today: string): string {
  const catalog = employees
    .map((e) => `${e.id} | ${e.fullName} | ${e.position ?? "-"} | ${e.badgeNumber}`)
    .join("\n");
  return `Sen bosmaxona ERP tizimidagi kassa yordamchisisan. Buxgalter yoki direktor hodimlarga berilgan pul haqida yozadi (o'zbek lotin/kirill yoki rus tilida, ovozli bo'lishi ham mumkin).

Vazifang xabarni tuzilgan JSON ga aylantirish:
- intent="payout": hodim(lar)ga pul berilgani haqida xabar.
- intent="balance_query": hodimning avansi/qoldig'i haqida savol ("Valining avansi qancha?"). Ismlarni queryNames ga yoz.
- intent="unknown": boshqa narsa.
- transcript: xabar matni (ovozli bo'lsa — eshitilgan matn).

Har bir pul berish = bitta items elementi. Bitta xabarda bir nechta hodim bo'lishi mumkin ("Vali 300, Ali 200 ming avans" → ikkala summa ham 300 000 va 200 000).
- kind: "avans", "аванс", "qarz", "oldindan" → "advance". "raschot", "расчёт", "oylik", "oylik qoldig'i", "to'liq hisob", "zarplata" → "settlement". Aniq bo'lmasa "advance".
- amount: to'liq son. "500 ming"=500000, "1,2 mln"/"1.2 million"=1200000, "yarim million"=500000, "300" yonida "ming" bo'lsa yoki kontekstdan ming ekani aniq bo'lsa 300000. "$200"/"200 dollar" → currency "USD".
- currency: aks holda "UZS".
- date: "kecha", "bugun", "15-noyabr" kabi bo'lsa YYYY-MM-DD; aytilmagan bo'lsa null. Bugun: ${today}.
- period: "o'tgan oy uchun", "oktyabr oyligi" kabi aytilsa YYYY-MM; aks holda null.
- note: qo'shimcha izoh (masalan "kartaga", "naqd", sabab), bo'lmasa null.
- nameAsWritten: ism xabarda qanday yozilgan bo'lsa (qo'shimchalarsiz: "Valiga" → "Vali").
- employeeId: quyidagi katalogdan aniq bitta mos hodim bo'lsa uning id si. Bir nechta mos yoki hech biri mos bo'lmasa null. Taxmin qilma.

HODIMLAR KATALOGI (id | F.I.Sh | lavozim | tabel):
${catalog}`;
}

export async function parsePayoutMessage(input: {
  text?: string | null;
  audio?: { base64: string; mime: string } | null;
  employees: DirectoryEmployee[];
  today: string;
}): Promise<ParsedPayoutMessage> {
  const parts: GeminiPart[] = [];
  if (input.audio) parts.push({ inline_data: { mime_type: input.audio.mime, data: input.audio.base64 } });
  parts.push({ text: input.text?.trim() || "(ovozli xabar — yuqoridagi audioni tahlil qil)" });

  const raw = await callGeminiStructured<ParsedPayoutMessage>({
    systemText: buildSystemPrompt(input.employees, input.today),
    parts,
    responseSchema: RESPONSE_SCHEMA,
  });

  const knownIds = new Set(input.employees.map((e) => e.id));
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((it) => ({
      nameAsWritten: String(it.nameAsWritten || "").trim(),
      employeeId: it.employeeId && knownIds.has(it.employeeId) ? it.employeeId : null,
      amount: Math.round(Number(it.amount) || 0),
      currency: it.currency === "USD" ? "USD" : "UZS",
      kind: it.kind === "settlement" ? ("settlement" as const) : ("advance" as const),
      date: it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : null,
      period: it.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(it.period) ? it.period : null,
      note: it.note?.trim() || null,
    }))
    .filter((it) => it.amount > 0 && it.nameAsWritten);

  return {
    intent: raw.intent === "payout" || raw.intent === "balance_query" ? raw.intent : "unknown",
    transcript: String(raw.transcript || input.text || "").trim(),
    items,
    queryNames: Array.isArray(raw.queryNames) ? raw.queryNames.map(String) : [],
  };
}

// ─── Offline fallback (used when Gemini is unavailable) ──────────────────────

const AMOUNT_RE =
  /(\$\s*)?(\d+(?:[.,]\d+)?(?:[ \u00a0]\d{3})*)\s*(mln|million|миллион|млн|mlrd|ming|минг|тысяч|тыс|k)?\.?\s*(so['ʻ’`]?m|сум|сўм|uzs|\$|dollar|usd|доллар)?/gi;

const SETTLEMENT_RE = /raschot|расч[её]т|oylik|зарплат|zarplata|qoldi/i;
const NAME_STOP = new Set([
  "avans", "аванс", "raschot", "расчет", "расчёт", "oylik", "berdim", "berildi", "berdik", "som", "so'm", "сум",
  "naqd", "karta", "kartaga", "mln", "ming", "uchun", "va", "bilan", "dollar", "raschoti", "oyligi", "avansi",
  "yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "sentyabr", "oktabr", "oktyabr",
  "noyabr", "dekabr",
]);

function stripSuffix(word: string): string {
  return word.replace(/(ga|ka|qa|ning|dan|ni|га|ка|қа|нинг|дан|ни)$/i, "");
}

/**
 * Minimal rule-based parse: "<Ism> [avans|raschot] <summa>" segments separated by commas / "va".
 * Only meant to keep the bot usable when the AI call fails; employees are resolved by name match later.
 */
export function parsePayoutLocally(text: string): ParsedPayoutMessage {
  const items: ParsedPayoutItem[] = [];
  const segments = text.split(/,(?!\d)|[;\n]|\s+va\s+|\s+и\s+/i).map((s) => s.trim()).filter(Boolean);
  let lastUnit: string | undefined;
  const pending: { name: string; raw: number; unit?: string; usd: boolean; kind: ParsedPayoutItem["kind"]; note: string | null }[] = [];

  for (const seg of segments) {
    AMOUNT_RE.lastIndex = 0;
    const m = [...seg.matchAll(AMOUNT_RE)].find((x) => /\d/.test(x[2]));
    if (!m) continue;
    const raw = Number(m[2].replace(/[ \u00a0]/g, "").replace(",", "."));
    const unit = m[3]?.toLowerCase();
    if (unit) lastUnit = unit;
    const usd = Boolean(m[1]) || /\$|dollar|usd|доллар/i.test(m[4] ?? "");
    const words = seg
      .replace(m[0], " ")
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}'ʻ’`]/gu, ""))
      .filter((w) => w.length >= 2 && !NAME_STOP.has(w.toLowerCase()));
    const name = words.slice(0, 2).map(stripSuffix).join(" ").trim();
    if (!name) continue;
    pending.push({
      name,
      raw,
      unit,
      usd,
      kind: SETTLEMENT_RE.test(seg) || SETTLEMENT_RE.test(text) ? "settlement" : "advance",
      note: /karta|карт/i.test(seg) ? "kartaga" : null,
    });
  }

  for (const p of pending) {
    // "Vali 300, Ali 200 ming" — a unit written once applies to the bare numbers too.
    const unit = p.unit ?? lastUnit;
    const mult = !unit ? 1 : /mln|million|миллион|млн/.test(unit) ? 1_000_000 : /mlrd/.test(unit) ? 1_000_000_000 : 1_000;
    const amount = Math.round(p.raw * mult);
    if (amount <= 0) continue;
    items.push({
      nameAsWritten: p.name,
      employeeId: null,
      amount,
      currency: p.usd ? "USD" : "UZS",
      kind: p.kind,
      date: null,
      period: null,
      note: p.note,
    });
  }

  return { intent: items.length ? "payout" : "unknown", transcript: text, items, queryNames: [] };
}
