import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
};

export const redis =
  globalForRedis.redisClient ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: null, // BullMQ bilan moslik uchun
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) return null; // Lokal devda Redis o'chiq bo'lsa cheksiz osilib qolmasligi uchun
      return Math.min(times * 200, 2000);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisClient = redis;
}

/**
 * Keshdan o'qish yoki topilmasa fetcher funksiyasini ishga tushirib Redis'ga yozish (Cache-Aside)
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Agar Redis vaqtincha ishlamasa, tizim to'xtab qolmasdan to'g'ridan-to'g'ri DB dan o'qiydi (Graceful Degradation)
  }

  const freshData = await fetcher();

  try {
    await redis.set(key, JSON.stringify(freshData), "EX", ttlSeconds);
  } catch {
    // Keshga yozishda xato bo'lsa asosiy oqimga xalaqit bermaydi
  }

  return freshData;
}

/**
 * Prefiks bo'yicha kesh kalitlarini tozalash (masalan: `dict:PRINTGOO:*` yoki `rbac:user123:*`)
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<number> {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch {
    return 0;
  }
}

/**
 * Redis holati va kechikish vaqtini (latency) tekshirish
 */
export async function checkRedisHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    const pong = await redis.ping();
    return {
      ok: pong === "PONG",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown Redis error",
    };
  }
}
