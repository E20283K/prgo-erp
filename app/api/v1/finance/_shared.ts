import { NextResponse } from "next/server";
import { getCompanyIdByCode } from "@/lib/server/crmService";

export function financeError(error: unknown, status = 400) {
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Xatolik" },
    { status }
  );
}

export function companyIdFrom(url: string): Promise<string> {
  return getCompanyIdByCode(new URL(url).searchParams.get("company") || "PRINTGOO");
}
