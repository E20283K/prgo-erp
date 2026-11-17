import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { employeeHasTerminalPin, setEmployeeTerminalPin } from "@/lib/server/terminalIdentityService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Whether the employee has a kiosk PIN (the PIN itself is never returned). */
export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["hr", "view"]]);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  return NextResponse.json({ success: true, hasPin: await employeeHasTerminalPin(id) });
}

/** Sets (or with `pin: null` removes) the employee's kiosk PIN. */
export async function PUT(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["hr", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { pin?: string | null };
    const result = await setEmployeeTerminalPin(id, body.pin ?? null);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "PIN saqlanmadi" },
      { status: 400 }
    );
  }
}
