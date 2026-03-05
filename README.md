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
uvicorn app.main:app --reload
```

Der Server läuft dann unter: `http://127.0.0.1:8000`

API-Dokumentation: `http://127.0.0.1:8000/docs`

---

### Kurzanleitung (nach einmaliger Einrichtung)

```powershell
cd backends
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```