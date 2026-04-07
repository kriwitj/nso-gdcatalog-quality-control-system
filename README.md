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

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind CSS                |
| Charts     | Recharts                                            |
| Auth       | JWT (jsonwebtoken + bcryptjs), httpOnly cookie      |
| Database   | PostgreSQL 16 + Prisma ORM                          |
| Queue      | Redis 7                                             |
| Worker     | Python 3.11 + Frictionless + psycopg2               |
| Proxy      | Nginx                                               |
| Container  | Docker + Docker Compose                             |

---

## การติดตั้งและรันระบบ

### ข้อกำหนด

- Docker Engine ≥ 24
- Docker Compose ≥ 2.20
- RAM ≥ 2GB (แนะนำ 4GB สำหรับ production)
- CPU ≥ 2 cores

---

### 1. Development (เครื่อง local)

```bash
# Clone project
git clone <repo-url> ogd-quality
cd ogd-quality

# สร้าง .env จาก template
cp .env.example .env
# แก้ไขค่าต่างๆ โดยเฉพาะ POSTGRES_PASSWORD, REDIS_PASSWORD
# และสร้าง JWT secrets (ดูรายละเอียดใน "JWT Secrets" ด้านล่าง)

# เริ่มระบบทั้งหมด
make dev

# เปิดดู log
make logs

# เปิด browser
open http://localhost:3000
```

### 2. JWT Secrets

ต้องตั้งค่าใน `.env` ก่อนรัน (สร้างด้วย `openssl rand -hex 32`):

```env
JWT_ACCESS_SECRET=<random_hex_32_chars>
JWT_REFRESH_SECRET=<random_hex_32_chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 3. รัน DB migration ครั้งแรก (ถ้า web container ไม่ทำให้อัตโนมัติ)

```bash
make migrate
```

### 4. สร้าง admin user เริ่มต้น

```bash
docker compose exec web npm run db:seed
# username: admin / password: Admin@1234 (เปลี่ยนหลังเข้าระบบครั้งแรก)
```

### 5. ซิงค์ข้อมูลจาก CKAN ครั้งแรก

```bash
make sync
# หรือ
curl -X POST http://localhost:3000/api/sync
```

### 6. ตรวจสอบคุณภาพ

```bash
make scan
# หรือ
curl -X POST http://localhost:3000/api/scan
```

---

## Production Deployment

### บน Server (Ubuntu 22.04 แนะนำ)

```bash
# 1. Clone
git clone <repo-url> /opt/ogd-quality
cd /opt/ogd-quality

# 2. สร้าง .env — ใส่ค่าจริงทั้งหมด
cp .env.example .env
nano .env

# 3. ตั้ง SSL (ต้อง point domain มาที่ server ก่อน)
export DOMAIN=ogd.yourdomain.go.th
export CERT_EMAIL=admin@yourdomain.go.th
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh

# 4. Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Crontab สำหรับ SSL renewal และ backup

```cron
# SSL renewal (รายเดือน)
0 3 1 * * cd /opt/ogd-quality && certbot renew --quiet && cp /etc/letsencrypt/live/${DOMAIN}/*.pem nginx/certs/ && docker compose -f docker-compose.prod.yml restart nginx

# Database backup (ทุกคืน)
0 1 * * * cd /opt/ogd-quality && ./scripts/backup-db.sh >> /var/log/ogd-backup.log 2>&1
```

---

## ตัวชี้วัดคุณภาพ

| มิติ                      | น้ำหนัก | คำอธิบาย                                    |
|---------------------------|---------|---------------------------------------------|
| Metadata Completeness     | 20%     | ชื่อ, คำอธิบาย, tag, license, org, ความถี่  |
| Timeliness                | 20%     | เปรียบเทียบ last_modified vs update_freq    |
| Accessibility             | 15%     | ดาวน์โหลดได้ / ไม่ได้                       |
| Machine Readable          | 20%     | CSV/XLSX/JSON/XML vs PDF/DOC                |
| Validity                  | 25%     | Frictionless validation report              |

### เกรดคุณภาพ

| เกรด | คะแนน     |
|------|-----------|
| A    | 90–100    |
| B    | 75–89     |
| C    | 60–74     |
| D    | 40–59     |
| F    | 0–39      |

---

### Machine Readable Status

ระบบกำหนด status จาก format ของทรัพยากรที่ดาวน์โหลดได้จริง (HTTP 200) เท่านั้น

| Status | ค่า DB | เงื่อนไข |
|--------|--------|----------|
| อ่านได้ทั้งหมด | `fully_machine_readable` | format อยู่ใน MACHINE_READABLE_FORMATS ทั้งหมด: `csv, tsv, json, jsonl, geojson, xml, xlsx, xls, ods, parquet, avro, ndjson` |
| อ่านได้บางส่วน | `partially_machine_readable` | format เป็น `zip` (อาจมีไฟล์ machine-readable ข้างใน แต่ยังไม่แตก) หรือ format ที่มีโครงสร้างบางส่วน เช่น `kml, gpkg, gml` |
| อ่านไม่ได้ | `not_machine_readable` | format อยู่ใน UNSTRUCTURED_FORMATS: `pdf, doc, docx, ppt, pptx, jpg, jpeg, png, gif, mp4` |
| ไม่ทราบ | `unknown` | HTTP ไม่ใช่ 200/206 (เช่น 404, 403), connect ไม่ได้, format เป็น API/WMS/WFS/Database ที่ตรวจสอบด้วยไฟล์ไม่ได้ หรือ format ไม่รู้จัก |

