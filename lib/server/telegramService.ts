import { db } from "@/db";
import fs from "fs";
import path from "path";
import {
  telegramChats,
  telegramMessages,
  quickReplyTemplates,
  clients,
  suppliers,
  supplierOrders,
  workOrders,
  workOrderAttachments,
  companies,
  type TelegramChat,
  type TelegramMessage,
  type QuickReplyTemplate,
  type TelegramCompanySettings,
  type TelegramChatSettings,
  type WorkOrderTelegramMeta,
} from "@/db/schema";
import { eq, desc, asc, and, sql, or, ilike, isNull } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { emitNotification } from "./notificationService";
import { generateTechCardImage } from "./techCardGenerator";
import { generateJobTicketPdf } from "./jobTicketPdfGenerator";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Development fallback mock token if not set
    return process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
  }
  return token;
}

/**
 * DB yoki .env dan faol Telegram Bot tokenni olish
 */
export async function getEffectiveTelegramBotToken(companyCode: string = "PRINTGOO"): Promise<string> {
  try {
    const comp = await db.query.companies.findFirst({
      where: eq(companies.code, companyCode),
    });
    if (comp?.settings?.telegram?.botToken && comp.settings.telegram.botToken.trim().length > 0) {
      return comp.settings.telegram.botToken.trim();
    }
  } catch (err) {
    console.warn("[getEffectiveTelegramBotToken] DB dan token olishda xatolik:", err);
  }
  return getTelegramBotToken();
}

const AVATARS_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "avatars");
const FILES_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "files");

function ensureFilesCacheDir() {
  if (!fs.existsSync(FILES_CACHE_DIR)) {
    fs.mkdirSync(FILES_CACHE_DIR, { recursive: true });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function workOrderMatchWhere(idOrDocNo: string) {
  return UUID_REGEX.test(idOrDocNo)
    ? or(eq(workOrders.id, idOrDocNo), eq(workOrders.docNo, idOrDocNo))
    : eq(workOrders.docNo, idOrDocNo);
}

function supplierOrderMatchWhere(idOrOrderNo: string) {
  return UUID_REGEX.test(idOrOrderNo)
    ? or(eq(supplierOrders.id, idOrOrderNo), eq(supplierOrders.orderNo, idOrOrderNo))
    : eq(supplierOrders.orderNo, idOrOrderNo);
}

function chatMatchWhere(idOrChatId: string) {
  return UUID_REGEX.test(idOrChatId)
    ? or(eq(telegramChats.id, idOrChatId), eq(telegramChats.chatId, idOrChatId))
    : eq(telegramChats.chatId, idOrChatId);
}

function ensureCacheDir() {
  if (!fs.existsSync(AVATARS_CACHE_DIR)) {
    fs.mkdirSync(AVATARS_CACHE_DIR, { recursive: true });
  }
}

/**
 * Telegram faylini (avatar/rasm) yuklab olib, lokal keshga (diskka) saqlash
 */
export async function downloadAndCacheTelegramPhoto(
  botToken: string,
  filePath: string,
  fileName: string
): Promise<string | null> {
  try {
    ensureCacheDir();
    const localPath = path.join(AVATARS_CACHE_DIR, fileName);

    // Agar keshdagi rasm mavjud va hajmi to'g'ri bo'lsa
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      return `/cache/telegram/avatars/${fileName}`;
    }

    const downloadUrl = `${TELEGRAM_API_BASE}/file/bot${botToken}/${filePath}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      console.warn(`[downloadAndCacheTelegramPhoto] download failed status ${res.status}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
    return `/cache/telegram/avatars/${fileName}`;
  } catch (err) {
    console.error("[downloadAndCacheTelegramPhoto] error:", err);
    return null;
  }
}

/**
 * Foydalanuvchi yoki guruh uchun zamonaviy Telegram uslubidagi SVG avatarni keshga yaratish
 */
export function generateSvgAvatar(type: "user" | "chat" | "bot", id: string, name: string): string {
  ensureCacheDir();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${type}_${safeId}.svg`;
  const localPath = path.join(AVATARS_CACHE_DIR, fileName);

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return `/cache/telegram/avatars/${fileName}`;
  }

  const initials = (name || (type === "chat" ? "TG" : type === "bot" ? "BOT" : "U"))
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || (type === "chat" ? "TG" : "U");

  const colors = [
    ["#3B82F6", "#1D4ED8"], // Blue
    ["#10B981", "#047857"], // Emerald
    ["#F59E0B", "#B45309"], // Amber
    ["#EF4444", "#B91C1C"], // Red
    ["#8B5CF6", "#6D28D9"], // Purple
    ["#EC4899", "#BE185D"], // Pink
    ["#06B6D4", "#0E7490"], // Cyan
    ["#14B8A6", "#0F766E"], // Teal
  ];

  const hash = Math.abs(
    (id + name).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  const [col1, col2] = colors[hash % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${col1}" />
      <stop offset="100%" stop-color="${col2}" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g_${safeId})" />
  <text x="50%" y="54%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="50" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
</svg>`;

  fs.writeFileSync(localPath, svg, "utf-8");
  return `/cache/telegram/avatars/${fileName}`;
}

/**
 * Telegram Botining o'z rasmini (avatarini) olish va diskda keshlab saqlash
 */
export async function getTelegramBotAvatarUrl(botToken?: string): Promise<string | null> {
  const token = botToken || (await getEffectiveTelegramBotToken());
  if (!token) return null;

  const fileName = "bot.jpg";
  const localPath = path.join(AVATARS_CACHE_DIR, fileName);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return `/cache/telegram/avatars/${fileName}`;
  }

  try {
    const meRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok || !meData.result?.id) return null;
    const botId = meData.result.id;

    let photoFileId: string | null = null;

    // 1. getChat orqali bot rasmini tekshirish
    const chatRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getChat?chat_id=${botId}`);
    const chatData = await chatRes.json();
    if (chatData.ok && chatData.result?.photo?.small_file_id) {
      photoFileId = chatData.result.photo.small_file_id;
    }

    // 2. getUserProfilePhotos orqali bot rasmini tekshirish
    if (!photoFileId) {
      const photosRes = await fetch(
        `${TELEGRAM_API_BASE}/bot${token}/getUserProfilePhotos?user_id=${botId}&limit=1`
      );
      const photosData = await photosRes.json();
      if (photosData.ok && photosData.result?.photos?.[0]?.[0]?.file_id) {
        photoFileId = photosData.result.photos[0][0].file_id;
      }
    }

    if (photoFileId) {
      const fileRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${photoFileId}`);
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        return await downloadAndCacheTelegramPhoto(token, fileData.result.file_path, fileName);
      }
    }
  } catch (err) {
    console.warn("[getTelegramBotAvatarUrl] error:", err);
  }

  // Fallback: Bot nomiga mos SVG
  return generateSvgAvatar("bot", "bot", "Bot");
}

/**
 * Telegram foydalanuvchisining profil rasmini (avatarini) olish va diskda keshlab saqlash
 */
export async function getTelegramUserAvatarUrl(
  botToken: string,
  userId: string | number,
  senderName?: string
): Promise<string | null> {
  if (!botToken || !userId) return null;

  const idStr = String(userId);
  const jpgName = `user_${idStr}.jpg`;
  const localJpg = path.join(AVATARS_CACHE_DIR, jpgName);

  if (fs.existsSync(localJpg) && fs.statSync(localJpg).size > 0) {
    return `/cache/telegram/avatars/${jpgName}`;
  }

  try {
    let photoFileId: string | null = null;

    // 1. getUserProfilePhotos
    const res = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (data.ok && data.result?.photos?.[0]?.[0]?.file_id) {
      photoFileId = data.result.photos[0][0].file_id;
    }

    // 2. Agar getUserProfilePhotos topilmasa, getChat orqali
    if (!photoFileId) {
      const chatRes = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getChat?chat_id=${userId}`);
      const chatData = await chatRes.json();
      if (chatData.ok && chatData.result?.photo?.small_file_id) {
        photoFileId = chatData.result.photo.small_file_id;
      }
    }

    if (photoFileId) {
      const fileRes = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getFile?file_id=${photoFileId}`);
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        const cached = await downloadAndCacheTelegramPhoto(botToken, fileData.result.file_path, jpgName);
        if (cached) return cached;
      }
    }
  } catch (err) {
    console.warn("[getTelegramUserAvatarUrl] error:", err);
  }

  // Telegram maxfiylik tufayli rasm berilmasa yoki foydalanuvchida rasm bo'lmasa,
  // foydalanuvchi ismi bilan zamonaviy SVG avatarni keshga yozamiz
  return generateSvgAvatar("user", idStr, senderName || "Foydalanuvchi");
}

/**
 * Telegram guruhi yoki chatining rasmini olish va diskda keshlab saqlash
 */
export async function getTelegramChatPhotoUrl(
  botToken: string,
  chatId: string | number,
  title?: string
): Promise<string | null> {
  if (!botToken || !chatId) return null;

  const idStr = String(chatId);
  const safeId = idStr.replace(/[^a-zA-Z0-9_-]/g, "_");
  const jpgName = `chat_${safeId}.jpg`;
  const localJpg = path.join(AVATARS_CACHE_DIR, jpgName);

  if (fs.existsSync(localJpg) && fs.statSync(localJpg).size > 0) {
    return `/cache/telegram/avatars/${jpgName}`;
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    if (data.ok && data.result?.photo?.small_file_id) {
      const fileRes = await fetch(
        `${TELEGRAM_API_BASE}/bot${botToken}/getFile?file_id=${data.result.photo.small_file_id}`
      );
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        const cached = await downloadAndCacheTelegramPhoto(botToken, fileData.result.file_path, jpgName);
        if (cached) return cached;
      }
    }
  } catch (err) {
    console.warn("[getTelegramChatPhotoUrl] error:", err);
  }

  // Guruhda rasm bo'lmasa, guruh nomi bosh harflari bilan SVG kesh yaratamiz
  return generateSvgAvatar("chat", safeId, title || "Guruh");
}

