import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// แปลง BigInt และ Date ให้ JSON-safe
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return isNaN(obj.getTime()) ? null : obj.toISOString()
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)])
    )
  }
  return obj
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const dataset = await prisma.dataset.findUnique({
      where: { id },
      include: {
        organization: true,
        ckanSource: { select: { id: true, name: true, url: true } },
        scoreHistory: {
          orderBy: { recordedAt: 'asc' },
          take: 30,
          select: { recordedAt: true, overallScore: true },
        },
        resources: {
          include: {
            checks: {
              orderBy: { checkedAt: 'desc' },
              take: 1,
              include: { validityReport: true },
            },
          },
        },
      },
    })

    if (!dataset) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const resources = dataset.resources.map(r => ({
      ...r,
      latestCheck: r.checks[0] ?? null,
      checks: undefined,
    }))

    return NextResponse.json(sanitize({ ...dataset, resources }))
  } catch (err) {
    console.error('[api/datasets/id]', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}