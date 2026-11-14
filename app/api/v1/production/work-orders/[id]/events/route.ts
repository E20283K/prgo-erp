import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, type PermissionRule } from "@/lib/server/apiAuth";
import {
  deleteWorkOrderEvent,
  listWorkOrderEvents,
  saveWorkOrderEvent,
} from "@/lib/server/workOrderEventService";

export const dynamic = "force-dynamic";

const PRODUCTION_READ: PermissionRule[] = [["production", "view"]];
const PRODUCTION_WRITE: PermissionRule[] = [
  ["production", "create"],
  ["production", "edit"],
];

type Ctx = { params: Promise<{ id: string }> };

const fail = (error: unknown, status = 400) =>
  NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Smena jurnali xatosi" },
    { status }
  );

/** Shift journal of a work order, newest first, with the plant's shift schedule. */
export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, PRODUCTION_READ);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const company = new URL(request.url).searchParams.get("company");
    const data = await listWorkOrderEvents(decodeURIComponent(id), company);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return fail(error);
  }
}

/** Logs (or corrects) one journal entry right away. */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, PRODUCTION_WRITE);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const company = new URL(request.url).searchParams.get("company");
    const body = await request.json();
    const event = await saveWorkOrderEvent(
      decodeURIComponent(id),
      body,
      { id: auth.user.id, name: auth.user.fullName || auth.user.username },
      company
    );
    return NextResponse.json({ success: true, event });
  } catch (error) {
    return fail(error);
  }
}

/** Removes a journal entry (kept in the database with who removed it). */
export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, PRODUCTION_WRITE);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return fail(new Error("eventId kerak."));
    const result = await deleteWorkOrderEvent(
      decodeURIComponent(id),
      eventId,
      { id: auth.user.id, name: auth.user.fullName || auth.user.username },
      searchParams.get("company")
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