/**
 * Barcha chatlar va xabarlar avatarlarini bir martalik keshga yuklash va bazani sinxronlash
 */
export async function backfillTelegramAvatars(companyCode: string = "PRINTGOO"): Promise<{
  botAvatarUrl: string | null;
  updatedChats: number;
  updatedMessages: number;
}> {
  const token = await getEffectiveTelegramBotToken(companyCode);
  const botAvatarUrl = await getTelegramBotAvatarUrl(token);

  let updatedChats = 0;
  let updatedMessages = 0;

  try {
    // 1. Guruhlarning rasmlarini keshga yuklash
    const allChats = await db.select().from(telegramChats);
    for (const c of allChats) {
      const cachedPhoto = await getTelegramChatPhotoUrl(token, c.chatId, c.title);
      if (cachedPhoto && (c.photoUrl !== cachedPhoto || !c.photoUrl)) {
        await db
          .update(telegramChats)
          .set({ photoUrl: cachedPhoto })
          .where(eq(telegramChats.id, c.id));
        updatedChats++;
      }
    }

    // 2. Chiquvchi xabarlarga Bot avatarini biriktirish
    if (botAvatarUrl) {
      const res = await db
        .update(telegramMessages)
        .set({ senderAvatarUrl: botAvatarUrl })
        .where(
          and(
            eq(telegramMessages.isOutgoing, true),
            or(isNull(telegramMessages.senderAvatarUrl), ilike(telegramMessages.senderAvatarUrl, "%api.telegram.org%"))
          )
        );
      updatedMessages += Number(res);
    }

    // 3. Kiruvchi xabarlar uchun foydalanuvchilar avatarlarini keshga olish
    const distinctSenders = await db
      .select({
        senderId: telegramMessages.senderId,
        senderName: telegramMessages.senderName,
      })
      .from(telegramMessages)
      .where(
        and(
          eq(telegramMessages.isOutgoing, false),
          sql`${telegramMessages.senderId} IS NOT NULL`
        )
      )
      .groupBy(telegramMessages.senderId, telegramMessages.senderName);

    for (const sender of distinctSenders) {
      if (!sender.senderId) continue;
      const userAvatar = await getTelegramUserAvatarUrl(token, sender.senderId, sender.senderName || undefined);
      if (userAvatar) {
        await db
          .update(telegramMessages)
          .set({ senderAvatarUrl: userAvatar })
          .where(
            and(
              eq(telegramMessages.senderId, sender.senderId),
              or(isNull(telegramMessages.senderAvatarUrl), ilike(telegramMessages.senderAvatarUrl, "%api.telegram.org%"))
            )
          );
        updatedMessages++;
      }
    }
  } catch (err) {
    console.error("[backfillTelegramAvatars] error:", err);
  }

  return { botAvatarUrl, updatedChats, updatedMessages };
}


/**
 * Korxonaning Telegram integratsiya sozlamalarini olish
 */
export async function getTelegramSettings(companyCode: string = "PRINTGOO"): Promise<TelegramCompanySettings> {
  const companyId = await getCompanyIdByCode(companyCode);
  const comp = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  const tg = comp?.settings?.telegram || {};
  const envToken = getTelegramBotToken();

  return {
    botToken: tg.botToken || (envToken ? `${envToken.slice(0, 6)}...${envToken.slice(-4)}` : ""),
    botUsername: tg.botUsername || "",
    webhookUrl: tg.webhookUrl || "",
    isWebhookActive: tg.isWebhookActive ?? false,
    defaultNotificationLanguage: tg.defaultNotificationLanguage || "uz",
    autoCreateLeadsFromUnknownGroups: tg.autoCreateLeadsFromUnknownGroups ?? false,
  };
}

/**
 * Korxonaning Telegram sozlamalarini yangilash
 */
export async function saveTelegramSettings(
  companyCode: string = "PRINTGOO",
  settingsUpdate: Partial<TelegramCompanySettings>
): Promise<TelegramCompanySettings> {
  const companyId = await getCompanyIdByCode(companyCode);
  const comp = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!comp) {
    throw new Error("Korxona topilmadi");
  }

  const currentSettings = comp.settings || {};
  const currentTelegram = currentSettings.telegram || {};

  // Agar botToken kiritilmagan bo'lsa yoki yashirilgan ko'rinishda bo'lsa, eskisini saqlash
  let newBotToken = currentTelegram.botToken;
  if (settingsUpdate.botToken && !settingsUpdate.botToken.includes("...")) {
    newBotToken = settingsUpdate.botToken.trim();
  }

  const updatedTelegram: TelegramCompanySettings = {
    ...currentTelegram,
    ...settingsUpdate,
    botToken: newBotToken,
  };

  await db
    .update(companies)
    .set({
      settings: {
        ...currentSettings,
        telegram: updatedTelegram,
      },
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));

  return getTelegramSettings(companyCode);
}

/**
 * Bot ulanishini tekshirish (Telegram API getMe)
 */
export async function testTelegramConnection(tokenOverride?: string): Promise<{
  ok: boolean;
  bot?: { id: number; is_bot: boolean; first_name: string; username?: string };
  error?: string;
}> {
  const token = tokenOverride || (await getEffectiveTelegramBotToken());
  if (!token) {
    return { ok: false, error: "Telegram Bot Token kiritilmagan" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`, { method: "GET" });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, bot: data.result };
    }
    return { ok: false, error: data.description || "Telegram API ulanishda xatolik berdi" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Telegram API ga ulanib bo'lmadi" };
  }
}

/**
 * Webhookni Telegram API ga sozlash yoki bekor qilish
 */
export async function configureTelegramWebhook(
  action: "set" | "delete",
  webhookUrl?: string,
  tokenOverride?: string
): Promise<{ ok: boolean; description?: string }> {
  const token = tokenOverride || (await getEffectiveTelegramBotToken());
  if (!token) {
    return { ok: false, description: "Telegram Bot Token kiritilmagan" };
  }

  try {
    if (action === "set") {
      if (!webhookUrl) return { ok: false, description: "Webhook URL ko'rsatilmadi" };
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          ...(process.env.TELEGRAM_WEBHOOK_SECRET
            ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
            : {}),
        }),
      });
      const data = await res.json();
      return { ok: !!data.ok, description: data.description };
    } else {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/deleteWebhook`, { method: "POST" });
      const data = await res.json();
      return { ok: !!data.ok, description: data.description };
    }
  } catch (err: any) {
    return { ok: false, description: err?.message || "Webhook sozlashda tarmoq xatosi" };
  }
}

/**
 * Guruh sozlamalarini yangilash (Xabarnomalar va mas'uliyat)
 */
export async function updateTelegramChatSettings(
  chatRecordId: string,
  settings: Partial<TelegramChatSettings>,
  extra?: { assignedUserId?: string; clientId?: string }
): Promise<TelegramChat> {
  const chat = await db.query.telegramChats.findFirst({
    where: chatMatchWhere(chatRecordId),
  });

  if (!chat) {
    throw new Error("Guruh topilmadi");
  }

  const updatedSettings: TelegramChatSettings = {
    ...(chat.settings || {}),
    ...settings,
  };

  const updatePayload: Record<string, any> = {
    settings: updatedSettings,
    updatedAt: new Date(),
  };

  if (extra?.assignedUserId !== undefined) {
    updatePayload.assignedUserId = extra.assignedUserId;
  }
  if (extra?.clientId !== undefined) {
    updatePayload.clientId = extra.clientId;
    if (extra.clientId) updatePayload.status = "active";
  }

  const [updated] = await db
    .update(telegramChats)
    .set(updatePayload)
    .where(eq(telegramChats.id, chat.id))
    .returning();

  return updated;
}

export interface TelegramChatWithClient extends TelegramChat {
  clientName?: string | null;
  clientCode?: string | null;
  clientPhone?: string | null;
  supplierName?: string | null;
  supplierCode?: string | null;
  supplierCategory?: string | null;
  isSlaBreached?: boolean;
}

/**
 * 1. Barcha Telegram guruhlar va chatlarni olish (filtrlash bilan)
 */
