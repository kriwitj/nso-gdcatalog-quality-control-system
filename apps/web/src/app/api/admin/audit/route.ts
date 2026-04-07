import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/audit — ประวัติการดำเนินการ
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const page     = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = 50
  const entity   = searchParams.get('entity') || ''
  const action   = searchParams.get('action') || ''

  const where = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pageSize })
}, ['admin'])
