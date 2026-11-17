import { getGeminiApiKeys, isKeyCoolingDown, markKeyCooldown } from "./gateway";

/** A Gemini content part: plain text or inline media (e.g. a Telegram voice note). */
export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

// Fast, reliable models first. 3.8-flash / 4-hydrogen are newer but were returning 503 / timing out
// under load when added (2026-11-17); the model cooldown below skips them quickly if they stay busy.
const DEFAULT_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash",
];

// A model that answered 503 / timed out is skipped for a while, so one busy model doesn't
// cost every request a 12-second wait.
const MODEL_COOLDOWN_MS = 2 * 60_000;
const modelCooldowns = new Map<string, number>();

function isModelCooling(model: string): boolean {
  const until = modelCooldowns.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    modelCooldowns.delete(model);
    return false;
  }
  return true;
}

const MODEL_CANDIDATES = () => {
  const all = Array.from(
    new Set([
      ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL.trim().toLowerCase().replace(/\s+/g, "-")] : []),
      ...DEFAULT_MODELS,
    ])
  );
  // Cooling models go to the back instead of being dropped, so a fully busy pool still gets tried.
  return [...all.filter((m) => !isModelCooling(m)), ...all.filter((m) => isModelCooling(m))];
};

function isModelBusyError(msg: string): boolean {
  const s = msg.toLowerCase();
  return s.includes("gemini 503") || s.includes("overloaded") || s.includes("high demand") || s.includes("timeout") || s.includes("aborted");
}

function isKeyQuotaError(msg: string): boolean {
  const s = msg.toLowerCase();
  return s.includes("gemini 429") || s.includes("resource_exhausted") || s.includes("quota");
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
  totalTimeoutMs?: number;
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

  // Bounded overall: the caller is usually a Telegram webhook that should answer within seconds.
  const deadline = Date.now() + (opts.totalTimeoutMs ?? 45000);
  const errors: string[] = [];
  let lastError: unknown = null;
  for (const [ki, key] of ordered.entries()) {
    for (const model of MODEL_CANDIDATES()) {
      const remaining = deadline - Date.now();
      if (remaining < 2000) break;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(Math.min(opts.timeoutMs ?? 12000, remaining)),
          }
        );
        if (!res.ok) throw new Error(`Gemini ${res.status} ${await res.text()}`);
        const data = await res.json();
        const text: string = (data.candidates?.[0]?.content?.parts || [])
          .filter((p: { thought?: boolean }) => !p.thought)
          .map((p: { text?: string }) => p.text || "")
          .join("")
          .trim()
          .replace(/^```(?:json)?\s*|\s*```$/g, "");
        if (!text) throw new Error(`bo'sh javob (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "?"})`);
        return JSON.parse(text) as T;
      } catch (err) {
        lastError = err;
        errors.push(`key${ki + 1}/${model}: ${String((err as Error)?.message || err).slice(0, 200)}`);
        // 429/quota is about the key → rotate keys. 503 "high demand" is about the model → just try the next model.
        if (isKeyQuotaError(String((err as Error)?.message || err))) {
          markKeyCooldown(key, 90);
          break; // next key
        }
        if (isModelBusyError(String((err as Error)?.message || err))) {
          modelCooldowns.set(model, Date.now() + MODEL_COOLDOWN_MS);
        }
      }
    }
  }
  console.error(`[Gemini structured] all attempts failed:\n  ${errors.join("\n  ")}`);
  throw lastError instanceof Error ? lastError : new Error("Gemini so'rovi bajarilmadi");
}