export async function getTelegramChats(
  companyCode: string = "PRINTGOO",
  options?: {
    status?: "all" | "active" | "unlinked" | "archived" | "sla_breach";
    search?: string;
  }
): Promise<TelegramChatWithClient[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  let whereClause = eq(telegramChats.companyId, companyId);

  const rawChats = await db
    .select({
      chat: telegramChats,
      clientName: clients.name,
      clientCode: clients.code,
      clientPhone: clients.phone,
      supplierName: suppliers.name,
      supplierCode: suppliers.code,
      supplierCategory: suppliers.category,
    })
    .from(telegramChats)
    .leftJoin(clients, eq(telegramChats.clientId, clients.id))
    .leftJoin(suppliers, eq(telegramChats.supplierId, suppliers.id))
    .where(whereClause)
    .orderBy(desc(telegramChats.lastMessageAt));

  const now = new Date();
  const fifteenMinutesMs = 15 * 60 * 1000;

  let results: TelegramChatWithClient[] = rawChats.map(({ chat, clientName, clientCode, clientPhone, supplierName, supplierCode, supplierCategory }) => {
    let isSlaBreached = false;
    if (chat.unansweredSince) {
      const waitTime = now.getTime() - new Date(chat.unansweredSince).getTime();
      if (waitTime >= fifteenMinutesMs) {
        isSlaBreached = true;
      }
    }
    let photoUrl = chat.photoUrl;
    if (!photoUrl || photoUrl.includes("api.telegram.org")) {
      const safeId = chat.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
      photoUrl = fs.existsSync(path.join(AVATARS_CACHE_DIR, `chat_${safeId}.jpg`))
        ? `/cache/telegram/avatars/chat_${safeId}.jpg`
        : `/cache/telegram/avatars/chat_${safeId}.svg`;
    }
    return {
      ...chat,
      photoUrl,
      clientName,
      clientCode,
      clientPhone,
      supplierName,
      supplierCode,
      supplierCategory,
      isSlaBreached,
    };
  });

  // Filtrlash
  if (options?.status) {
    if (options.status === "sla_breach") {
      results = results.filter((c) => c.isSlaBreached);
    } else if (options.status !== "all") {
      results = results.filter((c) => c.status === options.status);
    }
  }

  if (options?.search && options.search.trim() !== "") {
    const q = options.search.toLowerCase().trim();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.clientName && c.clientName.toLowerCase().includes(q)) ||
        (c.supplierName && c.supplierName.toLowerCase().includes(q)) ||
        (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(q))
    );
  }

  return results;
}

/**
 * 2. Tanlangan chatning xabarlar tarixini olish va unreadCount ni 0 qilish
 */
export async function getTelegramChatMessages(
  chatId: string
): Promise<{
  chat: TelegramChatWithClient | null;
  messages: TelegramMessage[];
  bot: { avatarUrl: string };
}> {
  // Chatni topish (UUID yoki telegram chatId bo'yicha)
  const chatRecord = await db.query.telegramChats.findFirst({
    where: chatMatchWhere(chatId),
    with: {
      client: true,
      supplier: true,
    },
  });

  const botAvatar = (await getTelegramBotAvatarUrl()) || "/cache/telegram/avatars/bot.jpg";

  if (!chatRecord) {
    return { chat: null, messages: [], bot: { avatarUrl: botAvatar } };
  }

  // unreadCount ni 0 qilish
  if (chatRecord.unreadCount > 0) {
    await db
      .update(telegramChats)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(telegramChats.id, chatRecord.id));
  }

  const rawMessages = await db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.chatId, chatRecord.id))
    .orderBy(asc(telegramMessages.sentAt));

  const messages: TelegramMessage[] = rawMessages.map((m) => {
    let avatarUrl = m.senderAvatarUrl;
    if (m.isOutgoing) {
      avatarUrl = avatarUrl && !avatarUrl.includes("api.telegram.org") ? avatarUrl : botAvatar;
    } else if (!avatarUrl || avatarUrl.includes("api.telegram.org")) {
      if (m.senderId) {
        const jpg = path.join(AVATARS_CACHE_DIR, `user_${m.senderId}.jpg`);
        avatarUrl = fs.existsSync(jpg)
          ? `/cache/telegram/avatars/user_${m.senderId}.jpg`
          : `/cache/telegram/avatars/user_${m.senderId}.svg`;
      }
    }
    return {
      ...m,
      senderAvatarUrl: avatarUrl,
    };
  });

  const now = new Date();
  const isSlaBreached =
    chatRecord.unansweredSince &&
    now.getTime() - new Date(chatRecord.unansweredSince).getTime() >= 15 * 60 * 1000;

  let chatPhoto = chatRecord.photoUrl;
  if (!chatPhoto || chatPhoto.includes("api.telegram.org")) {
    const safeId = chatRecord.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
    chatPhoto = fs.existsSync(path.join(AVATARS_CACHE_DIR, `chat_${safeId}.jpg`))
      ? `/cache/telegram/avatars/chat_${safeId}.jpg`
      : `/cache/telegram/avatars/chat_${safeId}.svg`;
  }

  return {
    chat: {
      ...chatRecord,
      photoUrl: chatPhoto,
      clientName: chatRecord.client?.name ?? null,
      clientCode: chatRecord.client?.code ?? null,
      clientPhone: chatRecord.client?.phone ?? null,
      supplierName: chatRecord.supplier?.name ?? null,
      supplierCode: chatRecord.supplier?.code ?? null,
      supplierCategory: chatRecord.supplier?.category ?? null,
      isSlaBreached: Boolean(isSlaBreached),
    },
    messages,
    bot: {
      avatarUrl: botAvatar,
    },
  };
}

export interface SendTelegramMessageParams {
  chatId: string; // Database chat UUID or Telegram chatId
  text: string;
  senderName?: string;
  replyToTelegramMessageId?: number;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: any; // Telegram InlineKeyboardMarkup
  photoUrl?: string; // Image URL or local path
  documentUrl?: string; // Document/PDF URL
  fileName?: string;
  mediaBuffer?: Buffer;
  isPhoto?: boolean;
}

