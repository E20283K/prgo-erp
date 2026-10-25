import {
  CopilotUiContext,
  CopilotMessage,
  CopilotResponse,
  CopilotToolStep,
  CopilotClientAction,
  CopilotMetric,
  CopilotTable,
  CopilotProviderMode,
} from "./types";
import { PRINTGOO_SYSTEM_PROMPT } from "./domain-knowledge";
import {
  ERP_TOOL_DEFINITIONS,
  executeErpTool,
  ToolExecutionResult,
} from "./tools";

/**
 * Helper to collect all Gemini API keys from various environment variables:
 * - GEMINI_API_KEYS (comma, semicolon, or newline-separated)
 * - GEMINI_API_KEY / GOOGLE_API_KEY
 * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3... (up to 10)
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  const rawList = process.env.GEMINI_API_KEYS;
  if (rawList) {
    keys.push(...rawList.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean));
  }

  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  if (process.env.GOOGLE_API_KEY) keys.push(process.env.GOOGLE_API_KEY.trim());

  // Numbered keys: GEMINI_API_KEY_1 .. GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k.trim());
  }

  // If no keys found in process.env (e.g. dev server was running before .env edit), read .env from disk
  if (keys.length === 0 && typeof process !== "undefined" && typeof window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split(/\r?\n/)) {
          const m = line.match(/^\s*(GEMINI_API_KEY(?:S|_\d+)?)\s*=\s*(.*)?\s*$/);
          if (m && m[2]) {
            let v = m[2].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (v) keys.push(...v.split(/[,;\n]+/).map((k: string) => k.trim()).filter(Boolean));
          }
        }
      }
    } catch (_) {}
  }

  // De-duplicate while preserving order
  return Array.from(new Set(keys.filter((k) => k.length > 5)));
}

// In-memory Cooldown tracking for rate-limited (HTTP 429) keys
const geminiKeyCooldowns = new Map<string, number>();
let geminiKeyIndex = 0;

function isKeyCoolingDown(key: string): boolean {
  const cooldownUntil = geminiKeyCooldowns.get(key);
  if (!cooldownUntil) return false;
  if (Date.now() > cooldownUntil) {
    geminiKeyCooldowns.delete(key);
    return false;
  }
  return true;
}

function markKeyCooldown(key: string, durationSeconds: number = 60) {
  geminiKeyCooldowns.set(key, Date.now() + durationSeconds * 1000);
}

/**
 * Universal AI Gateway for PrintGoo ERP
 * Routes to Gemini (with multi-key rotation and failover) / OpenAI / Anthropic
 * if API keys are configured, otherwise runs the built-in Smart Local Engine fallback.
 */
export async function executeCopilotGateway(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: CopilotUiContext,
  companyCode: string = "PRINTGOO"
): Promise<CopilotResponse> {
  const latestMessage = messages[messages.length - 1];
  const query = latestMessage?.content?.trim() || "";

  // 1. Check configured external providers
  const geminiKeys = getGeminiApiKeys();
  const openAiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (geminiKeys.length > 0) {
    try {
      return await executeGeminiGatewayWithFailover(messages, context, geminiKeys, companyCode);
    } catch (err) {
      console.warn("All Gemini keys in pool failed or exhausted, falling back to next provider or local engine:", err);
    }
  }

  if (openAiKey) {
    try {
      return await executeOpenAiGateway(messages, context, openAiKey, companyCode);
    } catch (err) {
      console.warn("OpenAI gateway failed, falling back to Smart Local Engine:", err);
    }
  }

  if (anthropicKey) {
    try {
      return await executeAnthropicGateway(messages, context, anthropicKey, companyCode);
    } catch (err) {
      console.warn("Anthropic gateway failed, falling back to Smart Local Engine:", err);
    }
  }

  // 2. Default to Smart Local Engine (Zero-Config)
  return executeSmartLocalEngine(query, context, companyCode);
}

// ─── SMART LOCAL INTENT & TOOL ENGINE ─────────────────────────────────────────

