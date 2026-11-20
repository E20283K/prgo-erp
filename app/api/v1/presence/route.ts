import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/server/authService";
import { heartbeatPresence, isValidPresenceKey, leavePresence } from "@/lib/server/presenceService";
import { getUserInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

function readToken(request: NextRequest): string | null {
  const fromCookie = request.cookies.get("printgoo_session")?.value;
  if (fromCookie) return fromCookie;
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * POST { key, editing?, leave? }
 * Heartbeat for the current user on document `key`; returns everyone else
 * who has it open. `leave: true` removes the user (sent via sendBeacon).
 */
export async function POST(request: NextRequest) {
  const token = readToken(request);
  const user = token ? await validateSession(token).catch(() => null) : null;
  if (!user) {
    return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
  }

  let body: { key?: unknown; sid?: unknown; editing?: unknown; leave?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!isValidPresenceKey(body.key)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri kalit" }, { status: 400 });
  }
  const sid = typeof body.sid === "string" ? body.sid.slice(0, 64) : "";

  if (body.leave === true) {
    await leavePresence(body.key, user.id, sid);
    return NextResponse.json({ success: true, data: [] });
  }

  const name = user.fullName || user.username;
  const viewers = await heartbeatPresence(body.key, {
    userId: user.id,
    name,
    initials: user.initials || getUserInitials(name, "U"),
    avatar: user.avatar || null,
    editing: body.editing === true,
    sid,
  });

  return NextResponse.json({
    success: true,
    data: viewers.filter((v) => v.userId !== user.id),
  });
}
