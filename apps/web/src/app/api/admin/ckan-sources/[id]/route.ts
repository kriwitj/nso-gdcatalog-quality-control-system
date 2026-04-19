import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'
import { logAudit } from '@/lib/audit'
import { encryptField } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/ckan-sources/:id
export const PATCH = withAuth(async (req: NextRequest, { params, user: caller }) => {
  const body = await req.json()
  const {
    name, url, apiKey, isActive,
    ministryId, departmentId, divisionId,
  } = body as {
    name?: string; url?: string; apiKey?: string; isActive?: boolean
    ministryId?: string; departmentId?: string; divisionId?: string
  }

  const existing = await prisma.ckanSource.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'ไม่พบ CKAN source' }, { status: 404 })

  if (url) {
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'รูปแบบ URL ไม่ถูกต้อง' }, { status: 400 })
    }
  }

  const data: Record<string, unknown> = {}
  if (name     !== undefined) data.name     = name
  if (url      !== undefined) data.url      = url
  if (isActive !== undefined) data.isActive  = isActive
  if ('apiKey'      in body) data.apiKey      = apiKey ? encryptField(apiKey) : null
  if ('ministryId'  in body) data.ministryId  = ministryId  ?? null
  if ('departmentId' in body) data.departmentId = departmentId ?? null
  if ('divisionId'  in body) data.divisionId  = divisionId  ?? null

  const source = await prisma.ckanSource.update({
    where:  { id: params.id },
    data,
    select: {
      id: true, name: true, url: true, isActive: true, updatedAt: true,
      ministry:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      division:   { select: { id: true, name: true } },
    },
  })

  await logAudit({ userId: caller.userId, action: 'UPDATE', entity: 'CkanSource', entityId: params.id, detail: { changed: Object.keys(data) } })
  return NextResponse.json({ source })
}, ['admin'])

// DELETE /api/admin/ckan-sources/:id
export const DELETE = withAuth(async (_req: NextRequest, { params, user: caller }) => {
  const existing = await prisma.ckanSource.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'ไม่พบ CKAN source' }, { status: 404 })

  await prisma.ckanSource.delete({ where: { id: params.id } })
  await logAudit({ userId: caller.userId, action: 'DELETE', entity: 'CkanSource', entityId: params.id, detail: { name: existing.name } })
  return NextResponse.json({ message: 'ลบ CKAN source เรียบร้อยแล้ว' })
}, ['admin'])
