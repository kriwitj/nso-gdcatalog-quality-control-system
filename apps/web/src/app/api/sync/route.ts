import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchAllPackages } from '@/lib/ckan'
import { withAuth } from '@/lib/withAuth'
import { Prisma } from '@prisma/client'
import { tryDecryptField } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// POST /api/sync — ต้อง login ระดับ admin หรือ editor
// Non-admin: sync ได้เฉพาะ CkanSource ของ ศูนย์/กอง ตัวเอง
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  let body: { sourceId?: string } = {}
  try { body = await req.json() } catch {}

  // Non-admin: ตรวจสอบ ศูนย์/กอง และ จำกัด scope
  let divisionId: string | null = null
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
    divisionId = dbUser.divisionId
  }

  // ดึง CKAN sources ตามสิทธิ์ (ไม่มี env fallback)
  const sourceWhere: Prisma.CkanSourceWhereInput = { isActive: true }
  if (body.sourceId) sourceWhere.id         = body.sourceId
  if (divisionId)   sourceWhere.divisionId  = divisionId

  const sources = await prisma.ckanSource.findMany({ where: sourceWhere })
  if (sources.length === 0) {
    return NextResponse.json(
      { error: divisionId
          ? 'ไม่พบ CKAN source สำหรับ ศูนย์/กอง ของคุณ กรุณาติดต่อ admin'
          : 'ไม่พบ CKAN source ที่เปิดใช้งาน' },
      { status: 404 },
    )
  }

  // ป้องกัน sync ซ้อนกัน — ถ้ามี job ประเภทเดียวกันกำลัง running อยู่ ให้ reject
  const activeSync = await prisma.scanJob.findFirst({
    where: { type: 'catalog_sync', status: { in: ['running', 'pending'] } },
    select: { id: true, startedAt: true },
  })
  if (activeSync) {
    return NextResponse.json(
      { error: `กำลังซิงค์อยู่แล้ว (job: ${activeSync.id.slice(0, 8)}…) กรุณารอให้เสร็จก่อน` },
      { status: 409 },
    )
  }

  const syncTargets = sources.map(s => ({
    id: s.id, name: s.name, url: s.url,
    apiKey: tryDecryptField(s.apiKey) ?? undefined,
  }))

  const job = await prisma.scanJob.create({
    data: {
      type: 'catalog_sync',
      status: 'running',
      startedAt: new Date(),
      triggeredBy: caller.userId,
    },
  })

  runSync(job.id, syncTargets).catch(err => {
    console.error('[sync] fatal:', err)
    prisma.scanJob.update({
      where: { id: job.id },
      data: { status: 'error', errorMsg: String(err), finishedAt: new Date() },
    }).catch(console.error)
  })

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    sources: syncTargets.map(t => t.name),
    message: `เริ่มซิงค์ข้อมูลจาก ${syncTargets.length} แหล่งข้อมูลแล้ว`,
  })
}, ['admin', 'editor'])

// GET /api/sync — แสดงจำนวนข้อมูลใน DB (ต้อง login)
export const GET = withAuth(async () => {
  const [datasets, organizations, resources] = await Promise.all([
    prisma.dataset.count(),
    prisma.organization.count(),
    prisma.resource.count(),
  ])
  return NextResponse.json({ datasets, organizations, resources })
})

// ─── Sync logic ───────────────────────────────────────────────────

type SyncTarget = { id: string | null; name: string; url: string; apiKey?: string }

async function runSync(jobId: string, targets: SyncTarget[]) {
  const errors: string[] = []
  let totalDone = 0

  try {
    for (const target of targets) {
      console.log(`[sync] source="${target.name}" url=${target.url}`)
      const packages = await fetchAllPackages({ baseUrl: target.url, apiKey: target.apiKey })
      console.log(`[sync] got ${packages.length} packages from "${target.name}"`)

      await prisma.scanJob.update({
        where: { id: jobId },
        data: { totalItems: packages.length },
      })

      let done = 0
      for (const pkg of packages) {
        try {
          await upsertPackage(pkg, target.id)
        } catch (err) {
          const msg = `${pkg.id} (${pkg.name}): ${err}`
          errors.push(msg)
          console.error(`[sync] skip — ${msg}`)
        }
        done++
        if (done % 10 === 0) {
          await prisma.scanJob.update({
            where: { id: jobId },
            data: { doneItems: totalDone + done, errorItems: errors.length },
          })
        }
      }
      totalDone += done

      if (target.id) {
        await prisma.ckanSource.update({
          where: { id: target.id },
          data:  { lastSyncAt: new Date() },
        }).catch(e => console.error(`[sync] update lastSyncAt failed: ${e}`))
      }
    }

    const summary = errors.length > 0
      ? `เสร็จสิ้น ${totalDone - errors.length}/${totalDone} packages (ข้าม ${errors.length} รายการ error)`
      : `เสร็จสิ้น ${totalDone} packages`

    console.log(`[sync] ${summary}`)
    if (errors.length > 0) console.warn('[sync] errors:\n' + errors.slice(0, 10).join('\n'))

    await prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: errors.length === totalDone ? 'error' : 'done',
        doneItems: totalDone,
        errorItems: errors.length,
        errorMsg: errors.length > 0 ? errors.slice(0, 5).join('\n') : null,
        finishedAt: new Date(),
      },
    })
  } catch (err) {
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { status: 'error', errorMsg: String(err), finishedAt: new Date() },
    })
    throw err
  }
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === 'null' || s === 'undefined' ? null : s
}

