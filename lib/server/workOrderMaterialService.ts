/**
 * Buyurtma xomashyosi oqimi: reja (BOM) → rezerv → sexga berish (ISS) → yakuniy sarf / qaytarish (RET).
 *
 * - Reja: `work_orders.dimensions.materials` (BOM). Omborga ta'sir qilmaydi.
 * - Rezerv: `warehouse_stock_balances.reserved` oshadi; buyurtmadagi band miqdor
 *   `dimensions.materialFlow.reservations` da saqlanadi (sexga berilgani sari kamayadi).
 * - Sexga berish: `ProductionIssue` hujjati; berilgan miqdor rezervdan yechiladi.
 * - Yakunlash: haqiqiy sarf kiritiladi; sexda ortgani RET bilan qaytadi, yetmagani qo'shimcha ISS
 *   bilan beriladi, qolgan rezerv bo'shatiladi.
 *
 * Berilgan / qaytarilgan miqdor har doim ombor hujjatlaridan hisoblanadi (yagona haqiqat manbai).
 */
import { db, type DbExec } from "@/db";
import { warehouseMovements, warehouseStockBalances, workOrders } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getCompanyIdByCode, upsertWarehouseMovement } from "./warehouseService";
import { emitNotification } from "./notificationService";

const EPS = 1e-9;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmtQty = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export interface MaterialReservation {
  sku: string;
  name: string;
  unit: string;
  locationName: string;
  qty: number;
}

export interface MaterialFlowState {
  reservations: MaterialReservation[];
  reservedAt?: string;
  closedAt?: string;
  closedBy?: string;
}

export interface MaterialFlowLine {
  sku: string;
  name: string;
  unit: string;
  category?: string;
  plan: number;
  reserved: number;
  issued: number;
  returned: number;
  /** Sexda turgan (berilgan − qaytarilgan) */
  net: number;
  locationName: string;
  /** Rezerv qilinadigan ombordagi bo'sh qoldiq (shu buyurtma rezervi hisobga olinmagan) */
  free: number;
}

export interface MaterialFlowDoc {
  number: string;
  type: "ProductionIssue" | "ProductionReturn";
  date: string;
  quantity: number;
  unit: string;
  /** Omborchi hali tasdiqlamagan (qoldiqqa ta'sir qilmagan) */
  pending?: boolean;
}

export interface MaterialFlowView {
  docNo: string;
  status: "planned" | "reserved" | "issued" | "closed";
  reservedAt?: string;
  closedAt?: string;
  closedBy?: string;
  lines: MaterialFlowLine[];
  docs: MaterialFlowDoc[];
  /** BOM qatorlari omborda topilmadi (katalogdan tanlanmagan) */
  unmatched: string[];
  /** Mijoz materiali — ombor oqimida qatnashmaydi */
  clientSupplied: string[];
  /** Oqimga kirmagan BOM qatorlari (panelda sababi bilan ko'rsatiladi) */
  outside: MaterialFlowOutsideLine[];
}

export interface MaterialFlowOutsideLine {
  sku: string;
  name: string;
  unit: string;
  plan: number;
  /** no_catalog — ombor katalogidan tanlanmagan (qo'lda yozilgan); client — mijoz materiali */
  reason: "no_catalog" | "client";
}

type Actor = { name?: string } | undefined;

// ─── Yordamchi funksiyalar ───────────────────────────────────────────────────

async function loadWorkOrder(exec: DbExec, companyId: string, docNoOrId: string, lock: boolean) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docNoOrId);
  const base = exec
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.companyId, companyId), isUuid ? eq(workOrders.id, docNoOrId) : eq(workOrders.docNo, docNoOrId)));
  const [wo] = lock ? await base.for("update").limit(1) : await base.limit(1);
  if (!wo) throw new Error(`Buyurtma topilmadi: ${docNoOrId}`);
  return wo;
}

