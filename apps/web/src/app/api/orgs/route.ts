import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAccessToken, AccessTokenPayload } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

async function buildScopeFilter(payload: AccessTokenPayload): Promise<Prisma.DatasetWhereInput> {
  if (payload.role === 'admin') return {}

  const dbUser = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { ministryId: true, departmentId: true, divisionId: true },
  })
  if (!dbUser) return {}

  const { ministryId, departmentId, divisionId } = dbUser
  if (!ministryId && !departmentId && !divisionId) return {}

  const orConditions: Prisma.CkanSourceWhereInput[] = []
  if (divisionId)   orConditions.push({ divisionId })
  if (departmentId) orConditions.push({ departmentId })
  if (ministryId)   orConditions.push({ ministryId })

  const scopeSources = await prisma.ckanSource.findMany({
    where:  { isActive: true, OR: orConditions },
    select: { id: true },
  })
  return { ckanSourceId: { in: scopeSources.map((s: { id: string }) => s.id) } }
}

// GET /api/orgs — รายชื่อหน่วยงานที่มีชุดข้อมูล (ตาม scope ของ user)
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }
  let payload: AccessTokenPayload
  try {
    payload = verifyAccessToken(auth.slice(7))
  } catch {
    return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
  }

  const datasetWhere = await buildScopeFilter(payload)

  const orgs = await prisma.organization.findMany({
    where:   { datasets: { some: datasetWhere } },
    select:  { id: true, name: true, title: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ orgs })
}