> **หมายเหตุ**: ถ้า HTTP status ไม่ใช่ 200/206 (เช่น 404) ระบบจะ**ไม่**สรุปจาก format ที่ประกาศไว้ใน metadata เพราะไม่สามารถยืนยันได้

---

### Timeliness Status

ระบบเปรียบเทียบวันที่แก้ไขล่าสุด (`metadata_modified`) กับความถี่การอัปเดต (`update_frequency`) ของชุดข้อมูล

| Status | ค่า DB | เงื่อนไข |
|--------|--------|----------|
| ทันสมัย | `up_to_date` | จำนวนวันนับตั้งแต่ `metadata_modified` ≤ ค่า warn threshold ตามความถี่ |
| ใกล้หมด | `warning` | เกิน warn threshold แต่ยังไม่เกิน outdated threshold |
| ล้าสมัย | `outdated` | จำนวนวันเกิน outdated threshold ตามความถี่ |
| ไม่ทราบ | `unknown` | ไม่มี `metadata_modified` หรือ parse วันที่ไม่ได้ |

**Threshold ตามความถี่การอัปเดต**:

| ความถี่ | ทันสมัย (≤ วัน) | ใกล้หมด (≤ วัน) | หมายเหตุ |
|---------|----------------|----------------|---------|
| รายวัน / daily | 2 | 7 | เกิน 7 วัน = ล้าสมัย |
| รายสัปดาห์ / weekly | 10 | 21 | เกิน 21 วัน = ล้าสมัย |
| รายเดือน / monthly | 45 | 90 | เกิน 90 วัน = ล้าสมัย |
| รายไตรมาส / quarterly | 100 | 120 | เกิน 120 วัน = ล้าสมัย |
| รายปี / yearly | 400 | 550 | เกิน 550 วัน = ล้าสมัย |
| ไม่ระบุ / อื่นๆ | 180 | 365 | ใช้ค่า default |

---

## API Reference

### Auth

| Method | Path                    | คำอธิบาย                                              |
|--------|-------------------------|-------------------------------------------------------|
| POST   | `/api/auth/login`       | เข้าสู่ระบบ → คืน `accessToken` + set cookie          |
| POST   | `/api/auth/refresh`     | รับ access token ใหม่ (ใช้ refresh_token cookie)      |
| POST   | `/api/auth/logout`      | ออกจากระบบ + ลบ refresh token                         |
| GET    | `/api/auth/me`          | ข้อมูลผู้ใช้ปัจจุบัน (ต้องใส่ `Authorization: Bearer`) |

### Data

| Method | Path                  | คำอธิบาย                        |
|--------|-----------------------|---------------------------------|
| GET    | `/api/stats`          | สถิติภาพรวม                     |
| GET    | `/api/datasets`       | รายการชุดข้อมูล (paginated)     |
| GET    | `/api/datasets/:id`   | รายละเอียดชุดข้อมูล              |
| GET    | `/api/resources/:id`  | รายละเอียดทรัพยากร               |
| POST   | `/api/sync`           | ดึงข้อมูลจาก CKAN               |
| POST   | `/api/scan`           | เริ่มตรวจสอบคุณภาพ               |
| GET    | `/api/jobs`           | รายการ scan jobs                |
| GET    | `/api/jobs/queue`     | ความยาวคิว Redis                |

---

## Roadmap

### Phase 1 ✅ (MVP)
- Catalog sync จาก CKAN API
- Resource check (HTTP, format, downloadable)
- Tabular validation (CSV/XLSX) ด้วย Frictionless
- Quality scoring 5 มิติ
- Dashboard + drill-down
- JWT Auth module (login / refresh / logout)

### Phase 2
- [ ] Middleware ป้องกัน `/api/sync` และ `/api/scan` ให้ต้องเป็น admin
- [ ] หน้า Login UI
- [ ] Endpoint เปลี่ยนรหัสผ่าน (`POST /api/auth/change-password`)
- [ ] Endpoint จัดการผู้ใช้ (`/api/admin/users`)
- [ ] Alert ทาง email / LINE Notify เมื่อคะแนนต่ำกว่า threshold
- [ ] Export report PDF/Excel
- [ ] Score trend graph 90 วัน

### Phase 3
- [ ] Schema registry — กำหนด schema มาตรฐานราย dataset
- [ ] Custom validation rules ราย organization
- [ ] Recommendation engine แนะนำการปรับปรุง
- [ ] OpenAPI + webhook สำหรับระบบ governance

---

## Troubleshooting

```bash
# ดู log ของ service เฉพาะ
docker compose logs -f worker
docker compose logs -f web

# เข้าไปใน container
docker compose exec web sh
docker compose exec worker bash

# ตรวจสอบคิว Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD LLEN ogd:queue:resource_check

# ล้างคิว (กรณีค้าง)
docker compose exec redis redis-cli -a $REDIS_PASSWORD DEL ogd:queue:resource_check

# Prisma Studio (UI สำหรับดู DB)
make studio

# Reset และเริ่มใหม่
docker compose down -v  # ⚠️ ลบ data ทั้งหมด
make dev
```
