import { db } from "@/db";
import { users, type DbUser } from "@/db/schema/users";
import { eq, desc } from "drizzle-orm";
import { hashPassword, sanitizeUser, type SanitizedUser, seedDefaultUsersIfEmpty } from "./authService";
import { getUserInitials } from "@/lib/utils";
import type { SystemUserRecord } from "@/components/documents/user/types";

export async function getAllUsers(): Promise<SanitizedUser[]> {
  await seedDefaultUsersIfEmpty();
  const all = await db.select().from(users).orderBy(desc(users.createdAt));
  return all.map(sanitizeUser);
}

export async function getUserById(id: string): Promise<SanitizedUser | null> {
  const found = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (found.length === 0) return null;
  return sanitizeUser(found[0]);
}

export async function createUser(data: Partial<SystemUserRecord>): Promise<SanitizedUser> {
  const code = data.code || `USR-${Math.floor(100 + Math.random() * 900)}`;
  const passwordToHash = data.password || "printgoo123";
  const { hash, salt } = hashPassword(passwordToHash);

  const [inserted] = await db
    .insert(users)
    .values({
      code,
      username: data.username || `user_${Date.now()}`,
      email: data.email || `${data.username || "user"}@printgoo.com`,
      passwordHash: hash,
      passwordSalt: salt,
      fullName: data.fullName || "Yangi Foydalanuvchi",
      phone: data.phone || "",
      role: data.role || "operator",
      department: data.department || "",
      plant: data.plant || "",
      status: data.status || "Active",
      avatar: data.avatar || null,
      initials: getUserInitials(data.fullName || data.username, "U"),
      language: data.language || "uz",
      defaultModule: data.defaultModule || "production",
      linkedEmployeeId: data.linkedEmployeeId || null,
      permissions: data.permissions!,
      scope: data.scope!,
      security: data.security!,
    })
    .returning();

  return sanitizeUser(inserted);
}

export async function updateUser(
  id: string,
  data: Partial<SystemUserRecord>
): Promise<SanitizedUser | null> {
  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (existing.length === 0) return null;

  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.fullName !== undefined) {
    updatePayload.fullName = data.fullName;
    updatePayload.initials = getUserInitials(data.fullName, "U");
  }
  if (data.username !== undefined) updatePayload.username = data.username;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.department !== undefined) updatePayload.department = data.department;
  if (data.plant !== undefined) updatePayload.plant = data.plant;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.avatar !== undefined) updatePayload.avatar = data.avatar;
  if (data.initials !== undefined) updatePayload.initials = data.initials;
  if (data.language !== undefined) updatePayload.language = data.language;
  if (data.defaultModule !== undefined) updatePayload.defaultModule = data.defaultModule;
  if (data.linkedEmployeeId !== undefined) updatePayload.linkedEmployeeId = data.linkedEmployeeId;
  if (data.permissions !== undefined) updatePayload.permissions = data.permissions;
  if (data.scope !== undefined) updatePayload.scope = data.scope;
  if (data.security !== undefined) updatePayload.security = data.security;

  // If a new password is provided, rehash it
  if (data.password && data.password.trim().length > 0) {
    const { hash, salt } = hashPassword(data.password);
    updatePayload.passwordHash = hash;
    updatePayload.passwordSalt = salt;
  }

  const [updated] = await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, id))
    .returning();

  return sanitizeUser(updated);
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id));
  return true;
}
