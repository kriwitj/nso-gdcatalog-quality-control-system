import { NextResponse } from 'next/server'
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

export async function GET() {
  const [
    totalDatasets,
    totalResources,
    avgRow,
    topByScore,
    recentlyScanned,
    topOrgRows,
    scannedOrgRows,
  ] = await Promise.all([
    prisma.dataset.count(),
    prisma.resource.count(),
    prisma.dataset.aggregate({ _avg: { overallScore: true } }),
    // top 5 by overall score with org hierarchy
    prisma.dataset.findMany({
      where: { overallScore: { not: null } },
      orderBy: { overallScore: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        overallScore: true,
        qualityGrade: true,
        organization: { select: { name: true, title: true } },
        ckanSource: {
          select: {
            division: {
              select: {
                name: true,
                department: {
                  select: {
                    name: true,
                    ministry: { select: { name: true } },
                  },
                },
              },
            },
            department: {
              select: {
                name: true,
                ministry: { select: { name: true } },
              },
            },
            ministry: { select: { name: true } },
          },
        },
      },
    }),
    // top 5 recently scanned
    prisma.dataset.findMany({
      where: { lastScanAt: { not: null } },
      orderBy: { lastScanAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        overallScore: true,
        qualityGrade: true,
        lastScanAt: true,
        organization: { select: { name: true, title: true } },
        ckanSource: {
          select: {
            division: {
              select: {
                name: true,
                department: {
                  select: {
                    name: true,
                    ministry: { select: { name: true } },
                  },
                },
              },
            },
            department: {
              select: {
                name: true,
                ministry: { select: { name: true } },
              },
            },
            ministry: { select: { name: true } },
          },
        },
      },
    }),
    // top 5 orgs by dataset count
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        title: true,
        _count: { select: { datasets: true } },
      },
      orderBy: { datasets: { _count: 'desc' } },
      take: 5,
    }),
    // top ckan sources by scanned datasets count (lastScanAt not null)
    prisma.dataset.groupBy({
      by: ['ckanSourceId'],
      where: { lastScanAt: { not: null }, ckanSourceId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ])

  // resolve ckan source names
  const scannedSourceIds = scannedOrgRows.map(r => r.ckanSourceId).filter(Boolean) as string[]
  const scannedSources = scannedSourceIds.length
    ? await prisma.ckanSource.findMany({
        where: { id: { in: scannedSourceIds } },
        select: { id: true, name: true, url: true },
      })
    : []
  const sourceNameMap = Object.fromEntries(
    scannedSources.map(s => [s.id, s.name || new URL(s.url).hostname])
  )

  const topScannedOrgs = scannedOrgRows
    .map(r => ({
      id: r.ckanSourceId!,
      name: sourceNameMap[r.ckanSourceId!] || r.ckanSourceId!,
      count: r._count.id,
    }))
    .slice(0, 5)

  return NextResponse.json(
    sanitize({
      totalDatasets,
      totalResources,
      avgScore: avgRow._avg.overallScore,
      topByScore,
      recentlyScanned,
      topOrgs: topOrgRows.map(o => ({
        id: o.id,
        name: o.title || o.name,
        count: o._count.datasets,
      })),
      topScannedOrgs,
    })
  )
}
