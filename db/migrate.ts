import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://printgoo:printgoo_dev_secret@localhost:5432/printgoo_erp";

async function runMigrations() {
  console.log("⏳ [DB Migrate] Baza migratsiyalari tekshirilmoqda...");
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: "./db/migrations" });
    console.log("✅ [DB Migrate] Barcha migratsiyalar muvaffaqiyatli tatbiq qilindi!");
  } catch (err: unknown) {
    // Xatoni yutib yubormaymiz: aks holda keyingi migratsiyalar jimgina qo'llanmay qoladi.
    const pgCode = (err as { cause?: { code?: string }; code?: string })?.cause?.code || (err as { code?: string })?.code;
    if (pgCode === "42710" || pgCode === "42P07") {
      console.error(
        "❌ [DB Migrate] Obyekt allaqachon mavjud. Baza `db:push` bilan yaratilgan bo'lsa, drizzle.__drizzle_migrations jadvalini migratsiyalar bilan moslashtiring."
      );
    }
    throw err;
  } finally {
    await migrationClient.end();
  }
}

/** One-time data fixes that follow a schema change; a failed one is retried next deploy, never fatal. */
async function runDataTasksSafely() {
  try {
    const { runDataTasks, closeDataTaskConnection } = await import("./dataTasks");
    try {
      await runDataTasks();
    } finally {
      await closeDataTaskConnection();
    }
  } catch (err) {
    console.error("❌ [Data task] Ishga tushmadi, keyingi deployda qayta uriniladi:", err);
  }
}

runMigrations()
  .then(runDataTasksSafely)
  .catch((err) => {
    console.error("❌ [DB Migrate] Migratsiya xatosi:", err);
    process.exit(1);
  });
