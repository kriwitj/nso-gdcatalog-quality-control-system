# AGENTS.md — GDCatalog Quality Control System

ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus  
สำหรับ Open Government Data (OGD) ของสำนักงานสถิติจังหวัดสระบุรี

---

## สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [Tech Stack](#tech-stack)
- [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
- [API Routes](#api-routes)
- [Library Files](#library-files)
- [Database Schema](#database-schema)
- [Authentication & RBAC](#authentication--rbac)
- [Export CSV/XLSX](#export-csvxlsx)
- [Docker & Deployment](#docker--deployment)
- [Environment Variables](#environment-variables)

---

## ภาพรวมระบบ

ระบบ 3 ชั้น (Three-tier) สำหรับตรวจสอบคุณภาพข้อมูลเปิดภาครัฐ (Open Government Data):

```
CKAN API → [Collector] → PostgreSQL → [Analyzer Worker] → [Dashboard]
                          ↑                    ↑
                       Next.js API          Redis Queue
```

**5 มิติคุณภาพ:**

| มิติ | น้ำหนัก | รายละเอียด |
|------|---------|-----------|
| Completeness | 20% | ความสมบูรณ์ของ Metadata (ชื่อ, คำอธิบาย, tag, license) |
| Timeliness | 20% | ความทันสมัยเทียบกับ updateFrequency |
| Accessibility | 15% | ดาวน์โหลดได้จริง + HTTP status |
| Machine Readable | 20% | รูปแบบไฟล์ CSV/JSON/XLSX vs PDF/DOC |
| Validity | 25% | ความถูกต้องของตาราง (Frictionless Framework) |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend/Backend | Next.js (App Router) | 15+ |
| Language | TypeScript | 5.3 |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 3.x |
| Export | SheetJS (xlsx) | 0.18.x |
| ORM | Prisma | 7.0 |
| DB Driver | @prisma/adapter-pg (pg) | 7.0 / 8.x |
| Database | PostgreSQL | 16 |
| Queue | Redis | 7 |
| Auth | JWT (jsonwebtoken) + bcryptjs | — |
| Worker | Python 3.11 + Frictionless | — |
| Reverse Proxy | Traefik (via proxy_net) | — |
| Container | Docker + Compose | 24+ |
| Testing | Jest + Playwright | — |

---

## โครงสร้างโปรเจค

```
ogd-quality-windows/
├── apps/
│   ├── web/                         # Next.js application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/             # API Route Handlers
│   │   │   │   │   ├── auth/        # login, refresh, logout, me, change-password
│   │   │   │   │   ├── datasets/    # list + detail + export
│   │   │   │   │   │   ├── route.ts          # GET /api/datasets (paginated)
│   │   │   │   │   │   ├── [id]/route.ts     # GET /api/datasets/:id
│   │   │   │   │   │   └── export/route.ts   # GET /api/datasets/export (no pagination)
│   │   │   │   │   ├── resources/   # detail + recent checks
│   │   │   │   │   ├── jobs/        # scan job tracking + queue status
│   │   │   │   │   ├── stats/       # dashboard statistics
│   │   │   │   │   ├── sync/        # trigger CKAN sync
│   │   │   │   │   ├── scan/        # trigger quality scan
│   │   │   │   │   ├── orgs/        # organization list
│   │   │   │   │   └── admin/       # users, ckan-sources, org hierarchy, audit
│   │   │   │   ├── dashboard/       # ภาพรวม (charts + stats)
│   │   │   │   ├── datasets/        # list + [id] detail (ปุ่ม export CSV/XLSX)
│   │   │   │   ├── resources/       # [id] detail (ปุ่ม export CSV/XLSX)
│   │   │   │   ├── jobs/            # scan job status
│   │   │   │   ├── settings/        # user account settings
│   │   │   │   ├── admin/           # users, ckan-sources, org, audit
│   │   │   │   ├── login/           # หน้าเข้าสู่ระบบ
│   │   │   │   ├── _components/     # PortalShell, ThemeProvider, ConfirmDialog
│   │   │   │   ├── layout.tsx       # Root layout (ThemeProvider)
│   │   │   │   └── page.tsx         # Landing page
│   │   │   └── lib/
│   │   │       ├── auth.ts          # JWT sign/verify, bcrypt
│   │   │       ├── withAuth.ts      # Route guard (RBAC)
│   │   │       ├── prisma.ts        # Prisma singleton client
│   │   │       ├── apiClient.ts     # Browser fetch + token refresh
│   │   │       ├── ckan.ts          # CKAN API client
│   │   │       ├── queue.ts         # Redis queue operations
│   │   │       ├── scoring.ts       # Grade/color/label formatters
│   │   │       ├── audit.ts         # Audit log helper
│   │   │       └── downloadFile.ts  # CSV / XLSX export utilities (SheetJS)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Data models
│   │   │   └── seed.ts              # Initial data seed
│   │   ├── prisma.config.ts         # Prisma v7 config (datasource URL)
│   │   ├── .dockerignore            # exclude .next, node_modules, .swc
│   │   ├── .npmrc                   # legacy-peer-deps=true
│   │   ├── Dockerfile               # Dev Dockerfile
│   │   ├── Dockerfile.prod          # Multi-stage production build
│   │   └── tailwind.config.ts       # darkMode: 'class'
│   └── worker/                      # Python quality checker
│       └── Dockerfile.prod
├── docker-compose.yml               # Development stack
├── docker-compose.windows.yml       # Windows override
├── docker-compose.prod.yml          # Production stack
├── .github/workflows/
│   └── deploy-supportdata.yml       # GitHub Actions CI/CD
├── README.md                        # คู่มือภาพรวม
├── README-WINDOWS.md                # คู่มือ Windows dev
└── AGENTS.md                        # This file
```

---

## API Routes

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login → accessToken + refresh_token cookie |
| POST | `/api/auth/refresh` | cookie | รับ accessToken ใหม่ (token rotation) |
| POST | `/api/auth/logout` | — | ลบ refresh token |
| GET | `/api/auth/me` | Bearer | ข้อมูล user + CKAN sources ที่เข้าถึงได้ |
| POST | `/api/auth/change-password` | Bearer | เปลี่ยนรหัสผ่าน |

### Data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats` | Bearer | Dashboard overview (grade dist, top/low datasets, queue) |
| GET | `/api/datasets` | Bearer | รายการชุดข้อมูล (paginated, filterable, sortable) |
| GET | `/api/datasets/[id]` | — | รายละเอียดชุดข้อมูล + resources + score history |
| GET | `/api/datasets/export` | Bearer | Export ทุก dataset + resources ตาม filter (ไม่ paginate) |
| GET | `/api/resources/[id]` | — | รายละเอียด resource + 10 recent checks |
| GET | `/api/orgs` | — | รายชื่อองค์กรทั้งหมด |

**Query params สำหรับ `/api/datasets` และ `/api/datasets/export`:**  
`page` (list เท่านั้น), `search`, `grade` (A/B/C/D/F), `orgId`, `scoreType`, `minScore`, `structured` (yes/no), `mrStatus`, `sort` (field_asc/desc)

### Operations

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/sync` | Bearer | admin, editor | Sync datasets จาก CKAN |
| GET | `/api/sync` | — | — | สถานะ sync (counts) |
| POST | `/api/scan` | Bearer | admin, editor | Enqueue quality checks |
| GET | `/api/jobs` | Bearer | any | รายการ scan jobs (100 ล่าสุด) |
| GET | `/api/jobs/[id]` | Bearer | any | Job detail |
| PATCH | `/api/jobs/[id]` | Bearer | admin | Force complete/cancel job |
| GET | `/api/jobs/queue` | Bearer | any | Redis queue lengths |

**POST `/api/scan` body options:**
```json
{}                          // full scan (all datasets in scope)
{ "datasetId": "..." }      // single dataset
{ "resourceId": "..." }     // single resource
```

### Admin (admin role only)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/admin/users` | จัดการผู้ใช้ |
| GET/PATCH/DELETE | `/api/admin/users/[id]` | แก้ไข/ลบผู้ใช้ |
| GET/POST | `/api/admin/ckan-sources` | จัดการ CKAN Sources |
| GET/PATCH/DELETE | `/api/admin/ckan-sources/[id]` | แก้ไข/ลบ source |
| GET/POST | `/api/admin/org` | จัดการ Ministry |
| GET/POST | `/api/admin/org/[type]` | Department/Division/Group |
| GET/PATCH/DELETE | `/api/admin/org/[type]/[id]` | แก้ไข/ลบ org |
| GET | `/api/admin/audit` | Audit log |

---

## Library Files

### `lib/auth.ts`
ฟังก์ชัน JWT + password สำหรับ server-side:
- `hashPassword(plain)` — bcrypt hash (12 rounds)
- `verifyPassword(plain, hash)` — bcrypt compare
- `signAccessToken(payload)` — JWT 15m (JWT_ACCESS_SECRET)
- `signRefreshToken(payload)` — JWT 7d (JWT_REFRESH_SECRET)
- `verifyAccessToken(token)` — verify + decode
- `verifyRefreshToken(token)` — verify + decode
- `extractBearerToken(req)` — parse Authorization header

### `lib/withAuth.ts`
Higher-order route wrapper สำหรับ RBAC:
```typescript
// ใช้งาน:
export const GET = withAuth(async (req, { user, params }) => { ... }, ['admin'])
export const POST = withAuth<{ id: string }>(handler)  // typed params
```
- ตรวจ Bearer token → verify JWT → enforce role whitelist → resolve Next.js Promise params

### `lib/prisma.ts`
Singleton PrismaClient พร้อม pg adapter:
```typescript
// Prisma v7 requires driver adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
new PrismaClient({ adapter })
```

### `lib/apiClient.ts`
Browser-side fetch wrapper:
- Auto-attach `Authorization: Bearer <token>` จาก localStorage
- **Proactive refresh**: รีเฟรช token ถ้าจะหมดอายุใน 60 วินาที
- **Singleton refresh promise**: ป้องกัน race condition เมื่อหลาย request ส่งพร้อมกัน
- **401 recovery**: ลอง refresh แล้ว retry อัตโนมัติ
- Redirect `/login` เมื่อ refresh ล้มเหลว

### `lib/downloadFile.ts`
Client-side export utilities (ใช้ SheetJS):
- `downloadCSV(rows, filename)` — สร้าง CSV พร้อม UTF-8 BOM รองรับภาษาไทย
- `downloadXLSX(sheets, filename)` — สร้าง XLSX หลาย sheets ด้วย `xlsx.utils.json_to_sheet`

### `lib/ckan.ts`
CKAN API client:
- `fetchAllPackages(source)` — paginate + retry (exponential backoff)
- `fetchPackage(source, name)` — single package detail
- รองรับ API key authentication

### `lib/queue.ts`
Redis queue operations:
- `enqueueResourceCheck(resourceId, jobId)` — ส่ง worker ตรวจ resource
- `enqueueScoreCalc(datasetId, jobId)` — คำนวณ score หลัง check เสร็จ
- `getQueueLengths()` — ความยาว queue ปัจจุบัน

### `lib/scoring.ts`
Formatting utilities (Thai labels):
- `scoreToGrade(score)` → A/B/C/D/F/?
- `gradeColor(grade)` → Tailwind badge classes
- `timelinessLabel/Color(status)` → Thai text + classes
- `machineReadableLabel/Color(status)` → Thai text + classes
- `structuredLabel(status)` → Thai text
- `severityColor/Label(severity)` → classes + Thai text
- `fmt(score, digits?)` → formatted number string
- `scoreBarColor(score)` → Tailwind color class

### `lib/audit.ts`
```typescript
logAudit(userId, action, entity, entityId, detail, ip)
// Records to AuditLog table
```

---

## Database Schema

### Core Data

```
Dataset (ckanId unique)
├── title, name, notes, license, tags[], groups[]
├── updateFrequency, metadataCreated, metadataModified
├── resourceCount, isOpen
├── completenessScore, timelinessScore, accessibilityScore,
│   machineReadableScore, validityScore, overallScore (0-100)
├── qualityGrade (A/B/C/D/F/?)
├── machineReadableStatus, timelinessStatus
├── lastScanAt, lastScanStatus, scanErrorMsg
└── FK: organizationId, ckanSourceId

Resource (ckanId unique)
├── name, description, format, url
├── size (bytes), mimeType, hash
├── metadataModified
└── FK: packageId (Dataset)

ResourceCheck
├── httpStatus, downloadable, contentType, fileSize
├── detectedFormat, isMachineReadable, isStructured, structuredStatus
├── timelinessStatus, encoding, rowCount, columnCount
├── isValid, errorCount, warningCount, partialScan
├── scanDurationMs, errorMsg
└── FK: resourceId, scanJobId

ValidityReport (1:1 with ResourceCheck)
├── Error counts: blankHeader, duplicateHeader, blankRow,
│   extraValue, extraHeader, missingValue, formatError,
│   schemaError, encodingError, sourceError
├── severity (ok/low/medium/high/critical)
├── primaryIssue, encoding, valid
└── rawJson (full Frictionless report)

ScanJob
├── type (full/resource/catalog_sync)
├── status (pending/running/done/error)
├── totalItems, doneItems, errorItems
├── startedAt, finishedAt, errorMsg
└── FK: datasetId (nullable), triggeredBy (userId)

QualityScoreHistory
├── scores snapshot (all 5 + overall + grade)
├── recordedAt
└── FK: datasetId

Organization (from CKAN)
└── ckanId, name, title, description, imageUrl
```

### Organizational Hierarchy

```
Ministry
  └── Department (FK: ministryId)
        └── Division (FK: departmentId)
              └── Group (FK: divisionId)

CkanSource
├── name, url (unique), apiKey, isActive
└── scope: ministryId | departmentId | divisionId (optional)
```

### Auth & RBAC

```
User
├── username (unique), email (unique), passwordHash
├── role (admin | editor | viewer)
├── isActive
├── scope: ministryId | departmentId | divisionId | groupId
└── relations: refreshTokens[]

RefreshToken
├── token (unique), expiresAt
└── FK: userId (cascade delete)

AuditLog
├── action (CREATE/UPDATE/DELETE)
├── entity (User/CkanSource/Ministry/etc.)
├── entityId, detail (JSON), ip
└── FK: userId
```

---

## Authentication & RBAC

### Flow

```
1. Login
   POST /api/auth/login { username, password }
   → bcryptjs.compare → signAccessToken (15m) + signRefreshToken (7d)
   → DB: save RefreshToken
   → Response: { accessToken } + Set-Cookie: refresh_token (httpOnly)

2. Authenticated Request
   Authorization: Bearer <accessToken>
   → withAuth() → jwt.verify → extract { userId, role }

3. Proactive Refresh (apiClient.ts)
   isExpiringSoon(token) = exp < now + 60s
   → POST /api/auth/refresh (cookie auto-sent)
   → new accessToken → localStorage + retry original request

4. 401 Recovery
   → POST /api/auth/refresh
   → success: retry request | fail: redirect /login

5. Logout
   POST /api/auth/logout
   → DB: delete RefreshToken
   → Clear cookie + localStorage
```

### RBAC Permissions

| Role | Dataset Access | Sync/Scan | Admin Panel |
|------|---------------|-----------|-------------|
| **admin** | ทั้งหมด | ทุก source | ✓ ทั้งหมด |
| **editor** | เฉพาะ Division ตัวเอง | เฉพาะ Division | ✗ |
| **viewer** | เฉพาะ Division ตัวเอง (read-only) | ✗ | ✗ |

**Data scoping:** Non-admin users เห็นเฉพาะ datasets จาก CkanSource ที่อยู่ใน Division ของตน

---

## Export CSV/XLSX

ระบบรองรับ export ข้อมูลคุณภาพ 3 จุด:

### `/datasets` — รายการชุดข้อมูล
- **⬇ CSV**: resource rows ทุก dataset ตาม filter (มีคอลัมน์ชุดข้อมูล + หน่วยงาน)
- **⬇ XLSX**: 2 sheets — `ชุดข้อมูล` (สรุปคะแนนทุกมิติ) + `ทรัพยากร` (latest check ทุก field)
- ดึงจาก `/api/datasets/export` — **ไม่จำกัด pagination**

### `/datasets/:id` — รายละเอียดชุดข้อมูล
- **⬇ CSV**: resource rows ของชุดข้อมูลนั้น
- **⬇ XLSX**: 2 sheets — `สรุปชุดข้อมูล` + `ทรัพยากร`

### `/resources/:id` — รายละเอียด resource
- **⬇ รายงาน CSV/XLSX**: ประวัติ check ทุกครั้ง พร้อม validity report (error counts ทุกประเภท)
- แยกจากปุ่ม "ดาวน์โหลดไฟล์" ที่ link ไปยังต้นฉบับ

### `/api/datasets/export`
```
GET /api/datasets/export?search=...&grade=A&sort=overallScore_desc
Authorization: Bearer <token>

Response: { data: DatasetWithResources[], total: number }
```
- ใช้ filter เดียวกับ `/api/datasets` ยกเว้น `page`
- `data[].resources[]` มี `checks[0]` (latest check) + `validityReport` พร้อมใช้

---

## Docker & Deployment

### Dev Dockerfile (`apps/web/Dockerfile`)

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**จุดสำคัญ:**
- `COPY package*.json .npmrc ./` — copy `.npmrc` เพื่อให้ `npm ci` อ่าน `legacy-peer-deps=true`
- Dummy `DATABASE_URL` ใช้เฉพาะ `prisma generate` build step (ไม่ connect จริง)
- `.dockerignore` exclude `.next`, `node_modules`, `.swc` ป้องกัน Windows path issue

### Production Dockerfile (`apps/web/Dockerfile.prod`)

```
Stage 1: deps    → npm ci
Stage 2: builder → prisma generate + npm run build (.next/standalone)
Stage 3: runner  → copy standalone + full node_modules (สำหรับ prisma CLI)
                   user: nextjs (uid 1001), port: 3000
                   CMD: node server.js
```

> **หมายเหตุ:** ต้อง copy full `node_modules` (ไม่ใช่ selective) เพราะ `prisma migrate deploy` ต้องการ `effect` package

### docker-compose Services

| Service | Image | Role |
|---------|-------|------|
| postgres | postgres:16-alpine | Primary DB (volume: pgdata) |
| redis | redis:7-alpine | Job queue + cache (volume: redisdata) |
| web | Dockerfile | Next.js app + Prisma migrations |
| worker | apps/worker/Dockerfile | Python quality checker |
| nginx | nginx:alpine | Reverse proxy (dev) |

**Web startup command (dev):**
```sh
npx prisma migrate deploy && npm run dev
```

**Networks (prod):**
- `internal` — postgres, redis, web, worker
- `proxy_net` — Traefik external network

### CI/CD (GitHub Actions)

`.github/workflows/deploy-supportdata.yml`:
1. Checkout code
2. `rsync` ไฟล์ไป deploy directory
3. Write `.env` จาก GitHub Secrets
4. `docker compose -f docker-compose.prod.yml up -d --build`

---

## Environment Variables

```env
# Database
POSTGRES_USER=ogd
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=ogdquality
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# Redis
REDIS_PASSWORD=<strong-password>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# JWT
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CKAN (default source)
CKAN_BASE_URL=https://catalog.example.go.th
CKAN_API_KEY=                          # optional

# Worker
MAX_FILE_SIZE_MB=100
MAX_ROWS=200000
WORKER_CONCURRENCY=3
DOWNLOAD_TIMEOUT=60

# App
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
DOMAIN=ogd.yourdomain.go.th
```

---

## Prisma v7 Notes

Prisma v7 ใช้ driver adapter — ต้องมี `prisma.config.ts` และ **ไม่มี** `url =` ใน `schema.prisma`:

```typescript
// prisma.config.ts
import { defineConfig, env } from "prisma/config"
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
})
```

```typescript
// lib/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })
```

---

*Updated: 2026-04-22*
