import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signAccessToken, signRefreshToken } from "@/lib/auth";
import { checkRateLimit, RateLimitError } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await checkRateLimit(`login:${ip}`, 10, 15 * 60);

    const body = await req.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "กรุณาระบุ username และ password" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    });

    const res = NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    res.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/api/auth",
    });

    return res;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } },
      );
    }
    console.error("LOGIN_ERROR", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}
