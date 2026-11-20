import { redis } from "./redis";

/**
 * Document presence: who has a document open right now.
 *
 * One Redis hash per document (`presence:doc:<key>`), field = userId,
 * value = JSON viewer entry. Clients heartbeat every ~10s; entries older
 * than STALE_MS are dropped on read, and the whole hash expires when
 * nobody heartbeats any more.
 */

const STALE_MS = 45_000; // background tabs may throttle the 10s heartbeat
const KEY_TTL_SECONDS = 60;
const KEY_PATTERN = /^[\w:.\-]{1,160}$/;

export interface PresenceViewer {
  userId: string;
  name: string;
  initials: string;
  avatar: string | null;
  editing: boolean;
  /** Client mount id; a late "leave" from an older mount must not drop a newer one. */
  sid: string;
  since: number;
  lastSeen: number;
}

export function isValidPresenceKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

function hashKey(docKey: string) {
  return `presence:doc:${docKey}`;
}

async function readViewers(docKey: string, now: number): Promise<PresenceViewer[]> {
  const raw = await redis.hgetall(hashKey(docKey));
  const viewers: PresenceViewer[] = [];
  const stale: string[] = [];
  for (const [userId, value] of Object.entries(raw)) {
    try {
      const entry = JSON.parse(value) as PresenceViewer;
      if (now - entry.lastSeen > STALE_MS) stale.push(userId);
      else viewers.push(entry);
    } catch {
      stale.push(userId);
    }
  }
  if (stale.length) await redis.hdel(hashKey(docKey), ...stale);
  return viewers.sort((a, b) => a.since - b.since);
}

export async function heartbeatPresence(
  docKey: string,
  viewer: Omit<PresenceViewer, "since" | "lastSeen">
): Promise<PresenceViewer[]> {
  const now = Date.now();
  const key = hashKey(docKey);
  try {
    const previous = await redis.hget(key, viewer.userId);
    let since = now;
    if (previous) {
      try {
        const prev = JSON.parse(previous) as PresenceViewer;
        if (now - prev.lastSeen <= STALE_MS) since = prev.since;
      } catch {
        // Corrupt entry: start a fresh session.
      }
    }
    const entry: PresenceViewer = { ...viewer, since, lastSeen: now };
    await redis.multi().hset(key, viewer.userId, JSON.stringify(entry)).expire(key, KEY_TTL_SECONDS).exec();
    return await readViewers(docKey, now);
  } catch {
    // Redis unavailable: presence is a nicety, never block the document.
    return [];
  }
}

export async function leavePresence(docKey: string, userId: string, sid: string): Promise<void> {
  try {
    const current = await redis.hget(hashKey(docKey), userId);
    if (!current) return;
    let currentSid = "";
    try {
      currentSid = (JSON.parse(current) as PresenceViewer).sid;
    } catch {
      // Corrupt entry: drop it.
    }
    if (currentSid && currentSid !== sid) return;
    await redis.hdel(hashKey(docKey), userId);
  } catch {
    // Entry expires on its own.
  }
}