function safeNames(arr: unknown, key = 'name'): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .map((item: any) => (item && typeof item === 'object' ? str(item[key]) : null))
    .filter((v): v is string => v !== null)
}

async function upsertPackage(pkg: any, ckanSourceId: string | null) {
  if (!pkg.id || !pkg.name) throw new Error(`Missing id/name: id=${pkg.id} name=${pkg.name}`)

  let orgId: string | null = null
  const org = pkg.organization
  if (org && str(org.id) && str(org.name)) {
    const saved = await prisma.organization.upsert({
      where:  { ckanId: org.id },
      create: { ckanId: org.id, name: str(org.name)!, title: str(org.title), description: str(org.description), imageUrl: str(org.image_url) },
      update: { name: str(org.name)!, title: str(org.title), description: str(org.description) },
    })
    orgId = saved.id
  }

  const tags   = safeNames(pkg.tags)
  const groups = safeNames(pkg.groups)

  const dataset = await prisma.dataset.upsert({
    where:  { ckanId_ckanSourceId: { ckanId: pkg.id, ckanSourceId: ckanSourceId ?? '' } },
    create: {
      ckanId: pkg.id, organizationId: orgId, name: pkg.name,
      ckanSourceId,
      title: str(pkg.title), notes: str(pkg.notes), license: str(pkg.license_title),
      tags, groups, updateFrequency: str(pkg.update_frequency),
      metadataCreated:  pkg.metadata_created  ? new Date(pkg.metadata_created)  : null,
      metadataModified: pkg.metadata_modified ? new Date(pkg.metadata_modified) : null,
      resourceCount: typeof pkg.num_resources === 'number' ? pkg.num_resources : (pkg.resources?.length ?? 0),
      isOpen: pkg.isopen === true,
    },
    update: {
      organizationId: orgId,
      title: str(pkg.title), notes: str(pkg.notes),
      license: str(pkg.license_title), tags, groups,
      updateFrequency: str(pkg.update_frequency),
      metadataModified: pkg.metadata_modified ? new Date(pkg.metadata_modified) : null,
      resourceCount: typeof pkg.num_resources === 'number' ? pkg.num_resources : (pkg.resources?.length ?? 0),
      isOpen: pkg.isopen === true,
    },
  })

  const resources = Array.isArray(pkg.resources) ? pkg.resources : []
  for (const res of resources) {
    if (!res?.id) continue
    await prisma.resource.upsert({
      where:  { ckanId_packageId: { ckanId: res.id, packageId: dataset.id } },
      create: {
        ckanId: res.id, packageId: dataset.id,
        name: str(res.name), description: str(res.description),
        format: str(res.format)?.toUpperCase() ?? null,
        url: str(res.url),
        size: typeof res.size === 'number' ? res.size : null,
        mimeType: str(res.mimetype), hash: str(res.hash),
        metadataModified: res.metadata_modified ? new Date(res.metadata_modified) : null,
      },
      update: {
        name: str(res.name), description: str(res.description),
        format: str(res.format)?.toUpperCase() ?? null,
        url: str(res.url),
        size: typeof res.size === 'number' ? res.size : null,
        mimeType: str(res.mimetype),
        metadataModified: res.metadata_modified ? new Date(res.metadata_modified) : null,
      },
    })
  }

  let score = 0
  if (str(pkg.title))            score += 20
  if (str(pkg.notes))            score += 20
  if (tags.length > 0)           score += 15
  if (str(pkg.license_title))    score += 15
  if (str(org?.id))              score += 15
  if (str(pkg.update_frequency)) score += 15
  await prisma.dataset.update({
    where: { id: dataset.id },
    data: { completenessScore: score, lastScanStatus: 'pending' },
  })
}
