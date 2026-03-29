# restore-db.ps1 — Restores the meal-planner database from a dump file
# Usage:
#   .\restore-db.ps1                                             (interactive selection)
#   .\restore-db.ps1 -DumpFile backups\mealplanner_2026-03-29_120000.dump

param(
    [string]$DumpFile
)

$envFile = Join-Path $PSScriptRoot "backends\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "backends\.env not found at $envFile"
    exit 1
}

# Parse DATABASE_URL from .env
$databaseUrl = $null
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
        $databaseUrl = $Matches[1].Trim()
        break
    }
}

if (-not $databaseUrl) {
    Write-Error "DATABASE_URL not found in backends\.env"
    exit 1
}

# Parse postgresql://user:password@host:port/dbname
if ($databaseUrl -match '^postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)$') {
    $dbUser     = $Matches[1]
    $dbPassword = $Matches[2]
    $dbHost     = $Matches[3]
    $dbPort     = if ($Matches[4]) { $Matches[4] } else { "5432" }
    $dbName     = $Matches[5]
} else {
    Write-Error "Could not parse DATABASE_URL: $databaseUrl"
    exit 1
}

# If no dump file given, let the user choose from backups/
if (-not $DumpFile) {
    $backupsDir = Join-Path $PSScriptRoot "backups"
    if (-not (Test-Path $backupsDir)) {
        Write-Error "No backups directory found. Run .\backup-db.ps1 first."
        exit 1
    }

    $dumps = Get-ChildItem -Path $backupsDir -Filter "*.dump" | Sort-Object Name
    if ($dumps.Count -eq 0) {
        Write-Error "No .dump files found in $backupsDir"
        exit 1
    }

    Write-Host "Available backups:"
    for ($i = 0; $i -lt $dumps.Count; $i++) {
        Write-Host "  [$($i + 1)] $($dumps[$i].Name)"
    }

    $choice = Read-Host "Select backup number (1-$($dumps.Count))"
    $index = [int]$choice - 1
    if ($index -lt 0 -or $index -ge $dumps.Count) {
        Write-Error "Invalid selection."
        exit 1
    }

    $DumpFile = $dumps[$index].FullName
}

if (-not (Test-Path $DumpFile)) {
    Write-Error "Dump file not found: $DumpFile"
    exit 1
}

# Confirmation prompt
Write-Host ""
Write-Host "WARNING: This will overwrite all data in database '$dbName'!" -ForegroundColor Yellow
Write-Host "Dump file: $DumpFile"
$confirm = Read-Host "Type 'yes' to continue"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 0
}

Write-Host "Restoring '$dbName' from $DumpFile ..."

# Run pg_restore
$env:PGPASSWORD = $dbPassword
try {
    pg_restore -U $dbUser -h $dbHost -p $dbPort -d $dbName --clean --if-exists $DumpFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_restore failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
    Write-Host "Restore successful."
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
