# TASK — Auth Module + Org Hierarchy + Landing Page + Export + Docker Fixes

## สถานะ: ✅ Phase 1 + Phase 2 + Phase 3 (Export + Docker) เสร็จแล้ว

---

## Phase 1 ✅ — MVP

| งาน | สถานะ |
|-----|-------|
| Catalog sync จาก CKAN API | ✅ |
| Resource check (HTTP, format, downloadable) | ✅ |
| Tabular validation (CSV/XLSX) ด้วย Frictionless | ✅ |
| Quality scoring 5 มิติ (Completeness/Timeliness/Accessibility/MR/Validity) | ✅ |
| Dashboard + drill-down | ✅ |
| JWT Auth module (login / refresh token rotation / logout / me) | ✅ |

---

## Phase 2 ✅ — RBAC + Admin UI

### 2.1 JWT Auth Module
- Login / Refresh (token rotation) / Logout / Me / Change-password
- Refresh token เก็บใน httpOnly cookie + DB
- Token rotation ทุก refresh — ป้องกัน token reuse

### 2.2 RBAC โครงสร้างองค์กร
User ผูกกับหน่วยงานได้ 4 ระดับ:
- **กระทรวง** → `Ministry`
- **กรม** → `Department`
- **ศูนย์/กอง** → `Division`
- **กลุ่ม** → `Group`

### 2.3 CkanSource Management
- ย้าย CKAN URL จาก .env ไปจัดการใน DB
- รองรับหลาย source พร้อมกัน + ผูกกับหน่วยงาน

### 2.4 Scope-based Data Access
- Non-admin เห็นเฉพาะ dataset ของ Division ตัวเอง
- filter ใน `datasets/route.ts`, `stats/route.ts`, `sync/route.ts`

### 2.5 Admin UI
| งาน | ไฟล์หลัก |
|-----|----------|
| Users CRUD | `/admin/users` + `/api/admin/users` |
| CkanSources CRUD | `/admin/ckan-sources` + `/api/admin/ckan-sources` |
| Org Hierarchy | `/admin/org` + `/api/admin/org/[type]/[id]` |
| Audit Log | `/admin/audit` + `/api/admin/audit` |
| เปลี่ยนรหัสผ่าน | `/settings` + `/api/auth/change-password` |

### 2.6 Client-side Token Management
- `lib/apiClient.ts` — proactive refresh (60s ก่อน expire) + singleton promise + 401 recovery

---

## Phase 3 ✅ — Export CSV/XLSX + Docker Fixes

### 3.1 Export ข้อมูลคุณภาพ

**ไฟล์ที่สร้าง/แก้ไข:**

```
apps/web/src/
├── lib/downloadFile.ts                    ← NEW: downloadCSV() + downloadXLSX()
├── app/datasets/page.tsx                  ← เพิ่มปุ่ม ⬇ CSV / ⬇ XLSX + handleDownload()
├── app/datasets/[id]/page.tsx             ← เพิ่มปุ่ม ⬇ CSV / ⬇ XLSX
├── app/resources/[id]/page.tsx            ← เพิ่มปุ่ม ⬇ รายงาน CSV / XLSX
└── app/api/datasets/export/route.ts       ← NEW: GET /api/datasets/export
```

**รายละเอียด:**

| หน้า | CSV | XLSX |
|------|-----|------|
| `/datasets` | resource rows ทุก dataset ตาม filter | 2 sheets: ชุดข้อมูล + ทรัพยากร |
| `/datasets/:id` | resource rows ของชุดนั้น | 2 sheets: สรุปชุดข้อมูล + ทรัพยากร |
| `/resources/:id` | ประวัติ check + validity report | 1 sheet: ผลการตรวจสอบ |

**`/api/datasets/export`:**
- filter เดียวกับ `/api/datasets` ยกเว้น `page`
- ดึง dataset ทั้งหมด + resources + latest check ใน **query เดียว**
- ไม่จำกัด pagination — ส่ง **ทุกชุดข้อมูลที่ตรงกับ filter**

### 3.2 Docker Fixes (Windows dev)

