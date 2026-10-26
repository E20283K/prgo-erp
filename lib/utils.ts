import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Foydalanuvchi ism-familiyasidan bosh harflarni (initials) ajratib oladi.
 * Masalan:
 *   "John Doe" -> "JD"
 *   "Ezoz Egamberganov" -> "EE"
 *   "Administrator" -> "AD"
 */
export function getUserInitials(name?: string | null, fallback = "U"): string {
  if (!name || typeof name !== "string") return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * 1C / ERP uslubidagi ketma-ket (max() + 1) formatdagi unikal kodni generatsiya qiladi.
 * Masalan:
 *   generateNextCode("DEP", ["DEP-01", "DEP-02"], 2) -> "DEP-03"
 *   generateNextCode("EMP", ["EMP-0012", "EMP-0015"], 4) -> "EMP-0016"
 *   generateNextCode("POS", ["POS-01", "POS-02"], 2) -> "POS-03"
 *   generateNextCode("PLT", ["PLT-001", "PLT-007"], 3) -> "PLT-008"
 */
export function generateNextCode(
  prefix: string,
  existingCodes: (string | null | undefined)[],
  digits = 2
): string {
  let maxNum = 0;
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "");
  const regex = new RegExp(`^${cleanPrefix}[-_]?(\\d+)`, "i");

  for (const c of existingCodes) {
    if (!c) continue;
    const match = String(c).trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(digits, "0");
  return `${cleanPrefix.toUpperCase()}-${padded}`;
}
