import { db } from "@/db";
import {
  notifications,
  companies,
  workOrders,
  warehouseStockBalances,
  deliveryActs,
  type DbNotification,
  type NewDbNotification,
  type NotificationRulesConfig,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

export interface EmitNotificationInput {
  dedupKey?: string;
  severity: "info" | "success" | "warning" | "error";
  category: "production" | "warehouse" | "finance" | "crm" | "system";
  eventType: string;
  entityCode?: string;
  title: string;
  description?: string;
  i18nKey?: string;
  i18nParams?: Record<string, string | number>;
  link?: { module: string; subModule: string };
  targetTab?: Record<string, unknown>;
  recipientRole?: string;
  recipientUserId?: string;
}

const DEFAULT_RULES: Required<NotificationRulesConfig> = {
  woDeadlineEnabled: true,
  woDeadlineDays: 7,
  woStatusEnabled: true,
  stockLowEnabled: true,
  financeDocsEnabled: true,
};

/**
 * Korxona bildirishnoma sozlamalarini (Rules) olish
 */
export async function getNotificationRules(companyCode: string = "PRINTGOO"): Promise<Required<NotificationRulesConfig>> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    const comp = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });
    const rules = comp?.settings?.notifications;
    return {
      woDeadlineEnabled: rules?.woDeadlineEnabled ?? DEFAULT_RULES.woDeadlineEnabled,
      woDeadlineDays: rules?.woDeadlineDays ?? DEFAULT_RULES.woDeadlineDays,
      woStatusEnabled: rules?.woStatusEnabled ?? DEFAULT_RULES.woStatusEnabled,
      stockLowEnabled: rules?.stockLowEnabled ?? DEFAULT_RULES.stockLowEnabled,
      financeDocsEnabled: rules?.financeDocsEnabled ?? DEFAULT_RULES.financeDocsEnabled,
    };
  } catch (err) {
    console.error("[getNotificationRules] Error:", err);
    return DEFAULT_RULES;
  }
}

/**
 * Korxona bildirishnoma sozlamalarini (Rules) yangilash
 */
export async function updateNotificationRules(
  newRules: Partial<NotificationRulesConfig>,
  companyCode: string = "PRINTGOO"
): Promise<Required<NotificationRulesConfig>> {
  const companyId = await getCompanyIdByCode(companyCode);
  const comp = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });
  const currentSettings = comp?.settings || {};
  const mergedRules = {
    ...DEFAULT_RULES,
    ...(currentSettings.notifications || {}),
    ...newRules,
  };

  await db
    .update(companies)
    .set({
      settings: {
        ...currentSettings,
        notifications: mergedRules,
      },
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));

  return mergedRules;
}

/**
 * Yangi bildirishnoma yaratish yoki dedupKey orqali yangilash
 */
export async function emitNotification(
  input: EmitNotificationInput,
  companyCode: string = "PRINTGOO"
): Promise<DbNotification | null> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    const rules = await getNotificationRules(companyCode);

    // Rule filter check
    if (input.eventType.startsWith("wo_deadline") && !rules.woDeadlineEnabled) return null;
    if (input.eventType.startsWith("wo_status") && !rules.woStatusEnabled) return null;
    if (input.eventType.startsWith("stock_") && !rules.stockLowEnabled) return null;
    if (input.eventType.startsWith("invoice_") && !rules.financeDocsEnabled) return null;

    if (input.dedupKey) {
      const existing = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.companyId, companyId),
          eq(notifications.dedupKey, input.dedupKey)
        ),
      });

      if (existing) {
        // Agar allaqachon foydalanuvchi o'chirgan bo'lsa (dismissed), qayta bezovta qilmaymiz
        if (existing.isDismissed) {
          return existing;
        }

        // Mavjud xabarni yangilash (agar holat o'zgargan bo'lsa)
        const [updated] = await db
          .update(notifications)
          .set({
            title: input.title,
            description: input.description,
            severity: input.severity,
            i18nKey: input.i18nKey,
            i18nParams: input.i18nParams,
            link: input.link,
            targetTab: input.targetTab,
            updatedAt: new Date(),
          })
          .where(eq(notifications.id, existing.id))
          .returning();

        return updated;
      }
    }

    const [created] = await db
      .insert(notifications)
      .values({
        companyId,
        recipientRole: input.recipientRole || "all",
        recipientUserId: input.recipientUserId ? (input.recipientUserId as any) : null,
        dedupKey: input.dedupKey || null,
        severity: input.severity,
        category: input.category,
        eventType: input.eventType,
        entityCode: input.entityCode || null,
        title: input.title,
        description: input.description || null,
        i18nKey: input.i18nKey || null,
        i18nParams: input.i18nParams || null,
        link: input.link || null,
        targetTab: input.targetTab || null,
        isRead: false,
        isDismissed: false,
      })
      .returning();

    return created;
  } catch (err) {
    console.error("[emitNotification] Error:", err);
    return null;
  }
}

