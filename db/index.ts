import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://printgoo:printgoo_dev_secret@localhost:5432/printgoo_erp";

// Next.js development HMR paytida ortiqcha PostgreSQL ulanishlari ochilmasligi uchun singleton:
const globalForDb = globalThis as unknown as {
  pgClient: postgres.Sql | undefined;
};

export const pgClient =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 25 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = pgClient;
}

export const db: PostgresJsDatabase<typeof schema> = drizzle(pgClient, {
  schema,
});

/**
 * PostgreSQL bazasining holati va kechikish vaqtini (latency) tekshirish
 */
export async function checkDbHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}> {
  const start = performance.now();
  try {
    const res = await db.execute<{ version: string }>(sql`SELECT version()`);
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: true,
      latencyMs,
      version: res[0]?.version?.split(" ").slice(0, 2).join(" "),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown PostgreSQL error",
    };
  }
}

/**
 * 1-Bosqich Audit Log yozish yordamchisi (tranzaksiya ichida yoki mustaqil)
 */
export async function writeAuditLog(
  entry: schema.NewAuditLog,
  tx: PostgresJsDatabase<typeof schema> = db
) {
  await tx.insert(schema.auditLogs).values(entry);
}
