import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const S3_BUCKETS = {
  prepress: process.env.S3_BUCKET_PREPRESS ?? "printgoo-prepress",
  docs: process.env.S3_BUCKET_DOCS ?? "printgoo-docs",
  thumbnails: process.env.S3_BUCKET_THUMBNAILS ?? "printgoo-thumbnails",
} as const;

export type StorageBucketKey = keyof typeof S3_BUCKETS;

const internalEndpoint =
  process.env.S3_INTERNAL_ENDPOINT ?? "http://localhost:9000";
const publicEndpoint =
  process.env.NEXT_PUBLIC_S3_ENDPOINT ?? internalEndpoint;

// Server-side S3 client (Docker ichki tarmog'i yoki localhost uchun)
export const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: internalEndpoint,
  forcePathStyle: true, // MinIO uchun majburiy
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "printgoo_minio",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "printgoo_minio_secret_key",
  },
});

// Brauzer uchun Presigned URL imzolovchi client (tashqi/public endpoint bilan)
export const s3PublicPresignClient = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: publicEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "printgoo_minio",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "printgoo_minio_secret_key",
  },
});

let bucketsInitialized = false;

/**
 * Katta hajmli Prepress PDF / Maket fayllarini brauzerdan to'g'ridan-to'g'ri MinIO'ga yuklash uchun Presigned PUT URL
 */
export async function createPresignedUploadUrl(params: {
  bucket: StorageBucketKey;
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; bucketName: string; objectKey: string }> {
  if (!bucketsInitialized) {
    try {
      await ensureStorageBuckets();
      bucketsInitialized = true;
    } catch {
      // Xato bo'lsa asosiy yuklash jarayonini to'xtatib qo'ymaydi
    }
  }

  const bucketName = S3_BUCKETS[params.bucket];
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.objectKey,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(s3PublicPresignClient, command, {
    expiresIn: params.expiresInSeconds ?? 900, // 15 daqiqa
  });

  return { uploadUrl, bucketName, objectKey: params.objectKey };
}

/**
 * Xavfsiz faylni ko'rish yoki yuklab olish uchun Presigned GET URL
 */
export async function createPresignedDownloadUrl(params: {
  bucket: StorageBucketKey;
  objectKey: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const bucketName = S3_BUCKETS[params.bucket];
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: params.objectKey,
  });

  return getSignedUrl(s3PublicPresignClient, command, {
    expiresIn: params.expiresInSeconds ?? 3600, // 1 soat
  });
}

/**
 * MinIO / S3 dan faylni o'chirish
 */
export async function deleteStorageObject(params: {
  bucket: StorageBucketKey;
  objectKey: string;
}): Promise<void> {
  const bucketName = S3_BUCKETS[params.bucket];
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: params.objectKey,
    })
  );
}

/**
 * MinIO S3 omborining holati va mavjud bucket'larni tekshirish
 */
export async function checkStorageHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  buckets?: string[];
  error?: string;
}> {
  const start = performance.now();
  try {
    const res = await s3Client.send(new ListBucketsCommand({}));
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      buckets: (res.Buckets ?? []).map((b) => b.Name ?? ""),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown MinIO S3 error",
    };
  }
}

/**
 * MinIO S3 bucketlarini (`printgoo-prepress`, `printgoo-docs`, `printgoo-thumbnails`) avtomatik yaratish va CORS qoidalarini biriktirish
 */
export async function ensureStorageBuckets(): Promise<string[]> {
  const createdOrVerified: string[] = [];
  const allowedOrigins = process.env.NEXT_PUBLIC_APP_URL
    ? [process.env.NEXT_PUBLIC_APP_URL, "*"]
    : ["*"];

  for (const bucketName of Object.values(S3_BUCKETS)) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      createdOrVerified.push(bucketName);
    } catch {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      createdOrVerified.push(bucketName);
    }

    try {
      await s3Client.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
                AllowedOrigins: allowedOrigins,
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
    } catch {
      // Ba'zi S3 implementatsiyalarida CORS API cheklangan bo'lsa asosiy jarayon to'xtamaydi
    }
  }
  bucketsInitialized = true;
  return createdOrVerified;
}

