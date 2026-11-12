import { NextRequest, NextResponse } from "next/server";
import {
  getTradingCatalogImages,
  addTradingCatalogImage,
  deleteTradingCatalogImage,
} from "@/lib/server/tradingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const catalogId = searchParams.get("catalogId");
    if (!catalogId) {
      return NextResponse.json({ success: false, error: "catalogId talab qilinadi" }, { status: 400 });
    }

    const data = await getTradingCatalogImages(catalogId);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/v1/trading/catalog/images error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const body = await req.json();

    if (!body.catalogId || !body.imageUrl) {
      return NextResponse.json(
        { success: false, error: "catalogId va imageUrl maydonlari majburiy" },
        { status: 400 }
      );
    }

    const data = await addTradingCatalogImage(
      {
        catalogId: body.catalogId,
        imageUrl: body.imageUrl,
        thumbnailUrl: body.thumbnailUrl,
        title: body.title,
        isPrimary: body.isPrimary ?? false,
        sortOrder: body.sortOrder ?? 0,
      },
      company
    );

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/v1/trading/catalog/images error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Rasm id si talab qilinadi" }, { status: 400 });
    }

    const success = await deleteTradingCatalogImage(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error("DELETE /api/v1/trading/catalog/images error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
