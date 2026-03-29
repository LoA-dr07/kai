# backup-db.ps1 — Creates a timestamped PostgreSQL dump of the meal-planner database

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

# Ensure backups directory exists
$backupsDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

# Generate timestamped filename
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dumpFile = Join-Path $backupsDir "${dbName}_${timestamp}.dump"

Write-Host "Creating backup of '$dbName' → $dumpFile"

# Run pg_dump (custom format)
$env:PGPASSWORD = $dbPassword
try {
    pg_dump -U $dbUser -h $dbHost -p $dbPort -F c -f $dumpFile $dbName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_dump failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
    Write-Host "Backup successful: $dumpFile"
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
