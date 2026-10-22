import { db, pgClient } from "../db";
import { workOrders, clients } from "../db/schema";
import { upsertWorkOrder } from "../lib/server/workOrderService";

async function main() {
  console.log("Checking existing work orders in PostgreSQL...");
  const existing = await db.select().from(workOrders);
  console.log(`Found ${existing.length} work orders currently.`);

  if (existing.length === 0) {
    console.log("Seeding real production work orders for master machines...");

    const sampleOrders = [
      {
        docNo: "WOOF-26-0351",
        customer: "Korzinka Supermarket LLC",
        product: "A4 Hardcover Catalog 96p (150g Silk)",
        department: "Offset" as const,
        pressMachine: "Heidelberg Speedmaster XL 106-8P",
        quantity: 25000,
        unit: "pcs",
        priority: "High" as const,
        stage: "In Production" as const,
        deadline: "2026-10-28",
        colorsConfig: "4+4 CMYK",
        spotColors: ["Pantone 186 C (Red)"],
        operator: "Alexey Kovalev (1-smena)",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOOF-26-0352",
        customer: "Artatex",
        product: "350g Premium Folding Carton Box (Karton)",
        department: "Offset" as const,
        pressMachine: "Heidelberg Speedmaster XL 106-8P",
        quantity: 18000,
        unit: "pcs",
        priority: "Normal" as const,
        stage: "Ready to Print" as const,
        deadline: "2026-10-30",
        colorsConfig: "4+0 CMYK",
        spotColors: [],
        operator: "Alexey Kovalev (1-smena)",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOOF-26-0353",
        customer: "Nestle Uzbekistan",
        product: "Shokolad Qutisi 250g (Triplex)",
        department: "Offset" as const,
        pressMachine: "Heidelberg Speedmaster XL 106-8P",
        quantity: 50000,
        unit: "pcs",
        priority: "Urgent" as const,
        stage: "Queue" as const,
        deadline: "2026-11-02",
        colorsConfig: "5+0 (CMYK + Gold)",
        spotColors: ["Pantone 871 C (Gold)"],
        operator: "Daniyar Rustamov (2-smena)",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: false,
          toolingReady: false,
        },
      },
      {
        docNo: "WOOF-26-0354",
        customer: "Apex Packaging",
        product: "Dori qutilari 100ml (Farmatsevtika)",
        department: "Offset" as const,
        pressMachine: "Komori Lithrone G40 (4-Color)",
        quantity: 32000,
        unit: "pcs",
        priority: "High" as const,
        stage: "In Production" as const,
        deadline: "2026-10-26",
        colorsConfig: "4+0 CMYK",
        spotColors: [],
        operator: "Farrux Zokirov",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOOF-26-0355",
        customer: "Artatex",
        product: "Yorliqlar va Bukletlar (B2 Format)",
        department: "Offset" as const,
        pressMachine: "Komori Lithrone G40 (4-Color)",
        quantity: 15000,
        unit: "pcs",
        priority: "Normal" as const,
        stage: "Queue" as const,
        deadline: "2026-11-04",
        colorsConfig: "4+4 CMYK",
        spotColors: [],
        operator: "Farrux Zokirov",
        checks: {
          designReady: true,
          paperReady: false,
          platesReady: false,
          toolingReady: true,
        },
      },
      {
        docNo: "WOFL-26-0356",
        customer: "Korzinka Supermarket LLC",
        product: "O'ziyopishqoq Rulon Etiketka (BOPP White)",
        department: "Flexo" as const,
        pressMachine: "Mark Andy Performance Series P7",
        quantity: 120000,
        unit: "pcs",
        priority: "Urgent" as const,
        stage: "In Production" as const,
        deadline: "2026-10-25",
        colorsConfig: "6+0 UV Flexo",
        spotColors: ["Pantone 286 C", "Pantone 485 C"],
        operator: "Bobur Alimov",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOFL-26-0357",
        customer: "Artatex",
        product: "Polietilen Termo-etiketka 58×40",
        department: "Flexo" as const,
        pressMachine: "Mark Andy Performance Series P7",
        quantity: 80000,
        unit: "pcs",
        priority: "Normal" as const,
        stage: "Ready to Print" as const,
        deadline: "2026-10-29",
        colorsConfig: "2+0 Flexo",
        spotColors: [],
        operator: "Bobur Alimov",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WODIE-26-0358",
        customer: "Apex Packaging",
        product: "FEFCO 0215 Qutini Avtomatik Shtansovka",
        department: "Post-press" as const,
        pressMachine: "Bobst Novacut 106 E Autoplaten",
        quantity: 25000,
        unit: "pcs",
        priority: "High" as const,
        stage: "Ready to Print" as const,
        deadline: "2026-10-27",
        colorsConfig: "-",
        spotColors: [],
        operator: "Shavkat Ergashev",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOCUT-26-0359",
        customer: "Korzinka Supermarket LLC",
        product: "Flayer va Bukletlarni Yakuniy Formatlash",
        department: "Post-press" as const,
        pressMachine: "Polar N 115 Plus High-Speed Guillotine",
        quantity: 40000,
        unit: "pcs",
        priority: "Normal" as const,
        stage: "In Production" as const,
        deadline: "2026-10-24",
        colorsConfig: "-",
        spotColors: [],
        operator: "Rustam Mirzayev",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: true,
          toolingReady: true,
        },
      },
      {
        docNo: "WOTX-26-0360",
        customer: "Artatex",
        product: "Yuqori Zichlikdagi Jakkar Brend Yorlig'i",
        department: "Jacquard" as const,
        pressMachine: "Staubli LX 3202 High-Speed Jacquard Loom",
        quantity: 60000,
        unit: "pcs",
        priority: "Normal" as const,
        stage: "Queue" as const,
        deadline: "2026-11-06",
        colorsConfig: "Taffeta Damask",
        spotColors: [],
        operator: "Dilshod Yusupov",
        checks: {
          designReady: true,
          paperReady: true,
          platesReady: false,
          toolingReady: false,
        },
      },
    ];

    for (const ord of sampleOrders) {
      const res = await upsertWorkOrder(ord as any, "PRINTGOO");
      console.log(`+ Seeded Work Order: [${ord.docNo}] ${ord.product} -> ${ord.pressMachine}`);
    }
  } else {
    console.log("Work orders already exist in database.");
  }

  const all = await db.select().from(workOrders);
  console.log(`Total work orders in DB: ${all.length}`);
  await pgClient.end();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
