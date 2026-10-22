import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq, or } from "drizzle-orm";
import {
  verifyPassword,
  createSession,
  sanitizeUser,
  seedDefaultUsersIfEmpty,
} from "@/lib/server/authService";

export async function POST(req: NextRequest) {
  try {
    await seedDefaultUsersIfEmpty();

    const body = await req.json();
    const { usernameOrEmail, password } = body;

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Login yoki parol kiritilmadi" },
        { status: 400 }
      );
    }

    const trimmedIdentifier = usernameOrEmail.trim().toLowerCase();

    // Look up by username or email
    const foundUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, trimmedIdentifier),
          eq(users.email, trimmedIdentifier)
        )
      )
      .limit(1);

    if (foundUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Login yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    const dbUser = foundUsers[0];

    // Check status
    if (dbUser.status !== "Active") {
      return NextResponse.json(
        { success: false, error: "Hisob faol emas yoki bloklangan" },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = verifyPassword(
      password,
      dbUser.passwordHash,
      dbUser.passwordSalt
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Login yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    // Client IP & User Agent
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "";

    // Create session in PostgreSQL
    const { token, expiresAt } = await createSession(dbUser.id, ipAddress, userAgent);

    // Set HTTP-only Cookie
    const cookieStore = await cookies();
    cookieStore.set("printgoo_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    const sanitized = sanitizeUser(dbUser);

    return NextResponse.json({
      success: true,
      token,
      user: sanitized,
    });
  } catch (error: any) {
    console.error("[Auth Login Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Tizimga kirishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
