import { db } from "../db";
import { getWarehouses, ensureDefaultWarehouses } from "../lib/server/warehouseService";
import { branches, companies, warehouses } from "../db/schema";

async function main() {
  console.log("=== PrintGoo Hierarchical Warehouse & Branch Verification ===");
  
  // 1. Ensure default warehouses
  await ensureDefaultWarehouses();
  
  // 2. Fetch all warehouses with relations
  const whList = await getWarehouses("PRINTGOO", true);
  console.log(`Total warehouses in PostgreSQL: ${whList.length}`);
  
  for (const wh of whList) {
    console.log(`- [${wh.code}] ${wh.name} (${wh.type}) | Filial: ${wh.branch?.name || "Yo'q (YTT/Markaziy)"} | Kompaniya: ${wh.company?.name || "Noma'lum"}`);
  }
  
  console.log("\n=== Verification Completed Successfully! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
