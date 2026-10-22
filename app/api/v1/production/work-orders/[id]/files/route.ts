import { NextResponse } from "next/server";
import { getWorkOrderAttachments, createWorkOrderAttachment } from "@/lib/server/workOrderService";
import { createPresignedUploadUrl, createPresignedDownloadUrl, type StorageBucketKey } from "@/lib/server/storage";
import { db } from "@/db";
import { workOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attachments = await getWorkOrderAttachments(id);
    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error("GET attachments error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Faylni tartibli papkada saqlash uchun Presigned URL berish yoki to'g'ridan-to'g'ri biriktirish:
 * Yo'l formati: {companyCode}/orders/{docNo}/{category}/{timestamp}_{fileName}
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workOrderId } = await params;
    const body = await request.json();

    const {
      docNo = "WO-GENERAL",
      companyCode = "PRINTGOO",
      fileName,
      fileType,
      fileSize,
      category = "docs",
      uploadedBy,
    } = body;

    if (!fileName) {
      return NextResponse.json({ success: false, error: "Fayl nomi kiritilishi shart!" }, { status: 400 });
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const objectKey = `${companyCode}/orders/${docNo}/${category}/${timestamp}_${sanitizedName}`;

    // Presign upload URL olish
    const bucket: StorageBucketKey = "prepress";
    const uploadRes = await createPresignedUploadUrl({
      bucket,
      objectKey,
      contentType: fileType || "application/octet-stream",
    });

    const permanentDownloadUrl = `/api/v1/storage/file?key=${encodeURIComponent(objectKey)}`;
    const downloadUrl = permanentDownloadUrl;

    // Bazaga attachment metadatasini yozish
    let savedRecord = null;
    try {
      let targetWorkOrderId = workOrderId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetWorkOrderId);
      if (!isUuid) {
        const order = await db.query.workOrders.findFirst({
          where: (wo, { or, eq }) => or(eq(wo.docNo, targetWorkOrderId), eq(wo.docNo, docNo)),
        });
        if (order) {
          targetWorkOrderId = order.id;
        }
      }

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetWorkOrderId)) {
        savedRecord = await createWorkOrderAttachment({
          workOrderId: targetWorkOrderId,
          name: fileName,
          category: category as any,
          fileType: fileType || "application/octet-stream",
          fileSize: fileSize || null,
          storagePath: objectKey,
          url: downloadUrl,
          uploadedBy: uploadedBy || null,
        });

        // Agar bu proof yoki rasm bo'lsa, work_orders jadvalidagi photo_url/photo_urls ustunlarini ham yangilaymiz
        if (category === "proofs" || (fileType && fileType.startsWith("image/"))) {
          const wo = await db.query.workOrders.findFirst({
            where: (w, { eq }) => eq(w.id, targetWorkOrderId),
          });
          if (wo) {
            const currentPhotos = (wo.photoUrls as string[]) || [];
            if (!currentPhotos.includes(downloadUrl)) {
              const updatedPhotos = [...currentPhotos, downloadUrl];
              await db.update(workOrders).set({
                photoUrl: wo.photoUrl || downloadUrl,
                photoUrls: updatedPhotos,
              }).where(eq(workOrders.id, targetWorkOrderId));
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not save attachment to database:", dbErr);
    }

    return NextResponse.json({
      success: true,
      uploadUrl: uploadRes.uploadUrl,
      downloadUrl,
      objectKey,
      attachment: savedRecord,
    });
  } catch (error) {
    console.error("POST file attachment error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