function resolveMediaBuffer(
  rawUrl?: string,
  defaultFileName?: string
): { buffer: Buffer; mimeType: string; fileName: string; isPhoto: boolean } | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("data:")) {
    const matches = rawUrl.match(/^data:([A-Za-z0-9-+./]+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const isPhoto = mimeType.startsWith("image/") && !mimeType.includes("svg");
      const ext = mimeType.includes("pdf")
        ? ".pdf"
        : mimeType.includes("png")
        ? ".png"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
        ? ".jpg"
        : mimeType.includes("dxf")
        ? ".dxf"
        : mimeType.includes("dwg")
        ? ".dwg"
        : ".bin";
      const fileName = defaultFileName || `file_${Date.now()}${ext}`;
      return { buffer, mimeType, fileName, isPhoto };
    }
  } else if (rawUrl.startsWith("/") || rawUrl.includes("/cache/") || rawUrl.includes("/uploads/")) {
    const cleanPath = rawUrl.split("?")[0].replace(/^\//, "");
    const absPath = path.join(process.cwd(), "public", cleanPath);
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      const buffer = fs.readFileSync(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const isPhoto = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
      const mimeType = isPhoto
        ? `image/${ext.replace(".", "")}`
        : ext === ".pdf"
        ? "application/pdf"
        : "application/octet-stream";
      return { buffer, mimeType, fileName: defaultFileName || path.basename(absPath), isPhoto };
    }
  }
  return null;
}

/**
 * 3. ERP orqali mijoz yoki ta'minotchi guruhiga xabar/buyurtma jo'natish
 */
export async function sendTelegramMessage(
  params: SendTelegramMessageParams
): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
  const chatRecord = await db.query.telegramChats.findFirst({
    where: chatMatchWhere(params.chatId),
  });

  if (!chatRecord) {
    return { success: false, error: "Telegram chat topilmadi" };
  }

  let tgMsgId = Math.floor(Date.now() / 1000);
  const token = await getEffectiveTelegramBotToken();

  let storedMediaUrl = params.photoUrl || params.documentUrl || null;
  const mediaBufferInfo = params.mediaBuffer
    ? {
        buffer: params.mediaBuffer,
        mimeType: params.isPhoto ? "image/png" : "application/octet-stream",
        fileName: params.fileName || "tech_card.png",
        isPhoto: params.isPhoto !== false,
      }
    : resolveMediaBuffer(params.photoUrl || params.documentUrl, params.fileName);

  if (mediaBufferInfo && storedMediaUrl && storedMediaUrl.startsWith("data:")) {
    ensureFilesCacheDir();
    const safeName = `${Date.now()}_${mediaBufferInfo.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const localDest = path.join(FILES_CACHE_DIR, safeName);
    try {
      fs.writeFileSync(localDest, mediaBufferInfo.buffer);
      storedMediaUrl = `/cache/telegram/files/${safeName}`;
    } catch {}
  }

  // Agar real Telegram Bot Token mavjud bo'lsa, Telegram Bot API ga so'rov yuboramiz
  if (token && !token.includes("mock") && !token.includes("test")) {
    try {
      if (mediaBufferInfo) {
        // Binariy fayl (chizma/PDF/rasm) ni multipart/form-data orqali jo'natish
        const form = new FormData();
        form.append("chat_id", chatRecord.chatId);
        if (params.text) form.append("caption", params.text);
        if (params.parseMode) form.append("parse_mode", params.parseMode);
        if (params.replyMarkup) form.append("reply_markup", JSON.stringify(params.replyMarkup));
        if (params.replyToTelegramMessageId) form.append("reply_to_message_id", String(params.replyToTelegramMessageId));

        const blob = new Blob([new Uint8Array(mediaBufferInfo.buffer)], { type: mediaBufferInfo.mimeType });
        const fieldName = mediaBufferInfo.isPhoto ? "photo" : "document";
        form.append(fieldName, blob, mediaBufferInfo.fileName);

        const endpoint = mediaBufferInfo.isPhoto ? "sendPhoto" : "sendDocument";
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${endpoint}`, {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (data.ok && data.result?.message_id) {
          tgMsgId = data.result.message_id;
        } else {
          console.warn(`[sendTelegramMessage] ${endpoint} error:`, data);
        }
      } else if (params.photoUrl && (params.photoUrl.startsWith("http://") || params.photoUrl.startsWith("https://"))) {
        // Rasm URL bilan yuborish
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatRecord.chatId,
            photo: params.photoUrl,
            caption: params.text,
            parse_mode: params.parseMode || "HTML",
            reply_markup: params.replyMarkup,
            reply_to_message_id: params.replyToTelegramMessageId,
          }),
        });
        const data = await response.json();
        if (data.ok && data.result?.message_id) {
          tgMsgId = data.result.message_id;
        }
      } else if (params.documentUrl && (params.documentUrl.startsWith("http://") || params.documentUrl.startsWith("https://"))) {
        // Hujjat URL bilan yuborish
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendDocument`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatRecord.chatId,
            document: params.documentUrl,
            caption: params.text,
            parse_mode: params.parseMode || "HTML",
            reply_markup: params.replyMarkup,
            reply_to_message_id: params.replyToTelegramMessageId,
          }),
        });
        const data = await response.json();
        if (data.ok && data.result?.message_id) {
          tgMsgId = data.result.message_id;
        }
      } else {
        // Oddiy matnli xabar yuborish
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatRecord.chatId,
            text: params.text,
            parse_mode: params.parseMode || "HTML",
            reply_to_message_id: params.replyToTelegramMessageId,
            reply_markup: params.replyMarkup,
          }),
        });
        const data = await response.json();
        if (data.ok && data.result?.message_id) {
          tgMsgId = data.result.message_id;
        }
      }
    } catch (err) {
      console.error("[sendTelegramMessage] Telegram API error:", err);
    }
  }

  // Bazada chiquvchi xabarni saqlash
  const botAvatarUrl = await getTelegramBotAvatarUrl(token);

  const [newMsg] = await db
    .insert(telegramMessages)
    .values({
      chatId: chatRecord.id,
      telegramMessageId: tgMsgId,
      senderName: params.senderName || "PrintGoo Menejer",
      senderAvatarUrl: botAvatarUrl || "/cache/telegram/avatars/bot.jpg",
      isOutgoing: true,
      text: params.text,
      mediaType: mediaBufferInfo?.isPhoto || params.photoUrl ? "photo" : mediaBufferInfo || params.documentUrl ? "document" : null,
      mediaUrl: storedMediaUrl,
      mediaFileName: mediaBufferInfo?.fileName || params.fileName || null,
      replyToTelegramMessageId: params.replyToTelegramMessageId,
      sentAt: new Date(),
    })
    .returning();

  // Chat holatini yangilash (SLA taymerini to'xtatish: unansweredSince = null)
  await db
    .update(telegramChats)
    .set({
      lastMessageAt: new Date(),
      lastMessageSnippet: params.text.slice(0, 150),
      unansweredSince: null, // Menejer javob berdi!
      updatedAt: new Date(),
    })
    .where(eq(telegramChats.id, chatRecord.id));

  return { success: true, message: newMsg };
}

/**
 * 4. Guruhni ERP dagi mijozga biriktirish va mas'ul menejerni belgilash
 */
export async function linkTelegramChatToClient(params: {
  chatId: string;
  clientId: string;
  assignedUserId?: string;
}): Promise<{ success: boolean; chat?: TelegramChat; error?: string }> {
  let resolvedClientId = params.clientId;
  if (!UUID_REGEX.test(resolvedClientId)) {
    const found = await db.query.clients.findFirst({
      where: or(eq(clients.code, resolvedClientId), eq(clients.name, resolvedClientId)),
    });
    if (found) {
      resolvedClientId = found.id;
    } else {
      return { success: false, error: `"${params.clientId}" kodli mijoz topilmadi` };
    }
  }

  const [updated] = await db
    .update(telegramChats)
    .set({
      clientId: resolvedClientId,
      supplierId: null,
      chatCategory: "client",
      assignedUserId: params.assignedUserId,
      status: "active",
      updatedAt: new Date(),
    })
    .where(chatMatchWhere(params.chatId))
    .returning();

  if (!updated) {
    return { success: false, error: "Guruh topilmadi" };
  }

  return { success: true, chat: updated };
}

/**
 * 4.1 Guruhni ERP dagi yetkazib beruvchiga (ta'minotchiga) biriktirish
 */
export async function linkTelegramChatToSupplier(params: {
  chatId: string;
  supplierId: string;
  assignedUserId?: string;
}): Promise<{ success: boolean; chat?: TelegramChat; error?: string }> {
  let resolvedSupplierId = params.supplierId;
  if (!UUID_REGEX.test(resolvedSupplierId)) {
    const found = await db.query.suppliers.findFirst({
      where: or(eq(suppliers.code, resolvedSupplierId), eq(suppliers.name, resolvedSupplierId)),
    });
    if (found) {
      resolvedSupplierId = found.id;
    } else {
      return { success: false, error: `"${params.supplierId}" kodli ta'minotchi topilmadi` };
    }
  }

  const [updated] = await db
    .update(telegramChats)
    .set({
      supplierId: resolvedSupplierId,
      clientId: null,
      chatCategory: "supplier",
      assignedUserId: params.assignedUserId,
      status: "active",
      updatedAt: new Date(),
    })
    .where(chatMatchWhere(params.chatId))
    .returning();

  if (!updated) {
    return { success: false, error: "Guruh topilmadi" };
  }

  return { success: true, chat: updated };
}

/**
 * 4.2 Guruhni biriktirishdan ozod qilish (Unlink)
 */
export async function unlinkTelegramChat(
  chatId: string
): Promise<{ success: boolean; chat?: TelegramChat; error?: string }> {
  const [updated] = await db
    .update(telegramChats)
    .set({
      clientId: null,
      supplierId: null,
      status: "unlinked",
      updatedAt: new Date(),
    })
    .where(chatMatchWhere(chatId))
    .returning();

  if (!updated) {
    return { success: false, error: "Guruh topilmadi" };
  }

  return { success: true, chat: updated };
}

/**
 * 4.3 Mijoz yoki ta'minotchi bo'yicha bog'langan faol guruhni olish
 */
export async function getLinkedTelegramChatForEntity(
  type: "client" | "supplier",
  entityId: string,
  companyCode: string = "PRINTGOO"
): Promise<TelegramChat | null> {
  const companyId = await getCompanyIdByCode(companyCode);

  let resolvedId = entityId;
  if (!UUID_REGEX.test(resolvedId)) {
    if (type === "client") {
      const found = await db.query.clients.findFirst({
        where: and(eq(clients.companyId, companyId), or(eq(clients.code, resolvedId), eq(clients.name, resolvedId))),
      });
      if (found) resolvedId = found.id;
      else return null;
    } else {
      const found = await db.query.suppliers.findFirst({
        where: and(eq(suppliers.companyId, companyId), or(eq(suppliers.code, resolvedId), eq(suppliers.name, resolvedId))),
      });
      if (found) resolvedId = found.id;
      else return null;
    }
  }

  const whereClause =
    type === "client"
      ? and(eq(telegramChats.companyId, companyId), eq(telegramChats.clientId, resolvedId))
      : and(eq(telegramChats.companyId, companyId), eq(telegramChats.supplierId, resolvedId));

  const chat = await db.query.telegramChats.findFirst({
    where: whereClause,
  });

  return chat || null;
}

/**
 * 4.4 Ish buyurtmasi (Work Order) ni mijozning Telegram guruhiga yuborish
 */
export async function sendWorkOrderToTelegram(params: {
  workOrderId: string;
  sendArtwork?: boolean;
  customMessage?: string;
  companyCode?: string;
}): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
  const companyCode = params.companyCode || "PRINTGOO";
  const companyId = await getCompanyIdByCode(companyCode);

  const order = await db.query.workOrders.findFirst({
    where: and(eq(workOrders.companyId, companyId), workOrderMatchWhere(params.workOrderId)),
    with: {
      client: true,
    },
  });

  if (!order) {
    return { success: false, error: "Ish buyurtmasi topilmadi" };
  }

  if (!order.clientId) {
    return { success: false, error: "Ushbu buyurtmaga mijoz biriktirilmagan" };
  }

  const linkedChat = await db.query.telegramChats.findFirst({
    where: and(
      eq(telegramChats.companyId, companyId),
      eq(telegramChats.clientId, order.clientId),
      eq(telegramChats.status, "active")
    ),
  });

  if (!linkedChat) {
    return {
      success: false,
      error: `"${order.client?.name || "Mijoz"}" uchun biriktirilgan faol Telegram guruh topilmadi. Avval mijoz profilidan guruhni ulang.`,
    };
  }

  const orderNo = order.docNo;
  const clientName = order.client?.name || order.customerName || "Mijoz";
  const productName = order.productName || "Poligrafiya mahsuloti";
  const quantity = Number(order.quantity || 0).toLocaleString("uz-UZ");
  const deliveryDate = order.deadline ? order.deadline : "Kelishilmoqda";
  const statusLabel = order.status;

  const textLines = [
    `📋 <b>BUYURTMA MA'LUMOTI: ${orderNo}</b>`,
    ``,
    `🏢 <b>Mijoz:</b> ${clientName}`,
    `📦 <b>Mahsulot:</b> ${productName}`,
    `🔢 <b>Miqdori:</b> ${quantity} dona`,
    `📅 <b>Topshirish muddati:</b> ${deliveryDate}`,
    `📌 <b>Holati:</b> ${statusLabel}`,
  ];

  if (params.customMessage?.trim()) {
    textLines.push(``);
    textLines.push(`💬 <i>Izoh: ${params.customMessage.trim()}</i>`);
  }

  textLines.push(``);
  textLines.push(`⚙️ <i>PrintGoo ERP avtomatlashtirilgan xabarnomasi</i>`);

  const fullText = textLines.join("\n");

  const sendResult = await sendTelegramMessage({
    chatId: linkedChat.id,
    text: fullText,
    senderName: "PrintGoo ERP",
    photoUrl: params.sendArtwork && order.photoUrl ? order.photoUrl : undefined,
    parseMode: "HTML",
  });

  return sendResult;
}

