/**
 * Bir martalik ma'lumot vazifalari: sxema migratsiyalaridan keyin deployda o'zi ishlaydi.
 * Har bir vazifa bajarilgach `drizzle.__data_tasks` jadvaliga yoziladi va qayta ishlamaydi.
 * Vazifa xato bersa yozilmaydi — keyingi deployda yana urinadi; deploy to'xtatilmaydi.
 *
 * Yangi vazifa: shu ro'yxat oxiriga noyob `name` bilan qo'shing (nomini keyin o'zgartirmang).
 */
import { db, pgClient } from "@/db";
import { sql } from "drizzle-orm";
import { backfillToolingItemIds } from "./backfillToolingItemIds";

const TASKS: { name: string; run: () => Promise<unknown> }[] = [
  {
    name: "0034_backfill_tooling_item_id",
    run: () => backfillToolingItemIds({ apply: true, log: (line) => console.log(`   ${line}`) }),
  },
];

export async function runDataTasks() {
  // Kept beside drizzle's own migrations table (the migrator creates that schema), outside the app
  // schema so db:push leaves it alone
  const [table] = await db.execute<{ t: string | null }>(sql`SELECT to_regclass('drizzle.__data_tasks')::text AS t`);
  if (!table?.t) {
    await db.execute(
      sql`CREATE TABLE drizzle.__data_tasks (name text PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now())`
    );
  }
  const done = await db.execute<{ name: string }>(sql`SELECT name FROM drizzle.__data_tasks`);
  const doneNames = new Set(Array.from(done).map((r) => r.name));

  for (const task of TASKS) {
    if (doneNames.has(task.name)) continue;
    console.log(`⏳ [Data task] ${task.name}`);
    try {
      await task.run();
      await db.execute(sql`INSERT INTO drizzle.__data_tasks (name) VALUES (${task.name}) ON CONFLICT DO NOTHING`);
      console.log(`✅ [Data task] ${task.name}`);
    } catch (err) {
      console.error(`❌ [Data task] ${task.name} — keyingi deployda qayta uriniladi:`, err);
    }
  }
}

export async function closeDataTaskConnection() {
  await pgClient.end();
}
