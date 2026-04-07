# TASK — Auth Module + Org Hierarchy + Landing Page

## สถานะ: ✅ Phase 1 + Phase 2 เสร็จแล้ว

---

## ขอบเขตงาน

### 1. JWT Auth Module
- Login / Refresh (token rotation) / Logout / Me / Change-password
- Refresh token เก็บใน httpOnly cookie + DB
- Token rotation ทุก refresh — ป้องกัน token reuse

### 2. RBAC โครงสร้างองค์กร
User สามารถผูกกับหน่วยงานได้ 4 ระดับ (เลือกระดับที่เหมาะสมอย่างเดียว):
- **กระทรวง** → `Ministry`
- **กรม** → `Department` (อยู่ใต้ Ministry)
- **ศูนย์/กอง** → `Division` (อยู่ใต้ Department)
- **กลุ่ม** → `Group` (อยู่ใต้ Division)

### 3. URL Config (CkanSource)
- ย้าย CKAN URL จาก .env ไปจัดการใน DB
- รองรับหลาย source พร้อมกัน
- ผูก source กับหน่วยงานได้ (Ministry/Department/Division)
- Sync API รองรับ `sourceId` เพื่อ sync เฉพาะ source ที่ต้องการ

### 4. Landing Page
- `/` → Landing page สาธารณะ (ไม่มี sidebar)
- `/login` → หน้า Login
- `/dashboard` → Dashboard portal (ต้อง login ถึงจะ sync/scan ได้)

---

## Prisma Models ที่เพิ่ม/แก้ไข

| Model          | ตาราง            | คำอธิบาย                                            |
|----------------|------------------|-----------------------------------------------------|
| `Ministry`     | `ministries`     | กระทรวง                                             |
| `Department`   | `departments`    | กรม (ใต้กระทรวง)                                    |
| `Division`     | `divisions`      | ศูนย์/กอง (ใต้กรม)                                  |
| `Group`        | `groups`         | กลุ่ม (ใต้ศูนย์/กอง)                                |
| `CkanSource`   | `ckan_sources`   | URL config สำหรับ CKAN instance แต่ละแห่ง           |
| `User`         | `users`          | เพิ่ม FK: ministryId/departmentId/divisionId/groupId |
| `RefreshToken` | `refresh_tokens` | เหมือนเดิม (rotation เมื่อ refresh)                  |

---

## API Endpoints

### Auth
| Method | Path                           | Auth    | คำอธิบาย                                    |
|--------|--------------------------------|---------|----------------------------------------------|
| POST   | `/api/auth/login`              | public  | รับ username+password → คืน accessToken + cookie |
| POST   | `/api/auth/refresh`            | cookie  | Rotate refresh token → คืน accessToken ใหม่ |
| POST   | `/api/auth/logout`             | cookie  | ลบ DB record + clear cookie                  |
| GET    | `/api/auth/me`                 | Bearer  | ข้อมูลผู้ใช้ปัจจุบัน                          |
| POST   | `/api/auth/change-password`    | Bearer  | เปลี่ยนรหัสผ่าน + เพิกถอน token ทั้งหมด      |

### Admin (ต้อง role=admin)
| Method | Path                              | คำอธิบาย                     |
|--------|-----------------------------------|------------------------------|
| GET    | `/api/admin/users`                | รายชื่อผู้ใช้                 |
| POST   | `/api/admin/users`                | สร้างผู้ใช้ใหม่               |
| GET    | `/api/admin/users/:id`            | ดูผู้ใช้                      |
| PATCH  | `/api/admin/users/:id`            | แก้ไขผู้ใช้ (role, org, etc.) |
| DELETE | `/api/admin/users/:id`            | ลบผู้ใช้                      |
| GET    | `/api/admin/ckan-sources`         | รายการ CKAN sources           |
| POST   | `/api/admin/ckan-sources`         | เพิ่ม CKAN source ใหม่        |
| PATCH  | `/api/admin/ckan-sources/:id`     | แก้ไข CKAN source             |
| DELETE | `/api/admin/ckan-sources/:id`     | ลบ CKAN source                |

### Protected (admin/editor)
| Method | Path         | คำอธิบาย                                           |
|--------|--------------|----------------------------------------------------|
| POST   | `/api/sync`  | ซิงค์จาก CKAN (รองรับ `sourceId` ใน body)          |
| POST   | `/api/scan`  | ตรวจสอบคุณภาพ                                       |

---

## โครงสร้างไฟล์ที่สร้าง/แก้ไข

