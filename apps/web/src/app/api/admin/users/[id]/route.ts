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

// GET /api/admin/users/:id
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const user = await prisma.user.findUnique({
    where:  { id: params.id },
    select: USER_SELECT,
  })
  if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })
  return NextResponse.json({ user })
}, ['admin'])

// PATCH /api/admin/users/:id
export const PATCH = withAuth(async (req: NextRequest, { params, user: caller }) => {
  const body = await req.json()
  const {
    email, role, isActive, password,
    ministryId, departmentId, divisionId, groupId,
  } = body as {
    email?: string; role?: string; isActive?: boolean; password?: string
    ministryId?: string; departmentId?: string
    divisionId?: string; groupId?: string
  }

  // ป้องกันไม่ให้ admin ลด role ตัวเอง
  if (params.id === caller.userId && role && role !== caller.role) {
    return NextResponse.json({ error: 'ไม่สามารถเปลี่ยน role ของตัวเองได้' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  if (role && !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: 'role ต้องเป็น admin / editor / viewer' },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  if (email    !== undefined) data.email        = email || null
  if (role     !== undefined) data.role         = role
  if (isActive !== undefined) data.isActive      = isActive
  if (password !== undefined) {
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'password ต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 },
      )
    }
    data.passwordHash = await hashPassword(password)
  }
  // org hierarchy (null = ลบออก, undefined = ไม่เปลี่ยน)
  if ('ministryId'   in body) data.ministryId   = ministryId   ?? null
  if ('departmentId' in body) data.departmentId = departmentId ?? null
  if ('divisionId'   in body) data.divisionId   = divisionId   ?? null
  if ('groupId'      in body) data.groupId      = groupId      ?? null

  const updated = await prisma.user.update({
    where:  { id: params.id },
    data,
    select: USER_SELECT,
  })

  await logAudit({ userId: caller.userId, action: 'UPDATE', entity: 'User', entityId: params.id, detail: { changed: Object.keys(data) } })
  return NextResponse.json({ user: updated })
}, ['admin'])

// DELETE /api/admin/users/:id
export const DELETE = withAuth(async (_req: NextRequest, { params, user: caller }) => {
  if (params.id === caller.userId) {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  await prisma.user.delete({ where: { id: params.id } })
  await logAudit({ userId: caller.userId, action: 'DELETE', entity: 'User', entityId: params.id, detail: { username: existing.username } })
  return NextResponse.json({ message: 'ลบผู้ใช้เรียบร้อยแล้ว' })
}, ['admin'])
