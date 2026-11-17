import { getGeminiApiKeys, isKeyCoolingDown, markKeyCooldown } from "./gateway";

/** A Gemini content part: plain text or inline media (e.g. a Telegram voice note). */
export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

const MODEL_CANDIDATES = () =>
  Array.from(
    new Set([
      ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL.trim().toLowerCase().replace(/\s+/g, "-")] : []),
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
    ])
  );

function isQuotaError(msg: string): boolean {
  const s = msg.toLowerCase();
  return s.includes("429") || s.includes("quota") || s.includes("resource_exhausted") || s.includes("503") || s.includes("overloaded");
}

/**
 * Single-shot Gemini call that must answer with JSON matching `responseSchema`.
 * Rotates API keys on quota errors (shared cooldown state with the copilot gateway)
 * and falls through the model candidates when a model is unavailable.
 */
export async function callGeminiStructured<T>(opts: {
  systemText: string;
  parts: GeminiPart[];
  responseSchema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) throw new Error("Gemini API kaliti sozlanmagan");

  const ordered = [...keys.filter((k) => !isKeyCoolingDown(k)), ...keys.filter((k) => isKeyCoolingDown(k))];
  const payload = {
    systemInstruction: { parts: [{ text: opts.systemText }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
    },
  };

  let lastError: unknown = null;
  for (const key of ordered) {
    for (const model of MODEL_CANDIDATES()) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 25000),
          }
        );
        if (!res.ok) throw new Error(`Gemini ${res.status} ${await res.text()}`);
        const data = await res.json();
        const text: string = (data.candidates?.[0]?.content?.parts || [])
          .map((p: { text?: string }) => p.text || "")
          .join("");
        if (!text) throw new Error("Gemini bo'sh javob qaytardi");
        return JSON.parse(text) as T;
      } catch (err) {
        lastError = err;
        if (isQuotaError(String((err as Error)?.message || err))) {
          markKeyCooldown(key, 90);
          break; // next key
        }
        // otherwise try the next model with the same key
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini so'rovi bajarilmadi");
}
