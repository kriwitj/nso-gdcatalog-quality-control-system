import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/org — โครงสร้างองค์กรทั้งหมด
export const GET = withAuth(async () => {
  const [ministries, departments, divisions, groups] = await Promise.all([
    prisma.ministry.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.division.findMany({ orderBy: { name: 'asc' } }),
    prisma.group.findMany({ orderBy: { name: 'asc' } }),
  ])
  return NextResponse.json({ ministries, departments, divisions, groups })
}, ['admin'])
