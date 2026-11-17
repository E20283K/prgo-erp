import crypto from "crypto";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

/**
 * Shared shop-floor kiosk: the device is signed in once, and each operator identifies with a
 * PIN or a badge scan before an action. The result is a short-lived signed token that the
 * journal trusts for who did the work (piecework, OEE), while the kiosk account stays the author.
 */

/** Fixed length, so the kiosk can sign in the moment the last digit is pressed. */
export const PIN_LENGTH = 4;
const PIN_RE = /^\d{4}$/;
const TOKEN_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  return process.env.TERMINAL_PIN_SECRET || process.env.BETTER_AUTH_SECRET || "printgoo_terminal_dev_secret";
}

/**
 * Keyed hash, not salted: the kiosk looks an operator up by PIN alone, so the same PIN must hash
 * the same way within a company. The server secret keeps the short PIN space out of reach of a DB dump.
 */
function pinHash(companyId: string, pin: string): string {
  return crypto.createHmac("sha256", secret()).update(`${companyId}:${pin}`).digest("hex");
}

export interface TerminalOperator {
  employeeId: string;
  fullName: string;
  companyId: string;
}

export async function setEmployeeTerminalPin(employeeId: string, pin: string | null): Promise<{ hasPin: boolean }> {
  const emp = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { id: true, companyId: true },
  });
  if (!emp) throw new Error("Xodim topilmadi.");

  if (pin === null || pin === "") {
    await db.update(employees).set({ terminalPinHash: null, updatedAt: new Date() }).where(eq(employees.id, emp.id));
    return { hasPin: false };
  }
  if (!PIN_RE.test(pin)) throw new Error("PIN 4 ta raqamdan iborat bo'lishi kerak.");

  const hash = pinHash(emp.companyId, pin);
  const taken = await db.query.employees.findFirst({
    where: and(eq(employees.companyId, emp.companyId), eq(employees.terminalPinHash, hash), ne(employees.id, emp.id)),
    columns: { id: true },
  });
  if (taken) throw new Error("Bu PIN boshqa xodimda bor. Boshqa PIN tanlang.");

  await db.update(employees).set({ terminalPinHash: hash, updatedAt: new Date() }).where(eq(employees.id, emp.id));
  return { hasPin: true };
}

export async function employeeHasTerminalPin(employeeId: string): Promise<boolean> {
  const emp = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { terminalPinHash: true },
  });
  return Boolean(emp?.terminalPinHash);
}

// Brute-force guard for the short PIN space: per kiosk account, a few misses per window.
const MAX_MISSES = 5;
const MISS_WINDOW_MS = 60 * 1000;
const misses = new Map<string, { count: number; since: number }>();

function checkMisses(key: string) {
  const m = misses.get(key);
  if (m && Date.now() - m.since < MISS_WINDOW_MS && m.count >= MAX_MISSES) {
    throw new Error("Juda ko'p noto'g'ri urinish. Bir daqiqadan keyin qayta urining.");
  }
}

function recordMiss(key: string) {
  const m = misses.get(key);
  if (!m || Date.now() - m.since >= MISS_WINDOW_MS) misses.set(key, { count: 1, since: Date.now() });
  else m.count += 1;
}

/** A 4-digit PIN or a scanned badge number identifies one active employee of the company. */
export async function identifyOperator(
  companyId: string,
  code: string,
  attemptKey: string
): Promise<{ operator: TerminalOperator; token: string; expiresAt: string }> {
  const value = String(code || "").trim();
  if (!value) throw new Error("PIN yoki beyjni kiriting.");
  checkMisses(attemptKey);

  const active = and(eq(employees.companyId, companyId), eq(employees.status, "active"));
  const emp = PIN_RE.test(value)
    ? await db.query.employees.findFirst({
        where: and(active, eq(employees.terminalPinHash, pinHash(companyId, value))),
        columns: { id: true, fullName: true, companyId: true },
      })
    : await db.query.employees.findFirst({
        where: and(active, sql`lower(${employees.badgeNumber}) = lower(${value})`),
        columns: { id: true, fullName: true, companyId: true },
      });

  if (!emp) {
    recordMiss(attemptKey);
    throw new Error(PIN_RE.test(value) ? "PIN noto'g'ri." : "Beyj topilmadi.");
  }
  misses.delete(attemptKey);

  const operator: TerminalOperator = { employeeId: emp.id, fullName: emp.fullName, companyId: emp.companyId };
  const exp = Date.now() + TOKEN_TTL_MS;
  return { operator, token: signOperatorToken(operator.employeeId, operator.companyId, exp), expiresAt: new Date(exp).toISOString() };
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`op:${payload}`).digest("base64url");
}

function signOperatorToken(employeeId: string, companyId: string, exp: number): string {
  const payload = `${employeeId}.${companyId}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** Resolves a kiosk operator token back to the employee; throws when it is forged or expired. */
export async function verifyOperatorToken(token: string): Promise<TerminalOperator> {
  const [encoded, signature] = String(token || "").split(".");
  const payload = encoded ? Buffer.from(encoded, "base64url").toString() : "";
  const expected = payload ? sign(payload) : "";
  const valid =
    signature &&
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) throw new Error("Operator tasdig'i yaroqsiz. Qaytadan PIN kiriting.");

  const [employeeId, companyId, expRaw] = payload.split(".");
  if (!(Number(expRaw) > Date.now())) throw new Error("Operator sessiyasi tugagan. Qaytadan PIN kiriting.");

  const emp = await db.query.employees.findFirst({
    where: and(eq(employees.id, employeeId), eq(employees.companyId, companyId), eq(employees.status, "active")),
    columns: { id: true, fullName: true, companyId: true },
  });
  if (!emp) throw new Error("Operator topilmadi.");
  return { employeeId: emp.id, fullName: emp.fullName, companyId: emp.companyId };
}
