# OGD Quality System — คู่มือสำหรับ Windows

## ข้อกำหนดระบบ

| รายการ          | ขั้นต่ำ                    | แนะนำ    |
|----------------|---------------------------|---------|
| Windows        | 10 (64-bit, build 19041+) | 11      |
| RAM            | 4 GB                      | 8 GB   |
| Disk           | 10 GB ว่าง                | 20 GB  |
| WSL2           | ต้องเปิด                   | —       |
| Docker Desktop | 4.x ขึ้นไป                 | ล่าสุด  |

---

## ขั้นตอนที่ 1 — เปิดใช้ WSL2

เปิด PowerShell ในฐานะ Administrator:

```powershell
wsl --install
# รีสตาร์ทเครื่อง
```

ตรวจสอบ:
```powershell
wsl --status
# ต้องขึ้น Default Version: 2
```

---

## ขั้นตอนที่ 2 — ติดตั้ง Docker Desktop

1. ดาวน์โหลดจาก https://www.docker.com/products/docker-desktop/
2. ติดตั้ง → เลือก **Use WSL2 instead of Hyper-V**
3. รีสตาร์ทเครื่อง
4. เปิด Docker Desktop → รอไฟเขียว **Running**

ทดสอบ:
```powershell
docker --version
docker compose version
```

---

## ขั้นตอนที่ 3 — ตั้งค่า Environment

```powershell
cd ogd-quality
copy .env.example .env
```

เปิด `.env` แก้ไขค่าต่อไปนี้:

```env
POSTGRES_PASSWORD=<strong_password>
REDIS_PASSWORD=<strong_password>

JWT_ACCESS_SECRET=<random_hex_32>
JWT_REFRESH_SECRET=<random_hex_32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

สร้าง random secret ด้วย PowerShell:
```powershell
# รัน 2 ครั้ง สำหรับ ACCESS และ REFRESH
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

---

## ขั้นตอนที่ 4 — รันระบบ

```powershell
docker compose up -d --build
```

หรือใช้ helper script:
```powershell
.\ogd.ps1 dev
```

ถ้าขึ้น error "cannot be loaded because running scripts is disabled":
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

รอ ~2–3 นาที (ครั้งแรก download images)

---

## ขั้นตอนที่ 5 — Migration + Seed

```powershell
# รัน migration (อัตโนมัติตอน startup หรือ manual)
docker compose exec web npx prisma migrate deploy

# สร้าง admin user
docker compose exec web npm run db:seed
# username: admin | password: Admin@1234
```

เปิด http://localhost:3000

---

## การใช้งาน helper script

```powershell
.\ogd.ps1 dev      # เริ่มระบบ
.\ogd.ps1 open     # เปิด browser
.\ogd.ps1 sync     # ดึงข้อมูลจาก CKAN (ต้อง login ก่อน)
.\ogd.ps1 scan     # ตรวจสอบคุณภาพ (ต้อง login ก่อน)
.\ogd.ps1 stats    # ดูสถิติ
.\ogd.ps1 logs     # ดู log
.\ogd.ps1 down     # หยุดระบบ
.\ogd.ps1 backup   # สำรองฐานข้อมูล
```

### ทดสอบ Auth API ด้วย PowerShell

```powershell
# Login
$res = Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"Admin@1234"}'
$token = $res.accessToken

# ดูข้อมูล user
Invoke-RestMethod -Uri http://localhost:3000/api/auth/me `
  -Headers @{ Authorization = "Bearer $token" }

# Sync จาก CKAN
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/sync `
  -Headers @{ Authorization = "Bearer $token" }

# Logout
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/logout
```

---

## ปัญหาที่พบบ่อยบน Windows

### Docker build ล้มเหลว: `invalid file request .next/node_modules/@prisma/...`

สาเหตุ: `.next` folder ถูก copy เข้า Docker build context  
แก้ไข: ไฟล์ `apps/web/.dockerignore` ต้องมีอยู่ (มีแล้วใน repo)

```
node_modules
.next
.swc
coverage
```

### Docker build ล้มเหลว: `npm install` peer deps error

สาเหตุ: `xlsx` package มี peer dep conflict กับ React 19  
แก้ไข: ไฟล์ `apps/web/.npmrc` มี `legacy-peer-deps=true` แล้ว — Dockerfile ใช้ `npm ci` ซึ่งอ่านค่านี้อัตโนมัติ

### Docker build ล้มเหลว: `prisma generate` หาไม่เจอ DATABASE_URL

สาเหตุ: `prisma.config.ts` อ่าน env var ตอน load  
แก้ไข: Dockerfile ส่ง dummy URL ขณะ build step แล้ว — ไม่ต้องแก้ไข

### Docker Desktop ไม่เริ่ม
- เปิด Virtualization ใน BIOS (Intel VT-x / AMD-V)
- Task Manager → Performance → CPU → Virtualization: **Enabled**

### Port 3000 ถูกใช้อยู่
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Docker Desktop ใช้ RAM เยอะ
สร้าง `C:\Users\<username>\.wslconfig`:
```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
```
แล้วรัน `wsl --shutdown`

### Line ending (CRLF vs LF)
```powershell
git config --global core.autocrlf false
git clone <repo> --config core.autocrlf=false
```

### Prisma migrate ไม่ทำงาน
```powershell
docker compose exec web npx prisma generate
docker compose exec web npx prisma migrate deploy
```

---

## ข้อแตกต่างจาก Linux/Mac

| ฟีเจอร์        | Windows                  | Linux/Mac       |
|---------------|--------------------------|-----------------|
| helper script | `.\ogd.ps1 <cmd>`        | `make <cmd>`    |
| backup script | PowerShell (ใน ogd.ps1) | bash            |
| deploy script | ไม่รองรับ (ใช้บน server) | `deploy.sh`     |
| performance   | ช้ากว่าเล็กน้อย (~10-20%) | baseline       |

---

## Production บน Windows Server

**ไม่แนะนำ** ให้รัน production บน Windows โดยตรง  
แนะนำใช้ Linux VPS (Ubuntu 22.04) และ deploy ด้วย `scripts/deploy.sh`