function readFlow(wo: { dimensions: unknown }): MaterialFlowState {
  const raw = ((wo.dimensions as any) || {}).materialFlow || {};
  return {
    reservations: Array.isArray(raw.reservations)
      ? raw.reservations
          .map((r: any) => ({
            sku: String(r.sku || ""),
            name: String(r.name || r.sku || ""),
            unit: String(r.unit || "sheets"),
            locationName: String(r.locationName || ""),
            qty: Number(r.qty) || 0,
          }))
          .filter((r: MaterialReservation) => r.sku && r.locationName && r.qty > EPS)
      : [],
    reservedAt: raw.reservedAt || undefined,
    closedAt: raw.closedAt || undefined,
    closedBy: raw.closedBy || undefined,
  };
}

async function writeDimensions(exec: DbExec, woId: string, dims: Record<string, unknown>) {
  await exec.update(workOrders).set({ dimensions: dims as any, updatedAt: new Date() }).where(eq(workOrders.id, woId));
}

type StockRow = typeof warehouseStockBalances.$inferSelect;

async function loadStock(exec: DbExec, companyId: string): Promise<StockRow[]> {
  return exec.select().from(warehouseStockBalances).where(eq(warehouseStockBalances.companyId, companyId));
}

interface PlanLine {
  sku: string;
  name: string;
  unit: string;
  category?: string;
  plan: number;
  preferredLocation?: string;
}

/** BOM ni katalogdagi SKU bo'yicha yig'ish. Mijoz materiali va katalogda yo'q qatorlar alohida. */
function buildPlan(wo: { dimensions: unknown }, stock: StockRow[]) {
  const materials: any[] = Array.isArray((wo.dimensions as any)?.materials) ? (wo.dimensions as any).materials : [];
  const bySku = new Map<string, PlanLine>();
  const unmatched: string[] = [];
  const clientSupplied: string[] = [];
  const outside: MaterialFlowOutsideLine[] = [];
  for (const m of materials) {
    const name = String(m?.name || "").trim();
    const source = m?.acquisitionSource || m?.sourceType;
    const plan = Number(m?.planQty) || Number(m?.qty) || 0;
    const rawKey = String(m?.sku || m?.id || "").trim();
    const unit = String(m?.unit || "sheets");
    if (source === "client" || /mijoz/i.test(String(m?.supplier || "")) || /mijoz/i.test(name)) {
      if (name) clientSupplied.push(name);
      if (name || rawKey) outside.push({ sku: rawKey, name: name || rawKey, unit, plan, reason: "client" });
      continue;
    }
    if (!(plan > 0)) continue;
    const key = rawKey.toLowerCase();
    const row =
      (key && stock.find((s) => s.sku.toLowerCase() === key)) ||
      (name && stock.find((s) => s.name.trim().toLowerCase() === name.toLowerCase())) ||
      null;
    if (!row) {
      // Katalog = ombor qoldiqlari jadvali. "Add Material" bilan qo'lda yozilgan qatorga vaqtinchalik id beriladi.
      unmatched.push(name || key || "?");
      outside.push({ sku: rawKey, name: name || rawKey || "?", unit, plan, reason: "no_catalog" });
      continue;
    }
    const cur = bySku.get(row.sku);
    if (cur) {
      cur.plan += plan;
    } else {
      bySku.set(row.sku, {
        sku: row.sku,
        name: row.name,
        unit: m?.unit || row.unit || "sheets",
        category: m?.category || row.category,
        plan,
        preferredLocation: m?.warehouseLocation || undefined,
      });
    }
  }
  return { lines: [...bySku.values()], unmatched, clientSupplied, outside };
}

interface IssuedState {
  /** sku → lokatsiya → sexda turgan miqdor */
  netByLoc: Map<string, Map<string, number>>;
  issued: Map<string, number>;
  returned: Map<string, number>;
  docs: MaterialFlowDoc[];
}

