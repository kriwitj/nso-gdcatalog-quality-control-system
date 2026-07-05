import { PrismaClient } from '@prisma/client'
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── ข้อมูลสำนักงานสถิติจังหวัด 76 จังหวัด ─────────────────────────
const PROVINCES: { name: string; slug: string }[] = [
  { name: 'สำนักงานสถิติจังหวัดกระบี่',           slug: 'krabi' },
  { name: 'สำนักงานสถิติจังหวัดกาญจนบุรี',        slug: 'kanchanaburi' },
  { name: 'สำนักงานสถิติจังหวัดกาฬสินธุ์',        slug: 'kalasin' },
  { name: 'สำนักงานสถิติจังหวัดกำแพงเพชร',        slug: 'kamphaengphet' },
  { name: 'สำนักงานสถิติจังหวัดขอนแก่น',          slug: 'khonkaen' },
  { name: 'สำนักงานสถิติจังหวัดจันทบุรี',         slug: 'chanthaburi' },
  { name: 'สำนักงานสถิติจังหวัดฉะเชิงเทรา',       slug: 'chachoengsao' },
  { name: 'สำนักงานสถิติจังหวัดชลบุรี',           slug: 'chonburi' },
  { name: 'สำนักงานสถิติจังหวัดชัยนาท',           slug: 'chainat' },
  { name: 'สำนักงานสถิติจังหวัดชัยภูมิ',          slug: 'chaiyaphum' },
  { name: 'สำนักงานสถิติจังหวัดชุมพร',            slug: 'chumphon' },
  { name: 'สำนักงานสถิติจังหวัดเชียงราย',         slug: 'chiangrai' },
  { name: 'สำนักงานสถิติจังหวัดเชียงใหม่',        slug: 'chiangmai' },
  { name: 'สำนักงานสถิติจังหวัดตรัง',             slug: 'trang' },
  { name: 'สำนักงานสถิติจังหวัดตราด',             slug: 'trat' },
  { name: 'สำนักงานสถิติจังหวัดตาก',              slug: 'tak' },
  { name: 'สำนักงานสถิติจังหวัดนครนายก',          slug: 'nakhonnayok' },
  { name: 'สำนักงานสถิติจังหวัดนครปฐม',           slug: 'nakhonpathom' },
  { name: 'สำนักงานสถิติจังหวัดนครพนม',           slug: 'nakhonphanom' },
  { name: 'สำนักงานสถิติจังหวัดนครราชสีมา',       slug: 'nakhonratchasima' },
  { name: 'สำนักงานสถิติจังหวัดนครศรีธรรมราช',    slug: 'nakhonsithammarat' },
  { name: 'สำนักงานสถิติจังหวัดนครสวรรค์',        slug: 'nakhonsawan' },
  { name: 'สำนักงานสถิติจังหวัดนนทบุรี',          slug: 'nonthaburi' },
  { name: 'สำนักงานสถิติจังหวัดนราธิวาส',         slug: 'narathiwat' },
  { name: 'สำนักงานสถิติจังหวัดน่าน',             slug: 'nan' },
  { name: 'สำนักงานสถิติจังหวัดบึงกาฬ',           slug: 'buengkan' },
  { name: 'สำนักงานสถิติจังหวัดบุรีรัมย์',        slug: 'buriram' },
  { name: 'สำนักงานสถิติจังหวัดปทุมธานี',         slug: 'pathumthani' },
  { name: 'สำนักงานสถิติจังหวัดประจวบคีรีขันธ์',  slug: 'prachuapkhirikhan' },
  { name: 'สำนักงานสถิติจังหวัดปราจีนบุรี',       slug: 'prachinburi' },
  { name: 'สำนักงานสถิติจังหวัดปัตตานี',          slug: 'pattani' },
  { name: 'สำนักงานสถิติจังหวัดพระนครศรีอยุธยา',  slug: 'phranakhonsiayutthaya' },
  { name: 'สำนักงานสถิติจังหวัดพะเยา',            slug: 'phayao' },
  { name: 'สำนักงานสถิติจังหวัดพังงา',            slug: 'phangnga' },
  { name: 'สำนักงานสถิติจังหวัดพัทลุง',           slug: 'phatthalung' },
  { name: 'สำนักงานสถิติจังหวัดพิจิตร',           slug: 'phichit' },
  { name: 'สำนักงานสถิติจังหวัดพิษณุโลก',         slug: 'phitsanulok' },
  { name: 'สำนักงานสถิติจังหวัดเพชรบุรี',         slug: 'phetchaburi' },
  { name: 'สำนักงานสถิติจังหวัดเพชรบูรณ์',        slug: 'phetchabun' },
  { name: 'สำนักงานสถิติจังหวัดแพร่',             slug: 'phrae' },
  { name: 'สำนักงานสถิติจังหวัดภูเก็ต',           slug: 'phuket' },
  { name: 'สำนักงานสถิติจังหวัดมหาสารคาม',        slug: 'mahasarakham' },
  { name: 'สำนักงานสถิติจังหวัดมุกดาหาร',         slug: 'mukdahan' },
  { name: 'สำนักงานสถิติจังหวัดแม่ฮ่องสอน',       slug: 'maehongson' },
  { name: 'สำนักงานสถิติจังหวัดยโสธร',            slug: 'yasothon' },
  { name: 'สำนักงานสถิติจังหวัดยะลา',             slug: 'yala' },
  { name: 'สำนักงานสถิติจังหวัดร้อยเอ็ด',         slug: 'roiet' },
  { name: 'สำนักงานสถิติจังหวัดระนอง',            slug: 'ranong' },
  { name: 'สำนักงานสถิติจังหวัดระยอง',            slug: 'rayong' },
  { name: 'สำนักงานสถิติจังหวัดราชบุรี',          slug: 'ratchaburi' },
  { name: 'สำนักงานสถิติจังหวัดลพบุรี',           slug: 'lopburi' },
  { name: 'สำนักงานสถิติจังหวัดลำปาง',            slug: 'lampang' },
  { name: 'สำนักงานสถิติจังหวัดลำพูน',            slug: 'lamphun' },
  { name: 'สำนักงานสถิติจังหวัดเลย',              slug: 'loei' },
  { name: 'สำนักงานสถิติจังหวัดศรีสะเกษ',         slug: 'sisaket' },
  { name: 'สำนักงานสถิติจังหวัดสกลนคร',           slug: 'sakonnakhon' },
  { name: 'สำนักงานสถิติจังหวัดสงขลา',            slug: 'songkhla' },
  { name: 'สำนักงานสถิติจังหวัดสตูล',             slug: 'satun' },
  { name: 'สำนักงานสถิติจังหวัดสมุทรปราการ',      slug: 'samutprakan' },
  { name: 'สำนักงานสถิติจังหวัดสมุทรสงคราม',      slug: 'samutsongkhram' },
  { name: 'สำนักงานสถิติจังหวัดสมุทรสาคร',        slug: 'samutsakhon' },
  { name: 'สำนักงานสถิติจังหวัดสระแก้ว',          slug: 'sakaeo' },
  { name: 'สำนักงานสถิติจังหวัดสระบุรี',          slug: 'saraburi' },
  { name: 'สำนักงานสถิติจังหวัดสิงห์บุรี',        slug: 'singburi' },
  { name: 'สำนักงานสถิติจังหวัดสุโขทัย',          slug: 'sukhothai' },
  { name: 'สำนักงานสถิติจังหวัดสุพรรณบุรี',       slug: 'suphanburi' },
  { name: 'สำนักงานสถิติจังหวัดสุราษฎร์ธานี',     slug: 'suratthani' },
  { name: 'สำนักงานสถิติจังหวัดสุรินทร์',         slug: 'surin' },
  { name: 'สำนักงานสถิติจังหวัดหนองคาย',          slug: 'nongkhai' },
  { name: 'สำนักงานสถิติจังหวัดหนองบัวลำภู',      slug: 'nongbualamphu' },
  { name: 'สำนักงานสถิติจังหวัดอ่างทอง',          slug: 'angthong' },
  { name: 'สำนักงานสถิติจังหวัดอำนาจเจริญ',       slug: 'amnatcharoen' },
  { name: 'สำนักงานสถิติจังหวัดอุดรธานี',         slug: 'udonthani' },
  { name: 'สำนักงานสถิติจังหวัดอุตรดิตถ์',        slug: 'uttaradit' },
  { name: 'สำนักงานสถิติจังหวัดอุทัยธานี',        slug: 'uthaithani' },
  { name: 'สำนักงานสถิติจังหวัดอุบลราชธานี',      slug: 'ubonratchathani' },
]

