import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { tryDecryptField } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return isNaN(obj.getTime()) ? null : obj.toISOString()
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)]))
  return obj
}

async function getScopeFilter(req: NextRequest): Promise<Prisma.DatasetWhereInput> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return {}

  try {
    const payload = verifyAccessToken(auth.slice(7))
    if (payload.role === 'admin') return {}

    const dbUser = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { divisionId: true },
    })

    // non-admin ไม่มี division → ไม่เห็นข้อมูลใดเลย
    if (!dbUser?.divisionId) return { id: { in: [] } }

    const scopeSources = await prisma.ckanSource.findMany({
      where:  { isActive: true, divisionId: dbUser.divisionId },
      select: { id: true },
    })
    return { ckanSourceId: { in: scopeSources.map(s => s.id) } }
  } catch {
    return {}
  }
}

/**
 * ดึงจำนวนองค์กรจาก CKAN API /api/3/action/organization_list ของแต่ละ source
 * รวม unique organization names จากทุก source
 * fallback: คืนค่า null ถ้า CKAN ไม่ตอบสนอง (ใช้ DB count แทน)
 */
async function fetchOrganizationCountFromCkan(
  scopeFilter: Prisma.DatasetWhereInput
): Promise<number | null> {
  try {
    // ดึง sources ตาม scope (admin = ทุก source, scoped = เฉพาะ source ของ division)
    let sourceWhere: Prisma.CkanSourceWhereInput = { isActive: true }

    const scopeSourceId = scopeFilter.ckanSourceId
    if (
      scopeSourceId &&
      typeof scopeSourceId === 'object' &&
      'in' in scopeSourceId
    ) {
      const ids = (scopeSourceId as { in: string[] }).in
      if (ids.length === 0) return 0
      sourceWhere = { ...sourceWhere, id: { in: ids } }
    }

    const sources = await prisma.ckanSource.findMany({
      where:  sourceWhere,
      select: { url: true, apiKey: true },
    })
    if (sources.length === 0) return 0

    const results = await Promise.allSettled(
      sources.map(async (s: { url: string; apiKey: string | null }) => {
        const url = `${s.url}/api/3/action/organization_list`
        const headers: Record<string, string> = {
          'User-Agent': 'OGD-Quality-System/1.0',
        }
        const decryptedKey = tryDecryptField(s.apiKey)
        if (decryptedKey) headers['Authorization'] = decryptedKey

        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data.result) ? (data.result as string[]) : []
      })
    )

    const allOrgs = new Set<string>()
    for (const r of results) {
      if (r.status === 'fulfilled') r.value.forEach((o: string) => allOrgs.add(o))
    }
    return allOrgs.size > 0 ? allOrgs.size : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  // ต้อง login
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }
  try { verifyAccessToken(auth.slice(7)) } catch {
    return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
  }

  const scopeFilter = await getScopeFilter(req)
  const hasScope    = Object.keys(scopeFilter).length > 0

  // ดึง DB stats และ CKAN org count พร้อมกัน
  const [dbResults, ckanOrgCount] = await Promise.all([
    Promise.all([
      prisma.dataset.count({ where: scopeFilter }),
      hasScope
        ? prisma.resource.count({ where: { dataset: scopeFilter } })
        : prisma.resource.count(),
      hasScope
        ? prisma.organization.count({ where: { datasets: { some: scopeFilter } } })
        : prisma.organization.count(),
      prisma.dataset.groupBy({ by: ['qualityGrade'], _count: true, where: scopeFilter }),
      prisma.dataset.groupBy({ by: ['machineReadableStatus'], _count: true, where: scopeFilter }),
      prisma.dataset.groupBy({ by: ['timelinessStatus'],     _count: true, where: scopeFilter }),
      prisma.dataset.aggregate({ _avg: { overallScore: true }, where: scopeFilter }),
      prisma.dataset.findMany({
        where: { overallScore: { not: null }, ...scopeFilter },
        orderBy: { overallScore: 'desc' }, take: 5,
        select: { id: true, title: true, overallScore: true, qualityGrade: true, organization: { select: { name: true } } },
      }),
      prisma.dataset.findMany({
        where: { overallScore: { not: null }, ...scopeFilter },
        orderBy: { overallScore: 'asc' }, take: 5,
        select: { id: true, title: true, overallScore: true, qualityGrade: true, organization: { select: { name: true } } },
      }),
      prisma.scanJob.findFirst({ where: { type: 'catalog_sync' }, orderBy: { createdAt: 'desc' } }),
      prisma.scanJob.count({ where: { status: { in: ['pending', 'running'] } } }),
    ]),
    fetchOrganizationCountFromCkan(scopeFilter),
  ])

  const [
    totalDatasets, totalResources, dbOrgCount,
    gradeRows, mrRows, timelinessRows, avgRow,
    topDatasets, lowDatasets, lastJob, pendingJobs,
  ] = dbResults

  // ใช้ CKAN org count ถ้าดึงสำเร็จ, fallback เป็น DB count
  const totalOrganizations = ckanOrgCount ?? dbOrgCount

  const MR_LABELS: Record<string, string> = {
    fully_machine_readable: 'อ่านได้ทั้งหมด',
    partially_machine_readable: 'อ่านได้บางส่วน',
    not_machine_readable: 'อ่านไม่ได้',
    unknown: 'ไม่ทราบ',
  }
  const TL_LABELS: Record<string, string> = {
    up_to_date: 'ทันสมัย', warning: 'ใกล้หมด', outdated: 'ล้าสมัย', unknown: 'ไม่ทราบ',
  }

  return NextResponse.json(sanitize({
    totalDatasets, totalResources, totalOrganizations,
    avgScore: avgRow._avg.overallScore,
    gradeDistribution: ['A','B','C','D','F','?'].map(g => ({
      grade: g,
      count: gradeRows.find(r => (r.qualityGrade ?? '?') === g)?._count ?? 0,
    })),
    machineReadableDistribution: Object.keys(MR_LABELS).map(k => ({
      status: k, label: MR_LABELS[k],
      count: mrRows.find(r => (r.machineReadableStatus ?? 'unknown') === k)?._count ?? 0,
    })),
    timelinessDistribution: Object.keys(TL_LABELS).map(k => ({
      status: k, label: TL_LABELS[k],
      count: timelinessRows.find(r => (r.timelinessStatus ?? 'unknown') === k)?._count ?? 0,
    })),
    topDatasets, lowDatasets,
    lastSyncAt: lastJob?.finishedAt ?? null,
    pendingJobs,
  }))
}
