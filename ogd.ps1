# ogd.ps1 — Windows helper script (แทน Makefile)
# รันด้วย: .\ogd.ps1 dev | sync | scan | logs | down | stats | backup
param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"

function Write-Header {
    Write-Host ""
    Write-Host "  OGD Quality System" -ForegroundColor Cyan
    Write-Host "  ==================" -ForegroundColor Cyan
    Write-Host ""
}

function Check-Docker {
    try {
        docker info | Out-Null
    } catch {
        Write-Host "❌  Docker ไม่ได้รันอยู่ — กรุณาเปิด Docker Desktop ก่อน" -ForegroundColor Red
        exit 1
    }
}

function Cmd-Dev {
    Check-Docker
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host "✅  สร้าง .env จาก .env.example แล้ว — กรุณาแก้ค่า password ก่อนรัน" -ForegroundColor Yellow
        Write-Host "   notepad .env" -ForegroundColor Gray
        exit 0
    }
    Write-Host "▶  Starting development stack..." -ForegroundColor Green
    docker compose up --build -d
    Write-Host ""
    Write-Host "✅  ระบบพร้อมใช้งาน → http://localhost:3000" -ForegroundColor Green
    Write-Host "   ดู log:  .\ogd.ps1 logs" -ForegroundColor Gray
}

function Cmd-Down {
    Write-Host "▶  Stopping stack..." -ForegroundColor Yellow
    docker compose down
}

function Cmd-Logs {
    docker compose logs -f
}

function Cmd-Ps {
    docker compose ps
}

function Cmd-Sync {
    Write-Host "▶  Triggering CKAN catalog sync..." -ForegroundColor Green
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/sync" -Method POST
    Write-Host ($result | ConvertTo-Json -Depth 3) -ForegroundColor Cyan
}

function Cmd-Scan {
    Write-Host "▶  Triggering quality scan..." -ForegroundColor Green
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method POST
    Write-Host ($result | ConvertTo-Json -Depth 3) -ForegroundColor Cyan
}

function Cmd-Stats {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/stats"
    Write-Host ""
    Write-Host "  ชุดข้อมูล:  $($result.totalDatasets)" -ForegroundColor White
    Write-Host "  ทรัพยากร:   $($result.totalResources)" -ForegroundColor White
    Write-Host "  หน่วยงาน:   $($result.totalOrganizations)" -ForegroundColor White
    if ($result.avgScore) {
        Write-Host "  คะแนนเฉลี่ย: $([math]::Round($result.avgScore, 1)) / 100" -ForegroundColor White
    }
    Write-Host ""
}

function Cmd-Queue {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/queue"
    Write-Host "  Resource queue: $($result.resourceQueue)" -ForegroundColor White
    Write-Host "  Score queue:    $($result.scoreQueue)" -ForegroundColor White
}

function Cmd-Migrate {
    Write-Host "▶  Running DB migration..." -ForegroundColor Green
    docker compose exec web npx prisma migrate dev
}

function Cmd-Studio {
    Write-Host "▶  Opening Prisma Studio..." -ForegroundColor Green
    docker compose exec web npx prisma studio
}

function Cmd-Shell {
    param([string]$Service = "web")
    docker compose exec $Service sh
}

function Cmd-Backup {
    Write-Host "▶  Backing up database..." -ForegroundColor Green
    $date = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "backups"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $file = "$backupDir\ogd_$date.sql"

    # Load .env
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
    $user = $env:POSTGRES_USER ?? "ogd"
    $db   = $env:POSTGRES_DB   ?? "ogdquality"

    docker compose exec -T postgres pg_dump -U $user $db > $file
    Compress-Archive -Path $file -DestinationPath "$file.zip"
    Remove-Item $file
    Write-Host "✅  Backup saved → $file.zip" -ForegroundColor Green
}

function Cmd-Reset {
    Write-Host "⚠️  นี่จะลบ database ทั้งหมด — กด Enter เพื่อยืนยัน หรือ Ctrl+C เพื่อยกเลิก" -ForegroundColor Red
    Read-Host
    docker compose down -v
    Write-Host "✅  Reset เรียบร้อย — รัน .\ogd.ps1 dev เพื่อเริ่มใหม่" -ForegroundColor Green
}

function Cmd-Open {
    Start-Process "http://localhost:3000"
}

function Cmd-Help {
    Write-Header
    Write-Host "  Usage: .\ogd.ps1 <command>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor Yellow
    Write-Host "    dev       เริ่มระบบ (build + start)"
    Write-Host "    down      หยุดระบบ"
    Write-Host "    logs      ดู log แบบ real-time"
    Write-Host "    ps        ดูสถานะ containers"
    Write-Host "    open      เปิด browser"
    Write-Host "    sync      ดึงข้อมูลจาก CKAN"
    Write-Host "    scan      เริ่มตรวจสอบคุณภาพ"
    Write-Host "    stats     ดูสถิติภาพรวม"
    Write-Host "    queue     ดูความยาวคิว Redis"
    Write-Host "    migrate   รัน DB migration"
    Write-Host "    studio    เปิด Prisma Studio (DB UI)"
    Write-Host "    backup    สำรองฐานข้อมูล"
    Write-Host "    reset     ล้าง database ทั้งหมด ⚠️"
    Write-Host ""
}

Write-Header
switch ($Command.ToLower()) {
    "dev"     { Cmd-Dev }
    "down"    { Cmd-Down }
    "logs"    { Cmd-Logs }
    "ps"      { Cmd-Ps }
    "sync"    { Cmd-Sync }
    "scan"    { Cmd-Scan }
    "stats"   { Cmd-Stats }
    "queue"   { Cmd-Queue }
    "migrate" { Cmd-Migrate }
    "studio"  { Cmd-Studio }
    "backup"  { Cmd-Backup }
    "reset"   { Cmd-Reset }
    "open"    { Cmd-Open }
    default   { Cmd-Help }
}