async function loadIssued(exec: DbExec, companyId: string, docNo: string): Promise<IssuedState> {
  const rows = await exec
    .select()
    .from(warehouseMovements)
    .where(
      and(
        eq(warehouseMovements.companyId, companyId),
        eq(warehouseMovements.workOrderId, docNo),
        // Qoralamalar faqat hujjat sifatida ko'rinadi — miqdorlar yakunlanganlardan hisoblanadi
        inArray(warehouseMovements.status, ["Completed", "Pending", "In Transit"])
      )
    );
  const netByLoc = new Map<string, Map<string, number>>();
  const issued = new Map<string, number>();
  const returned = new Map<string, number>();
  const docs: MaterialFlowDoc[] = [];
  const bump = (sku: string, loc: string, d: number) => {
    const m = netByLoc.get(sku) || new Map<string, number>();
    m.set(loc, (m.get(loc) || 0) + d);
    netByLoc.set(sku, m);
  };
  for (const r of rows) {
    let type = "";
    let items: any[] = [];
    try {
      const meta = r.reason && r.reason.startsWith("{") ? JSON.parse(r.reason) : null;
      type = meta?.movementType || "";
      items = Array.isArray(meta?.items) ? meta.items : [];
    } catch {
      /* eski matnli sabab */
    }
    if (!type) type = r.movementNumber.startsWith("ISS-") ? "ProductionIssue" : r.movementNumber.startsWith("RET-") ? "ProductionReturn" : "";
    if (type !== "ProductionIssue" && type !== "ProductionReturn") continue;
    if (items.length === 0 && r.materialSku) {
      items = [{ sku: r.materialSku, quantity: r.quantity, receivedQty: r.receivedQty }];
    }
    const pending = r.status !== "Completed";
    let docQty = 0;
    for (const it of items) {
      const sku = String(it?.sku || "");
      if (!sku) continue;
      if (pending) {
        docQty += Number(it.quantity) || 0;
        continue;
      }
      if (type === "ProductionIssue") {
        const q = Number(it.quantity) || 0;
        issued.set(sku, (issued.get(sku) || 0) + q);
        bump(sku, r.fromLocationName, q);
        docQty += q;
      } else {
        const q = Number(it.receivedQty !== undefined && it.receivedQty !== "" ? it.receivedQty : it.quantity) || 0;
        returned.set(sku, (returned.get(sku) || 0) + q);
        bump(sku, r.toLocationName, -q);
        docQty += q;
      }
    }
    docs.push({
      number: r.movementNumber,
      type: type as MaterialFlowDoc["type"],
      date: (r.movementDate instanceof Date ? r.movementDate : new Date(r.movementDate as any)).toISOString(),
      quantity: round3(docQty),
      unit: r.unit,
      ...(pending ? { pending: true } : {}),
    });
  }
  docs.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  return { netByLoc, issued, returned, docs };
}

/** Rezervni o'zgartirish (qatorni qulflab). Musbat delta bo'sh qoldiqdan oshsa, bor qadarini band qiladi. */
async function adjustReserved(exec: DbExec, companyId: string, locationName: string, sku: string, delta: number) {
  const [row] = await exec
    .select()
    .from(warehouseStockBalances)
    .where(
      and(
        eq(warehouseStockBalances.companyId, companyId),
        eq(warehouseStockBalances.locationName, locationName),
        eq(warehouseStockBalances.sku, sku)
      )
    )
    .for("update")
    .limit(1);
  if (!row) return 0;
  const stock = Number(row.stockLevel) || 0;
  const reserved = Number(row.reserved) || 0;
  const applied = delta > 0 ? Math.min(delta, Math.max(0, stock - reserved)) : Math.max(delta, -reserved);
  if (Math.abs(applied) < EPS) return 0;
  const nextReserved = round3(Math.max(0, reserved + applied));
  await exec
    .update(warehouseStockBalances)
    .set({
      reserved: nextReserved.toString(),
      available: Math.max(0, stock - nextReserved).toString(),
      updatedAt: new Date(),
    })
    .where(eq(warehouseStockBalances.id, row.id));
  return applied;
}

async function releaseAll(exec: DbExec, companyId: string, reservations: MaterialReservation[]) {
  for (const r of reservations) {
    await adjustReserved(exec, companyId, r.locationName, r.sku, -r.qty);
  }
}

function freeOf(stock: StockRow[], sku: string, loc: string) {
  const row = stock.find((s) => s.sku === sku && s.locationName === loc);
  return row ? Math.max(0, Number(row.stockLevel) - Number(row.reserved)) : 0;
}

