import { NextResponse } from "next/server";
import { checkDbHealth } from "@/db";
import { checkRedisHealth } from "@/lib/server/redis";
import { checkStorageHealth } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const [postgres, redis, minio] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth(),
    checkStorageHealth(),
  ]);

  const allHealthy = postgres.ok && redis.ok && minio.ok;

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        postgres,
        redis,
        minio,
      },
    },
    { status: allHealthy ? 200 : 503 }
  );
}