| ปัญหา | สาเหตุ | แก้ไข |
|-------|--------|--------|
| `invalid file request .next/node_modules/@prisma/...` | `.next` ถูก copy เข้า build context | สร้าง `apps/web/.dockerignore` |
| `npm install` fail (peer deps) | `xlsx` conflict กับ React 19 | สร้าง `apps/web/.npmrc` (`legacy-peer-deps=true`) |
| `npm install` non-reproducible | Dockerfile copy แค่ `package.json` | เปลี่ยนเป็น `COPY package*.json .npmrc ./` + `npm ci` |
| `prisma generate` fail (ไม่เจอ DATABASE_URL) | `prisma.config.ts` อ่าน env ตอน load | ส่ง dummy URL ใน Dockerfile build step |

---

## Prisma Models ที่เพิ่ม (Phase 2)

| Model | ตาราง | คำอธิบาย |
|-------|-------|----------|
| `Ministry` | `ministries` | กระทรวง |
| `Department` | `departments` | กรม |
| `Division` | `divisions` | ศูนย์/กอง |
| `Group` | `groups` | กลุ่ม |
| `CkanSource` | `ckan_sources` | CKAN instance URL config |
| `User` (updated) | `users` | เพิ่ม FK org hierarchy |
| `RefreshToken` | `refresh_tokens` | token rotation |
| `AuditLog` | `audit_logs` | audit trail |

---

## Dependencies ที่เพิ่ม

| Package | Version | เหตุผล |
|---------|---------|--------|
| `xlsx` | ^0.18.5 | Export CSV/XLSX ฝั่ง client (SheetJS) |

ต้องใช้ `legacy-peer-deps=true` เพราะ `xlsx@0.18.x` peer dep conflict กับ React 19

---

## API Endpoints สรุป

### Auth
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | `/api/auth/login` | public | Login → accessToken + cookie |
| POST | `/api/auth/refresh` | cookie | Token rotation |
| POST | `/api/auth/logout` | cookie | ลบ token |
| GET | `/api/auth/me` | Bearer | ข้อมูล user ปัจจุบัน |
| POST | `/api/auth/change-password` | Bearer | เปลี่ยนรหัสผ่าน |

### Data + Export
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET | `/api/datasets` | Bearer | List (paginated) |
| GET | `/api/datasets/export` | Bearer | Export ทั้งหมดตาม filter |
| GET | `/api/datasets/:id` | public | Detail + resources |
| GET | `/api/resources/:id` | public | Resource + check history |
| GET | `/api/stats` | Bearer | Dashboard stats |
| GET | `/api/orgs` | public | Organization list |

### Operations
| Method | Path | Roles | คำอธิบาย |
|--------|------|-------|----------|
| POST | `/api/sync` | admin, editor | Sync CKAN |
| POST | `/api/scan` | admin, editor | Queue quality check |
| GET | `/api/jobs` | any | Job list |
| GET | `/api/jobs/queue` | any | Queue status |

### Admin
| Method | Path | คำอธิบาย |
|--------|------|----------|
| * | `/api/admin/users` | User CRUD |
| * | `/api/admin/ckan-sources` | CKAN source CRUD |
| * | `/api/admin/org/[type]` | Org hierarchy CRUD |
| GET | `/api/admin/audit` | Audit log |

---

## RBAC

| Role | ดูข้อมูล | Sync | Scan | Admin | เปลี่ยนรหัส |
|------|----------|------|------|-------|------------|
| admin | ทั้งหมด | ✅ | ✅ | ✅ | ✅ |
| editor | Division | ✅ | ✅ | ❌ | ✅ |
| viewer | Division | ❌ | ❌ | ❌ | ✅ |

---

## คำสั่ง Migration + Seed

```bash
# Migration (อัตโนมัติตอน container start หรือ manual)
docker compose exec web npx prisma migrate deploy

# Seed: admin user + default CkanSource
docker compose exec web npm run db:seed
# username: admin | password: Admin@1234
```

---

## Environment Variables ที่ต้องตั้ง

```env
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
DATABASE_URL=postgresql://ogd:${POSTGRES_PASSWORD}@postgres:5432/ogdquality
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```
