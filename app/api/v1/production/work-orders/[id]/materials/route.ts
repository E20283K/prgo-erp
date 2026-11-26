import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, WAREHOUSE_READ, type PermissionRule } from "@/lib/server/apiAuth";
import {
  closeWorkOrderMaterials,
  getWorkOrderMaterialFlow,
  issueWorkOrderMaterials,
  releaseWorkOrderMaterials,
  reserveWorkOrderMaterials,
} from "@/lib/server/workOrderMaterialService";

export const dynamic = "force-dynamic";

/** Xomashyoni band qilish / sexga berish ombor yoki ishlab chiqarish tahrir huquqini talab qiladi */
const MATERIAL_WRITE: PermissionRule[] = [
  ["warehouse", "create"],
  ["warehouse", "edit"],
  ["production", "edit"],
];

const companyOf = (request: NextRequest) => {
  const sp = new URL(request.url).searchParams;
  return sp.get("company") || sp.get("companyCode") || "PRINTGOO";
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const data = await getWorkOrderMaterialFlow(decodeURIComponent(id), companyOf(request));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xomashyo holatini yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request, MATERIAL_WRITE);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const docNo = decodeURIComponent(id);
    const companyCode = companyOf(request);
    const body = await request.json().catch(() => ({}));
    const actorName = auth.user.fullName || auth.user.username || "";

    switch (body.action) {
      case "reserve": {
        const res = await reserveWorkOrderMaterials(docNo, companyCode);
        return NextResponse.json({ success: true, data: res.flow, shortages: res.shortages });
      }
      case "release": {
        const flow = await releaseWorkOrderMaterials(docNo, companyCode);
        return NextResponse.json({ success: true, data: flow });
      }
      case "issue": {
        const res = await issueWorkOrderMaterials(docNo, companyCode, {
          lines: Array.isArray(body.lines) ? body.lines : undefined,
          operator: actorName,
          pressMachine: body.pressMachine,
        });
        return NextResponse.json({ success: true, data: res.flow, documents: res.documents });
      }
      case "close": {
        const res = await closeWorkOrderMaterials(
          docNo,
          companyCode,
          {
            lines: Array.isArray(body.lines) ? body.lines : undefined,
            operator: actorName,
            pressMachine: body.pressMachine,
          },
          { name: actorName }
        );
        return NextResponse.json({
          success: true,
          data: res.flow,
          documents: res.documents,
          materials: res.materials,
          materialIssueDocNo: res.materialIssueDocNo,
        });
      }
      default:
        return NextResponse.json({ success: false, error: "Noma'lum amal" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xomashyo amalida xatolik" },
      { status: 400 }
    );
  }
}
