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
- Smartphone und PC im **selben WLAN**

### 1. Abhängigkeiten installieren (einmalig)

```powershell
cd mobile
npm install
```

### 2. Backend-URL konfigurieren

Erstelle im Ordner `mobile\` eine Datei `.env.local` mit der LAN-IP deines PCs:

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000
```

> `localhost` funktioniert auf dem Gerät nicht — es muss die echte IP des PCs sein.

### 3. Expo starten

```powershell
npx expo start
```

Den angezeigten QR-Code mit der **Expo Go App** scannen.

> **Wichtig:** Kein `--tunnel` verwenden — das erfordert ngrok und ist hier nicht nötig.
> Kein `--clear` nötig (löscht nur den Cache und verlangsamt den ersten Start).
> Der Standard-LAN-Modus (`npx expo start`) funktioniert, solange Handy und PC im selben WLAN sind.

### Kurzanleitung Frontend (nach einmaliger Einrichtung)

```powershell
cd mobile
npx expo start --tunnel --clear
```
