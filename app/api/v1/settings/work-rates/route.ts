import { NextRequest, NextResponse } from "next/server";
import { getWorkRates, upsertWorkRate, deleteWorkRate } from "@/lib/server/workRateService";

export const dynamic = "force-dynamic";

const companyOf = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  return searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";
};

const fail = (error: unknown, fallback: string) =>
  NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );

export async function GET(request: NextRequest) {
  try {
    const data = await getWorkRates(companyOf(request));
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error("GET /api/v1/settings/work-rates error:", error);
    return fail(error, "Operatsiyalarni yuklashda xatolik");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await upsertWorkRate(body, companyOf(request));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("POST /api/v1/settings/work-rates error:", error);
    return fail(error, "Operatsiyani saqlashda xatolik");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID berilmadi" }, { status: 400 });
    }
    const ok = await deleteWorkRate(id, companyOf(request));
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error("DELETE /api/v1/settings/work-rates error:", error);
    return fail(error, "Operatsiyani o'chirishda xatolik");
  }
}
