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
  overallScore:              { overallScore:         'asc'  },
  overallScore_desc:         { overallScore:         'desc' },
  completenessScore:         { completenessScore:    'asc'  },
  completenessScore_desc:    { completenessScore:    'desc' },
  timelinessScore:           { timelinessScore:      'asc'  },
  timelinessScore_desc:      { timelinessScore:      'desc' },
  accessibilityScore:        { accessibilityScore:   'asc'  },
  accessibilityScore_desc:   { accessibilityScore:   'desc' },
  machineReadableScore:      { machineReadableScore: 'asc'  },
  machineReadableScore_desc: { machineReadableScore: 'desc' },
  validityScore:             { validityScore:        'asc'  },
  validityScore_desc:        { validityScore:        'desc' },
  machineReadableStatus:     { machineReadableStatus: 'asc'  },
  machineReadableStatus_desc:{ machineReadableStatus: 'desc' },
  lastScanAt:                { lastScanAt:           'desc' },
  title:                     { title:                'asc'  },
  title_desc:                { title:                'desc' },
}

async function buildScopeFilter(payload: AccessTokenPayload): Promise<Prisma.DatasetWhereInput> {
  if (payload.role === 'admin') return {}
  const dbUser = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { divisionId: true },
  })
  if (!dbUser?.divisionId) return { id: { in: [] } }
  const scopeSources = await prisma.ckanSource.findMany({
    where:  { isActive: true, divisionId: dbUser.divisionId },
    select: { id: true },
  })
  return { ckanSourceId: { in: scopeSources.map((s: { id: string }) => s.id) } }
}

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

  const { searchParams } = req.nextUrl
  const search    = searchParams.get('search') || ''
  const grade     = searchParams.get('grade') || ''
  const orgId     = searchParams.get('orgId') || ''
  const scoreType = searchParams.get('scoreType') || ''
  const minScore  = searchParams.get('minScore') || ''
  const structured = searchParams.get('structured') || ''
  const mrStatus  = searchParams.get('mrStatus') || ''
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
  if (structured === 'yes') {
    where.machineReadableStatus = { in: ['fully_machine_readable', 'partially_machine_readable'] }
  } else if (structured === 'no') {
    where.machineReadableStatus = 'not_machine_readable'
  }
  if (mrStatus) where.machineReadableStatus = mrStatus
  if (scoreType && minScore !== '' && SCORE_FIELDS[scoreType]) {
    const field = SCORE_FIELDS[scoreType]
    ;(where as Record<string, unknown>)[field as string] = { gte: parseFloat(minScore) }
  }

  const sortNorm = sortKey.endsWith('_desc') ? sortKey : sortKey.replace(/_asc$/, '')
  const orderBy  = SORT_MAP[sortKey] || SORT_MAP[sortNorm] || { overallScore: 'asc' as const }

  const datasets = await prisma.dataset.findMany({
    where,
    orderBy,
    select: {
      id: true, title: true, name: true,
      overallScore: true, qualityGrade: true,
      completenessScore: true, timelinessScore: true,
      accessibilityScore: true, machineReadableScore: true, validityScore: true,
      machineReadableStatus: true, timelinessStatus: true,
      resourceCount: true, updateFrequency: true, license: true,
      lastScanAt: true, lastScanStatus: true,
      organization: { select: { name: true, title: true } },
      resources: {
        select: {
          id: true, name: true, format: true, url: true,
          checks: {
            orderBy: { checkedAt: 'desc' },
            take: 1,
            select: {
              httpStatus: true, downloadable: true,
              isMachineReadable: true, isStructured: true,
              structuredStatus: true, timelinessStatus: true,
              rowCount: true, columnCount: true,
              isValid: true, errorCount: true, warningCount: true,
              detectedFormat: true, encoding: true, fileSize: true,
              validityReport: {
                select: { severity: true, primaryIssue: true, errorMessage: true }
              },
            },
          },
        },
      },
    },
  })

  // Flatten: serialise BigInt / Date → plain values
  const safeDatasets = datasets.map(d => ({
    ...d,
    lastScanAt: d.lastScanAt ? d.lastScanAt.toISOString() : null,
    resources: d.resources.map(r => ({
      ...r,
      checks: r.checks.map(c => ({
        ...c,
        fileSize: c.fileSize != null ? Number(c.fileSize) : null,
      })),
    })),
  }))

  return NextResponse.json({ data: safeDatasets, total: safeDatasets.length })
}
