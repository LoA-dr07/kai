# Starts the meal-planner backend (FastAPI) and web frontend (Expo) in parallel.
# Usage:  .\start.ps1
# Stop:   Ctrl+C
#
# Requires: Python 3, Node.js / npm

$ErrorActionPreference = "Continue"

$RootDir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $RootDir "backends"
$FrontendDir = Join-Path $RootDir "mobile"
$VenvDir     = Join-Path $BackendDir "venv"

# ── 1. Python virtual environment ────────────────────────────────────────────
if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv $VenvDir
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    & "$VenvDir\Scripts\pip.exe" install -r "$BackendDir\requirements.txt" -q
    Write-Host "Virtual environment ready." -ForegroundColor Green
}

# ── 2. Start backend job ──────────────────────────────────────────────────────
Write-Host "[BACKEND]  Starting FastAPI on http://localhost:8000 ..." -ForegroundColor Blue
$backendJob = Start-Job -Name "Backend" -ScriptBlock {
    param($dir, $venv)
    Set-Location $dir
    & "$venv\Scripts\Activate.ps1"
    uvicorn app.main:app --reload --host 0.0.0.0 2>&1
} -ArgumentList $BackendDir, $VenvDir

# ── 3. Start frontend job ─────────────────────────────────────────────────────
Write-Host "[FRONTEND] Starting Expo web on http://localhost:8081 ..." -ForegroundColor Cyan
$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx expo start --web --non-interactive 2>&1
} -ArgumentList $FrontendDir

Write-Host ""
Write-Host "Both services started. Press Ctrl+C to stop." -ForegroundColor Green
Write-Host ""

# ── 4. Stream logs with prefixes ──────────────────────────────────────────────
try {
    while ($true) {
        Receive-Job $backendJob  | ForEach-Object { Write-Host "[BACKEND]  $_" -ForegroundColor Blue }
        Receive-Job $frontendJob | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor Cyan }

        # Exit loop if both jobs have stopped unexpectedly
        if ($backendJob.State  -eq "Failed") { Write-Host "[BACKEND]  process exited unexpectedly." -ForegroundColor Red }
        if ($frontendJob.State -eq "Failed") { Write-Host "[FRONTEND] process exited unexpectedly." -ForegroundColor Red }
        if ($backendJob.State  -notin "Running","NotStarted" -and
            $frontendJob.State -notin "Running","NotStarted") { break }

        Start-Sleep -Milliseconds 300
    }
} finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job  $backendJob,  $frontendJob  -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob  -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