/**
 * Intelligent stemmer to strip generic conversational words in Uzbek, Russian, and English
 * so that questions like "qanday buyurtmalarimiz bor?" become undefined (match all items)
 * instead of filtering by the word "buyurtmalarimiz".
 */
function cleanSearchTerm(input: string): string | undefined {
  const genericRoots = [
    "buyurtm", "zakaz", "hujjat", "order",
    "ombor", "sklad", "mahsul", "tovar", "material", "qoldiq", "ostatk",
    "qarz", "dolg", "balans", "moliya",
    "dastgoh", "stanok", "apparat", "mashin",
    "qanday", "qanaqa", "nima", "qaysi", "hamma", "barcha", "bor", "mavjud",
    "ko'rsat", "korsat", "ber", "ayt", "haqida", "tekshir", "ro'yxat", "royxat",
    "shu", "ushbu", "bizning", "bizda", "bizga", "menga", "bormi", "bormikin",
    "qani", "holat", "holati", "barcha", "keltir"
  ];

  const words = input
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 3) return false;
      return !genericRoots.some((root) => w.startsWith(root));
    });

  return words.length > 0 ? words.join(" ") : undefined;
}

export async function executeSmartLocalEngine(
  query: string,
  context: CopilotUiContext,
  companyCode: string = "PRINTGOO"
): Promise<CopilotResponse> {
  const lower = query.toLowerCase().trim();
  const toolSteps: CopilotToolStep[] = [];
  const actions: CopilotClientAction[] = [];
  let metrics: CopilotMetric[] = [];
  let structuredTable: CopilotTable | undefined;

  // 1. SLASH COMMANDS
  if (lower.startsWith("/wo") || lower.startsWith("/order")) {
    const term = query.replace(/^\/(wo|order)\s*/i, "").trim();
    const res = await executeErpTool("queryWorkOrders", { query: term || undefined }, companyCode);
    return formatToolResponse(res, "smart_local");
  }

  if (lower.startsWith("/stock") || lower.startsWith("/ombor")) {
    const term = query.replace(/^\/(stock|ombor)\s*/i, "").trim();
    const res = await executeErpTool(
      "checkWarehouseInventory",
      { query: term || undefined, lowStockOnly: !term },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  if (lower.startsWith("/calc")) {
    const raw = query.replace(/^\/calc\s*/i, "").trim();
    const parsedQty = parseInt(raw.match(/\d+/)?.[0] || "5000", 10);
    const isFlexo = raw.includes("flexo") || raw.includes("etiketka");
    const gsm = parseInt(raw.match(/(\d+)\s*g/i)?.[1] || "150", 10);

    const res = await executeErpTool(
      "calculatePrintingEstimate",
      {
        technology: isFlexo ? "flexo" : "offset",
        quantity: parsedQty,
        paperGsm: gsm,
      },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  if (lower.startsWith("/debt") || lower.startsWith("/qarz") || lower.startsWith("/finance")) {
    const term = query.replace(/^\/(debt|qarz|finance)\s*/i, "").trim();
    const res = await executeErpTool(
      "queryFinanceAndSettlements",
      { query: term || undefined, hasDebtOnly: true },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  if (lower.startsWith("/machines") || lower.startsWith("/stanok")) {
    const res = await executeErpTool("getMachineQueueAndTelemetry", {}, companyCode);
    return formatToolResponse(res, "smart_local");
  }

  if (lower.startsWith("/draft")) {
    const raw = query.replace(/^\/draft\s*/i, "").trim();
    const res = await executeErpTool(
      "prepareDraftDocument",
      {
        type: "work-order",
        product: raw || "Yangi ofset buyurtmasi",
        quantity: 5000,
      },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // 2. ACTIVE TAB CONTEXT RESOLUTION
  // If the user refers to the currently open document ("shu buyurtma", "bu buyurtma", "current", "этот заказ", "ushbu")
  const refersToActiveTab =
    context.includeActiveTabContext &&
    context.activeTabId &&
    (lower.includes("shu") ||
      lower.includes("ushbu") ||
      lower.includes("bu") ||
      lower.includes("current") ||
      lower.includes("этот") ||
      lower.includes("holati") ||
      lower.includes("qanday") ||
      lower.includes("tekshir"));

  if (refersToActiveTab) {
    if (context.activeTabType === "work-order" || context.activeTabId?.startsWith("WO")) {
      const res = await executeErpTool(
        "queryWorkOrders",
        { docNo: context.activeTabId },
        companyCode
      );
      return formatToolResponse(res, "smart_local");
    }

    if (context.activeTabType === "warehouse-stock") {
      const res = await executeErpTool(
        "checkWarehouseInventory",
        { query: context.activeTabId },
        companyCode
      );
      return formatToolResponse(res, "smart_local");
    }

    if (context.activeTabType === "customer") {
      const res = await executeErpTool(
        "queryCrmAndSuppliers",
        { query: context.activeTabId, type: "client" },
        companyCode
      );
      return formatToolResponse(res, "smart_local");
    }
  }

  // 3. INTENT DETECTION VIA DOMAIN KEYWORDS
  // Work Orders / Production
  if (
    lower.includes("woof-") ||
    lower.includes("wofl-") ||
    lower.includes("wodg-") ||
    lower.includes("wo-") ||
    lower.includes("buyurtma") ||
    lower.includes("zakaz") ||
    lower.includes("work order") ||
    lower.includes("tiraj") ||
    lower.includes("catalog")
  ) {
    const docMatch = query.match(/(wo[ofldge]*-[\w\d-]+)/i)?.[1];
    const orderTerm = docMatch || cleanSearchTerm(query);

    const res = await executeErpTool(
      "queryWorkOrders",
      { query: orderTerm },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // Warehouse & Stock Balances
  if (
    lower.includes("stock") ||
    lower.includes("ombor") ||
    lower.includes("qoldiq") ||
    lower.includes("qog'oz") ||
    lower.includes("karton") ||
    lower.includes("plyonka") ||
    lower.includes("bo'yoq") ||
    lower.includes("brak") ||
    lower.includes("yetishmovchilik") ||
    lower.includes("defitsit") ||
    lower.includes("material") ||
    lower.includes("mahsulot") ||
    lower.includes("остаток")
  ) {
    const materialTerm = cleanSearchTerm(query);

    const res = await executeErpTool(
      "checkWarehouseInventory",
      { query: materialTerm, lowStockOnly: lower.includes("yetishmovchilik") || lower.includes("defitsit") },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // Machines / Equipment Telemetry
  if (
    lower.includes("heidelberg") ||
    lower.includes("komori") ||
    lower.includes("mark andy") ||
    lower.includes("bobst") ||
    lower.includes("stanok") ||
    lower.includes("dastgoh") ||
    lower.includes("machine") ||
    lower.includes("press") ||
    lower.includes("oee") ||
    lower.includes("telemetriya") ||
    lower.includes("smena") ||
    lower.includes("смен")
  ) {
    const res = await executeErpTool("getMachineQueueAndTelemetry", {}, companyCode);
    return formatToolResponse(res, "smart_local");
  }

  // Finance / Debt / Settlements
  if (
    lower.includes("qarz") ||
    lower.includes("akt") ||
    lower.includes("sverki") ||
    lower.includes("schet") ||
    lower.includes("invoys") ||
    lower.includes("invoice") ||
    lower.includes("to'lov") ||
    lower.includes("debt") ||
    lower.includes("balans") ||
    lower.includes("settlement")
  ) {
    const res = await executeErpTool(
      "queryFinanceAndSettlements",
      { query: query, hasDebtOnly: true },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // CRM / Clients / Suppliers
  if (
    lower.includes("mijoz") ||
    lower.includes("klient") ||
    lower.includes("client") ||
    lower.includes("customer") ||
    lower.includes("ta'minotchi") ||
    lower.includes("supplier")
  ) {
    const isSup = lower.includes("ta'minotchi") || lower.includes("supplier");
    const res = await executeErpTool(
      "queryCrmAndSuppliers",
      { query: query, type: isSup ? "supplier" : "client" },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // Printing & Technological Calculation
  if (
    lower.includes("hisobla") ||
    lower.includes("smeta") ||
    lower.includes("priladka") ||
    lower.includes("kalkulyatsiya") ||
    lower.includes("calculate") ||
    lower.includes("tannarx")
  ) {
    const matchQty = parseInt(query.match(/\d[\d\s,.]*/)?.[0]?.replace(/[^\d]/g, "") || "5000", 10);
    const res = await executeErpTool(
      "calculatePrintingEstimate",
      {
        technology: lower.includes("flexo") ? "flexo" : "offset",
        quantity: matchQty,
        paperGsm: 150,
      },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // Draft Preparation
  if (
    lower.includes("yarat") ||
    lower.includes("ochib ber") ||
    lower.includes("qoralama") ||
    lower.includes("draft") ||
    lower.includes("yangi")
  ) {
    const res = await executeErpTool(
      "prepareDraftDocument",
      {
        type: "work-order",
        product: "Yangi buyurtma qoralamasi",
        quantity: 5000,
      },
      companyCode
    );
    return formatToolResponse(res, "smart_local");
  }

  // 4. GENERAL INDUSTRIAL RESPONSE WITH ACTIVE MODULE CONTEXT
  const moduleContextMap: Record<string, string> = {
    production: "Ishlab chiqarish (MES)",
    warehouse: "Ombor va logistika (WMS)",
    crm: "Mijozlar bilan aloqalar (CRM)",
    finance: "Moliya va hisob-kitoblar (1C)",
    hr: "Inson resurslari (HR)",
    settings: "Tizim sozlamalari",
  };

  const activeModName = moduleContextMap[context.activeModule] || "PrintGoo ERP";
  let fallbackMessage = `So'rovingiz tahlil qilindi. Joriy faol modul: **${activeModName}**.\n\n`;

  if (context.activeTabId && context.includeActiveTabContext) {
    fallbackMessage += `Faol hujjat kartochkasi: **${context.activeTabTitle || context.activeTabId}**.\n\n`;
  }

  fallbackMessage += `Quyidagi amallardan birini tanlashingiz yoki aniq buyruq kiritishingiz mumkin:\n`;
  fallbackMessage += `• Buyurtma tekshirish: \`/wo [buyurtma_raqami]\`\n`;
  fallbackMessage += `• Xomashyo qoldig'i: \`/stock [qog'oz_nomi]\`\n`;
  fallbackMessage += `• Bosma hisobi: \`/calc [tiraj]\`\n`;
  fallbackMessage += `• Mijoz qarzlari: \`/debt\`\n`;
  fallbackMessage += `• Stanoklar navbati: \`/machines\``;

  actions.push({
    id: "act-nav-module",
    type: "navigate_module",
    label: `${activeModName} registrini ko'rish`,
    iconName: "ArrowRight",
    payload: { module: context.activeModule },
  });

  return {
    success: true,
    message: fallbackMessage,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "contextAnalyzer",
        label: "Kontekst va registrlarni tahlil qilish",
        status: "done",
        summary: `${activeModName} moduli tahlil qilindi`,
      },
    ],
    actions,
    providerMode: "smart_local",
  };
}

function formatToolResponse(
  res: ToolExecutionResult,
  providerMode: CopilotProviderMode
): CopilotResponse {
  return {
    success: res.success,
    message: res.textResult,
    toolSteps: res.toolSteps,
    actions: res.actions,
    metrics: res.metrics,
    structuredTable: res.structuredTable,
    providerMode,
  };
}

// ─── CLOUD PROVIDER IMPLEMENTATIONS (GEMINI / OPENAI / ANTHROPIC) ────────────

/**
 * Executes Gemini request with automatic key rotation and failover.
 * If one key encounters HTTP 429 (Rate Limit / Quota Exceeded) or 503 (Overloaded),
 * it marks the key for cooldown and immediately retries the request using the next available key.
 */
async function executeGeminiGatewayWithFailover(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: CopilotUiContext,
  geminiKeys: string[],
  companyCode: string
): Promise<CopilotResponse> {
  if (geminiKeys.length === 0) {
    throw new Error("No Gemini API keys available");
  }

  // Sort keys: active (non-cooling) keys first, starting from round-robin pointer
  const total = geminiKeys.length;
  const orderedKeys: string[] = [];
  const startIdx = geminiKeyIndex % total;

  for (let i = 0; i < total; i++) {
    const k = geminiKeys[(startIdx + i) % total];
    if (!isKeyCoolingDown(k)) {
      orderedKeys.push(k);
    }
  }

  // If all keys are currently in cooldown, include them anyway as last resort
  if (orderedKeys.length === 0) {
    orderedKeys.push(...geminiKeys);
  }

  let lastError: any = null;

  for (let i = 0; i < orderedKeys.length; i++) {
    const currentKey = orderedKeys[i];
    const maskedKey = `...${currentKey.slice(-4)}`;

    try {
      const response = await executeGeminiGateway(messages, context, currentKey, companyCode);
      // Advance round-robin pointer on success
      geminiKeyIndex = (geminiKeyIndex + 1) % total;
      return response;
    } catch (err: any) {
      lastError = err;
      const errString = String(err?.message || err).toLowerCase();
      const isRateLimitOrQuota =
        errString.includes("429") ||
        errString.includes("quota") ||
        errString.includes("resource_exhausted") ||
        errString.includes("rate limit") ||
        errString.includes("503") ||
        errString.includes("overloaded");

      if (isRateLimitOrQuota) {
        markKeyCooldown(currentKey, 90); // 90 seconds cooldown
        const remaining = orderedKeys.length - i - 1;
        console.warn(
          `[Gemini Key Failover] Key ${maskedKey} reached rate limit/quota (HTTP 429/503). Switching to next key (${remaining} candidate(s) left)...`
        );
        if (remaining > 0) {
          continue; // Try next key
        }
      } else {
        // For other unexpected errors, also attempt failover if multiple keys exist
        if (i < orderedKeys.length - 1) {
          console.warn(`[Gemini Key Failover] Error on key ${maskedKey}: ${errString}. Trying next key...`);
          continue;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini API keys in pool failed.");
}

async function executeGeminiGateway(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: CopilotUiContext,
  apiKey: string,
  companyCode: string
): Promise<CopilotResponse> {
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const modelCandidates = Array.from(
    new Set([
      configuredModel.trim().toLowerCase().replace(/\s+/g, "-"),
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ])
  );

  // Map tool declarations to Gemini format
  const functionDeclarations = ERP_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  const systemInstruction = {
    parts: [
      {
        text: `${PRINTGOO_SYSTEM_PROMPT}\n\nJORIY ISH MAYDONI KONTEKSTI:\n- Faol modul: ${context.activeModule}\n- Faol hujjat: ${context.activeTabId || "Yo'q"} (${context.activeTabTitle || "—"})\n- Foydalanuvchi roli: ${context.userRole || "Operator"}\n- Til: ${context.locale || "uz"}\n- Hujjat tafsilotlari: ${JSON.stringify(context.activeDocumentSummary || {})}`,
      },
    ],
  };

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let lastModelError: any = null;

  for (const modelName of modelCandidates) {
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const allToolSteps: CopilotToolStep[] = [];
    const allActions: CopilotClientAction[] = [];
    const collectedMetrics: CopilotMetric[] = [];
    let collectedTable: CopilotTable | undefined;
    const sessionContents = [...contents];

    try {
      // Multi-step tool loop (max 3 turns)
      for (let loop = 0; loop < 3; loop++) {
        const payload = {
          systemInstruction,
          contents: sessionContents,
          tools: [{ functionDeclarations }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        };

        const res = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000), // 6 seconds timeout per attempt
        });

        if (!res.ok) {
          throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        const functionCalls = parts.filter((p: any) => p.functionCall);

        if (functionCalls.length === 0) {
          // Model returned final text answer
          const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
          return {
            success: true,
            message: textParts || "Operatsiya bajarildi.",
            toolSteps: allToolSteps,
            actions: allActions,
            metrics: collectedMetrics.length > 0 ? collectedMetrics : undefined,
            structuredTable: collectedTable,
            providerMode: "gemini",
          };
        }

        // Execute functions
        sessionContents.push(candidate.content);

        const responseParts: any[] = [];
        for (const fc of functionCalls) {
          const { name, args } = fc.functionCall;
          const toolRes = await executeErpTool(name, args, companyCode);

          if (toolRes.toolSteps) allToolSteps.push(...toolRes.toolSteps);
          if (toolRes.actions) allActions.push(...toolRes.actions);
          if (toolRes.metrics) collectedMetrics.push(...toolRes.metrics);
          if (toolRes.structuredTable) collectedTable = toolRes.structuredTable;

          responseParts.push({
            functionResponse: {
              name,
              response: {
                output: toolRes.data || toolRes.textResult,
                summary: toolRes.summary,
              },
            },
          });
        }

        sessionContents.push({
          role: "function",
          parts: responseParts,
        });
      }

      return {
        success: true,
        message: "So'rov bo'yicha operatsiyalar bajarildi.",
        toolSteps: allToolSteps,
        actions: allActions,
        metrics: collectedMetrics,
        structuredTable: collectedTable,
        providerMode: "gemini",
      };
    } catch (err: any) {
      lastModelError = err;
      const errStr = String(err?.message || err).toLowerCase();
      console.warn(`[Gemini Model Cascade] Model ${modelName} failed (${errStr}). Trying next candidate...`);
    }
  }

  throw lastModelError || new Error("All Gemini model candidates failed.");
}

async function executeOpenAiGateway(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: CopilotUiContext,
  apiKey: string,
  companyCode: string
): Promise<CopilotResponse> {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const tools = ERP_TOOL_DEFINITIONS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const systemMessage = {
    role: "system",
    content: `${PRINTGOO_SYSTEM_PROMPT}\n\nJORIY ISH MAYDONI KONTEKSTI:\n- Faol modul: ${context.activeModule}\n- Faol hujjat: ${context.activeTabId || "Yo'q"}\n- Til: ${context.locale || "uz"}`,
  };

  const openAiMessages: any[] = [systemMessage, ...messages];
  const allToolSteps: CopilotToolStep[] = [];
  let allActions: CopilotClientAction[] = [];
  let collectedMetrics: CopilotMetric[] = [];
  let collectedTable: CopilotTable | undefined;

  const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  for (let loop = 0; loop < 3; loop++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        messages: openAiMessages,
        tools,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message?.tool_calls || message.tool_calls.length === 0) {
      return {
        success: true,
        message: message?.content || "",
        toolSteps: allToolSteps,
        actions: allActions,
        metrics: collectedMetrics.length > 0 ? collectedMetrics : undefined,
        structuredTable: collectedTable,
        providerMode: "openai",
      };
    }

    openAiMessages.push(message);

    for (const tc of message.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch (_) {}

      const toolRes = await executeErpTool(name, args, companyCode);
      if (toolRes.toolSteps) allToolSteps.push(...toolRes.toolSteps);
      if (toolRes.actions) allActions.push(...toolRes.actions);
      if (toolRes.metrics) collectedMetrics.push(...toolRes.metrics);
      if (toolRes.structuredTable) collectedTable = toolRes.structuredTable;

      openAiMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        name,
        content: JSON.stringify(toolRes.data || toolRes.textResult),
      });
    }
  }

  return {
    success: true,
    message: "Operatsiyalar yakunlandi.",
    toolSteps: allToolSteps,
    actions: allActions,
    metrics: collectedMetrics,
    structuredTable: collectedTable,
    providerMode: "openai",
  };
}

async function executeAnthropicGateway(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: CopilotUiContext,
  apiKey: string,
  companyCode: string
): Promise<CopilotResponse> {
  // Simple fallback to Smart Local Engine if Anthropic SDK is not bundled
  return executeSmartLocalEngine(
    messages[messages.length - 1]?.content || "",
    context,
    companyCode
  );
}
