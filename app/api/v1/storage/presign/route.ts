import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  type StorageBucketKey,
} from "@/lib/server/storage";

const presignUploadSchema = z.object({
  bucket: z.enum(["prepress", "docs", "thumbnails"]).default("prepress"),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  companyCode: z.string().default("PRINTGOO"),
  folder: z.string().default("general"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = presignUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { bucket, fileName, contentType, companyCode, folder } = parsed.data;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const objectKey = `${companyCode}/${folder}/${timestamp}-${sanitizedName}`;

    const result = await createPresignedUploadUrl({
      bucket: bucket as StorageBucketKey,
      objectKey,
      contentType,
    });

    const downloadUrl = await createPresignedDownloadUrl({
      bucket: bucket as StorageBucketKey,
      objectKey,
    });

    return NextResponse.json({
      ...result,
      downloadUrl,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to generate presigned URL",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
