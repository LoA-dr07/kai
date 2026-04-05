# Plan: GitHub-Veröffentlichung des Meal-Planners

## Context

Das Projekt soll auf GitHub veröffentlicht werden, damit andere Familien es einsetzen können.
Aktuell ist es ein privates Entwicklungs-Repo ohne öffentliche Nutzung im Blick.
Ziel: Sauberes, sicheres, installierbares öffentliches Repository.

---

## Kritischer Befund: Secrets in der Git-History

`backends/.env` ist seit Commit `0e7fecb` (Phase 1) in der Git-History verankert:
- `DATABASE_URL=postgresql://postgres:...@localhost:5432/meal_planner` (echtes Passwort)
- `SECRET_KEY=...` (echter Key)
- Wahrscheinlich auch `ANTHROPIC_API_KEY` (Phase 8)

**→ Muss aus der kompletten History getilgt werden, bevor das Repo public geht.**

---

## Implementierungsschritte – Reihenfolge

### Schritt 1 – Secrets aus Git-History entfernen (KRITISCH, zuerst)

1. `git filter-repo` verwenden (empfohlen, ersetzt das veraltete `filter-branch`):
   ```bash
   pip install git-filter-repo   # einmalig
   git filter-repo --path backends/.env --invert-paths --force
   ```
   Löscht `backends/.env` aus **allen** Commits rückwirkend.

2. `git rm --cached backends/.env` sicherstellen (Datei bleibt lokal, aber untracked).

3. **Alle Secrets rotieren** (lokal neue Werte vergeben):
   - Neues DB-Passwort in PostgreSQL setzen + `.env` aktualisieren
   - Neuen `SECRET_KEY` generieren:
     ```bash
     python -c "import secrets; print(secrets.token_hex(32))"
     ```
   - Neuen `ANTHROPIC_API_KEY` im Anthropic-Dashboard generieren (alten invalidieren)

4. Force-Push des bereinigten Branches:
   ```bash
   git push --force origin <branch>
   ```

---

### Schritt 2 – Env-Vorlagen anlegen

Neue Datei **`backends/.env.example`** (wird committet):
```
DATABASE_URL=postgresql://BENUTZER:PASSWORT@localhost:5432/meal_planner
SECRET_KEY=HIER_ZUFAELLIGEN_32_BYTE_HEX_STRING_EINTRAGEN
ANTHROPIC_API_KEY=sk-ant-...  # Optional, nur für KI-Wochenplanung (Phase 8)
```

`mobile/.env.example` existiert bereits – passt.

---

### Schritt 3 – Hardcoded IP entfernen

`mobile/package.json` Zeile 7:
```json
// Vorher:
"mobile": "SET REACT_NATIVE_PACKAGER_HOSTNAME=192.168.178.83 && expo start --go --lan"

// Nachher:
"mobile": "expo start --go --lan"
```
Die IP-Konfiguration erfolgt über README-Dokumentation (Nutzer setzt die Variable manuell).

---

### Schritt 4 – .gitignore bereinigen

Ergänzen in `.gitignore`:
```
# IDE
.idea/
*.iml
.vscode/

# Backend env
backends/.env.local
```

`.idea/` enthält IntelliJ-Konfiguration mit lokalem Pfadwissen – nicht öffentlich.

---

### Schritt 5 – LICENSE-Datei hinzufügen

Neue Datei **`LICENSE`** (MIT empfohlen für ein offenes Familienprojekt):
```
MIT License

Copyright (c) 2026 [Name / GitHub-Username]
...
```

---

### Schritt 6 – README.md komplett neu schreiben

Das aktuelle README ist unvollständig und enthält private IP-Adressen (`192.168.178.83`).

Neue Struktur für andere Familien:
```
# Meal-Planner
Kurzbeschreibung + Screenshot

## Features
## Voraussetzungen (Node 18+, Python 3.10+, PostgreSQL)
## Schnellstart – Option A: Manuell (Backend + Web)
## Schnellstart – Option B: Docker (empfohlen)
## Konfiguration (.env-Dateien)
## Mobile App (Expo Go + LAN-IP)
## KI-Wochenplanung (ANTHROPIC_API_KEY optional)
## Erstes Setup (Datenbank-Seed für 3 User)
## Projektstruktur
## Tech-Stack
```

Kritisch: Private IP `192.168.178.83` aus README.md Zeile 113 durch Beispiel-IP ersetzen.

---

### Schritt 7 – Docker-Setup (empfohlen für andere Familien)

Ohne Docker müssen andere Familien Python-venv + PostgreSQL selbst installieren –
das ist eine hohe Einstiegshürde. Mit Docker reicht `docker compose up`.

Neue Dateien:

**`docker-compose.yml`** (Root):
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: meal_planner
      POSTGRES_USER: meal_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backends
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://meal_user:${POSTGRES_PASSWORD}@db:5432/meal_planner
      SECRET_KEY: ${SECRET_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    depends_on: [db]

volumes:
  pgdata:
```

**`backends/Dockerfile`**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["sh", "-c", "alembic upgrade head && python -m app.db.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**`.env.example`** (Root, für docker-compose):
```
POSTGRES_PASSWORD=sicheres_passwort_hier
SECRET_KEY=zufaelliger_32_byte_hex
ANTHROPIC_API_KEY=sk-ant-...
```

---

### Schritt 8 – Dokumentation nachziehen

- `ROADMAP.md`: Neue Phase "GitHub-Veröffentlichung" als abgeschlossen markieren
- `CLAUDE.md`: Docker als zusätzliche Startoption ergänzen
- `docs/architecture.md`: Docker-Deployment-Abschnitt

---

## Kritische Dateien – Zusammenfassung

| Datei | Aktion |
|-------|--------|
| `backends/.env` | Aus git history entfernen (git filter-repo) |
| `backends/.env.example` | Neu anlegen |
| `.gitignore` | `.idea/` ergänzen |
| `mobile/package.json:7` | Hardcoded IP entfernen |
| `README.md` | Komplett neu schreiben |
| `LICENSE` | Neu anlegen (MIT) |
| `docker-compose.yml` | Neu anlegen |
| `backends/Dockerfile` | Neu anlegen |
| `.env.example` (Root) | Neu anlegen |

---

## Reihenfolge (Abhängigkeiten)

```
Schritt 1 (History bereinigen)
    ↓
Schritt 2 (.env.example) + Schritt 3 (IP) + Schritt 4 (.gitignore) + Schritt 5 (LICENSE)
    [alle parallel möglich]
    ↓
Schritt 6 (README – setzt Klarheit über Docker aus Schritt 7 voraus)
    ↓
Schritt 7 (Docker)
    ↓
Schritt 8 (Doku aktualisieren)
    ↓
Commit + Push + Repo public schalten
```

---

## Verifikation

1. `git ls-files | grep ".env"` → darf nur `.env.example`-Dateien zeigen
2. `git log --all -- backends/.env` → darf keine Einträge mehr zeigen (nach filter-repo)
3. `docker compose up` → Backend erreichbar auf `http://localhost:8000/docs`
4. README-Anleitung auf frischem System durchführen (frische Installation simulieren)
5. Repo auf GitHub public schalten, Clone testen
