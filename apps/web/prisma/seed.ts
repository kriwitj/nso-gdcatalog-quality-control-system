import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ─── Admin user ───────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existing) {
    console.log('ผู้ใช้ admin มีอยู่แล้ว — ข้ามขั้นตอนนี้')
  } else {
    const passwordHash = await bcrypt.hash('Admin@1234', 12)
    const admin = await prisma.user.create({
      data: {
        username:     'admin',
        email:        'admin@ogd.local',
        passwordHash,
        role:         'admin',
      },
    })
    console.log(`สร้างผู้ใช้ admin เรียบร้อย (id: ${admin.id})`)
    console.log('รหัสผ่านเริ่มต้น: Admin@1234 — กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก')
    console.log('')
    console.log('หมายเหตุ: CKAN Source ต้องกำหนดผ่าน Admin UI → /admin/ckan-sources')
    console.log('และกำหนดให้แต่ละ ศูนย์/กอง ผ่าน Admin UI → /admin/org')
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
