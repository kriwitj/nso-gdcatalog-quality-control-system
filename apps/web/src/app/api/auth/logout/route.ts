import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('refresh_token')?.value

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } })
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
