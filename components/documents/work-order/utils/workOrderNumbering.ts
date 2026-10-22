/**
 * Work Order Numbering Engine for PrintGoo ERP
 * Format: WO{SEX}-{YY}-{XXXX}
 * Examples:
 *   - Offset:   WOOF-26-0001
 *   - Flexo:    WOFL-26-0001
 *   - Jacquard: WOJC-26-0001
 *
 * Rules:
 *   1. Departments allowed for Work Order: "Offset", "Flexo", "Jacquard".
 *      (Post-press is strictly a route operation / finishing phase, not a standalone Work Order tech).
 *   2. Independent incremental sequence per department, resets annually to 0001 on Jan 1st.
 *   3. Strict auto-generation (Read-only on client).
 */

export type WorkOrderDepartment = "Offset" | "Flexo" | "Jacquard";

export const WO_DEPT_PREFIXES: Record<WorkOrderDepartment, string> = {
  Offset: "WOOF",
  Flexo: "WOFL",
  Jacquard: "WOJC",
};

export const WO_PREFIX_TO_DEPT: Record<string, WorkOrderDepartment> = {
  WOOF: "Offset",
  WOFL: "Flexo",
  WOJC: "Jacquard",
};

// In-memory counter cache seeded with default active sequence numbers for 2026
const sequenceCounters: Record<string, number> = {
  "Offset-26": 351,
  "Flexo-26": 120,
  "Jacquard-26": 80,
};

/**
 * Returns current 2-digit year (e.g., "26" for 2026)
 */
export function getCurrentYearSuffix(): string {
  return new Date().getFullYear().toString().slice(-2);
}

/**
 * Normalizes input department to one of the 3 supported manufacturing departments.
 */
export function normalizeDepartment(dept?: string | null): WorkOrderDepartment {
  if (!dept) return "Offset";
  const lower = dept.toLowerCase().trim();
  if (lower.includes("flex")) return "Flexo";
  if (lower.includes("jacq") || lower.includes("damask") || lower.includes("weav")) return "Jacquard";
  return "Offset";
}

/**
 * Formats a Work Order number given department, sequence, and optional 2-digit year.
 * e.g. formatWorkOrderNo("Offset", 42) -> "WOOF-26-0042"
 */
export function formatWorkOrderNo(
  dept: WorkOrderDepartment | string,
  seq: number,
  yearSuffix: string = getCurrentYearSuffix()
): string {
  const normalizedDept = normalizeDepartment(dept);
  const prefix = WO_DEPT_PREFIXES[normalizedDept] || "WOOF";
  const paddedSeq = String(seq).padStart(4, "0");
  return `${prefix}-${yearSuffix}-${paddedSeq}`;
}

/**
 * Generates the next sequential Work Order number for the given department and auto-increments.
 */
export function getNextWorkOrderNo(
  dept: WorkOrderDepartment | string,
  yearSuffix: string = getCurrentYearSuffix()
): string {
  const normalizedDept = normalizeDepartment(dept);
  const key = `${normalizedDept}-${yearSuffix}`;
  const current = sequenceCounters[key] ?? 0;
  const next = current + 1;
  sequenceCounters[key] = next;
  return formatWorkOrderNo(normalizedDept, next, yearSuffix);
}

/**
 * Parses a document number into parts if it matches the standard format.
 */
export function parseWorkOrderNo(docNo?: string | null): {
  isValid: boolean;
  department: WorkOrderDepartment;
  year: string;
  seq: number;
} | null {
  if (!docNo) return null;
  const match = docNo.match(/^WO(OF|FL|JC)-(\d{2})-(\d{4,})$/i);
  if (!match) return null;
  const deptCode = `WO${match[1].toUpperCase()}`;
  const department = WO_PREFIX_TO_DEPT[deptCode] || "Offset";
  return {
    isValid: true,
    department,
    year: match[2],
    seq: parseInt(match[3], 10),
  };
}

/**
 * Migrates legacy `WO-XXXX` or legacy format ids into standard `WO{SEX}-26-XXXX`.
 */
export function migrateLegacyWorkOrderNo(
  legacyId?: string | null,
  fallbackDept: WorkOrderDepartment = "Offset"
): string {
  if (!legacyId) return formatWorkOrderNo(fallbackDept, 1);
  if (/^WO(OF|FL|JC)-\d{2}-\d{4}$/i.test(legacyId)) return legacyId;

  // Extract any existing numerical portion
  const numMatch = legacyId.match(/\d+/);
  const seq = numMatch ? parseInt(numMatch[0], 10) : 1;
  return formatWorkOrderNo(fallbackDept, seq);
}