/**
 * 4.5 Yetkazib beruvchiga buyurtma (PO - CTP, Shtamp, Xomashyo) ni inline tugmalar bilan jo'natish
 */
/**
 * Poligrafik jarayon bosqichlari uchun vizual Stepper yasash
 */
export function buildProductionStepper(currentStage: string, currentStatus: string): string {
  const steps = [
    { key: "prepress", label: "Prepress" },
    { key: "print", label: "Chop etish" },
    { key: "finishing", label: "Shtamp/Ishlov" },
    { key: "packaging", label: "Qadoqlash" },
    { key: "completed", label: "Tayyor" },
  ];

  let activeIndex = 0;
  if (currentStage === "Queue") activeIndex = 0;
  else if (currentStage === "Ready to Print") activeIndex = 0;
  else if (currentStage === "In Production") activeIndex = 1;
  else if (currentStage === "Post-press") activeIndex = 2;
  else if (currentStage === "Packaging") activeIndex = 3;
  else if (currentStage === "Completed") activeIndex = 4;

  const renderedSteps = steps.map((s, idx) => {
    if (idx < activeIndex) return `[✓ ${s.label}]`;
    if (idx === activeIndex) return `[▶ ${s.label}]`;
    return `[○ ${s.label}]`;
  });

  return renderedSteps.join(" ➔ ");
}

export function escapeTelegramHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Telegram guruh uchun professional spetsifikatsiya va Stepper matnini shakllantirish
 */
export function formatWorkOrderTelegramCaption(order: any, customNote?: string): string {
  const orderNo = order.docNo || "ZAKAZ";
  const clientName = (order.client?.name || order.customerName || "MIJOZ").toUpperCase();
  const productName = order.productName || "Poligrafiya mahsuloti";
  const paperStock = order.paperStock || "Standart";

  const embellishments: string[] = [];
  if (order.coating) embellishments.push(order.coating);
  if (order.lamination) embellishments.push(order.lamination);
  if (order.embellishment) embellishments.push(order.embellishment);
  const finishingStr = embellishments.length > 0 ? embellishments.join(", ") : "Standart";

  let dimStr = "Standart";
  const dims = order.dimensions as any;
  if (dims?.width && dims?.height) {
    const w = Number(dims.width);
    const h = Number(dims.height);
    const unit = dims.dimensionUnit || "mm";
    if (unit === "mm") {
      dimStr = `${(h / 10).toFixed(1)} x ${(w / 10).toFixed(1)} cm (${h}x${w} mm)`;
    } else {
      dimStr = `${h} x ${w} ${unit}`;
    }
  }

  const quantity = Number(order.quantity || 0).toLocaleString("uz-UZ");
  const unit = order.unit || "dona";
  const deadline = order.deadline || "Kelishilmoqda";
  const statusLabel = order.status || "Active";
  const stageLabel = order.stage || "Queue";

  const stepper = buildProductionStepper(stageLabel, statusLabel);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const escapeHtml = escapeTelegramHtml;

  const lines = [
    `🏭 <b>* ${escapeHtml(clientName)} *</b>`,
    `📋 <b>BUYURTMA: ${escapeHtml(orderNo)}</b>`,
    ``,
    `🔄 <b>Jarayon:</b> ${stepper}`,
    `📌 <b>Holati:</b> ${escapeHtml(statusLabel)} (${escapeHtml(stageLabel)})`,
    ``,
    `📦 <b>Mahsulot:</b> ${escapeHtml(productName)}`,
    `📄 <b>Material:</b> ${escapeHtml(paperStock)}`,
    `✨ <b>Ishlov:</b> ${escapeHtml(finishingStr)}`,
    `📐 <b>O'lchami:</b> ${escapeHtml(dimStr)}`,
    `🔢 <b>Tiraj:</b> ${quantity} ${escapeHtml(unit)}`,
    `📅 <b>Topshirish:</b> ${escapeHtml(deadline)}`,
  ];

  if (customNote?.trim()) {
    lines.push(``);
    lines.push(`💬 <i>Izoh: ${escapeHtml(customNote.trim())}</i>`);
  }

  lines.push(``);
  lines.push(`🕒 <i>Yangilandi: ${timeStr} | PrintGoo ERP</i>`);

  return lines.join("\n");
}

/**
 * Buyurtmani markaziy 'Buyurtmalar guruhi'ga (yoki tanlangan guruhga)
 * yuqori sifatli kompozit rasm va Stepper-status bilan jo'natish
 */
export async function sendWorkOrderToOrdersGroup(params: {
  workOrderId: string;
  chatId?: string;
  customNote?: string;
  companyCode?: string;
  sendCardImage?: boolean;
  alertReply?: boolean;
}): Promise<{
  success: boolean;
  message?: TelegramMessage;
  telegramMeta?: WorkOrderTelegramMeta;
  error?: string;
}> {
  const companyCode = params.companyCode || "PRINTGOO";
  const companyId = await getCompanyIdByCode(companyCode);

  const order = await db.query.workOrders.findFirst({
    where: and(
      eq(workOrders.companyId, companyId),
      workOrderMatchWhere(params.workOrderId)
    ),
    with: {
      client: true,
      attachments: true,
    },
  });

  if (!order) {
    return { success: false, error: "Ish buyurtmasi topilmadi" };
  }

  const comp = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  let targetChatRecord: TelegramChat | null = null;
  const requestedChatId = params.chatId || comp?.settings?.telegram?.ordersChatId;

  if (requestedChatId) {
    const found = await db.query.telegramChats.findFirst({
      where: and(eq(telegramChats.companyId, companyId), chatMatchWhere(requestedChatId)),
    });
    if (found) targetChatRecord = found;
  }

  if (!targetChatRecord && order.clientId) {
    const clientChat = await db.query.telegramChats.findFirst({
      where: and(
        eq(telegramChats.companyId, companyId),
        eq(telegramChats.clientId, order.clientId),
        eq(telegramChats.status, "active")
      ),
    });
    if (clientChat) targetChatRecord = clientChat;
  }

  if (!targetChatRecord) {
    return {
      success: false,
      error: "Biriktirilgan Telegram guruh topilmadi. Avval Sozlamalardan 'Markaziy Buyurtmalar guruhi'ni belgilang yoki mijozga guruh biriktiring.",
    };
  }

  const caption = formatWorkOrderTelegramCaption(order, params.customNote);

  const dims = order.dimensions as any;
  const embellishments: string[] = [];
  if (order.coating) embellishments.push(order.coating);
  if (order.lamination) embellishments.push(order.lamination);
  if (order.embellishment) embellishments.push(order.embellishment);

  // Rasmiy A4 PDF Texnik Pasport (Job Ticket) generatsiyasi
  const pdfResult = await generateJobTicketPdf({
    docNo: order.docNo,
    clientName: order.client?.name || order.customerName || "Mijoz",
    productName: order.productName || "Poligrafiya mahsuloti",
    quantity: order.quantity,
    unit: order.unit,
    department: order.department,
    site: order.site || undefined,
    pressMachine: order.pressMachine || undefined,
    orderDate: order.orderDate || undefined,
    deadline: order.deadline || undefined,
    paperStock: order.paperStock || undefined,
    coating: order.coating || undefined,
    lamination: order.lamination || undefined,
    embellishment: order.embellishment || undefined,
    width: dims?.width ? Number(dims.width) : undefined,
    height: dims?.height ? Number(dims.height) : undefined,
    status: order.status,
    stage: order.stage,
    priority: order.priority,
    operations: (order as any).operations || [],
    notes: order.notes || undefined,
  });

  const messageText = params.alertReply
    ? `⚠️ <b>DIQQAT: BUYURTMA PARAMETRLARI YANGILANDI!</b>\n\n${caption}`
    : caption;

  const sendResult = await sendTelegramMessage({
    chatId: targetChatRecord.id,
    text: messageText,
    senderName: "PrintGoo ERP",
    mediaBuffer: pdfResult.buffer,
    fileName: pdfResult.fileName,
    documentUrl: pdfResult.publicUrl,
    isPhoto: false,
    replyToTelegramMessageId:
      params.alertReply && order.telegramMeta?.messageId ? order.telegramMeta.messageId : undefined,
    parseMode: "HTML",
  });

  if (sendResult.success && sendResult.message) {
    const updatedMeta: WorkOrderTelegramMeta = {
      chatId: targetChatRecord.id,
      messageId: sendResult.message.telegramMessageId,
      lastSentAt: new Date().toISOString(),
      channelTitle: targetChatRecord.title,
    };

    await db
      .update(workOrders)
      .set({
        telegramMeta: updatedMeta,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, order.id));

    await db
      .update(telegramMessages)
      .set({
        workOrderId: order.id,
        isAttachedToOrder: true,
      })
      .where(eq(telegramMessages.id, sendResult.message.id));

    return {
      ...sendResult,
      telegramMeta: updatedMeta,
    };
  }

  return sendResult;
}

/**
 * Buyurtmaning bosqichi yoki statusi o'zgarganda guruhdagi mavjud Telegram xabarini
 * 'editMessageCaption' (yoki replacePdf=true bo'lganda 'editMessageMedia') orqali jonli yangilash
 */
