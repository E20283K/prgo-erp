import { NextResponse } from "next/server";
import { db } from "@/db";
import { cacheGetOrSet } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await cacheGetOrSet("dict:global:companies", 300, async () => {
      return db.query.companies.findMany({
        with: {
          branches: true,
        },
        orderBy: (companies, { asc }) => [asc(companies.code)],
      });
    });

    return NextResponse.json({
      count: data.length,
      companies: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        message: err instanceof Error ? err.message : "Unknown database error",
      },
      { status: 500 }
    );
  }
}
