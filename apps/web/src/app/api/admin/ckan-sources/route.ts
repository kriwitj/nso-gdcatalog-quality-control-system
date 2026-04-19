import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'
import { logAudit } from '@/lib/audit'
import { encryptField } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// GET /api/admin/ckan-sources — รายการ CKAN sources ทั้งหมด
export const GET = withAuth(async () => {
  const sources = await prisma.ckanSource.findMany({
    select: {
      id: true, name: true, url: true, isActive: true, createdAt: true,
      ministry:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      division:   { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ sources })
}, ['admin', 'editor'])

// POST /api/admin/ckan-sources — เพิ่ม CKAN source ใหม่
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  const body = await req.json()
  const {
    name, url, apiKey, isActive = true,
    ministryId, departmentId, divisionId,
  } = body as {
    name?: string; url?: string; apiKey?: string; isActive?: boolean
    ministryId?: string; departmentId?: string; divisionId?: string
  }

  if (!name || !url) {
    return NextResponse.json({ error: 'กรุณาระบุ name และ url' }, { status: 400 })
  }

  try {
    new URL(url) // ตรวจสอบ URL format
  } catch {
    return NextResponse.json({ error: 'รูปแบบ URL ไม่ถูกต้อง' }, { status: 400 })
  }

  const source = await prisma.ckanSource.create({
    data: {
      name, url,
      apiKey:      apiKey ? encryptField(apiKey) : null,
      isActive,
      ministryId:  ministryId  || null,
      departmentId: departmentId || null,
      divisionId:  divisionId  || null,
    },
    select: {
      id: true, name: true, url: true, isActive: true, createdAt: true,
      ministry:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      division:   { select: { id: true, name: true } },
    },
  })

  await logAudit({ userId: caller.userId, action: 'CREATE', entity: 'CkanSource', entityId: source.id, detail: { name, url } })
  return NextResponse.json({ source }, { status: 201 })
}, ['admin'])

// PATCH /api/admin/ckan-sources/:id
export const PATCH = withAuth(async (req: NextRequest) => {
  // redirect ไปใช้ [id] route
  return NextResponse.json({ error: 'ใช้ /api/admin/ckan-sources/:id' }, { status: 404 })
}, ['admin'])