export async function updateTelegramOrderCardStatus(
  workOrderId: string,
  companyCode: string = "PRINTGOO",
  replacePdf: boolean = false,
  alertReply?: boolean,
  alertComment?: string
): Promise<{
  success: boolean;
  updated?: boolean;
  mediaReplaced?: boolean;
  alertSent?: boolean;
  telegramMeta?: WorkOrderTelegramMeta;
  error?: string;
}> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    const order = await db.query.workOrders.findFirst({
      where: and(
        eq(workOrders.companyId, companyId),
        workOrderMatchWhere(workOrderId)
      ),
      with: {
        client: true,
      },
    });

    if (!order) {
      return { success: false, error: "Buyurtma topilmadi" };
    }

    const meta = order.telegramMeta;
    if (!meta?.messageId || !meta?.chatId) {
      return { success: true, updated: false };
    }

    const chatRecord = await db.query.telegramChats.findFirst({
      where: and(eq(telegramChats.companyId, companyId), chatMatchWhere(meta.chatId)),
    });

    if (!chatRecord) {
      return { success: false, error: "Biriktirilgan Telegram chat topilmadi" };
    }

    const token = await getEffectiveTelegramBotToken(companyCode);
    if (!token) {
      return { success: false, error: "Telegram bot token topilmadi" };
    }

    const updatedCaption = formatWorkOrderTelegramCaption(order);
    const dims = order.dimensions as any;

    if (replacePdf) {
      try {
        const pdfResult = await generateJobTicketPdf({
          docNo: order.docNo,
          clientName: order.client?.name || order.customerName || "Mijoz",
          productName: order.productName || "Poligrafiya mahsuloti",
          quantity: order.quantity,
          unit: order.unit,
          department: order.department,
          site: order.site || undefined,
          pressMachine: order.pressMachine || undefined,
          orderDate: order.orderDate || undefined,
          deadline: order.deadline || undefined,
          paperStock: order.paperStock || undefined,
          coating: order.coating || undefined,
          lamination: order.lamination || undefined,
          embellishment: order.embellishment || undefined,
          width: dims?.width ? Number(dims.width) : undefined,
          height: dims?.height ? Number(dims.height) : undefined,
          status: order.status,
          stage: order.stage,
          priority: order.priority,
          operations: (order as any).operations || [],
          notes: order.notes || undefined,
        });

        const form = new FormData();
        form.append("chat_id", chatRecord.chatId);
        form.append("message_id", String(meta.messageId));
        form.append(
          "media",
          JSON.stringify({
            type: "document",
            media: "attach://document",
            caption: updatedCaption,
            parse_mode: "HTML",
          })
        );
        const blob = new Blob([new Uint8Array(pdfResult.buffer)], { type: "application/pdf" });
        form.append("document", blob, pdfResult.fileName);

        const mediaRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageMedia`, {
          method: "POST",
          body: form,
        });
        const mediaJson = await mediaRes.json();
        if (mediaJson.ok) {
          const updatedMeta: WorkOrderTelegramMeta = {
            ...meta,
            lastSentAt: new Date().toISOString(),
          };

          await db
            .update(workOrders)
            .set({
              telegramMeta: updatedMeta,
              updatedAt: new Date(),
            })
            .where(eq(workOrders.id, order.id));

          let alertSent = false;
          if (alertReply && meta.messageId) {
            try {
              const alertText = alertComment?.trim()
                ? `⚠️ <b>DIQQAT: BUYURTMA PARAMETRLARI YANGILANDI!</b>\nBuyurtma raqami: <b>#${escapeTelegramHtml(order.docNo)}</b>\nIzoh: <i>${escapeTelegramHtml(alertComment.trim())}</i>`
                : `⚠️ <b>DIQQAT: BUYURTMA PARAMETRLARI YANGILANDI!</b>\nBuyurtma raqami: <b>#${escapeTelegramHtml(order.docNo)}</b>\nYangi PDF texnik pasport yuklandi va spetsifikatsiyalar yangilandi.`;

              await sendTelegramMessage({
                chatId: chatRecord.id,
                text: alertText,
                senderName: "PrintGoo ERP",
                replyToTelegramMessageId: meta.messageId,
                parseMode: "HTML",
              });
              alertSent = true;
            } catch (replyErr) {
              console.warn("[updateTelegramOrderCardStatus] alertReply warning:", replyErr);
            }
          }

          return { success: true, updated: true, mediaReplaced: true, alertSent, telegramMeta: updatedMeta };
        } else {
          console.warn("[updateTelegramOrderCardStatus] editMessageMedia warning:", mediaJson);
        }
      } catch (mediaErr) {
        console.warn("[updateTelegramOrderCardStatus] editMessageMedia error, falling back to caption:", mediaErr);
      }
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatRecord.chatId,
        message_id: meta.messageId,
        caption: updatedCaption,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();
    if (data.ok) {
      const updatedMeta: WorkOrderTelegramMeta = {
        ...meta,
        lastSentAt: new Date().toISOString(),
      };

      await db
        .update(workOrders)
        .set({
          telegramMeta: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.id, order.id));

      let alertSent = false;
      if (alertReply && meta.messageId) {
        try {
          const alertText = alertComment?.trim()
            ? `⚠️ <b>DIQQAT: BUYURTMA STATUSI YANGILANDI!</b>\nBuyurtma raqami: <b>#${escapeTelegramHtml(order.docNo)}</b>\nIzoh: <i>${escapeTelegramHtml(alertComment.trim())}</i>`
            : `⚠️ <b>DIQQAT: BUYURTMA STATUSI YANGILANDI!</b>\nBuyurtma raqami: <b>#${escapeTelegramHtml(order.docNo)}</b>\nStatus: <b>${escapeTelegramHtml(order.status || "")}</b> | Bosqich: <b>${escapeTelegramHtml(order.stage || "")}</b>`;

          await sendTelegramMessage({
            chatId: chatRecord.id,
            text: alertText,
            senderName: "PrintGoo ERP",
            replyToTelegramMessageId: meta.messageId,
            parseMode: "HTML",
          });
          alertSent = true;
        } catch (replyErr) {
          console.warn("[updateTelegramOrderCardStatus] alertReply warning:", replyErr);
        }
      }

      return { success: true, updated: true, alertSent, telegramMeta: updatedMeta };
    } else {
      console.warn("[updateTelegramOrderCardStatus] editMessageCaption response:", data);
      return { success: false, error: data.description || "Tahrirlashda xatolik" };
    }
  } catch (err: any) {
    console.error("[updateTelegramOrderCardStatus] Error:", err);
    return { success: false, error: err?.message || "Server xatoligi" };
  }
}

