import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { extractBearerToken, verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    let payload: { userId: string; role: string }
    try {
      payload = verifyAccessToken(token)
    } catch {
      return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: {
        id: true, username: true, email: true, role: true, isActive: true,
        divisionId: true,
        division:   { select: { id: true, name: true } },
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'บัญชีผู้ใช้ไม่พร้อมใช้งาน' }, { status: 401 })
    }

    // ดึง CkanSources ตาม scope:
    // - admin  → ทุก source ที่ active
    // - non-admin + divisionId → sources ของ division นั้น
    // - non-admin + ไม่มี division → ไม่มี source
    const sources = await prisma.ckanSource.findMany({
      where: user.role === 'admin'
        ? { isActive: true }
        : user.divisionId
          ? { divisionId: user.divisionId, isActive: true }
          : { id: { in: [] } },
      select:  { id: true, name: true, url: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ user, sources })
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