/** Rezerv qaysi ombordan: avvalgi rezerv → BOM da ko'rsatilgan → bo'sh qoldig'i eng ko'p ombor */
function pickLocation(stock: StockRow[], line: PlanLine, previous?: string) {
  const rows = stock.filter((s) => s.sku === line.sku);
  if (previous && rows.some((r) => r.locationName === previous)) return previous;
  if (line.preferredLocation && rows.some((r) => r.locationName === line.preferredLocation)) return line.preferredLocation;
  const best = [...rows].sort(
    (a, b) => Number(b.stockLevel) - Number(b.reserved) - (Number(a.stockLevel) - Number(a.reserved))
  )[0];
  return best?.locationName || "";
}

function buildView(
  docNo: string,
  flow: MaterialFlowState,
  plan: ReturnType<typeof buildPlan>,
  issuedState: IssuedState,
  stock: StockRow[]
): MaterialFlowView {
  const skus = new Set<string>([
    ...plan.lines.map((l) => l.sku),
    ...flow.reservations.map((r) => r.sku),
    ...issuedState.issued.keys(),
  ]);
  const lines: MaterialFlowLine[] = [];
  for (const sku of skus) {
    const p = plan.lines.find((l) => l.sku === sku);
    const res = flow.reservations.filter((r) => r.sku === sku);
    const reserved = res.reduce((s, r) => s + r.qty, 0);
    const issued = issuedState.issued.get(sku) || 0;
    const returned = issuedState.returned.get(sku) || 0;
    const stockRow = stock.find((s) => s.sku === sku);
    const locationName =
      res[0]?.locationName || (p ? pickLocation(stock, p) : "") || [...(issuedState.netByLoc.get(sku)?.keys() || [])][0] || "";
    lines.push({
      sku,
      name: p?.name || res[0]?.name || stockRow?.name || sku,
      unit: p?.unit || res[0]?.unit || stockRow?.unit || "sheets",
      category: p?.category || stockRow?.category,
      plan: round3(p?.plan || 0),
      reserved: round3(reserved),
      issued: round3(issued),
      returned: round3(returned),
      net: round3(issued - returned),
      locationName,
      free: round3(locationName ? freeOf(stock, sku, locationName) : 0),
    });
  }
  const anyIssued = lines.some((l) => l.issued > EPS);
  const status: MaterialFlowView["status"] = flow.closedAt
    ? "closed"
    : anyIssued
      ? "issued"
      : flow.reservations.length > 0
        ? "reserved"
        : "planned";
  return {
    docNo,
    status,
    reservedAt: flow.reservedAt,
    closedAt: flow.closedAt,
    closedBy: flow.closedBy,
    lines,
    docs: issuedState.docs,
    unmatched: plan.unmatched,
    clientSupplied: plan.clientSupplied,
    outside: plan.outside,
  };
}

async function viewOf(exec: DbExec, companyId: string, docNoOrId: string) {
  const wo = await loadWorkOrder(exec, companyId, docNoOrId, false);
  const stock = await loadStock(exec, companyId);
  return buildView(wo.docNo, readFlow(wo), buildPlan(wo, stock), await loadIssued(exec, companyId, wo.docNo), stock);
}

function assertOpen(flow: MaterialFlowState, docNo: string) {
  if (flow.closedAt) throw new Error(`${docNo}: xomashyo sarfi allaqachon yakunlangan.`);
}

// ─── Ommaviy API ─────────────────────────────────────────────────────────────

export async function getWorkOrderMaterialFlow(docNoOrId: string, companyCode = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return viewOf(db, companyId, docNoOrId);
}

/**
 * Rejadagi (BOM) materiallarni omborda band qilish. Qayta chaqirilsa, rezerv BOM ga moslab
 * qayta hisoblanadi: kerak = reja − sexga berilgan. Bo'sh qoldiq yetmasa, bor qadarini band qiladi.
 */