/**
 * Real bazadagi operatsion holatlarni skanerlab bildirishnomalarni sinxronlashtirish
 */
export async function syncBusinessAlerts(companyCode: string = "PRINTGOO") {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    const rules = await getNotificationRules(companyCode);
    const now = new Date();

    // 1. Production: Yaqinlashayotgan yoki muddati o'tgan buyurtmalar
    if (rules.woDeadlineEnabled) {
      try {
        const activeOrders = await db.query.workOrders.findMany({
          where: eq(workOrders.companyId, companyId),
          limit: 15,
        });

        for (const wo of activeOrders) {
          if (wo.status === "Completed" || wo.status === "Cancelled" || !wo.deadline) continue;
          const deadlineDate = new Date(wo.deadline);
          const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

          if (diffDays <= rules.woDeadlineDays && diffDays >= 0) {
            await emitNotification(
              {
                dedupKey: `wo-deadline:${wo.docNo}`,
                severity: diffDays <= 2 ? "error" : "warning",
                category: "production",
                eventType: "wo_deadline",
                entityCode: wo.docNo,
                title: `${wo.docNo} dedlayn yaqinlashmoqda`,
                description: `${wo.productName} mahsuloti uchun ${diffDays} kun qoldi. Bosqich: ${wo.stage || "Rejada"}.`,
                i18nKey: "seed_woDeadline_title",
                i18nParams: { docNo: wo.docNo, days: diffDays, product: wo.productName },
                link: { module: "production", subModule: "work-orders" },
                targetTab: {
                  id: `wo-${wo.docNo}`,
                  title: `${wo.docNo} (Buyurtma)`,
                  type: "work-order",
                  module: "production",
                  documentData: { id: wo.docNo, docNo: wo.docNo, customer: wo.customerName },
                },
              },
              companyCode
            );
          }
        }
      } catch (e) {
        // workOrders may be empty or error handled gracefully
      }
    }

    // 2. Warehouse: Kam qolgan xomashyolar (Stock Balances)
    if (rules.stockLowEnabled) {
      try {
        const lowStocks = await db.query.warehouseStockBalances.findMany({
          where: eq(warehouseStockBalances.companyId, companyId),
          limit: 10,
        });

        for (const stock of lowStocks) {
          const avail = Number(stock.available) || 0;
          const reorder = Number(stock.reorder) || 50;
          if (avail <= reorder) {
            await emitNotification(
              {
                dedupKey: `stock-low:${stock.sku}`,
                severity: avail <= 20 ? "error" : "warning",
                category: "warehouse",
                eventType: "stock_low",
                entityCode: stock.sku,
                title: `Ombor kam qoldiq: ${stock.name}`,
                description: `Ombordagi qoldiq minimal me'yordan kam (${avail} ${stock.unit} qoldi). Xarid buyurtmasi kerak.`,
                i18nKey: "seed_stockLow_title",
                i18nParams: { sku: stock.sku, name: stock.name, qty: avail, unit: stock.unit },
                link: { module: "warehouse", subModule: "stock-balance" },
                targetTab: {
                  id: `stock-${stock.sku}`,
                  title: `${stock.sku} (Qoldiq)`,
                  type: "warehouse-stock",
                  module: "warehouse",
                  documentData: { sku: stock.sku, name: stock.name },
                },
              },
              companyCode
            );
          }
        }
      } catch (e) {}
    }

    // 3. Agar bildirishnomalar jadvali bo'sh bo'lsa (yangi bazada), rasmiy namunaviy biznes hodisalarni yaratish
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.companyId, companyId));

    if (Number(countRes[0]?.count || 0) === 0) {
      // Seed high-value operational alerts
      await emitNotification(
        {
          dedupKey: "seed:wo-351",
          severity: "warning",
          category: "production",
          eventType: "wo_deadline",
          entityCode: "WOOF-26-0351",
          title: "WOOF-26-0351 dedlayn yaqinlashmoqda",
          description: "Hardcover Catalog buyurtmasi uchun 6 kun qoldi. Prepress: Tasdiqlangan.",
          i18nKey: "seed_woDeadline_title",
          i18nParams: { docNo: "WOOF-26-0351", days: 6, product: "Hardcover Catalog" },
          link: { module: "production", subModule: "work-orders" },
          targetTab: {
            id: "wo-WOOF-26-0351",
            title: "WOOF-26-0351 (Buyurtma)",
            type: "work-order",
            module: "production",
          },
        },
        companyCode
      );

      await emitNotification(
        {
          dedupKey: "seed:stock-gas-150",
          severity: "error",
          category: "warehouse",
          eventType: "stock_low",
          entityCode: "PAP-GAS-150",
          title: "Ombor ogohlantirishi: Galerie Art Silk 150g",
          description: "Ombor qoldig'i reorder darajasidan past (42 varaq qoldi).",
          i18nKey: "seed_stockLow_title",
          i18nParams: { sku: "PAP-GAS-150", name: "Galerie Art Silk 150g", qty: 42, unit: "varaq" },
          link: { module: "warehouse", subModule: "stock-balance" },
          targetTab: {
            id: "stock-PAP-GAS-150",
            title: "PAP-GAS-150 (Qoldiq)",
            type: "warehouse-stock",
            module: "warehouse",
          },
        },
        companyCode
      );

      await emitNotification(
        {
          dedupKey: "seed:inv-sf-8001",
          severity: "success",
          category: "finance",
          eventType: "invoice_posted",
          entityCode: "SF-8001",
          title: "Schet-faktura SF-8001 rasmiylashtirildi",
          description: "Alpha Media Group LLC - $14,850.00 (Ombor yuk xati: SHP-6000).",
          i18nKey: "seed_invoicePosted_title",
          i18nParams: { docNo: "SF-8001", amount: "$14,850.00", customer: "Alpha Media Group LLC" },
          link: { module: "finance", subModule: "delivery-acts" },
          targetTab: {
            id: "doc-delivery-act-SF-8001",
            title: "SF-8001 (Schet-faktura)",
            type: "delivery-act",
            module: "finance",
          },
        },
        companyCode
      );
    }
  } catch (err) {
    console.error("[syncBusinessAlerts] Error:", err);
  }
}

