import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth'
import { checkRateLimit, RateLimitError } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 วัน

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    await checkRateLimit(`refresh:${ip}`, 30, 15 * 60)

    const oldToken = req.cookies.get('refresh_token')?.value
    if (!oldToken) {
      return NextResponse.json({ error: 'ไม่พบ refresh token' }, { status: 401 })
    }

    let payload: { userId: string }
    try {
      payload = verifyRefreshToken(oldToken)
    } catch {
      return NextResponse.json(
        { error: 'refresh token ไม่ถูกต้องหรือหมดอายุ' },
        { status: 401 },
      )
    }

    // ตรวจสอบใน DB และลบ (token rotation)
    const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } })
    if (!stored || stored.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'refresh token หมดอายุหรือถูกยกเลิกแล้ว' },
        { status: 401 },
      )
    }
    await prisma.refreshToken.delete({ where: { id: stored.id } })

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'บัญชีผู้ใช้ไม่พร้อมใช้งาน' }, { status: 401 })
    }

    // ออก token คู่ใหม่
    const accessToken  = signAccessToken({ userId: user.id, role: user.role })
    const newRefresh   = signRefreshToken({ userId: user.id })
    const expiresAt    = new Date(Date.now() + REFRESH_TTL_MS)

    await prisma.refreshToken.create({
      data: { userId: user.id, token: newRefresh, expiresAt },
    })

    const res = NextResponse.json({ accessToken })
    res.cookies.set('refresh_token', newRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires:  expiresAt,
      path:     '/api/auth',
    })

    return res
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'พยายาม refresh token มากเกินไป กรุณารอสักครู่' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSec) } },
      )
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
