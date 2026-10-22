import { pgClient } from "../db";
import { INITIAL_MACHINES_RECORD } from "../components/documents/machine/data";
import { createProductionMachine, getProductionMachines } from "../lib/server/workOrderService";

async function main() {
  console.log("Checking existing machines in PostgreSQL...");
  const existing = await getProductionMachines("PRINTGOO");
  console.log(`Found ${existing.length} machines currently.`);

  if (existing.length === 0) {
    console.log("Seeding INITIAL_MACHINES_RECORD...");
    for (const m of INITIAL_MACHINES_RECORD) {
      const created = await createProductionMachine(m, "PRINTGOO");
      console.log(`+ Seeded machine: [${created.code}] ${created.name}`);
    }
  } else {
    console.log("Machines already present.");
  }

  const all = await getProductionMachines("PRINTGOO");
  console.log(`Total machines in DB: ${all.length}`);
  await pgClient.end();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
