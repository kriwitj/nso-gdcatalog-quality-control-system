import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { extractBearerToken, verifyAccessToken, verifyPassword, hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    let payload: { userId: string }
    try {
      payload = verifyAccessToken(token)
    } catch {
      return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body as {
      currentPassword?: string
      newPassword?: string
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'กรุณาระบุ currentPassword และ newPassword' },
        { status: 400 },
      )
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'บัญชีผู้ใช้ไม่พร้อมใช้งาน' }, { status: 401 })
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.$transaction([
      // อัปเดตรหัสผ่าน
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // เพิกถอน refresh token ทั้งหมด (บังคับ login ใหม่ทุก device)
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ])

    return NextResponse.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่' })
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
