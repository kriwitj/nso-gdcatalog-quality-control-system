import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAccessToken, AccessTokenPayload } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const SCORE_FIELDS: Record<string, keyof Prisma.DatasetWhereInput> = {
  overall:         'overallScore',
  completeness:    'completenessScore',
  timeliness:      'timelinessScore',
  accessibility:   'accessibilityScore',
  machineReadable: 'machineReadableScore',
  validity:        'validityScore',
}

const SORT_MAP: Record<string, Prisma.DatasetOrderByWithRelationInput> = {
  overallScore:         { overallScore:         'asc'  },
  overallScore_desc:    { overallScore:         'desc' },
  completenessScore:    { completenessScore:    'asc'  },
  completenessScore_desc: { completenessScore:  'desc' },
  timelinessScore:      { timelinessScore:      'asc'  },
  timelinessScore_desc: { timelinessScore:      'desc' },
  accessibilityScore:   { accessibilityScore:   'asc'  },
  accessibilityScore_desc: { accessibilityScore: 'desc' },
  machineReadableScore: { machineReadableScore: 'asc'  },
  machineReadableScore_desc: { machineReadableScore: 'desc' },
  validityScore:        { validityScore:        'asc'  },
  validityScore_desc:   { validityScore:        'desc' },
  lastScanAt:           { lastScanAt:           'desc' },
  title:                { title:                'asc'  },
}

async function buildScopeFilter(payload: AccessTokenPayload): Promise<Prisma.DatasetWhereInput> {
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
  return { ckanSourceId: { in: scopeSources.map((s: { id: string }) => s.id) } }
}

export async function GET(req: NextRequest) {
  // ต้อง login
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

  const { searchParams } = req.nextUrl
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize  = 50
  const search    = searchParams.get('search') || ''
  const grade     = searchParams.get('grade') || ''
  const orgId     = searchParams.get('orgId') || ''
  const scoreType = searchParams.get('scoreType') || ''
  const minScore  = searchParams.get('minScore') || ''
  const sortKey   = searchParams.get('sort') || 'overallScore_asc'

  const scopeFilter = await buildScopeFilter(payload)

  const where: Prisma.DatasetWhereInput = { ...scopeFilter }

  if (search) {
    where.OR = [
      { title:        { contains: search, mode: 'insensitive' } },
      { name:         { contains: search, mode: 'insensitive' } },
      { organization: { title: { contains: search, mode: 'insensitive' } } },
    ]
  }
  if (grade) where.qualityGrade = grade
  if (orgId) where.organizationId = orgId

  if (scoreType && minScore !== '' && SCORE_FIELDS[scoreType]) {
    const field = SCORE_FIELDS[scoreType]
    ;(where as Record<string, unknown>)[field as string] = {
      gte: parseFloat(minScore),
    }
  }

  // Sort: "field_asc" or "field_desc" → look up SORT_MAP
  const sortNorm = sortKey.endsWith('_desc') ? sortKey : sortKey.replace(/_asc$/, '')
  const orderBy  = SORT_MAP[sortKey] || SORT_MAP[sortNorm] || { overallScore: 'asc' as const }

  const [data, total] = await Promise.all([
    prisma.dataset.findMany({
      where,
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      orderBy,
      select: {
        id: true, title: true, name: true, resourceCount: true,
        overallScore: true, qualityGrade: true,
        completenessScore: true, timelinessScore: true,
        accessibilityScore: true, machineReadableScore: true, validityScore: true,
        timelinessStatus: true, machineReadableStatus: true,
        lastScanAt: true, lastScanStatus: true,
        organization: { select: { id: true, name: true, title: true } },
        ckanSource: { select: { id: true, name: true, url: true } },
      },
    }),
    prisma.dataset.count({ where }),
  ])

  return NextResponse.json({ data, total, page, pageSize })
}
