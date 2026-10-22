import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./core";
import { clients } from "./crm";
import { workOrders } from "./production";

// ─── Enums: Telegram Guruhlari & Xabarlari ───────────────────────────────────

export const telegramChatTypeEnum = pgEnum("telegram_chat_type", [
  "group",
  "supergroup",
  "private",
  "channel",
]);

export const telegramChatStatusEnum = pgEnum("telegram_chat_status", [
  "active",    // Mijozga biriktirilgan va faol
  "unlinked",  // Yangi qo'shilgan, hali mijozga biriktirilmagan
  "archived",  // Arxivlangan yoki yopilgan
]);

// ─── 1. Telegram Chats (Mijoz Guruhlari & Shaxsiy Muloqotlar) ────────────────

export interface TelegramChatSettings {
  notifyOrderCreated?: boolean;
  notifyProofReady?: boolean;
  notifyProductionDone?: boolean;
  notifyPaymentReminder?: boolean;
}

export const telegramChats = pgTable(
  "telegram_chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    chatId: varchar("chat_id", { length: 64 }).notNull(), // Telegram chat_id (e.g. "-10021481928")
    title: varchar("title", { length: 255 }).notNull(),   // Guruh yoki shaxs nomi
    type: telegramChatTypeEnum("type").default("supergroup").notNull(),
    username: varchar("username", { length: 128 }),       // Telegram username (agar bo'lsa)
    photoUrl: text("photo_url"),                           // Telegram chat/guruh avatari URL
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }), // Bog'langan CRM mijozi
    assignedUserId: varchar("assigned_user_id", { length: 128 }), // Mas'ul menejer
    status: telegramChatStatusEnum("status").default("unlinked").notNull(),
    unreadCount: integer("unread_count").default(0).notNull(),
    settings: jsonb("settings").$type<TelegramChatSettings>().default({
      notifyOrderCreated: true,
      notifyProofReady: true,
      notifyProductionDone: true,
      notifyPaymentReminder: false,
    }).notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessageSnippet: text("last_message_snippet"),
    unansweredSince: timestamp("unanswered_since", { withTimezone: true }), // SLA taymeri: mijoz yozgan, ammo javob berilmagan vaqt
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("telegram_chats_company_chat_id_uq").on(table.companyId, table.chatId),
    index("telegram_chats_company_idx").on(table.companyId),
    index("telegram_chats_client_idx").on(table.clientId),
    index("telegram_chats_status_idx").on(table.status),
    index("telegram_chats_last_msg_idx").on(table.lastMessageAt),
  ]
);

// ─── 2. Telegram Messages (Xabarlar va Biriktirilgan Fayllar) ────────────────

export const telegramMessages = pgTable(
  "telegram_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => telegramChats.id, { onDelete: "cascade" }),
    telegramMessageId: integer("telegram_message_id").notNull(), // Telegram message_id
    senderId: varchar("sender_id", { length: 64 }),              // Telegram user_id
    senderName: varchar("sender_name", { length: 255 }),         // Ism yoki Telegram username
    senderUsername: varchar("sender_username", { length: 128 }), // Telegram @username
    senderAvatarUrl: text("sender_avatar_url"),                  // Foydalanuvchi Telegram avatar fotosurati
    isOutgoing: boolean("is_outgoing").default(false).notNull(), // true = Menejer/Bot ERP dan yozdi
    text: text("text"),
    mediaType: varchar("media_type", { length: 32 }),            // 'document' | 'photo' | 'voice' | 'sticker'
    mediaUrl: text("media_url"),                                 // Telegram or S3 URL
    mediaFileName: varchar("media_file_name", { length: 255 }),  // Fayl nomi (masalan: maket_v2.pdf)
    mediaFileSize: integer("media_file_size"),                   // Fayl hajmi (baytlarda)
    telegramFileId: varchar("telegram_file_id", { length: 255 }),// Telegram file_id
    s3Key: varchar("s3_key", { length: 255 }),                   // Menejer saqlagan bo'lsa S3 manzili
    isAttachedToOrder: boolean("is_attached_to_order").default(false).notNull(),
    workOrderId: uuid("work_order_id")
      .references(() => workOrders.id, { onDelete: "set null" }), // Biriktirilgan buyurtma
    replyToTelegramMessageId: integer("reply_to_telegram_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("telegram_messages_chat_idx").on(table.chatId),
    index("telegram_messages_tg_msg_idx").on(table.chatId, table.telegramMessageId),
    index("telegram_messages_work_order_idx").on(table.workOrderId),
    index("telegram_messages_sent_at_idx").on(table.sentAt),
  ]
);

// ─── 3. Quick Reply Templates (Menejerlar uchun Tezkor Shablonlar) ─────────────

export const quickReplyTemplates = pgTable(
  "quick_reply_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // Masalan: "ACK_RECEIVED"
    title: varchar("title", { length: 128 }).notNull(), // "Buyurtma qabul qilindi"
    content: text("content").notNull(),                 // Shablon matni
    category: varchar("category", { length: 64 }).default("general").notNull(), // "greeting" | "production" | "payment" | "general"
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quick_reply_templates_company_code_uq").on(table.companyId, table.code),
    index("quick_reply_templates_company_idx").on(table.companyId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const telegramChatsRelations = relations(telegramChats, ({ one, many }) => ({
  company: one(companies, {
    fields: [telegramChats.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [telegramChats.clientId],
    references: [clients.id],
  }),
  messages: many(telegramMessages),
}));

export const telegramMessagesRelations = relations(telegramMessages, ({ one }) => ({
  chat: one(telegramChats, {
    fields: [telegramMessages.chatId],
    references: [telegramChats.id],
  }),
  workOrder: one(workOrders, {
    fields: [telegramMessages.workOrderId],
    references: [workOrders.id],
  }),
}));

export const quickReplyTemplatesRelations = relations(quickReplyTemplates, ({ one }) => ({
  company: one(companies, {
    fields: [quickReplyTemplates.companyId],
    references: [companies.id],
  }),
}));

export type TelegramChat = typeof telegramChats.$inferSelect;
export type NewTelegramChat = typeof telegramChats.$inferInsert;
export type TelegramMessage = typeof telegramMessages.$inferSelect;
export type NewTelegramMessage = typeof telegramMessages.$inferInsert;
export type QuickReplyTemplate = typeof quickReplyTemplates.$inferSelect;
export type NewQuickReplyTemplate = typeof quickReplyTemplates.$inferInsert;
