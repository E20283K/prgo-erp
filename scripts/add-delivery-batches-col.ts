import { pgClient } from "../db";

async function main() {
  console.log("Adding delivery_batches column to work_orders...");
  await pgClient.unsafe(`
    ALTER TABLE work_orders 
    ADD COLUMN IF NOT EXISTS delivery_batches jsonb DEFAULT '[]'::jsonb NOT NULL;
  `);
  console.log("SUCCESS: delivery_batches column added to work_orders!");
  await pgClient.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
