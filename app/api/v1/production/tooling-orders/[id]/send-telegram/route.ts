import { NextRequest, NextResponse } from "next/server";
import { sendPurchaseOrderToTelegram } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { customNote, fileUrl, fileName } = body;

    const result = await sendPurchaseOrderToTelegram({
      supplierOrderId: id,
      customNote: customNote || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Buyurtma yetkazib beruvchi guruhiga inline tugmalar bilan yuborildi",
      data: result.message,
    });
  } catch (error) {
    console.error("[POST /api/v1/production/tooling-orders/[id]/send-telegram] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Xabarni yuborishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
