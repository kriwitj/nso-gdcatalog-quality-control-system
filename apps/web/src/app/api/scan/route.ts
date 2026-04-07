import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { enqueueResourceCheck } from '@/lib/queue'
import { withAuth } from '@/lib/withAuth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type ResourceRow = {
  id: string; ckanId: string; url: string | null
  format: string | null; metadataModified: Date | null; packageId: string
}

type DatasetRow = {
  id: string; ckanId: string; updateFrequency: string | null; ckanSourceId: string | null
  resources: ResourceRow[]
}


// POST /api/scan — ต้อง login ระดับ admin หรือ editor
// รองรับ body: { datasetId? } | { resourceId? }
// Non-admin: จำกัด scope ตาม divisionId ของ CkanSource
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  let body: { datasetId?: string; resourceId?: string } = {}
  try { body = await req.json() } catch {}

  // Non-admin: จำกัด scope ตาม divisionId
  let scopeSourceIds: string[] | null = null
  if (caller.role !== 'admin') {
    const dbUser = await prisma.user.findUnique({
      where:  { id: caller.userId },
      select: { divisionId: true },
    })
    if (!dbUser?.divisionId) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์: บัญชีของคุณยังไม่ได้กำหนด ศูนย์/กอง กรุณาติดต่อ admin' },
        { status: 403 },
      )
    }
    const divSources = await prisma.ckanSource.findMany({
      where:  { divisionId: dbUser.divisionId, isActive: true },
      select: { id: true },
    })
    scopeSourceIds = divSources.map((s: { id: string }) => s.id)
  }

  // ── Single-resource scan ────────────────────────────────────────
  if (body.resourceId) {
    const resource = await prisma.resource.findUnique({
      where:   { id: body.resourceId },
      select: {
        id: true, ckanId: true, url: true,
        format: true, metadataModified: true, packageId: true,
        dataset: { select: { id: true, ckanId: true, updateFrequency: true, ckanSourceId: true } },
      },
    })
    if (!resource || !resource.url) {
      return NextResponse.json({ error: 'ไม่พบทรัพยากร หรือไม่มี URL' }, { status: 404 })
    }
    // scope check
    if (scopeSourceIds && !scopeSourceIds.includes(resource.dataset.ckanSourceId ?? '')) {
      return NextResponse.json({ error: 'ทรัพยากรนี้ไม่อยู่ในขอบเขตของคุณ' }, { status: 403 })
    }

    const job = await prisma.scanJob.create({
      data: {
        type:        'resource',
        status:      'running',
        startedAt:   new Date(),
        triggeredBy: caller.userId,
        totalItems:  1,
        datasetId:   resource.dataset.id,
      },
    })

    await enqueueResourceCheck({
      jobId:                job.id,
      resourceId:           resource.id,
      resourceCkanId:       resource.ckanId,
      resourceUrl:          resource.url,
      resourceFormat:       resource.format,
      packageId:            resource.dataset.id,
      datasetCkanId:        resource.dataset.ckanId,
      metadataModified:     resource.metadataModified?.toISOString() ?? null,
      updateFrequency:      resource.dataset.updateFrequency,
      datasetResourceCount: 1,
    })

    return NextResponse.json({
      ok: true, jobId: job.id, enqueued: 1,
      message: 'เริ่มตรวจสอบทรัพยากร 1 รายการ',
    })
  }

  // ── ป้องกัน full scan ซ้อนกัน ──────────────────────────────────
  if (!body.datasetId) {
    const activeScan = await prisma.scanJob.findFirst({
      where:  { type: 'full', status: { in: ['running', 'pending'] } },
      select: { id: true },
    })
    if (activeScan) {
      return NextResponse.json(
        { error: `กำลังตรวจสอบอยู่แล้ว (job: ${activeScan.id.slice(0, 8)}…) กรุณารอให้เสร็จก่อน` },
        { status: 409 },
      )
    }
  }

  // ── Dataset / full scan ─────────────────────────────────────────
  const where: Prisma.DatasetWhereInput = {
    ...(body.datasetId ? { id: body.datasetId } : {}),
    ...(scopeSourceIds ? { ckanSourceId: { in: scopeSourceIds } } : {}),
  }

  const datasets = await prisma.dataset.findMany({
    where,
    include: {
      resources: {
        select: { id: true, ckanId: true, url: true, format: true, metadataModified: true, packageId: true },
      },
    },
  })

  if (datasets.length === 0) {
    return NextResponse.json({ error: 'ไม่พบชุดข้อมูลในขอบเขตของคุณ' }, { status: 404 })
  }

  // นับเฉพาะ resource ที่มี URL — ให้ totalItems ตรงกับ done_items จริง
  const scannable = (datasets as DatasetRow[]).map(dataset => ({
    dataset,
    resources: dataset.resources.filter(r => r.url),
  }))
  const totalResources = scannable.reduce((s: number, d: { resources: ResourceRow[] }) => s + d.resources.length, 0)

  const job = await prisma.scanJob.create({
    data: {
      type:        body.datasetId ? 'resource' : 'full',
      status:      'running',
      startedAt:   new Date(),
      triggeredBy: caller.userId,
      totalItems:  totalResources,
      datasetId:   body.datasetId ?? null,
    },
  })

  await prisma.dataset.updateMany({ where, data: { lastScanStatus: 'running' } })

  let enqueued = 0
  for (const { dataset, resources } of scannable) {
    for (const resource of resources) {
      await enqueueResourceCheck({
        jobId:                job.id,
        resourceId:           resource.id,
        resourceCkanId:       resource.ckanId,
        resourceUrl:          resource.url as string,
        resourceFormat:       resource.format,
        packageId:            dataset.id,
        datasetCkanId:        dataset.ckanId,
        metadataModified:     resource.metadataModified?.toISOString() ?? null,
        updateFrequency:      dataset.updateFrequency,
        datasetResourceCount: resources.length,
      })
      enqueued++
    }
  }

  return NextResponse.json({
    ok: true, jobId: job.id, enqueued,
    message: `เริ่มตรวจสอบ ${enqueued} ทรัพยากร จาก ${datasets.length} ชุดข้อมูล`,
  })
}, ['admin', 'editor'])