/**
 * Faol bildirishnomalarni olish
 */
export async function getNotifications(companyCode: string = "PRINTGOO"): Promise<DbNotification[]> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    return db.query.notifications.findMany({
      where: and(
        eq(notifications.companyId, companyId),
        eq(notifications.isDismissed, false)
      ),
      orderBy: [desc(notifications.createdAt)],
      limit: 60,
    });
  } catch (err) {
    console.error("[getNotifications] Error:", err);
    return [];
  }
}

/**
 * Bitta bildirishnomani o'qilgan/o'qilmagan deb belgilash
 */
export async function markNotificationRead(
  id: string,
  isRead: boolean = true,
  companyCode: string = "PRINTGOO"
): Promise<boolean> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    await db
      .update(notifications)
      .set({
        isRead,
        readAt: isRead ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id as any), eq(notifications.companyId, companyId)));
    return true;
  } catch (err) {
    console.error("[markNotificationRead] Error:", err);
    return false;
  }
}

/**
 * Barcha bildirishnomalarni o'qilgan deb belgilash
 */
export async function markAllNotificationsRead(companyCode: string = "PRINTGOO"): Promise<boolean> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.companyId, companyId), eq(notifications.isDismissed, false)));
    return true;
  } catch (err) {
    console.error("[markAllNotificationsRead] Error:", err);
    return false;
  }
}

/**
 * Bildirishnomani o'chirib yuborish (Soft dismiss)
 */
export async function dismissNotification(
  id: string,
  companyCode: string = "PRINTGOO"
): Promise<boolean> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    await db
      .update(notifications)
      .set({
        isDismissed: true,
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id as any), eq(notifications.companyId, companyId)));
    return true;
  } catch (err) {
    console.error("[dismissNotification] Error:", err);
    return false;
  }
}

/**
 * Barcha bildirishnomalarni tozalash (Soft dismiss all)
 */
export async function clearAllNotifications(companyCode: string = "PRINTGOO"): Promise<boolean> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    await db
      .update(notifications)
      .set({
        isDismissed: true,
        updatedAt: new Date(),
      })
      .where(eq(notifications.companyId, companyId));
    return true;
  } catch (err) {
    console.error("[clearAllNotifications] Error:", err);
    return false;
  }
}
