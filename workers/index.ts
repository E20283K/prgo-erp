import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../lib/server/redis";
import {
  QUEUE_NAMES,
  type PrepressJobPayload,
  type NotificationJobPayload,
} from "../lib/server/queue";
import { ensureStorageBuckets } from "../lib/server/storage";

console.log("🚀 [PrintGoo Worker] Fon xizmati (BullMQ) ishga tushmoqda...");

ensureStorageBuckets()
  .then((buckets) => console.log("📦 [PrintGoo Worker] MinIO S3 bucketlar va CORS tayyor:", buckets))
  .catch((err) => console.warn("⚠️ [PrintGoo Worker] MinIO bucketlarni tekshirishda xato:", err));

// 1. Prepress PDF / Maket qayta ishlash Worker
const prepressWorker = new Worker<PrepressJobPayload>(
  QUEUE_NAMES.PREPRESS_PROCESSING,
  async (job) => {
    console.log(
      `[PrepressWorker] Job #${job.id} bajarilmoqda: s3Key=${job.data.s3Key}`
    );
    // Keyingi bosqichda PDF thumbnail va o'lchamlarni tekshirish mantiqi ulanadi
    return { processedAt: new Date().toISOString(), fileId: job.data.fileId };
  },
  { connection: redis, concurrency: 2 }
);

// 2. Bildirishnomalar (Telegram Bot & SSE Pub/Sub) Worker
const notificationsWorker = new Worker<NotificationJobPayload>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job) => {
    console.log(
      `[NotificationsWorker] Job #${job.id} (${job.data.channel}): ${job.data.title}`
    );
    if (job.data.channel === "internal_sse") {
      await redis.publish(
        `sse:channel:${job.data.companyId}`,
        JSON.stringify(job.data)
      );
    }
    return { sentAt: new Date().toISOString() };
  },
  { connection: redis, concurrency: 5 }
);

const shutdown = async () => {
  console.log("🛑 [PrintGoo Worker] To'xtatilmoqda...");
  await Promise.all([prepressWorker.close(), notificationsWorker.close()]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
