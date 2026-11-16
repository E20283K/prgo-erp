import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, type ApiUser } from "@/lib/server/apiAuth";
import { getNavBadges, NAV_BADGE_MODULES, type NavBadgeModule } from "@/lib/server/navBadgeService";

export const dynamic = "force-dynamic";

function canView(user: ApiUser, mod: NavBadgeModule): boolean {
  if (user.role === "admin") return true;
  return (user.permissions as any)?.[mod]?.view === true;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(
    request,
    NAV_BADGE_MODULES.map((m) => [m, "view"])
  );
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";
    const allowed = Object.fromEntries(
      NAV_BADGE_MODULES.map((m) => [m, canView(auth.user, m)])
    ) as Record<NavBadgeModule, boolean>;

    const data = await getNavBadges(companyCode, allowed);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Badge hisoblashda xatolik" },
      { status: 500 }
    );
  }
}
