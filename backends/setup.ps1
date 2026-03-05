# Windows Setup-Skript fuer das meal-planner Backend
# Ausfuehren mit: .\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== meal-planner Backend Setup ===" -ForegroundColor Cyan

# 1. Python-Befehl ermitteln
$pythonCmd = $null
foreach ($cmd in @("py", "python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $pythonCmd = $cmd
        break
    }
}

if (-not $pythonCmd) {
    Write-Host "FEHLER: Python wurde nicht gefunden!" -ForegroundColor Red
    Write-Host "Bitte Python von https://www.python.org/downloads/ herunterladen und installieren."
    Write-Host "Wichtig: Beim Installieren 'Add Python to PATH' ankreuzen!"
    exit 1
}

$pyVersion = & $pythonCmd --version 2>&1
Write-Host "Python gefunden: $pyVersion ($pythonCmd)" -ForegroundColor Green

# 2. Virtuelles Environment erstellen
if (-not (Test-Path ".\venv")) {
    Write-Host "`nErstelle virtuelles Environment..." -ForegroundColor Yellow
    & $pythonCmd -m venv venv
    Write-Host "venv erstellt." -ForegroundColor Green
} else {
    Write-Host "`nvenv bereits vorhanden, wird wiederverwendet." -ForegroundColor Yellow
}

# 3. pip-Pfad im venv bestimmen
$pipPath = ".\venv\Scripts\pip.exe"
if (-not (Test-Path $pipPath)) {
    Write-Host "FEHLER: pip im venv nicht gefunden!" -ForegroundColor Red
    exit 1
}

# 4. Abhaengigkeiten installieren
Write-Host "`nInstalliere Abhaengigkeiten..." -ForegroundColor Yellow
& $pipPath install -r requirements.txt
Write-Host "Abhaengigkeiten installiert." -ForegroundColor Green

# 5. .env pruefen
if (-not (Test-Path ".\.env")) {
    Write-Host "`nHINWEIS: Keine .env-Datei gefunden!" -ForegroundColor Yellow
    Write-Host "Erstelle eine .env-Datei mit folgendem Inhalt:"
    Write-Host "  DATABASE_URL=postgresql://postgres:PASSWORT@localhost:5432/mealplanner"
    Write-Host "  SECRET_KEY=dein_secret_key"
} else {
    Write-Host "`n.env-Datei gefunden." -ForegroundColor Green
}

# 6. Fertig
Write-Host "`n=== Setup abgeschlossen! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Naechste Schritte:" -ForegroundColor White
Write-Host "  1. venv aktivieren:     .\venv\Scripts\Activate.ps1"
Write-Host "  2. DB-Migration:        alembic upgrade head"
Write-Host "  3. Backend starten:     uvicorn app.main:app --reload --port 8000"
Write-Host "  4. Swagger UI:          http://localhost:8000/docs"
Write-Host ""
Write-Host "Tipp: Falls Activate.ps1 verweigert wird, einmalig ausfuehren:" -ForegroundColor Gray
Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Gray
