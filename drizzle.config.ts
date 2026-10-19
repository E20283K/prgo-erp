import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://printgoo:printgoo_dev_secret@localhost:5432/printgoo_erp",
  },
  verbose: true,
  strict: true,
});
