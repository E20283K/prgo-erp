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