export async function sendPurchaseOrderToTelegram(params: {
  supplierOrderId: string;
  customNote?: string;
  companyCode?: string;
  fileUrl?: string;
  fileName?: string;
  mediaBuffer?: Buffer;
  isPhoto?: boolean;
}): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
  const companyCode = params.companyCode || "PRINTGOO";
  const companyId = await getCompanyIdByCode(companyCode);

  const order = await db.query.supplierOrders.findFirst({
    where: and(
      eq(supplierOrders.companyId, companyId),
      supplierOrderMatchWhere(params.supplierOrderId)
    ),
    with: {
      supplier: true,
      workOrder: true,
    },
  });

  if (!order) {
    return { success: false, error: "Ta'minot buyurtmasi topilmadi" };
  }

  const linkedChat = await db.query.telegramChats.findFirst({
    where: and(
      eq(telegramChats.companyId, companyId),
      eq(telegramChats.supplierId, order.supplierId),
      eq(telegramChats.status, "active")
    ),
  });

  if (!linkedChat) {
    return {
      success: false,
      error: `"${order.supplier?.name || "Yetkazib beruvchi"}" uchun biriktirilgan faol Telegram guruh topilmadi. Avval ta'minotchi profilidan guruhni ulang.`,
    };
  }

  // 1. Faylni aniqlash (buyurtmaning o'zidan yoki bog'langan ish buyurtmasidan)
  let fileUrl = params.fileUrl || order.fileUrl || null;
  let fileName = params.fileName || order.fileName || null;

  if (!fileUrl && order.workOrderId) {
    try {
      const woAttachments = await db.query.workOrderAttachments.findMany({
        where: eq(workOrderAttachments.workOrderId, order.workOrderId),
      });

      if (woAttachments && woAttachments.length > 0) {
        if (order.orderType === "die_tooling") {
          const dieline = woAttachments.find(
            (a) => a.category === "dieline" || /\.(dxf|dwg|pdf|ai)$/i.test(a.name || a.url)
          );
          if (dieline) {
            fileUrl = dieline.url;
            fileName = dieline.name;
          }
        } else if (order.orderType === "ctp_plates" || order.orderType === "cliche") {
          const art = woAttachments.find(
            (a) =>
              a.category === "artwork" ||
              a.category === "proofs" ||
              /\.(pdf|ai|tiff?|png|jpe?g)$/i.test(a.name || a.url)
          );
          if (art) {
            fileUrl = art.url;
            fileName = art.name;
          }
        }

        if (!fileUrl && woAttachments[0]) {
          fileUrl = woAttachments[0].url;
          fileName = woAttachments[0].name;
        }
      }
    } catch (woAttErr) {
      console.warn("[sendPurchaseOrderToTelegram] Error fetching wo attachments:", woAttErr);
    }

    if (!fileUrl && order.workOrder?.photoUrl) {
      fileUrl = order.workOrder.photoUrl;
      fileName = `${order.workOrderNo || "buyurtma"}_namuna.jpg`;
    }
  }

  // Fayl topilgan bo'lsa, uni ta'minot buyurtmasi kartasida ham saqlab qo'yamiz
  if ((fileUrl && fileUrl !== order.fileUrl) || (fileName && fileName !== order.fileName)) {
    try {
      await db
        .update(supplierOrders)
        .set({
          fileUrl,
          fileName,
          updatedAt: new Date(),
        })
        .where(eq(supplierOrders.id, order.id));
    } catch (saveErr) {
      console.warn("[sendPurchaseOrderToTelegram] Failed to update file fields:", saveErr);
    }
  }

  const ORDER_TYPE_TITLES: Record<string, string> = {
    ctp_plates: "CTP Metall Forma (Ofset)",
    die_tooling: "Kesish Shtansformasi & Bigovka",
    cliche: "Folga / Kongrev Klishe",
    raw_materials: "Xomashyo & Materiallar",
    outsourcing: "Autsorsing xizmati",
    spare_parts: "Ehtiyot qismlar va servis",
  };

  const typeTitle = ORDER_TYPE_TITLES[order.orderType] || order.orderType;
  const deadline = order.deliveryDeadline || "Tezkor (kelishilgan vaqtda)";

  const textLines = [
    `📦 <b>TA'MINOT BUYURTMASI: ${order.orderNo}</b>`,
    "",
    `🏭 <b>Yetkazib beruvchi:</b> ${order.supplier?.name}`,
    `🔧 <b>Jihoz/Xizmat turi:</b> ${typeTitle}`,
    `📝 <b>Tavsif:</b> ${order.title}`,
  ];

  if (order.workOrderNo) {
    textLines.push(`📋 <b>Asosiy buyurtma:</b> ${order.workOrderNo}`);
  }

  textLines.push(`🔢 <b>Miqdori:</b> ${order.quantity} ${order.unit}`);
  textLines.push(`⏳ <b>Muddati:</b> ${deadline}`);

  if (order.specDetails?.trim()) {
    textLines.push("");
    textLines.push(`📐 <b>Spetsifikatsiya:</b>\n${order.specDetails.trim()}`);
  }

  if (fileName) {
    textLines.push("");
    textLines.push(`📎 <b>Biriktirilgan fayl:</b> ${fileName}`);
  }

  if (params.customNote?.trim()) {
    textLines.push("");
    textLines.push(`💬 <i>Izoh: ${params.customNote.trim()}</i>`);
  }

  textLines.push("");
  textLines.push("👇 <i>Iltimos, buyurtma holatini quyidagi tugmalar orqali belgilang:</i>");

  const fullText = textLines.join("\n");

  // Bosqichma-bosqich dinamik tugmalar
  let initialButtons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (order.status === "In_Production") {
    initialButtons = [
      [
        {
          text: "✅ Tayyor bo'ldi",
          callback_data: `po_status:${order.id}:Ready`,
        },
      ],
    ];
  } else if (order.status === "Ready") {
    initialButtons = [
      [
        {
          text: "🚚 Yo'lga chiqdi / Kuryerda",
          callback_data: `po_status:${order.id}:Delivered`,
        },
      ],
    ];
  } else if (order.status === "Delivered" || order.status === "Cancelled") {
    initialButtons = [];
  } else {
    // Dastlabki yuborilgan holat (Ordered / Draft): Qabul qilish yoki Rad etish
    initialButtons = [
      [
        {
          text: "🟢 Qabul qilish",
          callback_data: `po_status:${order.id}:In_Production`,
        },
        {
          text: "❌ Rad etish",
          callback_data: `po_status:${order.id}:Cancelled`,
        },
      ],
    ];
  }

  const replyMarkup = {
    inline_keyboard: initialButtons,
  };

  const isImage = Boolean(
    fileUrl &&
      (/\.(png|jpe?g|webp|gif)$/i.test(fileName || fileUrl) ||
        fileUrl.startsWith("data:image/"))
  );

  const sendResult = await sendTelegramMessage({
    chatId: linkedChat.id,
    text: fullText,
    senderName: "PrintGoo Ta'minot",
    replyMarkup,
    photoUrl: isImage && fileUrl ? fileUrl : undefined,
    documentUrl: !isImage && fileUrl ? fileUrl : undefined,
    fileName: fileName || undefined,
    parseMode: "HTML",
  });

  if (sendResult.success && sendResult.message) {
    await db
      .update(supplierOrders)
      .set({
        telegramChatId: linkedChat.chatId,
        telegramMessageId: sendResult.message.telegramMessageId,
        telegramSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierOrders.id, order.id));
  }

  return sendResult;
}

/**
 * 5. Telegram Webhook yangilanishini qayta ishlash (Incoming Update)
 */
