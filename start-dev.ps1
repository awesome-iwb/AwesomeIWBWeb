# Awesome IWB Development Environment Launcher
# This script starts both frontend and backend services

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Awesome IWB Dev Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check bun installation
try {
    $bunVersion = bun --version
    Write-Host "OK Bun version: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR Bun not found. Install from https://bun.sh" -ForegroundColor Red
    exit 1
}

# Get project root
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"

Write-Host "Project root: $projectRoot" -ForegroundColor Gray
Write-Host ""

# Install backend dependencies
Write-Host "[1/4] Checking backend dependencies..." -ForegroundColor Yellow
Set-Location $backendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "      Installing backend dependencies..." -ForegroundColor Gray
    bun install
} else {
    Write-Host "      OK Backend dependencies ready" -ForegroundColor Green
}

# Install frontend dependencies
Write-Host "[2/4] Checking frontend dependencies..." -ForegroundColor Yellow
Set-Location $frontendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "      Installing frontend dependencies..." -ForegroundColor Gray
    bun install
} else {
    Write-Host "      OK Frontend dependencies ready" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/4] Starting backend service (port 8080)..." -ForegroundColor Yellow

# Start backend (background job)
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    bun run dev
} -ArgumentList $backendDir

# Wait for backend to start
Start-Sleep -Seconds 3
$backendOutput = Receive-Job -Job $backendJob -Keep
if ($backendOutput -match "Elysia is running") {
    Write-Host "      OK Backend service started" -ForegroundColor Green
} else {
    Write-Host "      WARN Backend still starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[4/4] Starting frontend service (port 5173)..." -ForegroundColor Yellow
Write-Host ""

# Show access URLs
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

# Start frontend (foreground, blocking)
try {
    Set-Location $frontendDir
    bun run dev -- --host 0.0.0.0 --port 5173
} finally {
    # Cleanup backend process
    Write-Host ""
    Write-Host "Stopping backend service..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
    Write-Host "OK Cleaned up" -ForegroundColor Green
}
