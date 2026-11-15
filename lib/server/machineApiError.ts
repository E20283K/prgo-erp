import { NextResponse } from "next/server";

const UNIQUE_VIOLATION = "23505";

/** Postgres error code, whether thrown directly or wrapped by drizzle in `cause`. */
function pgCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

/** Error response for machine create/update: a duplicate code is the user's to fix, not a server fault. */
export function machineSaveErrorResponse(error: unknown, label: string) {
  if (pgCode(error) === UNIQUE_VIOLATION) {
    return NextResponse.json(
      { success: false, error: "Bu kod bilan uskuna allaqachon mavjud." },
      { status: 409 }
    );
  }
  console.error(`${label} error:`, error);
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
    { status: 500 }
  );
}
