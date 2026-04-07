import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }

  let payload: { userId: string; role: string }
  try {
    payload = verifyAccessToken(auth.slice(7))
  } catch {
    return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
  }

  // Build scope filter
  let jobWhere: Prisma.ScanJobWhereInput = {}

  if (payload.role !== 'admin') {
    const dbUser = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { divisionId: true },
    })

    if (dbUser?.divisionId) {
      // เห็น jobs ของทุก user ในศูนย์/กองเดียวกัน
      const divUsers = await prisma.user.findMany({
        where:  { divisionId: dbUser.divisionId },
        select: { id: true },
      })
      jobWhere = { triggeredBy: { in: divUsers.map(u => u.id) } }
    } else {
      // ไม่มี division → เห็นเฉพาะ job ของตัวเอง
      jobWhere = { triggeredBy: payload.userId }
    }
  }

  const jobs = await prisma.scanJob.findMany({
    where:   jobWhere,
    orderBy: { createdAt: 'desc' },
    take:    100,
    include: { dataset: { select: { title: true, name: true } } },
  })

  // Batch lookup usernames
  const userIds = [...new Set(jobs.map(j => j.triggeredBy).filter(Boolean))] as string[]
  const users   = userIds.length
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, username: true },
      })
    : []
  const userMap = Object.fromEntries(users.map(u => [u.id, u.username]))

  const data = jobs.map(j => ({
    ...j,
    triggeredByUsername: j.triggeredBy ? (userMap[j.triggeredBy] ?? null) : null,
  }))

  return NextResponse.json({ data })
}
