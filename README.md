# GDCatalog Quality Control System — ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus

ระบบตรวจสอบคุณภาพข้อมูลเปิดภาครัฐจาก `gdcatalog.go.th` แบบ 3 ชั้น:  
**Collector → Analyzer → Dashboard**

---

## สถาปัตยกรรม

```
CKAN API
  └─► Next.js API (Sync)  ─► PostgreSQL (catalog snapshot)
                          ─► Redis Queue
                               └─► Python Workers
                                     ├─ HTTP check
                                     ├─ Format detection
                                     ├─ Frictionless validation
                                     └─► PostgreSQL (results + scores)
Dashboard (Next.js) ◄── PostgreSQL
```

## Tech Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Frontend   | Next.js 15 (App Router), TypeScript 5.3, Tailwind CSS 3.4   |
| Charts     | Recharts 3.x                                                 |
| Export     | SheetJS (xlsx) — CSV / XLSX download                         |
| Auth       | JWT (jsonwebtoken + bcryptjs), httpOnly cookie               |
| ORM        | Prisma 7 + @prisma/adapter-pg                               |
| Database   | PostgreSQL 16                                                |
| Queue      | Redis 7                                                      |
| Worker     | Python 3.11 + Frictionless + psycopg2                       |
| Proxy      | Nginx                                                        |
| Container  | Docker + Docker Compose                                      |

---

## การติดตั้งและรันระบบ

### ข้อกำหนด

- Docker Engine ≥ 24
- Docker Compose ≥ 2.20
- RAM ≥ 2GB (แนะนำ 4GB)

---

### 1. Development

```bash
git clone <repo-url> ogd-quality
cd ogd-quality

cp .env.example .env
# แก้ POSTGRES_PASSWORD, REDIS_PASSWORD, JWT secrets

docker compose up -d --build
```

**Windows:**
```powershell
.\ogd.ps1 dev
```

### 2. JWT Secrets

```env
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

สร้างด้วย PowerShell:
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

### 3. Migration + Seed (ครั้งแรก)

```bash
# Migration รันอัตโนมัติตอน container start
# หรือ manual:
docker compose exec web npx prisma migrate deploy

# สร้าง admin user
docker compose exec web npm run db:seed
# username: admin / password: Admin@1234
```

### 4. ซิงค์และตรวจสอบคุณภาพ

```bash
# ซิงค์ข้อมูลจาก CKAN
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <token>"

# ตรวจสอบคุณภาพ
curl -X POST http://localhost:3000/api/scan \
  -H "Authorization: Bearer <token>"
