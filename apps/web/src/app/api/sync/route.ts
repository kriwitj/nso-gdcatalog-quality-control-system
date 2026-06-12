import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchAllPackages, fetchPackage } from '@/lib/ckan'
import { withAuth } from '@/lib/withAuth'
import { Prisma } from '@prisma/client'
import { tryDecryptField } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// POST /api/sync — ต้อง login ระดับ admin หรือ editor
// Non-admin: sync ได้เฉพาะ CkanSource ของ ศูนย์/กอง ตัวเอง
export const POST = withAuth(async (req: NextRequest, { user: caller }) => {
  let body: { sourceId?: string; datasetId?: string } = {}
  try { body = await req.json() } catch {}

  // ─── Single-dataset sync ───────────────────────────────────────────
  if (body.datasetId) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: body.datasetId },
      include: { ckanSource: true },
    })
    if (!dataset) {
      return NextResponse.json({ error: 'ไม่พบชุดข้อมูล' }, { status: 404 })
    }
    if (!dataset.ckanSource?.isActive) {
      return NextResponse.json({ error: 'ไม่พบ CKAN source หรือ source ถูกปิดใช้งาน' }, { status: 404 })
    }

    // Non-admin: ตรวจสิทธิ์ว่า source อยู่ใน division ของตัวเอง
    if (caller.role !== 'admin') {
      const dbUser = await prisma.user.findUnique({
        where: { id: caller.userId },
        select: { divisionId: true },
      })
      if (!dbUser?.divisionId || dataset.ckanSource.divisionId !== dbUser.divisionId) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ซิงก์ชุดข้อมูลนี้' }, { status: 403 })
      }
    }

    const source = dataset.ckanSource
    const apiKey = tryDecryptField(source.apiKey) ?? undefined

    const job = await prisma.scanJob.create({
      data: {
        type: 'catalog_sync',
        status: 'running',
        totalItems: 1,
        startedAt: new Date(),
        triggeredBy: caller.userId,
        datasetId: dataset.id,
      },
    })

    runSyncSingle(job.id, dataset.ckanId, { id: source.id, url: source.url, apiKey }).catch(err => {
      console.error('[sync-single] fatal:', err)
      prisma.scanJob.update({
        where: { id: job.id },
        data: { status: 'error', errorMsg: String(err), finishedAt: new Date() },
      }).catch(console.error)
    })

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      message: `เริ่มซิงก์ชุดข้อมูล "${dataset.title || dataset.name}" แล้ว`,
    })
  }

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

  // ป้องกัน sync ซ้อนกัน เฉพาะ division เดียวกัน (คนละ division sync พร้อมกันได้)
  {
    const sameScopeUserIds = divisionId
      ? (await prisma.user.findMany({ where: { divisionId }, select: { id: true } })).map(u => u.id)
      : (await prisma.user.findMany({ where: { role: 'admin' },  select: { id: true } })).map(u => u.id)

    const conflictingSync = await prisma.scanJob.findFirst({
      where: {
        type:        'catalog_sync',
        status:      { in: ['running', 'pending'] },
        triggeredBy: { in: sameScopeUserIds },
      },
      select: { id: true },
    })
    if (conflictingSync) {
      return NextResponse.json(
        { error: `กำลังซิงค์อยู่แล้ว (job: ${conflictingSync.id.slice(0, 8)}…) กรุณารอให้เสร็จก่อน` },
        { status: 409 },
      )
    }
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

async function purgeResources(resourceIds: string[]) {
  if (resourceIds.length === 0) return
  const checks = await prisma.resourceCheck.findMany({
    where: { resourceId: { in: resourceIds } },
    select: { id: true },
  })
  if (checks.length > 0) {
    const checkIds = checks.map(c => c.id)
    await prisma.validityReport.deleteMany({ where: { checkId: { in: checkIds } } })
    await prisma.resourceCheck.deleteMany({ where: { id: { in: checkIds } } })
  }
  await prisma.resource.deleteMany({ where: { id: { in: resourceIds } } })
}

async function purgeDatasets(datasetIds: string[]) {
  if (datasetIds.length === 0) return
  const resources = await prisma.resource.findMany({
    where: { packageId: { in: datasetIds } },
    select: { id: true },
  })
  await purgeResources(resources.map(r => r.id))
  await prisma.scanJob.updateMany({
    where: { datasetId: { in: datasetIds } },
    data: { datasetId: null },
  })
  await prisma.qualityScoreHistory.deleteMany({ where: { datasetId: { in: datasetIds } } })
  await prisma.dataset.deleteMany({ where: { id: { in: datasetIds } } })
}

async function runSyncSingle(
  jobId: string,
  ckanId: string,
  source: { id: string; url: string; apiKey?: string },
) {
  try {
    const pkg = await fetchPackage(ckanId, { baseUrl: source.url, apiKey: source.apiKey })
    await upsertPackage(pkg, source.id)
    await prisma.ckanSource.update({
      where: { id: source.id },
      data: { lastSyncAt: new Date() },
    }).catch(e => console.error(`[sync-single] update lastSyncAt failed: ${e}`))
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { status: 'done', doneItems: 1, finishedAt: new Date() },
    })
  } catch (err) {
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { status: 'error', errorMsg: String(err), finishedAt: new Date() },
    })
    throw err
  }
}

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

      // ลบ datasets ที่ไม่มีใน CKAN อีกแล้ว (ถูกลบหรือเปลี่ยน source)
      if (target.id && packages.length > 0) {
        const fetchedCkanIds = packages.map((p: any) => p.id).filter(Boolean) as string[]
        const staleDatasets = await prisma.dataset.findMany({
          where: { ckanSourceId: target.id, ckanId: { notIn: fetchedCkanIds } },
          select: { id: true },
        })
        if (staleDatasets.length > 0) {
          const staleIds = staleDatasets.map(d => d.id)
          await purgeDatasets(staleIds)
          console.log(`[sync] purged ${staleDatasets.length} stale datasets from "${target.name}"`)
        }
      }

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

  // ลบ resources ที่ถูกลบออกจาก dataset ใน CKAN
  const fetchedResCkanIds = resources.map((r: any) => r?.id).filter(Boolean) as string[]
  const staleResources = await prisma.resource.findMany({
    where: { packageId: dataset.id, ckanId: { notIn: fetchedResCkanIds } },
    select: { id: true },
  })
  if (staleResources.length > 0) {
    await purgeResources(staleResources.map(r => r.id))
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