export async function reserveWorkOrderMaterials(docNoOrId: string, companyCode = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const shortages: string[] = [];
  const docNo = await db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, companyId, docNoOrId, true);
    const flow = readFlow(wo);
    assertOpen(flow, wo.docNo);

    await releaseAll(tx, companyId, flow.reservations);
    const stock = await loadStock(tx, companyId);
    const plan = buildPlan(wo, stock);
    const issuedState = await loadIssued(tx, companyId, wo.docNo);

    const next: MaterialReservation[] = [];
    for (const line of plan.lines) {
      const net = (issuedState.issued.get(line.sku) || 0) - (issuedState.returned.get(line.sku) || 0);
      const need = round3(Math.max(0, line.plan - net));
      if (need <= EPS) continue;
      const prev = flow.reservations.find((r) => r.sku === line.sku)?.locationName;
      const loc = pickLocation(stock, line, prev);
      const got = loc ? round3(await adjustReserved(tx, companyId, loc, line.sku, need)) : 0;
      if (got > EPS) next.push({ sku: line.sku, name: line.name, unit: line.unit, locationName: loc, qty: got });
      if (got + EPS < need) shortages.push(`${line.name}: kerak ${fmtQty(need)}, band ${fmtQty(got)} ${line.unit}`);
    }

    const dims = { ...((wo.dimensions as any) || {}) };
    dims.materialFlow = {
      ...((dims.materialFlow as any) || {}),
      reservations: next,
      reservedAt: next.length > 0 ? new Date().toISOString() : undefined,
    };
    await writeDimensions(tx, wo.id, dims);
    return wo.docNo;
  });
  return { flow: await viewOf(db, companyId, docNo), shortages };
}

/** Buyurtma rezervini to'liq bo'shatish (bekor qilish, o'chirish). */
export async function releaseWorkOrderMaterials(docNoOrId: string, companyCode = "PRINTGOO", exec?: DbExec) {
  const companyId = await getCompanyIdByCode(companyCode);
  const run = async (tx: DbExec) => {
    const wo = await loadWorkOrder(tx, companyId, docNoOrId, true);
    const flow = readFlow(wo);
    if (flow.reservations.length === 0) return wo.docNo;
    await releaseAll(tx, companyId, flow.reservations);
    const dims = { ...((wo.dimensions as any) || {}) };
    dims.materialFlow = { ...((dims.materialFlow as any) || {}), reservations: [], reservedAt: undefined };
    await writeDimensions(tx, wo.id, dims);
    return wo.docNo;
  };
  const docNo = exec ? await run(exec) : await db.transaction((tx) => run(tx));
  return viewOf(exec ?? db, companyId, docNo);
}

interface IssueInput {
  /** Berilmasa — butun rezerv (rezerv bo'lmasa, reja − berilgan) */
  lines?: Array<{ sku: string; qty: number }>;
  operator?: string;
  pressMachine?: string;
}

/** Bir ombordan bir ISS hujjati. Berilgan miqdor shu SKU rezervidan yechiladi. */
async function issueLines(
  tx: DbExec,
  companyId: string,
  companyCode: string,
  wo: { docNo: string; productName: string; pressMachine: string | null },
  flow: MaterialFlowState,
  lines: Array<{ sku: string; name: string; unit: string; locationName: string; qty: number }>,
  input: { operator?: string; pressMachine?: string; note: string }
) {
  const byLoc = new Map<string, typeof lines>();
  for (const l of lines) {
    if (!(l.qty > EPS)) continue;
    if (!l.locationName) throw new Error(`${l.name}: ombor aniqlanmadi.`);
    byLoc.set(l.locationName, [...(byLoc.get(l.locationName) || []), l]);
  }
  const numbers: string[] = [];
  for (const [loc, group] of byLoc) {
    // Avval o'z rezervimizni bo'shatamiz — aks holda bo'sh qoldiq tekshiruvi o'z rezervimizga uriladi
    for (const l of group) {
      const res = flow.reservations.find((r) => r.sku === l.sku && r.locationName === loc);
      if (!res) continue;
      const take = Math.min(res.qty, l.qty);
      await adjustReserved(tx, companyId, loc, l.sku, -take);
      res.qty = round3(res.qty - take);
    }
    const total = group.reduce((s, l) => s + l.qty, 0);
    const press = input.pressMachine || wo.pressMachine || "Sex";
    const rec = await upsertWarehouseMovement(
      {
        movementNumber: "",
        movementType: "ProductionIssue",
        status: "Completed",
        date: new Date().toISOString().slice(0, 10),
        from: loc,
        to: press,
        pressMachine: press,
        operator: input.operator || "",
        workOrderId: wo.docNo,
        quantity: total,
        receivedQty: total,
        unit: group[0].unit,
        material: group.map((l) => l.name).join(", "),
        reason: `${input.note} — ${wo.docNo} (${wo.productName})`,
        items: group.map((l, i) => ({
          id: `line-${i + 1}`,
          sku: l.sku,
          name: l.name,
          quantity: round3(l.qty),
          receivedQty: round3(l.qty),
          unit: l.unit,
        })),
      },
      companyCode,
      // Rezerv yuqorida yechildi; buyurtma o'lchamlari tranzaksiya oxirida yoziladi
      { tx, reservationHandled: true }
    );
    numbers.push(rec.movementNumber);
  }
  flow.reservations = flow.reservations.filter((r) => r.qty > EPS);
  return numbers;
}

