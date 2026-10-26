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
  } finally {
    await migrationClient.end();
  }
}

runMigrations().catch((err) => {
  console.error("❌ [DB Migrate] Migratsiya xatosi:", err);
  process.exit(1);
});
