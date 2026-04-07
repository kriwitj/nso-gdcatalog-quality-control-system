# OGD Quality System — คู่มือสำหรับ Windows

## ข้อกำหนดระบบ

| รายการ         | ขั้นต่ำ               | แนะนำ              |
|---------------|----------------------|-------------------|
| Windows       | 10 (64-bit, build 19041+) | 11               |
| RAM           | 4 GB                 | 8 GB              |
| Disk          | 10 GB ว่าง           | 20 GB             |
| WSL2          | ต้องเปิด              | -                 |
| Docker Desktop| 4.x ขึ้นไป            | ล่าสุด            |

---

## ขั้นตอนที่ 1 — เปิดใช้ WSL2

เปิด PowerShell ในฐานะ Administrator แล้วรัน:

```powershell
wsl --install
# รีสตาร์ทเครื่อง
```

ถ้าติดตั้ง WSL2 แล้ว ตรวจสอบด้วย:
```powershell
wsl --status
# ต้องขึ้น Default Version: 2
```

---

## ขั้นตอนที่ 2 — ติดตั้ง Docker Desktop

1. ดาวน์โหลดจาก https://www.docker.com/products/docker-desktop/
2. ติดตั้ง → เลือก **Use WSL2 instead of Hyper-V** (สำคัญ)
3. รีสตาร์ทเครื่อง
4. เปิด Docker Desktop → รอให้ Engine status ขึ้น **Running** (ไฟเขียว)

ทดสอบ:
```powershell
docker --version
docker compose version
```

---

## ขั้นตอนที่ 3 — ตั้งค่า Environment

```powershell
# แตกไฟล์ zip แล้ว cd เข้าไป
cd ogd-quality

# สร้าง .env
copy .env.example .env
```

เปิด `.env` แล้วแก้ไขค่าต่อไปนี้ให้ครบ:

```env
POSTGRES_PASSWORD=<strong_password>
REDIS_PASSWORD=<strong_password>

# สร้าง JWT secrets (ใช้ https://www.uuidgenerator.net/ หรือ PowerShell ด้านล่าง)
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

## ขั้นตอนที่ 4 — ติดตั้งและรันระบบ

```powershell
# รันด้วย PowerShell script (แทน make)
.\ogd.ps1 dev
```

ถ้าขึ้น error "cannot be loaded because running scripts is disabled":
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# แล้วรัน .\ogd.ps1 dev อีกครั้ง
```

รอ ~2–3 นาที (ครั้งแรก download images)

---

## ขั้นตอนที่ 5 — สร้าง admin user

```powershell
docker compose exec web npm run db:seed
# username: admin | password: Admin@1234
```

เปิด http://localhost:3000

---

## การใช้งานปกติ

```powershell
.\ogd.ps1 dev      # เริ่มระบบ
.\ogd.ps1 open     # เปิด browser
.\ogd.ps1 sync     # ดึงข้อมูลจาก CKAN
.\ogd.ps1 scan     # ตรวจสอบคุณภาพ
.\ogd.ps1 stats    # ดูสถิติ
.\ogd.ps1 logs     # ดู log
.\ogd.ps1 down     # หยุดระบบ
.\ogd.ps1 backup   # สำรองฐานข้อมูล
```

### ทดสอบ Auth API

```powershell
# Login
$res = Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"Admin@1234"}'
$token = $res.accessToken

# ดูข้อมูล user
Invoke-RestMethod -Uri http://localhost:3000/api/auth/me `
  -Headers @{ Authorization = "Bearer $token" }

# Logout
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/logout
```

---

## ปัญหาที่พบบ่อยบน Windows

### Docker Desktop ไม่เริ่ม
- ตรวจสอบว่า Virtualization เปิดอยู่ใน BIOS (Intel VT-x / AMD-V)
- ใน Task Manager → Performance → CPU → Virtualization: **Enabled**

### Port 3000 ถูกใช้อยู่แล้ว
```powershell
# หา process ที่ใช้ port 3000
netstat -ano | findstr :3000
# kill ด้วย PID ที่เจอ
taskkill /PID <PID> /F
```

### Docker Desktop ใช้ RAM เยอะเกินไป
สร้างไฟล์ `C:\Users\<username>\.wslconfig`:
```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
```
แล้วรัน `wsl --shutdown` ใน PowerShell

### Line ending (CRLF vs LF)
ถ้า git clone แล้ว scripts ใน `apps/worker/*.py` มีปัญหา:
```powershell
git config --global core.autocrlf false
git clone <repo> --config core.autocrlf=false
```

### Prisma migrate ไม่ทำงาน
```powershell
docker compose exec web npx prisma generate
docker compose exec web npx prisma migrate deploy
```

### JWT_ACCESS_SECRET / JWT_REFRESH_SECRET ยังไม่ได้ตั้ง
ถ้า login แล้วได้ 500 ให้ตรวจสอบว่า `.env` มีค่า `JWT_ACCESS_SECRET` และ `JWT_REFRESH_SECRET` แล้วรัน:
```powershell
docker compose up -d --force-recreate web
```

---

## ข้อแตกต่างจาก Linux/Mac

| ฟีเจอร์               | Windows                    | Linux/Mac     |
|----------------------|----------------------------|---------------|
| คำสั่ง helper         | `.\ogd.ps1 <cmd>`          | `make <cmd>`  |
| script backup         | PowerShell (ใน ogd.ps1)   | bash          |
| script deploy         | ไม่รองรับ (ใช้บน server)   | `deploy.sh`   |
| performance           | เล็กน้อยช้ากว่า (~10-20%) | baseline      |
| path separator        | `\` (Docker จัดการให้)    | `/`           |

---

## Production บน Windows Server

**ไม่แนะนำ** ให้รัน production บน Windows Server ตรงๆ แนะนำให้:
1. เช่า Linux VPS (Ubuntu 22.04) จาก AWS / Azure / DigitalOcean
2. ใช้ `scripts/deploy.sh` บน server นั้น
3. เครื่อง Windows ใช้เป็น dev/test เท่านั้น

หรือถ้าต้องการ Windows Server จริงๆ ใช้ Docker Desktop for Windows Server ได้เช่นกัน
