import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAMES = {
  PREPRESS_PROCESSING: "prepress-processing", // PDF thumbnail, Prepress tekshiruv
  DOCUMENT_GENERATION: "document-generation", // Texkarta PDF, Shartnoma, Excel eksport
  NOTIFICATIONS: "notifications",             // Telegram Bot xabarnomalari va Proof tasdiqlash
  CURRENCY_SYNC: "currency-sync",             // Markaziy Bank (CBU.uz) kunlik kurslar
} as const;

export interface PrepressJobPayload {
  companyId: string;
  fileId: string;
  s3Key: string;
  mimeType: string;
}

export interface NotificationJobPayload {
  companyId: string;
  channel: "telegram" | "internal_sse";
  recipientId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

export const prepressQueue = new Queue<PrepressJobPayload>(
  QUEUE_NAMES.PREPRESS_PROCESSING,
  {
    connection: redis,
    defaultJobOptions,
  }
);

export const notificationsQueue = new Queue<NotificationJobPayload>(
  QUEUE_NAMES.NOTIFICATIONS,
  {
    connection: redis,
    defaultJobOptions,
  }
);
