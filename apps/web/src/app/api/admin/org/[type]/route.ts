import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/withAuth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST /api/admin/org/:type — สร้างหน่วยงาน
// type = ministries | departments | divisions | groups
export const POST = withAuth(async (req: NextRequest, { params, user: caller }) => {
  const body = await req.json()
  const { name, code, parentId } = body as { name?: string; code?: string; parentId?: string }

  if (!name) return NextResponse.json({ error: 'กรุณาระบุชื่อหน่วยงาน' }, { status: 400 })

  try {
    let item: { id: string; name: string }

    switch (params.type) {
      case 'ministries':
        item = await prisma.ministry.create({ data: { name, code: code || null } })
        break
      case 'departments':
        if (!parentId) return NextResponse.json({ error: 'กรุณาระบุ ministryId' }, { status: 400 })
        item = await prisma.department.create({ data: { name, code: code || null, ministryId: parentId } })
        break
      case 'divisions':
        if (!parentId) return NextResponse.json({ error: 'กรุณาระบุ departmentId' }, { status: 400 })
        item = await prisma.division.create({ data: { name, code: code || null, departmentId: parentId } })
        break
      case 'groups':
        if (!parentId) return NextResponse.json({ error: 'กรุณาระบุ divisionId' }, { status: 400 })
        item = await prisma.group.create({ data: { name, code: code || null, divisionId: parentId } })
        break
      default:
        return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
    }

    await logAudit({ userId: caller.userId, action: 'CREATE', entity: params.type, entityId: item.id, detail: { name } })
    return NextResponse.json({ item }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') return NextResponse.json({ error: 'ชื่อนี้มีอยู่แล้ว' }, { status: 409 })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}, ['admin'])
