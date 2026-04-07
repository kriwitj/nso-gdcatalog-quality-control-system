import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { enqueueResourceCheck } from '@/lib/queue'
import { withAuth } from '@/lib/withAuth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// POST /api/scan — ต้อง login ระดับ admin หรือ editor
// Non-admin: ตรวจสอบได้เฉพาะ datasets จาก CkanSource ของ ศูนย์/กอง ตัวเอง
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  let body: { datasetId?: string } = {}
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

  // ป้องกัน scan ซ้อนกัน — ถ้ามี full scan กำลัง running อยู่ ให้ reject
  // (single-dataset scan อนุญาตให้รันซ้อนกันได้)
  if (!body.datasetId) {
    const activeScan = await prisma.scanJob.findFirst({
      where: { type: 'full', status: { in: ['running', 'pending'] } },
      select: { id: true },
    })
    if (activeScan) {
      return NextResponse.json(
        { error: `กำลังตรวจสอบอยู่แล้ว (job: ${activeScan.id.slice(0, 8)}…) กรุณารอให้เสร็จก่อน` },
        { status: 409 },
      )
    }
  }

  const where: Prisma.DatasetWhereInput = {
    ...(body.datasetId  ? { id: body.datasetId } : {}),
    ...(scopeSourceIds  ? { ckanSourceId: { in: scopeSourceIds } } : {}),
  }

  const datasets = await prisma.dataset.findMany({
    where,
    include: {
      resources: {
        select: {
          id: true, ckanId: true, url: true,
          format: true, metadataModified: true, packageId: true,
        },
      },
    },
  })

  if (datasets.length === 0) {
    return NextResponse.json({ error: 'ไม่พบชุดข้อมูลในขอบเขตของคุณ' }, { status: 404 })
  }

  // นับเฉพาะ resource ที่มี URL จริง ๆ (ที่จะ enqueue) เพื่อให้ totalItems ตรงกับ done_items
  const scannable = datasets.map(d => ({
    dataset: d,
    resources: d.resources.filter((r: { url: string | null }) => r.url),
  }))
  const totalResources = scannable.reduce((s, d) => s + d.resources.length, 0)

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
    const resourceIds = resources.map((r: { id: string }) => r.id)

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
        datasetResourceCount: resourceIds.length,
      })
      enqueued++
    }
  }

  return NextResponse.json({
    ok: true, jobId: job.id, enqueued,
    message: `เริ่มตรวจสอบ ${enqueued} ทรัพยากร จาก ${datasets.length} ชุดข้อมูล`,
  })
}, ['admin', 'editor'])
