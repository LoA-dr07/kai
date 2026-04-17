# Meal-Planner

Familien-Mahlzeitenplaner für gemeinsame Nutzung im Haushalt (3 Mitglieder).
Features: Rezeptverwaltung, Wochenplanung, KI-Unterstützung, Import/Export, Tags, Sternebewertungen.

**Stack:** FastAPI · Neon PostgreSQL · fly.io (Backend) · React Native / Expo + Expo Web (Frontend) · PowerSync (Offline-Sync, nur Native)

---

## Voraussetzungen (Dienste)

| Dienst | Zweck | Wo |
|--------|-------|----|
| [Neon](https://neon.tech) | PostgreSQL-Datenbank (Serverless) | neon.tech |
| [fly.io](https://fly.io) | Backend-Hosting (FastAPI) | fly.io |
| [PowerSync](https://powersync.com) | Offline-Sync für Native (iOS/Android) | powersync.com |
| [Anthropic](https://console.anthropic.com) | Claude API (KI-Features) | console.anthropic.com |

---

## Ersteinrichtung (einmalig)

### 1. Repository klonen & Abhängigkeiten installieren

```powershell
git clone <repo-url>
cd meal-planner

# Backend
cd backends
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd ..\mobile
npm install
```

### 2. Umgebungsvariablen konfigurieren

**`backends/.env`** anlegen (Vorlage: `backends/.env.example`):
```env
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
POWERSYNC_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
POWERSYNC_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
```

**`mobile/.env`** anlegen (Vorlage: `mobile/.env.example`):
```env
EXPO_PUBLIC_API_URL=https://meal-planner-api.fly.dev
EXPO_PUBLIC_POWERSYNC_URL=https://<instanz>.powersync.journeyapps.com
```

> **Neon-URL:** Neon Dashboard → Connection Details → **Direct connection** (nicht Pooled)
> **PowerSync-URL:** PowerSync Dashboard → Instanz-Übersicht → Instance URL

### 3. RSA-Schlüssel für PowerSync generieren (einmalig)

```powershell
# In PowerShell (kein openssl nötig):
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$rsa.ExportRSAPrivateKeyPem() | Out-File -FilePath private_key.pem -Encoding ascii
$rsa.ExportSubjectPublicKeyInfoPem() | Out-File -FilePath public_key.pem -Encoding ascii

# Einzeilig für .env (\ als Zeilenumbruch-Ersatz):
(Get-Content private_key.pem -Raw) -replace "`r`n","\n" -replace "`n","\n"
(Get-Content public_key.pem -Raw) -replace "`r`n","\n" -replace "`n","\n"
```

### 4. Datenbank migrieren & befüllen

```powershell
cd backends
.\venv\Scripts\Activate.ps1
alembic upgrade head          # Tabellen erstellen
python -m app.db.seed         # Haushalt + 3 User anlegen
```

### 5. fly.io Secrets setzen

```powershell
cd backends
fly secrets set DATABASE_URL="postgresql://..." -a meal-planner-api
fly secrets set ANTHROPIC_API_KEY="sk-ant-..." -a meal-planner-api
fly secrets set POWERSYNC_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..." -a meal-planner-api
fly secrets set POWERSYNC_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..." -a meal-planner-api
```

### 6. PowerSync konfigurieren

1. PowerSync Dashboard → **Development-Instanz** → DB verbinden (Neon Direct URL)
2. Sync Rules definieren & deployen (Vorlage: `docs/sync-rules.yaml`)
3. Auth → JWKS URI: `https://meal-planner-api.fly.dev/auth/jwks.json`
4. Gleiche Schritte für **Production-Instanz** wiederholen

### 7. Backend deployen

```powershell
cd backends
fly deploy
```

---

## App starten

### Web-App (Browser)

```powershell
cd mobile
npx expo start --web
```

Öffnet `http://localhost:8081`. Backend läuft auf fly.io – kein lokales Backend nötig.

### Mobile App (iOS/Android via Expo Go)

Voraussetzung: PC und Handy im selben WLAN.

```powershell
# Terminal 1: LAN-IP ermitteln (ipconfig → IPv4-Adresse des WLAN-Adapters)
# mobile/.env anpassen:
# EXPO_PUBLIC_API_URL=http://192.168.x.x:8000  ← nur für lokalen Backend-Betrieb

# Terminal 2: Backend lokal starten (optional, alternativ fly.io nutzen)
cd backends
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0

# Terminal 3: Expo starten
cd mobile
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.x.x"; npx expo start --go --lan
```

QR-Code mit der **Expo Go App** scannen.

> **Tipp:** Für Mobile-Tests kann `EXPO_PUBLIC_API_URL` auch auf `https://meal-planner-api.fly.dev` zeigen – dann ist kein lokales Backend nötig.

### Lokale Entwicklung (Backend + Web)

```powershell
# Terminal 1: Backend
cd backends
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0

# Terminal 2: Frontend
cd mobile
# mobile/.env: EXPO_PUBLIC_API_URL=http://localhost:8000
npx expo start --web
```

---

## Tests

```powershell
cd backends
.\venv\Scripts\Activate.ps1
pytest
```

---

## Weitere Dokumentation

| Datei | Inhalt |
|-------|--------|
| `docs/architecture.md` | Systemarchitektur, Datenbankschema, PowerSync-Datenfluss |
| `docs/api.md` | Vollständige API-Referenz (alle Endpunkte) |
| `docs/frontend.md` | Screens, Hooks, Komponenten, PowerSync-Integration |
| `ROADMAP.md` | Feature-Tracker und Entwicklungsphasen |
| `CLAUDE.md` | Entwicklungskonventionen und Claude-Code-Konfiguration |
