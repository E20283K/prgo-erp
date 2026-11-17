import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getFloorOverview, getMachineQueue, listTerminalMachines } from "@/lib/server/operatorTerminalService";

export const dynamic = "force-dynamic";

/** Operator terminal: machines (no machineId), the whole floor (`overview`), or the work queue of one machine. */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["production", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("overview")) {
      return NextResponse.json({ success: true, floor: await getFloorOverview() });
    }
    const machineId = params.get("machineId");
    if (!machineId) {
      return NextResponse.json({ success: true, machines: await listTerminalMachines() });
    }
    return NextResponse.json({ success: true, ...(await getMachineQueue(machineId)) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Terminal ma'lumotlari yuklanmadi" },
      { status: 400 }
    );
  }
}
