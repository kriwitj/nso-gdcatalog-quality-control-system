import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { withAuth } from '@/lib/withAuth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const USER_SELECT = {
  id: true, username: true, email: true, role: true, isActive: true,
  createdAt: true, updatedAt: true,
  ministry:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  division:   { select: { id: true, name: true } },
  group:      { select: { id: true, name: true } },
} as const

// GET /api/admin/users — รายชื่อผู้ใช้ทั้งหมด (admin เท่านั้น)
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') || ''
  const role   = searchParams.get('role')   || ''

  const users = await prisma.user.findMany({
    where: {
      ...(search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email:    { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
      ...(role ? { role } : {}),
    },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ users })
}, ['admin'])

// POST /api/admin/users — สร้างผู้ใช้ใหม่ (admin เท่านั้น)
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  const body = await req.json()
  const {
    username, email, password, role = 'viewer', isActive = true,
    ministryId, departmentId, divisionId, groupId,
  } = body as {
    username?: string; email?: string; password?: string
    role?: string; isActive?: boolean
    ministryId?: string; departmentId?: string
    divisionId?: string; groupId?: string
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: 'กรุณาระบุ username และ password' },
      { status: 400 },
    )
  }
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: 'role ต้องเป็น admin / editor / viewer' },
      { status: 400 },
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'password ต้องมีอย่างน้อย 8 ตัวอักษร' },
      { status: 400 },
    )
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ error: 'username นี้ถูกใช้แล้ว' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      username, email: email || null, passwordHash, role,
      isActive, ministryId, departmentId, divisionId, groupId,
    },
    select: USER_SELECT,
  })

  await logAudit({ userId: caller.userId, action: 'CREATE', entity: 'User', entityId: user.id, detail: { username, role } })
  return NextResponse.json({ user }, { status: 201 })
}, ['admin'])
