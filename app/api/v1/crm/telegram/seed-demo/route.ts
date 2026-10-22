import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Demo seed is disabled." },
    { status: 404 }
  );
}
