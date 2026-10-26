import { db } from "@/db";
import { users, userSessions, type DbUser } from "@/db/schema/users";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { getUserInitials } from "@/lib/utils";
import { ROLE_TEMPLATES, FULL_PERMISSIONS } from "@/components/documents/user/data";
import type { SystemUserRecord } from "@/components/documents/user/types";

export type SanitizedUser = Omit<SystemUserRecord, "password">;

// ─── 1. Password Security (scrypt with Salt) ──────────────────────────────────

export function hashPassword(password: string, customSalt?: string): { hash: string; salt: string } {
  const salt = customSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
  } catch {
    return false;
  }
}

// ─── 2. User Sanitizer (Removes passwordHash/salt) ───────────────────────────

export function sanitizeUser(dbUser: DbUser): SanitizedUser {
  return {
    id: dbUser.id,
    code: dbUser.code,
    username: dbUser.username,
    fullName: dbUser.fullName,
    email: dbUser.email,
    phone: dbUser.phone || "",
    role: dbUser.role,
    department: dbUser.department || "",
    plant: dbUser.plant || "",
    status: dbUser.status,
    avatar: dbUser.avatar || undefined,
    initials: getUserInitials(dbUser.fullName || dbUser.username, "U"),
    language: dbUser.language,
    defaultModule: dbUser.defaultModule,
    linkedEmployeeId: dbUser.linkedEmployeeId || undefined,
    permissions: dbUser.permissions,
    scope: dbUser.scope,
    security: dbUser.security,
    createdAt: dbUser.createdAt?.toISOString(),
    updatedAt: dbUser.updatedAt?.toISOString(),
  };
}

// ─── 3. Seed Default Users (Admin, Manager, Operator) ─────────────────────────

export async function seedDefaultUsersIfEmpty(): Promise<void> {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    return;
  }

  // 1. Asosiy Administrator
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin";
  const adminHash = hashPassword(initialAdminPassword);
  const adminRole = ROLE_TEMPLATES.admin;
  await db.insert(users).values({
    code: "USR-001",
    username: "admin",
    email: "admin@printgoo.uz",
    passwordHash: adminHash.hash,
    passwordSalt: adminHash.salt,
    fullName: "Administrator",
    phone: "+998 71 200-00-00",
    role: "admin",
    department: adminRole.department,
    plant: "Bosh Bino (HQ & Plant 1)",
    status: "Active",
    avatar: null,
    initials: "AD",
    language: "uz",
    defaultModule: "settings",
    permissions: adminRole.permissions,
    scope: adminRole.scope,
    security: {
      twoFactorEnabled: false,
      sessionTimeoutMinutes: 480,
      allowedIpOnly: false,
      allowedIps: "",
      workHoursOnly: false,
      requirePasswordChange: false,
      auditLog: [],
    },
  });
}

// ─── 4. Session Management ───────────────────────────────────────────────────

export const SESSION_DURATION_HOURS = 24;

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.insert(userSessions).values({
    userId,
    token,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<SanitizedUser | null> {
  if (!token) return null;

  const now = new Date();
  const found = await db
    .select({
      session: userSessions,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.token, token), gt(userSessions.expiresAt, now)))
    .limit(1);

  if (!found || found.length === 0) {
    return null;
  }

  const user = found[0].user;
  if (user.status !== "Active") {
    return null;
  }

  return sanitizeUser(user);
}

export async function destroySession(token: string): Promise<boolean> {
  if (!token) return false;
  await db.delete(userSessions).where(eq(userSessions.token, token));
  return true;
}

// ─── 5. Admin Password Reset ─────────────────────────────────────────────────

export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const { hash, salt } = hashPassword(newPassword);

  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0) return false;

  const updatedSecurity = {
    ...existing[0].security,
    requirePasswordChange: true,
  };

  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      security: updatedSecurity,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return true;
}