export async function issueWorkOrderMaterials(docNoOrId: string, companyCode = "PRINTGOO", input: IssueInput = {}) {
  const companyId = await getCompanyIdByCode(companyCode);
  const result = await db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, companyId, docNoOrId, true);
    const flow = readFlow(wo);
    assertOpen(flow, wo.docNo);
    const stock = await loadStock(tx, companyId);
    const plan = buildPlan(wo, stock);
    const issuedState = await loadIssued(tx, companyId, wo.docNo);

    const describe = (sku: string) => {
      const p = plan.lines.find((l) => l.sku === sku);
      const r = flow.reservations.find((x) => x.sku === sku);
      const s = stock.find((x) => x.sku === sku);
      if (!p && !r && !s) throw new Error(`${sku}: material katalogda topilmadi.`);
      return {
        name: p?.name || r?.name || s!.name,
        unit: p?.unit || r?.unit || s!.unit,
        locationName: r?.locationName || (p ? pickLocation(stock, p) : s!.locationName),
      };
    };

    let lines: Array<{ sku: string; name: string; unit: string; locationName: string; qty: number }>;
    if (input.lines && input.lines.length > 0) {
      lines = input.lines
        .map((l) => ({ sku: String(l.sku), qty: round3(Number(l.qty) || 0) }))
        .filter((l) => l.qty > EPS)
        .map((l) => ({ ...l, ...describe(l.sku) }));
    } else if (flow.reservations.length > 0) {
      lines = flow.reservations.map((r) => ({ ...r }));
    } else {
      lines = plan.lines
        .map((p) => {
          const net = (issuedState.issued.get(p.sku) || 0) - (issuedState.returned.get(p.sku) || 0);
          return { sku: p.sku, name: p.name, unit: p.unit, locationName: pickLocation(stock, p), qty: round3(Math.max(0, p.plan - net)) };
        })
        .filter((l) => l.qty > EPS);
    }
    if (lines.length === 0) throw new Error("Sexga beriladigan material yo'q: reja to'liq berilgan yoki BOM bo'sh.");

    const numbers = await issueLines(tx, companyId, companyCode, wo, flow, lines, {
      operator: input.operator,
      pressMachine: input.pressMachine,
      note: "Sexga berish",
    });

    const dims = { ...((wo.dimensions as any) || {}) };
    dims.materialFlow = { ...((dims.materialFlow as any) || {}), reservations: flow.reservations };
    await writeDimensions(tx, wo.id, dims);
    return { docNo: wo.docNo, numbers };
  });
  return { flow: await viewOf(db, companyId, result.docNo), documents: result.numbers };
}

interface CloseInput {
  /** Har SKU bo'yicha haqiqiy sarf (chiqindi bilan). Berilmagan SKU — sexda turgani to'liq sarflangan. */
  lines?: Array<{ sku: string; actualQty: number }>;
  operator?: string;
  pressMachine?: string;
}

