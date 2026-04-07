import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/org/:type/:id
export const DELETE = withAuth(async (_req: NextRequest, { params, user: caller }) => {
  try {
    let name = ''

    switch (params.type) {
      case 'ministries': {
        const item = await prisma.ministry.findUnique({ where: { id: params.id } })
        if (!item) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
        name = item.name
        await prisma.ministry.delete({ where: { id: params.id } })
        break
      }
      case 'departments': {
        const item = await prisma.department.findUnique({ where: { id: params.id } })
        if (!item) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
        name = item.name
        await prisma.department.delete({ where: { id: params.id } })
        break
      }
      case 'divisions': {
        const item = await prisma.division.findUnique({ where: { id: params.id } })
        if (!item) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
        name = item.name
        await prisma.division.delete({ where: { id: params.id } })
        break
      }
      case 'groups': {
        const item = await prisma.group.findUnique({ where: { id: params.id } })
        if (!item) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
        name = item.name
        await prisma.group.delete({ where: { id: params.id } })
        break
      }
      default:
        return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
    }

    await logAudit({ userId: caller.userId, action: 'DELETE', entity: params.type, entityId: params.id, detail: { name } })
    return NextResponse.json({ message: 'ลบเรียบร้อยแล้ว' })
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return NextResponse.json({ error: 'ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่เชื่อมโยงอยู่' }, { status: 409 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}, ['admin'])
