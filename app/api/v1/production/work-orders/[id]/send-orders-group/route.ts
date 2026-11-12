import { NextRequest, NextResponse } from "next/server";
import {
  sendWorkOrderToOrdersGroup,
  updateTelegramOrderCardStatus,
} from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const {
      chatId,
      customNote,
      updateOnly,
      replacePdf,
      alertReply,
      companyCode = "PRINTGOO",
    } = body;

    // 1. Agar mavjud xabarning biriktirilgan PDF faylini almashtirish (editMessageMedia)
    if (replacePdf) {
      const updateResult = await updateTelegramOrderCardStatus(
        id,
        companyCode,
        true,
        Boolean(alertReply),
        customNote
      );

      if (!updateResult.success) {
        return NextResponse.json(
          { success: false, error: updateResult.error || "PDF ni yangilab bo'lmadi" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Telegram guruhidagi PDF texnik pasport muvaffaqiyatli yangilandi",
        updated: updateResult.updated,
        mediaReplaced: updateResult.mediaReplaced,
        alertSent: updateResult.alertSent,
        telegramMeta: updateResult.telegramMeta,
      });
    }

    // 2. Agar faqat status / bosqich matnini yangilash (editMessageCaption)
    if (updateOnly) {
      const updateResult = await updateTelegramOrderCardStatus(
        id,
        companyCode,
        false,
        Boolean(alertReply),
        customNote
      );

      if (!updateResult.success) {
        return NextResponse.json(
          { success: false, error: updateResult.error || "Statusni yangilab bo'lmadi" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Telegram guruhidagi buyurtma statusi muvaffaqiyatli yangilandi",
        updated: updateResult.updated,
        alertSent: updateResult.alertSent,
        telegramMeta: updateResult.telegramMeta,
      });
    }

    // 3. Yangi buyurtma yuborish (yoki qayta yangi xabar sifatida yuborish)
    const result = await sendWorkOrderToOrdersGroup({
      workOrderId: id,
      chatId: chatId || undefined,
      customNote: customNote || undefined,
      companyCode,
      alertReply: Boolean(alertReply),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Buyurtma Telegram guruhiga muvaffaqiyatli jo'natildi",
      data: result.message,
      telegramMeta: result.telegramMeta,
    });
  } catch (error) {
    console.error("[POST /api/v1/production/work-orders/[id]/send-orders-group] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Xabarni yuborishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
