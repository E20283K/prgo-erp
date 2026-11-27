/**
 * Qolip/CTP buyurtmalarini jihozlarga bog'lash (db/dataTasks/backfillToolingItemIds.ts).
 * Deployda migratsiyalardan keyin bir marta o'zi ishlaydi; bu skript qo'lda ko'rib chiqish uchun.
 *
 *   npx tsx scripts/backfill-tooling-item-id.ts            # ko'rib chiqish
 *   npx tsx scripts/backfill-tooling-item-id.ts --apply    # bazaga yozish
 */
import "dotenv/config";
import { pgClient } from "@/db";
import { backfillToolingItemIds } from "@/db/dataTasks/backfillToolingItemIds";

const APPLY = process.argv.includes("--apply");

backfillToolingItemIds({ apply: APPLY })
  .then(() => {
    if (!APPLY) console.log("(ko'rib chiqish rejimi — yozish uchun --apply)");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
