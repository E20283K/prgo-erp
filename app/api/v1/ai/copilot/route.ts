import { NextRequest, NextResponse } from "next/server";
import { executeCopilotGateway } from "@/lib/ai/gateway";
import { CopilotUiContext } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context, companyCode = "PRINTGOO" } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Xabarlar ro'yxati (messages) bo'sh bo'lishi mumkin emas",
        },
        { status: 400 }
      );
    }

    const safeContext: CopilotUiContext = {
      activeModule: context?.activeModule || "production",
      activeSubModule: context?.activeSubModule,
      activeTabId: context?.activeTabId,
      activeTabType: context?.activeTabType,
      activeTabTitle: context?.activeTabTitle,
      activeDocumentSummary: context?.activeDocumentSummary || null,
      userRole: context?.userRole || "Operator",
      userName: context?.userName || "User",
      locale: context?.locale || "uz",
      clientDataSnapshot: context?.clientDataSnapshot,
      screenSnapshot: context?.screenSnapshot,
      includeActiveTabContext: context?.includeActiveTabContext !== false,
    };

    const response = await executeCopilotGateway(
      messages,
      safeContext,
      companyCode
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("AI Copilot API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "AI Copilot so'rovini qayta ishlashda xatolik yuz berdi",
        providerMode: "smart_local",
      },
      { status: 500 }
    );
  }
}
