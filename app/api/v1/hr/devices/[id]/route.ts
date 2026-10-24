import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { biometricDevices } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.deviceCode !== undefined) updateData.deviceCode = body.deviceCode.trim();
    if (body.model !== undefined) updateData.model = body.model.trim();
    if (body.ipAddress !== undefined) updateData.ipAddress = body.ipAddress.trim();
    if (body.port !== undefined) updateData.port = Number(body.port);
    if (body.username !== undefined) updateData.username = body.username.trim();
    if (body.password !== undefined && body.password.trim().length > 0) {
      updateData.password = body.password.trim();
    }
    if (body.direction !== undefined) updateData.direction = body.direction;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled);

    const [updated] = await db
      .update(biometricDevices)
      .set(updateData)
      .where(eq(biometricDevices.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(biometricDevices).where(eq(biometricDevices.id, id));
    return NextResponse.json({ success: true, message: "Qurilma o'chirildi" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
