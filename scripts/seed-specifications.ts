import { db, pgClient } from "../db";
import { productionSpecifications } from "../db/schema";
import { upsertProductionSpecification } from "../lib/server/workOrderService";
import {
  MASTER_SPECIFICATIONS,
  RECIPE_MATERIALS,
  RECIPE_ROUTES,
} from "../components/documents/work-order/types";

async function main() {
  console.log("Checking production specifications in PostgreSQL...");
  const existing = await db.select().from(productionSpecifications);
  console.log(`Found ${existing.length} existing specifications.`);

  const existingCodes = new Set(existing.map((s) => s.code));

  for (const spec of MASTER_SPECIFICATIONS) {
    if (existingCodes.has(spec.code)) {
      console.log(`Skipping already existing spec: [${spec.code}] ${spec.name}`);
      continue;
    }

    const rawMaterials = RECIPE_MATERIALS[spec.code] || [];
    const materials = rawMaterials.map((m, idx) => ({
      id: `MAT-${spec.code}-${idx + 1}`,
      name: m.name,
      quantity: m.req || 1,
      unit: m.unit || "pcs",
      unitPrice: 1.0,
      spec: m.name,
      wastePercent: 5,
    }));

    const rawRoutes = RECIPE_ROUTES[spec.code] || [];
    const operations = rawRoutes.map((r, idx) => ({
      id: `OP-${spec.code}-${idx + 1}`,
      stepNumber: idx + 1,
      name: r.name,
      machineStr: r.machineStr,
      plannedDurationHours: 2.5,
      costEstimateUsd: 150,
      description: `${r.name} jarayoni`,
    }));

    await upsertProductionSpecification(
      {
        code: spec.code,
        name: spec.name,
        department: spec.department,
        description: spec.description,
        category:
          spec.department === "Flexo"
            ? "Labels & Tags"
            : spec.department === "Jacquard"
            ? "Textile & Garment"
            : "Commercial Print",
        status: "Active",
        unit: spec.unit || "pcs",
        estimatedCost: spec.estimatedCost || "$0",
        materialsCount: materials.length,
        materials,
        operations,
      },
      "PRINTGOO"
    );

    console.log(`+ Seeded spec: [${spec.code}] ${spec.name} (${spec.department})`);
  }

  const all = await db.select().from(productionSpecifications);
  console.log(`Done! Total specifications now: ${all.length}`);
  await pgClient.end();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