```
apps/web/
├── prisma/
│   ├── schema.prisma                          ← เพิ่ม Ministry/Dept/Div/Group/CkanSource, อัปเดต User
│   ├── migrations/
│   │   ├── 0002_add_auth/migration.sql        ← users + refresh_tokens
│   │   └── 0003_add_org_hierarchy/migration.sql ← org hierarchy + ckan_sources + alter users
│   └── seed.ts                                ← seed admin user + default CkanSource
│
├── src/
│   ├── lib/
│   │   ├── auth.ts         ← JWT sign/verify + bcrypt
│   │   ├── withAuth.ts     ← Route protection helper (withAuth(handler, roles?))
│   │   └── ckan.ts         ← รับ { baseUrl, apiKey } แบบ dynamic
│   │
│   └── app/
│       ├── layout.tsx      ← Root layout (bare — ไม่มี sidebar)
│       ├── page.tsx        ← Landing page สาธารณะ
│       ├── login/page.tsx  ← Login form
│       ├── _components/
│       │   └── PortalShell.tsx ← Sidebar + user info + logout
│       ├── dashboard/
│       │   ├── layout.tsx  ← wraps PortalShell
│       │   └── page.tsx    ← Dashboard
│       ├── datasets/layout.tsx  ← wraps PortalShell
│       ├── jobs/layout.tsx      ← wraps PortalShell
│       ├── resources/layout.tsx ← wraps PortalShell
│       └── api/
│           ├── auth/
│           │   ├── login/route.ts
│           │   ├── refresh/route.ts      ← token rotation
│           │   ├── logout/route.ts
│           │   ├── me/route.ts
│           │   └── change-password/route.ts
│           ├── admin/
│           │   ├── users/route.ts
│           │   ├── users/[id]/route.ts
│           │   ├── ckan-sources/route.ts
│           │   └── ckan-sources/[id]/route.ts
│           ├── sync/route.ts  ← ป้องกัน POST, รองรับ sourceId
│           └── scan/route.ts  ← ป้องกัน POST
```

---

## RBAC — การกำหนดสิทธิ์

| Role     | Sync | Scan | Admin API | Change Password |
|----------|------|------|-----------|-----------------|
| `admin`  | ✅   | ✅   | ✅        | ✅ (ตัวเอง)     |
| `editor` | ✅   | ✅   | ❌        | ✅ (ตัวเอง)     |
| `viewer` | ❌   | ❌   | ❌        | ✅ (ตัวเอง)     |

**Scope การจัดการ** (Phase 2): User ที่มี `divisionId` จะเห็น/จัดการเฉพาะ Dataset ของ division นั้น

---

## Environment variables ที่ต้องใส่

```env
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## คำสั่งรัน Migration + Seed

```bash
# Migration รันอัตโนมัติตอน docker compose up
# หรือ manual:
docker compose exec web npx prisma migrate deploy

# Seed: สร้าง admin user + default CkanSource
docker compose exec web npm run db:seed
# username: admin | password: Admin@1234
```

---

## Phase 2 — เสร็จแล้ว ✅

| งาน | ไฟล์หลัก |
|-----|----------|
| Scope-based query (filter dataset ตาม division/dept) | `datasets/route.ts`, `stats/route.ts`, `sync/route.ts` + migration `0004` |
| Admin UI — Users | `/admin/users` + `GET\|POST\|PATCH\|DELETE /api/admin/users` |
| Admin UI — CkanSources | `/admin/ckan-sources` + `/api/admin/ckan-sources` |
| Admin UI — Org Hierarchy | `/admin/org` + `/api/admin/org/[type]/[id]` |
| Admin UI — Audit Log | `/admin/audit` + `/api/admin/audit` |
| หน้าเปลี่ยนรหัสผ่าน | `/settings` |
| Refresh token auto-renewal (client) | `src/lib/apiClient.ts` |
| Audit log backend | `src/lib/audit.ts` + model `AuditLog` |

### Migration รัน Phase 2:
```bash
docker compose exec web npx prisma migrate deploy
```

### โครงสร้างไฟล์ที่เพิ่ม (Phase 2):
```
apps/web/
├── prisma/migrations/0004_phase2/migration.sql
├── src/lib/
│   ├── audit.ts        ← logAudit() helper
│   └── apiClient.ts    ← apiFetch() with auto token refresh
└── src/app/
    ├── admin/
    │   ├── layout.tsx          ← wraps PortalShell + admin guard
    │   ├── page.tsx            ← redirect → /admin/users
    │   ├── users/page.tsx      ← CRUD ผู้ใช้
    │   ├── ckan-sources/page.tsx ← CRUD CKAN sources
    │   ├── org/page.tsx        ← จัดการโครงสร้างองค์กร
    │   └── audit/page.tsx      ← ดู audit log
    ├── settings/
    │   ├── layout.tsx
    │   └── page.tsx            ← หน้าเปลี่ยนรหัสผ่าน
    └── api/admin/
        ├── org/route.ts              ← GET full hierarchy
        ├── org/[type]/route.ts       ← POST create
        ├── org/[type]/[id]/route.ts  ← DELETE
        └── audit/route.ts            ← GET logs
```
