# Ecom Ventures - Local Development Orchestrator
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting Ecom Ventures Local Services   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Start PostgreSQL if not already running on 5432
$pgConn = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
if (-not $pgConn) {
    Write-Host "[1/5] Starting PostgreSQL (port 5432)..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\ZKBioTime\pgsql\bin\postgres.exe" -ArgumentList "-D", "C:\Users\IMRAN\ecom_pg_data" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/5] PostgreSQL is already running on port 5432." -ForegroundColor Green
}

# 2. Start Redis if not already running on 6380
$redisConn = Get-NetTCPConnection -LocalPort 6380 -ErrorAction SilentlyContinue
if (-not $redisConn) {
    Write-Host "[2/5] Starting Redis (port 6380)..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\ZKBioTime\redis\redis-server.exe" -ArgumentList "--port", "6380", "--requirepass", "redis_secure_password_2026" -WindowStyle Hidden
    Start-Sleep -Seconds 1
} else {
    Write-Host "[2/5] Redis is already running on port 6380." -ForegroundColor Green
}

# 3. Start Backend API & Worker
Write-Host "[3/5] Starting Backend API & Worker..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd backend; .\api.exe" -WorkingDirectory (Get-Location)
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd backend; .\worker.exe" -WorkingDirectory (Get-Location)

# 4. Start Frontends
Write-Host "[4/5] Starting Frontend Apps..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "npm run dev --workspace=apps/master-admin" -WorkingDirectory (Get-Location)
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "npm run dev --workspace=apps/store-admin" -WorkingDirectory (Get-Location)
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd apps/storefront; npx next dev -p 3002" -WorkingDirectory (Get-Location)

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  All Ecom Ventures servers launched!     " -ForegroundColor Green
Write-Host "  - Master Admin: http://localhost:5173   " -ForegroundColor Green
Write-Host "  - Store Admin:  http://localhost:5174   " -ForegroundColor Green
Write-Host "  - Storefront:   http://localhost:3002   " -ForegroundColor Green
Write-Host "  - Backend API:  http://localhost:8080   " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