/**
 * Sarfni yakunlash: sexda ortgani omborga qaytadi (RET), yetmagani qo'shimcha beriladi (ISS),
 * qolgan rezerv bo'shatiladi va BOM dagi haqiqiy sarf yangilanadi.
 */
export async function closeWorkOrderMaterials(
  docNoOrId: string,
  companyCode = "PRINTGOO",
  input: CloseInput = {},
  actor?: Actor
) {
  const companyId = await getCompanyIdByCode(companyCode);
  const result = await db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, companyId, docNoOrId, true);
    const flow = readFlow(wo);
    assertOpen(flow, wo.docNo);
    const stock = await loadStock(tx, companyId);
    const plan = buildPlan(wo, stock);
    const issuedState = await loadIssued(tx, companyId, wo.docNo);

    const actualBySku = new Map<string, number>();
    for (const l of input.lines || []) {
      const q = Number(l.actualQty);
      if (!Number.isFinite(q) || q < 0) throw new Error(`${l.sku}: haqiqiy sarf noto'g'ri.`);
      actualBySku.set(String(l.sku), round3(q));
    }

    const skus = new Set<string>([...plan.lines.map((l) => l.sku), ...issuedState.issued.keys(), ...actualBySku.keys()]);
    const extra: Array<{ sku: string; name: string; unit: string; locationName: string; qty: number }> = [];
    const returns = new Map<string, Array<{ sku: string; name: string; unit: string; qty: number }>>();
    const consumed = new Map<string, number>();

    for (const sku of skus) {
      const net = round3((issuedState.issued.get(sku) || 0) - (issuedState.returned.get(sku) || 0));
      const actual = actualBySku.has(sku) ? actualBySku.get(sku)! : Math.max(0, net);
      consumed.set(sku, actual);
      const p = plan.lines.find((l) => l.sku === sku);
      const s = stock.find((x) => x.sku === sku);
      const name = p?.name || s?.name || sku;
      const unit = p?.unit || s?.unit || "sheets";
      const diff = round3(actual - net);
      if (diff > EPS) {
        const res = flow.reservations.find((r) => r.sku === sku);
        const loc = res?.locationName || (p ? pickLocation(stock, p) : s?.locationName || "");
        extra.push({ sku, name, unit, locationName: loc, qty: diff });
      } else if (diff < -EPS) {
        // Ortgan material berilgan omborga qaytadi (eng ko'p berilgan ombordan boshlab)
        let left = -diff;
        const locs = [...(issuedState.netByLoc.get(sku) || new Map()).entries()].filter(([, q]) => q > EPS).sort((a, b) => b[1] - a[1]);
        for (const [loc, q] of locs) {
          if (left <= EPS) break;
          const take = round3(Math.min(left, q));
          returns.set(loc, [...(returns.get(loc) || []), { sku, name, unit, qty: take }]);
          left = round3(left - take);
        }
      }
    }

    const numbers: string[] = [];
    if (extra.length > 0) {
      numbers.push(
        ...(await issueLines(tx, companyId, companyCode, wo, flow, extra, {
          operator: input.operator,
          pressMachine: input.pressMachine,
          note: "Qo'shimcha sarf",
        }))
      );
    }
    // Ortgan material omborga qoralama (Pending) RET bilan qaytadi: omborchi jismonan qabul qilib tasdiqlaganda
    // qoldiq oshadi. Qabul qilingan miqdor oldindan to'ldiriladi — omborchi sanab tuzatadi.
    const pendingReturns: Array<{ number: string; location: string; total: number; unit: string }> = [];
    for (const [loc, group] of returns) {
      const total = group.reduce((s, l) => s + l.qty, 0);
      const press = input.pressMachine || wo.pressMachine || "Sex";
      const rec = await upsertWarehouseMovement(
        {
          movementNumber: "",
          movementType: "ProductionReturn",
          status: "Pending",
          date: new Date().toISOString().slice(0, 10),
          from: press,
          to: loc,
          pressMachine: press,
          operator: input.operator || "",
          workOrderId: wo.docNo,
          quantity: total,
          receivedQty: total,
          unit: group[0].unit,
          material: group.map((l) => l.name).join(", "),
          reason: `Sexdan qaytarish (ortgan material) — ${wo.docNo} (${wo.productName})`,
          items: group.map((l, i) => ({
            id: `line-${i + 1}`,
            sku: l.sku,
            name: l.name,
            quantity: l.qty,
            receivedQty: l.qty,
            unit: l.unit,
          })),
        },
        companyCode,
        { tx }
      );
      numbers.push(rec.movementNumber);
      pendingReturns.push({ number: rec.movementNumber, location: loc, total: round3(total), unit: group[0].unit });
    }

    await releaseAll(tx, companyId, flow.reservations);

    // BOM dagi haqiqiy sarfni SKU bo'yicha reja ulushiga qarab taqsimlash (tannarx shu qatorlardan olinadi)
    const dims = { ...((wo.dimensions as any) || {}) };
    const materials: any[] = Array.isArray(dims.materials) ? dims.materials : [];
    const rowsBySku = new Map<string, number[]>();
    materials.forEach((m, idx) => {
      const key = String(m?.sku || m?.id || "").trim().toLowerCase();
      const name = String(m?.name || "").trim().toLowerCase();
      const row = stock.find((s) => s.sku.toLowerCase() === key) || stock.find((s) => s.name.trim().toLowerCase() === name);
      if (row && consumed.has(row.sku)) rowsBySku.set(row.sku, [...(rowsBySku.get(row.sku) || []), idx]);
    });
    const nextMaterials = materials.map((m) => ({ ...m }));
    for (const [sku, idxs] of rowsBySku) {
      const total = consumed.get(sku) || 0;
      const planSum = idxs.reduce((s, i) => s + (Number(materials[i].planQty) || Number(materials[i].qty) || 0), 0);
      let left = total;
      idxs.forEach((i, k) => {
        const p = Number(materials[i].planQty) || Number(materials[i].qty) || 0;
        const share = k === idxs.length - 1 ? left : round3(planSum > 0 ? (total * p) / planSum : total / idxs.length);
        left = round3(left - share);
        const unitPrice = Number(nextMaterials[i].unitPrice) || 0;
        nextMaterials[i].actualQty = share;
        nextMaterials[i].qty = share;
        nextMaterials[i].wasteQty = round3(Math.max(0, share - p));
        if (unitPrice > 0) nextMaterials[i].totalPrice = round3(share * unitPrice);
      });
    }

    const firstIssue = issuedState.docs.find((d) => d.type === "ProductionIssue" && !d.pending)?.number || numbers.find((n) => n.startsWith("ISS-"));
    dims.materials = nextMaterials;
    dims.materialsConsumed = true;
    dims.materialsConsumedAt = new Date().toISOString();
    if (firstIssue) dims.materialIssueDocNo = firstIssue;
    dims.materialFlow = {
      ...((dims.materialFlow as any) || {}),
      reservations: [],
      closedAt: new Date().toISOString(),
      closedBy: actor?.name || input.operator || undefined,
    };
    await writeDimensions(tx, wo.id, dims);
    return { docNo: wo.docNo, numbers, materials: nextMaterials, materialIssueDocNo: firstIssue, pendingReturns };
  });

  for (const r of result.pendingReturns) {
    try {
      await emitNotification(
        {
          dedupKey: `production-return-pending:${r.number}`,
          severity: "warning",
          category: "warehouse",
          eventType: "production_return:pending",
          entityCode: r.number,
          title: `Qaytarishni qabul qiling: ${r.number}`,
          description: `${result.docNo}: sexdan ${fmtQty(r.total)} ${r.unit} ortgan material "${r.location}" omboriga qaytariladi.`,
          link: { module: "warehouse", subModule: "production-issue" },
        },
        companyCode
      );
    } catch {
      /* bildirishnoma yetmasa ham hujjat ro'yxatda va menyu hisoblagichida ko'rinadi */
    }
  }

  return {
    flow: await viewOf(db, companyId, result.docNo),
    documents: result.numbers,
    materials: result.materials,
    materialIssueDocNo: result.materialIssueDocNo,
  };
}
