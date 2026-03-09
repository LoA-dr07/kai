# meal-planner

## Backend starten

### Voraussetzungen

- Python 3.10+
- PostgreSQL läuft lokal (z.B. über pgAdmin oder als Dienst)
- PowerShell im Ordner `backends\` geöffnet

### 1. Virtuelle Umgebung einrichten (einmalig)

```powershell
cd backends
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Umgebungsvariable setzen

Erstelle im Ordner `backends\` eine Datei `.env` mit folgendem Inhalt:

```
DATABASE_URL=postgresql://BENUTZER:PASSWORT@localhost:5432/DATENBANKNAME
```

Beispiel:
```
DATABASE_URL=postgresql://postgres:meinPasswort@localhost:5432/meal_planner
```

### 3. Datenbank migrieren

```powershell
# Sicherstellen, dass venv aktiv ist
.\venv\Scripts\Activate.ps1

alembic upgrade head
```

### 4. Server starten

```powershell
uvicorn app.main:app --reload --host 0.0.0.0
```

- Browser/Lokal: `http://127.0.0.1:8000`
- Vom Gerät im selben WLAN: `http://<DEINE-LAN-IP>:8000`
  (LAN-IP ermitteln: `ipconfig` → Eintrag „IPv4-Adresse", z.B. `192.168.1.42`)
- API-Dokumentation: `http://127.0.0.1:8000/docs`

---

### Kurzanleitung Backend (nach einmaliger Einrichtung)

```powershell
cd backends
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0
```

---

## Frontend (Mobile App) starten

### Voraussetzungen

- Node.js 18+
- Expo Go App auf dem Smartphone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### 1. Abhängigkeiten installieren (einmalig)

```powershell
cd mobile
npm install
npx expo install @expo/ngrok@^4.0.0
```

> Falls ngrok noch nicht installiert ist: `winget install ngrok.ngrok`

### 2. ngrok starten (Backend nach außen tunneln)

Damit die App auf dem Handy die Backend-API erreichen kann, muss das Backend öffentlich erreichbar sein.

**ngrok installieren (einmalig):**
```powershell
winget install ngrok.ngrok
```

**ngrok starten** (in einem separaten PowerShell-Fenster, während der Backend-Server läuft):
```powershell
ngrok http 8000
```

ngrok zeigt eine URL an, z.B.:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
```

### 3. Backend-URL konfigurieren

Erstelle im Ordner `mobile\` eine Datei `.env` mit der ngrok-URL aus dem vorherigen Schritt:

```
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

> Die ngrok-URL ändert sich bei jedem Neustart von ngrok — dann muss die `.env` entsprechend aktualisiert werden.
> `localhost` oder die LAN-IP funktionieren **nicht** zuverlässig, wenn das Handy über Tunnel verbunden ist.

### 4. Expo starten

```powershell
npx expo start --tunnel
```

Den angezeigten QR-Code mit der **Expo Go App** scannen.

### Kurzanleitung Frontend (nach einmaliger Einrichtung)

1. Backend starten (in `backends\`):
```powershell
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0
```

2. ngrok starten (separates Fenster) und URL in `mobile\.env` eintragen:
```powershell
ngrok http 8000
# → EXPO_PUBLIC_API_URL in mobile\.env auf die angezeigte https://... URL setzen
```

3. Expo starten:
```powershell
cd mobile
npx expo start --tunnel
```
