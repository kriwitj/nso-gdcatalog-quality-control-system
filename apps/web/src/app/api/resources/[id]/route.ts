import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return isNaN(obj.getTime()) ? null : obj.toISOString()
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (typeof obj === 'object')
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)])
    )
  return obj
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        dataset: { select: { id: true, title: true, name: true } },
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: 10,
          include: { validityReport: true },
        },
      },
    })
    if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(sanitize(resource))
  } catch (err) {
    console.error('[api/resources/id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}