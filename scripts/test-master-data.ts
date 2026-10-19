import {
  getUnitsOfMeasure,
  getItemsByCompany,
  getFlexoMachinesWithCylinders,
  getDiesTooling,
  getPantoneCatalog,
} from "../lib/server/masterDataService";
import { redis } from "../lib/server/redis";
import { pgClient } from "../db";

async function runMasterDataTest() {
  console.log("🔍 [Test] 2-Bosqich Master Data & Redis Kesh sinovi...");

  // 1. O'lchov birliklari
  const units = await getUnitsOfMeasure();
  console.log(`✅ O'lchov birliklari: ${units.length} ta yuklandi (Kesh kaliti: master:units:all)`);

  // 2. Xomashyo va materiallar
  const items = await getItemsByCompany("PRINTGOO");
  console.log(`✅ Xomashyo va Nomenklatura: ${items.length} ta topildi (Kesh kaliti: master:items:PRINTGOO:all:all)`);

  // 3. Stanoklar va silindrlar
  const machines = await getFlexoMachinesWithCylinders("PRINTGOO");
  console.log(`✅ Fleksografik stanoklar: ${machines.length} ta`);
  machines.forEach((m) => {
    console.log(`   - ${m.name} (${m.model}): ${m.availableCylinders.length} ta silindr biriktirilgan`);
  });

  // 4. Pichoqlar va qoliplar
  const dies = await getDiesTooling("PRINTGOO");
  console.log(`✅ Pichoqlar va shtamplar (Dies & Tooling): ${dies.length} ta`);

  // 5. Pantone katalogi (qidiruv va to'liq kesh)
  const neonOrange = await getPantoneCatalog("021");
  console.log(`✅ Pantone qidiruvi ('021'): ${neonOrange.length} ta mos keldi ->`, neonOrange[0]?.name, neonOrange[0]?.hex);

  // 6. Redis keshdagi kalitlarni tekshirish
  const redisKeys = await redis.keys("master:*");
  console.log(`⚡ Redis'da yaratilgan kesh kalitlari (${redisKeys.length} ta):`, redisKeys);

  console.log("🎉 Barcha testlar muvaffaqiyatli yakunlandi!");
}

runMasterDataTest()
  .catch((e) => {
    console.error("❌ Xatolik:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pgClient.end();
    await redis.quit();
  });