```

---

## Production Deployment (Linux Server)

```bash
git clone <repo-url> /opt/ogd-quality
cd /opt/ogd-quality
cp .env.example .env && nano .env
./scripts/deploy.sh
```

---

## ตัวชี้วัดคุณภาพ (5 มิติ)

| มิติ                      | น้ำหนัก | คำอธิบาย                                    |
|---------------------------|---------|---------------------------------------------|
| Metadata Completeness     | 20%     | ชื่อ, คำอธิบาย, tag, license, org, ความถี่  |
| Timeliness                | 20%     | เปรียบเทียบ last_modified vs update_freq    |
| Accessibility             | 15%     | ดาวน์โหลดได้ / ไม่ได้                       |
| Machine Readable          | 20%     | CSV/XLSX/JSON/XML vs PDF/DOC                |
| Validity                  | 25%     | Frictionless validation report              |

### เกรดคุณภาพ

| เกรด | คะแนน  |
|------|--------|
| A    | 90–100 |
| B    | 75–89  |
| C    | 60–74  |
| D    | 40–59  |
| F    | 0–39   |

---

## API Reference

### Auth

| Method | Path                         | คำอธิบาย                                      |
|--------|------------------------------|-----------------------------------------------|
| POST   | `/api/auth/login`            | เข้าสู่ระบบ → `accessToken` + refresh cookie  |
| POST   | `/api/auth/refresh`          | รับ token ใหม่ (token rotation)               |
| POST   | `/api/auth/logout`           | ออกจากระบบ + ลบ refresh token                 |
| GET    | `/api/auth/me`               | ข้อมูลผู้ใช้ปัจจุบัน                           |
| POST   | `/api/auth/change-password`  | เปลี่ยนรหัสผ่าน                                |

### Data

| Method | Path                      | Auth   | คำอธิบาย                                      |
|--------|---------------------------|--------|-----------------------------------------------|
| GET    | `/api/stats`              | Bearer | สถิติภาพรวม dashboard                          |
| GET    | `/api/datasets`           | Bearer | รายการชุดข้อมูล (paginated, filterable)        |
| GET    | `/api/datasets/:id`       | public | รายละเอียดชุดข้อมูล + resources + score history|
| GET    | `/api/datasets/export`    | Bearer | Export ทุก dataset + resources (ไม่ paginate)  |
| GET    | `/api/resources/:id`      | public | รายละเอียด resource + check history            |
| GET    | `/api/orgs`               | public | รายชื่อองค์กร                                  |

**Query params สำหรับ `/api/datasets` และ `/api/datasets/export`:**  
`search`, `grade` (A/B/C/D/F), `orgId`, `scoreType`, `minScore`, `structured` (yes/no), `mrStatus`, `sort`

### Operations

| Method | Path              | Roles         | คำอธิบาย                          |
|--------|-------------------|---------------|-----------------------------------|
| POST   | `/api/sync`       | admin, editor | Sync datasets จาก CKAN            |
| GET    | `/api/sync`       | public        | สถานะ sync (counts)               |
| POST   | `/api/scan`       | admin, editor | Enqueue quality checks            |
| GET    | `/api/jobs`       | Bearer        | รายการ scan jobs (100 ล่าสุด)     |
| GET    | `/api/jobs/:id`   | Bearer        | Job detail                        |
| PATCH  | `/api/jobs/:id`   | admin         | Force complete/cancel job         |
| GET    | `/api/jobs/queue` | Bearer        | Redis queue lengths               |

**POST `/api/scan` body:**
```json
{}                        // full scan
{ "datasetId": "..." }    // single dataset
{ "resourceId": "..." }   // single resource
```

### Admin (admin เท่านั้น)

| Method           | Path                            | คำอธิบาย                   |
|------------------|---------------------------------|----------------------------|
| GET/POST         | `/api/admin/users`              | จัดการผู้ใช้                |
| GET/PATCH/DELETE | `/api/admin/users/:id`          | แก้ไข/ลบผู้ใช้              |
| GET/POST         | `/api/admin/ckan-sources`       | จัดการ CKAN Sources         |
| GET/PATCH/DELETE | `/api/admin/ckan-sources/:id`   | แก้ไข/ลบ source             |
| GET/POST         | `/api/admin/org`                | จัดการ Ministry             |
| GET/POST         | `/api/admin/org/:type`          | Department/Division/Group   |
| GET/PATCH/DELETE | `/api/admin/org/:type/:id`      | แก้ไข/ลบ org                |
| GET              | `/api/admin/audit`              | Audit log                   |

---

## ฟีเจอร์ Export CSV/XLSX

### หน้ารายการชุดข้อมูล (`/datasets`)
- ปุ่ม **⬇ CSV** — export resource rows ทุกชุดข้อมูลตาม filter ปัจจุบัน
- ปุ่ม **⬇ XLSX** — 2 sheets: `ชุดข้อมูล` (สรุปคะแนน) + `ทรัพยากร` (ทุก resource + check results)
- ดึงข้อมูลจาก `/api/datasets/export` — **ไม่จำกัด pagination** รวมทุกหน้า

### หน้ารายละเอียดชุดข้อมูล (`/datasets/:id`)
- ปุ่ม **⬇ CSV** — export ตาราง resources ของชุดข้อมูลนั้น
- ปุ่ม **⬇ XLSX** — 2 sheets: `สรุปชุดข้อมูล` + `ทรัพยากร`

### หน้ารายละเอียด resource (`/resources/:id`)
- ปุ่ม **⬇ รายงาน CSV / XLSX** — export ประวัติ check ทุกครั้งพร้อม validity report ครบทุก error type
- แยกจากปุ่ม "ดาวน์โหลดไฟล์" ที่ link ไปยังไฟล์ต้นฉบับ

---

## RBAC

| Role     | ดูข้อมูล | Sync | Scan | Admin | เปลี่ยนรหัส |
|----------|----------|------|------|-------|------------|
| admin    | ทั้งหมด  | ✅   | ✅   | ✅    | ✅         |
| editor   | Division | ✅   | ✅   | ❌    | ✅         |
| viewer   | Division | ❌   | ❌   | ❌    | ✅         |

---

## Troubleshooting

```bash
# ดู log
docker compose logs -f web
docker compose logs -f worker

# ตรวจสอบคิว
docker compose exec redis redis-cli -a $REDIS_PASSWORD LLEN ogd:queue:resource_check

# Prisma
docker compose exec web npx prisma migrate deploy
docker compose exec web npx prisma studio

# Reset (⚠️ ลบ data ทั้งหมด)
docker compose down -v && docker compose up -d --build
```

**ปัญหา `npm install` ใน Docker (peer deps):**  
ไฟล์ `apps/web/.npmrc` มี `legacy-peer-deps=true` แก้ปัญหานี้แล้ว

**ปัญหา `prisma generate` หาไม่เจอ DATABASE_URL ตอน build:**  
Dockerfile ส่ง dummy URL ขณะ build step — ไม่ต้องแก้ไขเพิ่มเติม

**ปัญหา `.next` folder ใน Docker build context:**  
ไฟล์ `apps/web/.dockerignore` exclude `.next`, `node_modules`, `.swc` แล้ว
