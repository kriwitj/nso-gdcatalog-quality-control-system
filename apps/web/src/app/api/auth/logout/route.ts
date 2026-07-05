import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { extractBearerToken, verifyAccessToken } from '@/lib/auth'
import { revokeSsoSession } from '@/lib/sso'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const refreshTokenValue = req.cookies.get('refresh_token')?.value

    if (refreshTokenValue) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshTokenValue } })
    }

    // revoke SSO session ถ้ามี ssoAccessToken
    const accessToken = extractBearerToken(req)
    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken)
        const user = await prisma.user.findUnique({
          where:  { id: payload.userId },
          select: { ssoAccessToken: true },
        })
        if (user?.ssoAccessToken) {
          await revokeSsoSession(user.ssoAccessToken)
          await prisma.user.update({
            where: { id: payload.userId },
            data:  { ssoAccessToken: null },
          })
        }
      } catch {
        // ไม่ block logout ถ้า revoke ล้มเหลว
      }
    }

    const res = NextResponse.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' })
    res.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires:  new Date(0),
      path:     '/api/auth',
    })

    return res
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
