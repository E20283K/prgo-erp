import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  syncBusinessAlerts,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
  getNotificationRules,
  updateNotificationRules,
  emitNotification,
} from "@/lib/server/notificationService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";

    // 1. Yangi dedlayn va ombor qoldiqlarini skanerlab sinxronlash
    await syncBusinessAlerts(companyCode);

    // 2. Faol bildirishnomalarni va qoidalar sozlamasini olish
    const [items, rules] = await Promise.all([
      getNotifications(companyCode),
      getNotificationRules(companyCode),
    ]);

    return NextResponse.json({
      success: true,
      notifications: items,
      rules,
    });
  } catch (err: any) {
    console.error("[GET /api/v1/notifications] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const companyCode = searchParams.get("companyCode") || body.companyCode || "PRINTGOO";

    if (body.action === "updateRules") {
      const updatedRules = await updateNotificationRules(body.rules, companyCode);
      return NextResponse.json({ success: true, rules: updatedRules });
    }

    const created = await emitNotification(body, companyCode);
    return NextResponse.json({ success: true, notification: created });
  } catch (err: any) {
    console.error("[POST /api/v1/notifications] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process notification" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const companyCode = searchParams.get("companyCode") || body.companyCode || "PRINTGOO";

    if (body.markAll) {
      await markAllNotificationsRead(companyCode);
      return NextResponse.json({ success: true, allRead: true });
    }

    if (body.id) {
      const isRead = body.read !== undefined ? Boolean(body.read) : true;
      await markNotificationRead(body.id, isRead, companyCode);
      return NextResponse.json({ success: true, id: body.id, isRead });
    }

    return NextResponse.json(
      { success: false, error: "Missing 'id' or 'markAll' in payload" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[PATCH /api/v1/notifications] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update notification status" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await clearAllNotifications(companyCode);
      return NextResponse.json({ success: true, cleared: true });
    }

    if (id) {
      await dismissNotification(id, companyCode);
      return NextResponse.json({ success: true, dismissedId: id });
    }

    return NextResponse.json(
      { success: false, error: "Missing 'id' or 'all' query param" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[DELETE /api/v1/notifications] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete notification" },
      { status: 500 }
    );
  }
}