async function main() {
  // ─── Admin user ───────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existing) {
    console.log('ผู้ใช้ admin มีอยู่แล้ว — ข้าม')
  } else {
    const passwordHash = await bcrypt.hash('Admin@1234', 12)
    await prisma.user.create({
      data: { username: 'admin', email: 'admin@ogd.local', passwordHash, role: 'admin' },
    })
    console.log('สร้างผู้ใช้ admin เรียบร้อย (รหัสผ่าน: Admin@1234)')
  }

  // ─── Ministry ─────────────────────────────────────────────────────
  const ministry = await prisma.ministry.upsert({
    where:  { name: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม' },
    create: { name: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม' },
    update: {},
  })
  console.log(`กระทรวง: ${ministry.name}`)

  // ─── Department ───────────────────────────────────────────────────
  const department = await prisma.department.upsert({
    where:  { ministryId_name: { ministryId: ministry.id, name: 'สำนักงานสถิติแห่งชาติ' } },
    create: { ministryId: ministry.id, name: 'สำนักงานสถิติแห่งชาติ' },
    update: {},
  })
  console.log(`กรม: ${department.name}`)

  // ─── Divisions + CKAN Sources ─────────────────────────────────────
  let createdDiv = 0, skippedDiv = 0
  let createdSrc = 0, skippedSrc = 0

  for (const p of PROVINCES) {
    // Division (ศูนย์/กอง)
    const division = await prisma.division.upsert({
      where:  { departmentId_name: { departmentId: department.id, name: p.name } },
      create: { departmentId: department.id, name: p.name },
      update: {},
    })
    const isNewDiv = division.updatedAt.getTime() - division.createdAt.getTime() < 1000
    if (isNewDiv) createdDiv++; else skippedDiv++

    // CKAN Source
    const url = `https://${p.slug}.gdcatalog.go.th`
    const existingSrc = await prisma.ckanSource.findUnique({ where: { url } })
    if (existingSrc) {
      skippedSrc++
    } else {
      await prisma.ckanSource.create({
        data: { name: p.name, url, isActive: true, divisionId: division.id },
      })
      createdSrc++
    }
  }

  console.log(`\nศูนย์/กอง: สร้าง ${createdDiv} รายการ, มีแล้ว ${skippedDiv} รายการ`)
  console.log(`CKAN Sources: สร้าง ${createdSrc} รายการ, มีแล้ว ${skippedSrc} รายการ`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
