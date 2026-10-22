import { db } from "@/db";
import { users, userSessions, type DbUser } from "@/db/schema/users";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
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
    initials: dbUser.initials || dbUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
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

  // 1. Admin
  const adminHash = hashPassword("admin");
  const adminRole = ROLE_TEMPLATES.admin;
  await db.insert(users).values({
    code: "USR-001",
    username: "admin",
    email: "admin@printgoo.com",
    passwordHash: adminHash.hash,
    passwordSalt: adminHash.salt,
    fullName: "Dmitry Morozov",
    phone: "+998 90 123-45-67",
    role: "admin",
    department: adminRole.department,
    plant: "Bosh Bino (HQ & Plant 1)",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    initials: "DM",
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

  // 2. Manager (Commercial & Sales)
  const managerHash = hashPassword("manager");
  const managerRole = ROLE_TEMPLATES.sales_mgr;
  await db.insert(users).values({
    code: "USR-002",
    username: "manager",
    email: "e.voronina@printgoo.com",
    passwordHash: managerHash.hash,
    passwordSalt: managerHash.salt,
    fullName: "Elena Voronina",
    phone: "+998 90 234-56-78",
    role: "manager",
    department: "Commercial / Sales",
    plant: "Bosh Bino (HQ & Plant 1)",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    initials: "EV",
    language: "uz",
    defaultModule: "trading",
    permissions: {
      crm: { view: true, create: true, edit: true, delete: false, approve: false, export: true },
      trading: { view: true, create: true, edit: true, delete: false, approve: false, export: true },
      production: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      warehouse: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      finance: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      hr: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      settings: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    },
    scope: {
      allPlants: true,
      plantIds: [],
      viewCostPrice: false,
      viewMargin: false,
      maxDiscountPercent: 15,
      ownDocumentsOnly: false,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeoutMinutes: 240,
      allowedIpOnly: false,
      allowedIps: "",
      workHoursOnly: false,
      requirePasswordChange: false,
      auditLog: [],
    },
  });

  // 3. Operator (Production Shift Lead)
  const operatorHash = hashPassword("operator");
  const operatorRole = ROLE_TEMPLATES.shift_lead;
  await db.insert(users).values({
    code: "USR-003",
    username: "operator",
    email: "a.kovalev@printgoo.com",
    passwordHash: operatorHash.hash,
    passwordSalt: operatorHash.salt,
    fullName: "Alexey Kovalev",
    phone: "+998 90 345-67-89",
    role: "operator",
    department: operatorRole.department,
    plant: "1-sonli Bosmaxona (Plant 1)",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    initials: "AK",
    language: "uz",
    defaultModule: "production",
    permissions: operatorRole.permissions,
    scope: operatorRole.scope,
    security: {
      twoFactorEnabled: false,
      sessionTimeoutMinutes: 120,
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
