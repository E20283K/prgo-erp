/**
 * Mavjud qolip/CTP buyurtmalarini (supplier_orders) ish buyurtmasidagi bitta jihozga bog'laydi
 * (`tooling_item_id`). Avval bitta PO bir xil turdagi hamma jihozni (Oldi va Orqa) "buyurtma
 * berilgan" qilib qo'yardi; bu yerda har bir PO bitta jihozga beriladi:
 *   PO raqami → jihoz nomi → shu turdagi birinchi bo'sh jihoz.
 *
 * Boshqa jihozga tegishli PO raqami yozilgan jihozlardan (xato tufayli) PO raqami, ta'minotchi olib
 * tashlanadi va holati "Draft" ga qaytadi ("Mounted" — stanokka o'rnatilgan — o'zgarmaydi).
 * Bunday jihozning fayli bog'langan jihoz fayli bilan bir xil bo'lsa, u almashib ketgan bo'lishi
 * mumkin — hisobotda ko'rsatiladi, avtomatik tiklanmaydi.
 *
 * Bekor qilingan buyurtmalar bog'lanmaydi. Qayta ishga tushirish xavfsiz: bog'langan PO o'tkazib yuboriladi.
 */
import { db } from "@/db";
import { supplierOrders, workOrders } from "@/db/schema";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { toolingItemMatchesOrder } from "@/components/documents/work-order/toolingItems";
import { toolingOrderTypeOf } from "@/lib/deficits";
import type { WorkOrderToolingItem } from "@/components/documents/work-order/types";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export async function backfillToolingItemIds({
  apply,
  log = console.log,
}: {
  apply: boolean;
  log?: (line: string) => void;
}): Promise<{ linked: number; unmatched: number; cleared: number }> {
  const orders = await db
    .select({
      id: supplierOrders.id,
      companyId: supplierOrders.companyId,
      orderNo: supplierOrders.orderNo,
      orderType: supplierOrders.orderType,
      title: supplierOrders.title,
      workOrderNo: supplierOrders.workOrderNo,
      toolingItemId: supplierOrders.toolingItemId,
    })
    .from(supplierOrders)
    .where(
      and(
        inArray(supplierOrders.orderType, ["ctp_plates", "die_tooling", "cliche", "outsourcing"]),
        ne(supplierOrders.status, "Cancelled")
      )
    )
    .orderBy(asc(supplierOrders.orderNo));

  const byWo = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.workOrderNo) continue;
    const key = `${o.companyId}|${norm(o.workOrderNo)}`;
    byWo.set(key, [...(byWo.get(key) || []), o]);
  }

  let linked = 0;
  let unmatched = 0;
  let cleared = 0;
  for (const [key, woOrders] of byWo) {
    const [companyId] = key.split("|");
    const wo = await db.query.workOrders.findFirst({
      where: and(eq(workOrders.companyId, companyId), eq(workOrders.docNo, woOrders[0].workOrderNo!.trim())),
      columns: { id: true, docNo: true, dimensions: true },
    });
    const dims = (wo?.dimensions as Record<string, unknown> | null) || {};
    const items = Array.isArray(dims.toolingItems) ? (dims.toolingItems as WorkOrderToolingItem[]) : [];
    if (!wo || items.length === 0) {
      const open = woOrders.filter((o) => !o.toolingItemId).length;
      if (open > 0) log(`${woOrders[0].workOrderNo}: jihozlar saqlanmagan — ${open} ta PO bog'lanmadi`);
      unmatched += open;
      continue;
    }

    // Each PO takes one item; already linked POs keep theirs
    const owner = new Map<string, string>(); // orderNo -> item id
    const claimed = new Set<string>();
    for (const o of woOrders) {
      if (o.toolingItemId) {
        owner.set(o.orderNo, o.toolingItemId);
        claimed.add(o.toolingItemId);
      }
    }
    for (const o of woOrders.filter((x) => !x.toolingItemId)) {
      const open = items.filter((t) => !claimed.has(t.id));
      const link = { orderNo: o.orderNo, title: o.title, orderType: o.orderType };
      const target =
        open.find((t) => t.purchaseOrderNo === o.orderNo) ||
        open.find((t) => norm(t.name) === norm(o.title)) ||
        open.find((t) => toolingItemMatchesOrder(t, link)) ||
        open.find((t) => toolingOrderTypeOf(t) === o.orderType);
      if (!target) {
        log(`${wo.docNo} ${o.orderNo} "${o.title}": mos jihoz topilmadi`);
        unmatched++;
        continue;
      }
      claimed.add(target.id);
      owner.set(o.orderNo, target.id);
      linked++;
      log(`${wo.docNo} ${o.orderNo} → ${target.name}`);
      if (apply) await db.update(supplierOrders).set({ toolingItemId: target.id }).where(eq(supplierOrders.id, o.id));
    }

    // Items carrying a PO number that belongs to another item
    let changed = false;
    const next = items.map((t) => {
      const ownerId = t.purchaseOrderNo ? owner.get(t.purchaseOrderNo) : undefined;
      if (!ownerId || ownerId === t.id) return t;
      const ownerItem = items.find((x) => x.id === ownerId);
      const sameFile = !!t.fileUrl && t.fileUrl === ownerItem?.fileUrl;
      log(
        `${wo.docNo} "${t.name}": ${t.purchaseOrderNo} "${ownerItem?.name}" niki — olib tashlanadi` +
          (t.status === "Mounted" ? " (holat Mounted qoladi)" : ` (holat ${t.status} → Draft)`) +
          (sameFile ? " · FAYL bog'langan jihoz bilan bir xil, tekshiring" : "")
      );
      cleared++;
      changed = true;
      return {
        ...t,
        purchaseOrderNo: undefined,
        purchaseOrderId: undefined,
        supplierId: undefined,
        supplierName: undefined,
        status: t.status === "Mounted" ? t.status : "Draft",
      } as WorkOrderToolingItem;
    });
    if (changed && apply) {
      await db
        .update(workOrders)
        .set({ dimensions: { ...dims, toolingItems: next } as typeof wo.dimensions, updatedAt: new Date() })
        .where(eq(workOrders.id, wo.id));
    }
  }

  log(`Bog'landi: ${linked} · topilmadi: ${unmatched} · noto'g'ri PO olib tashlandi: ${cleared}`);
  return { linked, unmatched, cleared };
}
