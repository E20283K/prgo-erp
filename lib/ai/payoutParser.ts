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
