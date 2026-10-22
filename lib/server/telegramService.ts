import { db } from "@/db";
import {
  telegramChats,
  telegramMessages,
  quickReplyTemplates,
  clients,
  workOrders,
  companies,
  type TelegramChat,
  type TelegramMessage,
  type QuickReplyTemplate,
  type TelegramCompanySettings,
  type TelegramChatSettings,
} from "@/db/schema";
import { eq, desc, asc, and, sql, or, ilike } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

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

/**
 * Telegram foydalanuvchisining eng so'nggi profil rasmini (avatarini) olish
 */
export async function getTelegramUserAvatarUrl(
  botToken: string,
  userId: string | number
): Promise<string | null> {
  if (!botToken || !userId) return null;
  try {
    const res = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!data.ok || !data.result || data.result.total_count === 0) {
      return null;
    }
    const photos = data.result.photos?.[0];
    if (!photos || photos.length === 0) return null;
    // Kichik yoki o'rta o'lchamdagi rasm
    const photo = photos[0];
    const fileRes = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/getFile?file_id=${photo.file_id}`
    );
    const fileData = await fileRes.json();
    if (fileData.ok && fileData.result?.file_path) {
      return `${TELEGRAM_API_BASE}/file/bot${botToken}/${fileData.result.file_path}`;
    }
  } catch (err) {
    console.warn("[getTelegramUserAvatarUrl] error:", err);
  }
  return null;
}

/**
 * Telegram guruhi yoki chatining rasmini olish
 */
export async function getTelegramChatPhotoUrl(
  botToken: string,
  chatId: string | number
): Promise<string | null> {
  if (!botToken || !chatId) return null;
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    if (data.ok && data.result?.photo?.small_file_id) {
      const fileRes = await fetch(
        `${TELEGRAM_API_BASE}/bot${botToken}/getFile?file_id=${data.result.photo.small_file_id}`
      );
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        return `${TELEGRAM_API_BASE}/file/bot${botToken}/${fileData.result.file_path}`;
      }
    }
  } catch (err) {
    console.warn("[getTelegramChatPhotoUrl] error:", err);
  }
  return null;
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
        body: JSON.stringify({ url: webhookUrl }),
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
    where: or(eq(telegramChats.id, chatRecordId), eq(telegramChats.chatId, chatRecordId)),
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
    })
    .from(telegramChats)
    .leftJoin(clients, eq(telegramChats.clientId, clients.id))
    .where(whereClause)
    .orderBy(desc(telegramChats.lastMessageAt));

  const now = new Date();
  const fifteenMinutesMs = 15 * 60 * 1000;

  let results: TelegramChatWithClient[] = rawChats.map(({ chat, clientName, clientCode, clientPhone }) => {
    let isSlaBreached = false;
    if (chat.unansweredSince) {
      const waitTime = now.getTime() - new Date(chat.unansweredSince).getTime();
      if (waitTime >= fifteenMinutesMs) {
        isSlaBreached = true;
      }
    }
    return {
      ...chat,
      clientName,
      clientCode,
      clientPhone,
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
): Promise<{ chat: TelegramChatWithClient | null; messages: TelegramMessage[] }> {
  // Chatni topish (UUID yoki telegram chatId bo'yicha)
  const chatRecord = await db.query.telegramChats.findFirst({
    where: or(eq(telegramChats.id, chatId), eq(telegramChats.chatId, chatId)),
    with: {
      client: true,
    },
  });

  if (!chatRecord) {
    return { chat: null, messages: [] };
  }

  // unreadCount ni 0 qilish
  if (chatRecord.unreadCount > 0) {
    await db
      .update(telegramChats)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(telegramChats.id, chatRecord.id));
  }

  const messages = await db
    .select()
    .from(telegramMessages)
    .where(eq(telegramMessages.chatId, chatRecord.id))
    .orderBy(asc(telegramMessages.sentAt));

  const now = new Date();
  const isSlaBreached =
    chatRecord.unansweredSince &&
    now.getTime() - new Date(chatRecord.unansweredSince).getTime() >= 15 * 60 * 1000;

  return {
    chat: {
      ...chatRecord,
      clientName: chatRecord.client?.name ?? null,
      clientCode: chatRecord.client?.code ?? null,
      clientPhone: chatRecord.client?.phone ?? null,
      isSlaBreached: Boolean(isSlaBreached),
    },
    messages,
  };
}

/**
 * 3. ERP orqali mijoz guruhiga javob yozish (2 tomonlama muloqot)
 */
export async function sendTelegramMessage(params: {
  chatId: string; // Database chat UUID or Telegram chatId
  text: string;
  senderName?: string;
  replyToTelegramMessageId?: number;
}): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
  const chatRecord = await db.query.telegramChats.findFirst({
    where: or(eq(telegramChats.id, params.chatId), eq(telegramChats.chatId, params.chatId)),
  });

  if (!chatRecord) {
    return { success: false, error: "Telegram chat topilmadi" };
  }

  let tgMsgId = Math.floor(Date.now() / 1000);
  const token = await getEffectiveTelegramBotToken();

  // Agar real Telegram Bot Token mavjud bo'lsa, Telegram Bot API ga so'rov yuboramiz
  if (token && !token.includes("mock") && !token.includes("test")) {
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatRecord.chatId,
          text: params.text,
          reply_to_message_id: params.replyToTelegramMessageId,
        }),
      });
      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        tgMsgId = data.result.message_id;
      }
    } catch (err) {
      console.error("[sendTelegramMessage] Telegram API error:", err);
    }
  }

  // Bazada chiquvchi xabarni saqlash
  const [newMsg] = await db
    .insert(telegramMessages)
    .values({
      chatId: chatRecord.id,
      telegramMessageId: tgMsgId,
      senderName: params.senderName || "PrintGoo Menejer",
      isOutgoing: true,
      text: params.text,
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
  const [updated] = await db
    .update(telegramChats)
    .set({
      clientId: params.clientId,
      assignedUserId: params.assignedUserId,
      status: "active",
      updatedAt: new Date(),
    })
    .where(or(eq(telegramChats.id, params.chatId), eq(telegramChats.chatId, params.chatId)))
    .returning();

  if (!updated) {
    return { success: false, error: "Guruh topilmadi" };
  }

  return { success: true, chat: updated };
}

/**
 * 5. Telegram Webhook yangilanishini qayta ishlash (Incoming Update)
 */
export async function processTelegramWebhookUpdate(
  update: any,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; handled: boolean; error?: string }> {
  try {
    const message = update.message || update.edited_message || update.channel_post;
    const myChatMember = update.my_chat_member;

    // Agar na xabar va na guruhga a'zo bo'lish hodisasi bo'lsa
    if (!message && !myChatMember) {
      return { success: true, handled: false };
    }

    const companyId = await getCompanyIdByCode(companyCode);

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
    if (senderId && !message.from?.is_bot && botToken) {
      senderAvatarUrl = await getTelegramUserAvatarUrl(botToken, senderId);
    }

    if (!chatRecord.photoUrl && botToken) {
      const chatPhoto = await getTelegramChatPhotoUrl(botToken, tgChatId);
      if (chatPhoto) {
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
