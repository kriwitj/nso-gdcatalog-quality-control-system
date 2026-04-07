import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'

export const dynamic = 'force-dynamic'

// PATCH /api/jobs/:id  { action: 'complete' | 'cancel' }
// force-close a stuck job — admin only
export const PATCH = withAuth(async (
  req: NextRequest,
  { params, user }: { params: { id: string }; user: { userId: string; role: string } }
) => {
  const { action } = await req.json().catch(() => ({ action: '' }))
  if (action !== 'complete' && action !== 'cancel') {
    return NextResponse.json({ error: 'action ต้องเป็น complete หรือ cancel' }, { status: 400 })
  }

  const job = await prisma.scanJob.findUnique({
    where:  { id: params.id },
    select: { id: true, status: true, triggeredBy: true, doneItems: true, totalItems: true },
  })
  if (!job) return NextResponse.json({ error: 'ไม่พบ job' }, { status: 404 })

  // non-admin: ปิดได้เฉพาะ job ของตัวเอง
  if (user.role !== 'admin' && job.triggeredBy !== user.userId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ปิด job นี้' }, { status: 403 })
  }

  if (job.status !== 'running' && job.status !== 'pending') {
    return NextResponse.json({ error: `job สถานะ "${job.status}" ไม่สามารถปิดได้` }, { status: 409 })
  }

  const newStatus = action === 'complete' ? 'done' : 'error'
  const updated = await prisma.scanJob.update({
    where: { id: params.id },
    data: {
      status:     newStatus,
      finishedAt: new Date(),
      errorMsg:   action === 'cancel' ? 'ยกเลิกโดยผู้ใช้' : null,
    },
  })

  return NextResponse.json({ ok: true, job: { id: updated.id, status: updated.status } })
}, ['admin', 'editor'])