export async function processTelegramWebhookUpdate(
  update: any,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; handled: boolean; error?: string }> {
  try {
    const callbackQuery = update.callback_query;
    const message = update.message || update.edited_message || update.channel_post;
    const myChatMember = update.my_chat_member;

    const companyId = await getCompanyIdByCode(companyCode);
    const token = await getEffectiveTelegramBotToken(companyCode);

    // ── 1. Inline tugma bosilishi (Callback Query) ───────────────────────────
    if (callbackQuery) {
      const cqData = String(callbackQuery.data || "");
      if (cqData.startsWith("po_status:")) {
        const [, orderId, newStatus] = cqData.split(":");
        const validStatuses = ["In_Production", "Cancelled", "Ready", "Delivered"];
        if (orderId && validStatuses.includes(newStatus)) {
          const order = await db.query.supplierOrders.findFirst({
            where: and(eq(supplierOrders.companyId, companyId), eq(supplierOrders.id, orderId)),
            with: { supplier: true },
          });

          if (order) {
            const fromUser = callbackQuery.from;
            const userName =
              [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ") ||
              fromUser?.username ||
              "Ta'minotchi";
            const confirmedBy = fromUser?.username ? `${userName} (@${fromUser.username})` : userName;

            let statusLabel = "";
            let emoji = "";
            let nextKeyboard = { inline_keyboard: [] as any[] };
            let notifSeverity: "info" | "warning" | "success" = "info";

            if (newStatus === "In_Production") {
              statusLabel = "Qabul qilindi (Jarayonda)";
              emoji = "🟢";
              nextKeyboard = {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Tayyor bo'ldi",
                      callback_data: `po_status:${order.id}:Ready`,
                    },
                  ],
                ],
              };
            } else if (newStatus === "Cancelled") {
              statusLabel = "Rad etildi / Qabul qilinmadi";
              emoji = "❌";
              nextKeyboard = { inline_keyboard: [] };
              notifSeverity = "warning";
            } else if (newStatus === "Ready") {
              statusLabel = "Tayyor bo'ldi";
              emoji = "✅";
              nextKeyboard = {
                inline_keyboard: [
                  [
                    {
                      text: "🚚 Yo'lga chiqdi / Kuryerda",
                      callback_data: `po_status:${order.id}:Delivered`,
                    },
                  ],
                ],
              };
            } else if (newStatus === "Delivered") {
              statusLabel = "Yo'lga chiqdi (Yetkazildi)";
              emoji = "🚚";
              nextKeyboard = { inline_keyboard: [] };
            }

            // Baza statusini yangilash
            await db
              .update(supplierOrders)
              .set({
                status: newStatus as any,
                telegramConfirmedBy: confirmedBy,
                updatedAt: new Date(),
              })
              .where(eq(supplierOrders.id, order.id));

            // Telegram bot orqali javob (Toast) qaytarish
            if (token && !token.includes("mock") && !token.includes("test")) {
              try {
                await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: `Holat: ${statusLabel}`,
                    show_alert: false,
                  }),
                });

                // Xabarni tahrirlab yangi statusni belgilash
                const originalMsg = callbackQuery.message;
                if (originalMsg) {
                  const nowStr = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
                  const baseText = originalMsg.text || originalMsg.caption || "";
                  const updatedText = `${baseText}\n\n${emoji} <b>Holat:</b> ${statusLabel} (${nowStr})\n👤 <b>Mas'ul:</b> ${confirmedBy}`;

                  if (originalMsg.caption !== undefined) {
                    await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageCaption`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: originalMsg.chat.id,
                        message_id: originalMsg.message_id,
                        caption: updatedText,
                        parse_mode: "HTML",
                        reply_markup: nextKeyboard,
                      }),
                    });
                  } else {
                    await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: originalMsg.chat.id,
                        message_id: originalMsg.message_id,
                        text: updatedText,
                        parse_mode: "HTML",
                        reply_markup: nextKeyboard,
                      }),
                    });
                  }
                }
              } catch (apiErr) {
                console.error("[processTelegramWebhookUpdate] CallbackQuery handling error:", apiErr);
              }
            }

            // Menejerlarga ERP bildirishnoma uzatish
            try {
              await emitNotification(
                {
                  dedupKey: `po-status-${order.id}-${newStatus}`,
                  severity: notifSeverity,
                  category: "production",
                  eventType: "telegram_message",
                  entityCode: order.orderNo,
                  title: `Ta'minotchi • ${statusLabel}`,
                  description: `${order.orderNo} (${order.title}) — ${confirmedBy} tomonidan "${statusLabel}" holatiga o'tkazildi.`,
                  link: {
                    module: "production",
                    subModule: "tooling-orders",
                  },
                  targetTab: {
                    id: "tab-production-tooling-orders",
                    title: "Tooling & CTP Orders",
                    type: "registry",
                    module: "production",
                  },
                },
                companyCode
              );
            } catch (notifErr) {
              console.warn("[processTelegramWebhookUpdate] emitNotification error:", notifErr);
            }

            return { success: true, handled: true };
          }
        }
      }
      return { success: true, handled: false };
    }

    // Agar na xabar va na guruhga a'zo bo'lish hodisasi bo'lsa
    if (!message && !myChatMember) {
      return { success: true, handled: false };
    }

    // Agar bot guruhga qo'shilgan hodisasi bo'lsa (my_chat_member)
    if (!message && myChatMember) {
      const chat = myChatMember.chat;
      const tgChatId = String(chat.id);
      const title = chat.title || "Telegram Guruh";
      const chatType = chat.type === "channel" ? "channel" : chat.type === "private" ? "private" : "supergroup";
      const username = chat.username || null;

      let chatRecord = await db.query.telegramChats.findFirst({
        where: and(
          eq(telegramChats.companyId, companyId),
          eq(telegramChats.chatId, tgChatId)
        ),
      });

      if (!chatRecord) {
        await db.insert(telegramChats).values({
          companyId,
          chatId: tgChatId,
          title,
          type: chatType as any,
          username,
          status: "unlinked",
          unreadCount: 0,
          lastMessageAt: new Date(),
          lastMessageSnippet: "Bot guruhga qo'shildi",
        });
      }
      return { success: true, handled: true };
    }

    const tgChatId = String(message.chat.id);
    const title = message.chat.title || `${message.from?.first_name || ""} ${message.from?.last_name || ""}`.trim() || "Telegram Chat";
    const chatType = message.chat.type === "channel" ? "channel" : message.chat.type === "private" ? "private" : "supergroup";
    const username = message.chat.username || message.from?.username || null;

    // Chatni topish yoki yangi yaratish
    let chatRecord = await db.query.telegramChats.findFirst({
      where: and(
        eq(telegramChats.companyId, companyId),
        eq(telegramChats.chatId, tgChatId)
      ),
    });

    const isClientMessage = !message.from?.is_bot;
    const messageSnippet = message.text || message.caption || (message.document ? `[Fayl: ${message.document.file_name}]` : message.photo ? "[Rasm]" : "[Xabar]");

    if (!chatRecord) {
      const [newChat] = await db
        .insert(telegramChats)
        .values({
          companyId,
          chatId: tgChatId,
          title,
          type: chatType as any,
          username,
          status: "unlinked",
          unreadCount: isClientMessage ? 1 : 0,
          lastMessageAt: new Date(),
          lastMessageSnippet: messageSnippet.slice(0, 150),
          unansweredSince: isClientMessage ? new Date() : null,
        })
        .returning();
      chatRecord = newChat;
    } else {
      await db
        .update(telegramChats)
        .set({
          title: message.chat.title || chatRecord.title,
          lastMessageAt: new Date(),
          lastMessageSnippet: messageSnippet.slice(0, 150),
          unreadCount: isClientMessage ? chatRecord.unreadCount + 1 : chatRecord.unreadCount,
          unansweredSince: isClientMessage && !chatRecord.unansweredSince ? new Date() : chatRecord.unansweredSince,
          updatedAt: new Date(),
        })
        .where(eq(telegramChats.id, chatRecord.id));
    }

    // Media tahlili (hujjat, maket, rasm)
    let mediaType: string | undefined;
    let mediaFileName: string | undefined;
    let mediaFileSize: number | undefined;
    let telegramFileId: string | undefined;

    if (message.document) {
      mediaType = "document";
      mediaFileName = message.document.file_name;
      mediaFileSize = message.document.file_size;
      telegramFileId = message.document.file_id;
    } else if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      mediaType = "photo";
      const largest = message.photo[message.photo.length - 1];
      telegramFileId = largest.file_id;
      mediaFileSize = largest.file_size;
      mediaFileName = `photo_${largest.file_unique_id}.jpg`;
    }

    const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || message.from?.username || "Telegram Foydalanuvchi";
    const senderUsername = message.from?.username || null;
    const senderId = message.from?.id ? String(message.from.id) : "";

    // Foydalanuvchi va guruh avatarlarini olish
    const botToken = await getEffectiveTelegramBotToken(companyCode);
    let senderAvatarUrl: string | null = null;
    if (message.from?.is_bot) {
      senderAvatarUrl = await getTelegramBotAvatarUrl(botToken);
    } else if (senderId && botToken) {
      senderAvatarUrl = await getTelegramUserAvatarUrl(botToken, senderId, senderName);
    }

    if (botToken) {
      const chatPhoto = await getTelegramChatPhotoUrl(botToken, tgChatId, title);
      if (chatPhoto && (!chatRecord.photoUrl || chatRecord.photoUrl !== chatPhoto || chatRecord.photoUrl.includes("api.telegram.org"))) {
        await db
          .update(telegramChats)
          .set({ photoUrl: chatPhoto })
          .where(eq(telegramChats.id, chatRecord.id));
      }
    }

    // Xabarni saqlash
    await db.insert(telegramMessages).values({
      chatId: chatRecord.id,
      telegramMessageId: message.message_id,
      senderId,
      senderName,
      senderUsername,
      senderAvatarUrl,
      isOutgoing: Boolean(message.from?.is_bot),
      text: message.text || message.caption || null,
      mediaType,
      mediaFileName,
      mediaFileSize,
      telegramFileId,
      replyToTelegramMessageId: message.reply_to_message?.message_id,
      sentAt: message.date ? new Date(message.date * 1000) : new Date(),
    });

    // Mijozdan yangi xabar kelganda tizim bildirishnomasini hosil qilish
    if (isClientMessage) {
      try {
        await emitNotification(
          {
            dedupKey: `tg-msg-${message.message_id}-${chatRecord.id}`,
            severity: "info",
            category: "crm",
            eventType: "telegram_message",
            entityCode: chatRecord.chatId,
            title: `Telegram • ${title}`,
            description: messageSnippet,
            link: { module: "crm", subModule: "telegram-inbox" },
            targetTab: {
              id: "tab-crm-telegram-inbox",
              title: "Telegram Inbox",
              type: "registry",
              module: "crm",
              chatId: chatRecord.id,
            },
          },
          companyCode
        );
      } catch (err) {
        console.error("[processTelegramWebhookUpdate] emitNotification error:", err);
      }
    }

    return { success: true, handled: true };
  } catch (error) {
    console.error("[processTelegramWebhookUpdate] error:", error);
    return {
      success: false,
      handled: false,
      error: error instanceof Error ? error.message : "Noma'lum xatolik",
    };
  }
}

/**
 * 6. Tezkor Shablonlarni olish (Quick Reply Templates)
 */
export async function getQuickReplyTemplates(companyCode: string = "PRINTGOO"): Promise<QuickReplyTemplate[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  let templates = await db.query.quickReplyTemplates.findMany({
    where: and(
      eq(quickReplyTemplates.companyId, companyId),
      eq(quickReplyTemplates.isActive, true)
    ),
    orderBy: [asc(quickReplyTemplates.sortOrder)],
  });

  if (templates.length === 0) {
    // Standart bosmaxona shablonlarini kiritish
    await seedDefaultQuickReplies(companyId);
    templates = await db.query.quickReplyTemplates.findMany({
      where: and(
        eq(quickReplyTemplates.companyId, companyId),
        eq(quickReplyTemplates.isActive, true)
      ),
      orderBy: [asc(quickReplyTemplates.sortOrder)],
    });
  }

  return templates;
}

/**
 * Standart tezkor shablonlarni boshlang'ich kiritish (Seed)
 */
export async function seedDefaultQuickReplies(companyId: string) {
  const defaults = [
    {
      companyId,
      code: "ACK_RECEIVED",
      title: "Buyurtma qabul qilindi",
      content: "Assalomu alaykum! Buyurtmangiz qabul qilindi. Menejerimiz tez orada hisob-kitob qilib sizga xabar beradi.",
      category: "greeting",
      sortOrder: 1,
    },
    {
      companyId,
      code: "PREPRESS_REVIEW",
      title: "Maket tekshiruvda",
      content: "Yuborilgan dizayn maketi Prepress (bosmagacha tayyorlov) bo'limiga tekshiruvga topshirildi.",
      category: "production",
      sortOrder: 2,
    },
    {
      companyId,
      code: "REQUEST_VECTOR",
      title: "Vektor / PDF so'rovi",
      content: "Iltimos, maketning original vektor faylini (PDF, CorelDraw yoki Adobe Illustrator, egri chiziqlarda/curves) fayl (hujjat) ko'rinishida yuborsangiz.",
      category: "production",
      sortOrder: 3,
    },
    {
      companyId,
      code: "IN_PRODUCTION",
      title: "Ishlab chiqarishga tushdi",
      content: "Buyurtma tasdiqlandi va bosmaxona stanogida chop etish navbatiga qo'yildi.",
      category: "production",
      sortOrder: 4,
    },
    {
      companyId,
      code: "READY_FOR_PICKUP",
      title: "Mahsulot tayyor",
      content: "Mahsulotingiz to'liq tayyor bo'ldi va tayyor mahsulotlar omboriga qabul qilindi! Olib ketishingiz yoki yetkazib berishni tashkil qilishimiz mumkin.",
      category: "production",
      sortOrder: 5,
    },
  ];

  for (const item of defaults) {
    await db
      .insert(quickReplyTemplates)
      .values(item)
      .onConflictDoNothing();
  }
}
