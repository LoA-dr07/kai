# Meal-Planner – Claude Code Konfiguration

## Projektübersicht

Familien-Mahlzeitenplaner für gemeinsame Nutzung im Haushalt (3 Mitglieder).
Features: Rezeptverwaltung, Wochenplanung, Haushaltsmitglieder, Import/Export, Tags, Sternebewertungen.

**Stack:** FastAPI + PostgreSQL (Backend) · React Native / Expo + Expo Web (Frontend)
**Entwicklungsumgebung:** Windows (PowerShell · `.\venv\Scripts\Activate.ps1`)

---

## Befehle

### Alles auf einmal starten (Backend + Web-Frontend)
```powershell
.\start.ps1
# Backend:  http://localhost:8000  (API-Docs: /docs)
# Frontend: http://localhost:8081
# Stoppen:  Ctrl+C
```

### Backend starten
```powershell
cd backends
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0
# Läuft auf http://localhost:8000 · API-Docs: http://localhost:8000/docs
```

### Web-App starten
```powershell
cd mobile
# .env: EXPO_PUBLIC_API_URL=http://localhost:8000
npx expo start --web
# Öffnet http://localhost:8081
```

### Mobile App starten
```powershell
# Voraussetzung: PC und Handy im selben WLAN

# Terminal 1: Backend (s.o.)
# – bereits mit --host 0.0.0.0, also im LAN erreichbar

# Terminal 2: Expo (LAN-Modus)
cd mobile
# .env: EXPO_PUBLIC_API_URL=http://<LAN-IP-des-PCs>:8000
# LAN-IP ermitteln: ipconfig → "IPv4-Adresse" unter dem WLAN-Adapter
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.178.83"; npx expo start --go --lan
# Alternativ: npm run mobile
# (IP in mobile/package.json → "mobile"-Script anpassen falls sie sich ändert)

# Beim ersten Mal: Windows-Firewall muss eingehende Verbindungen auf Port 8081 (TCP) erlauben
# – Windows fragt automatisch nach, oder manuell:
# Windows-Defender-Firewall → Eingehende Regel → Port 8081 TCP zulassen
```

### Tests
```powershell
cd backends
.\venv\Scripts\Activate.ps1
pytest
```

### Datenbank-Migration
```powershell
cd backends
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

### Neue Migration erstellen
```powershell
cd backends
.\venv\Scripts\Activate.ps1
alembic revision --autogenerate -m "beschreibung"
```

### Datenbank-Seed (Haushalt + 3 User)
```powershell
cd backends
.\venv\Scripts\Activate.ps1
python -m app.db.seed
```

---

## Architektur

```
mobile/          ← React Native / Expo (iOS · Android · Web)
  app/(tabs)/    ← Hauptscreens (Tab-Navigation)
  components/    ← Wiederverwendbare UI-Komponenten
  lib/
    api.ts       ← Axios-Client (EXPO_PUBLIC_API_URL)
    hooks/       ← React Query Hooks
    types.ts     ← TypeScript-Typen
    alert.ts     ← Plattform-kompatibles Alert-Utility

backends/        ← FastAPI (Python)
  app/
    main.py      ← App-Init, Router-Registrierung, CORS
    models/      ← SQLAlchemy ORM-Modelle
    routers/     ← API-Endpunkte
    schemas/     ← Pydantic Request/Response-Schemas
    db/
      session.py ← Datenbankverbindung (SQLAlchemy)
      seed.py    ← Seed-Daten (Haushalt, User, Tags)
  alembic/
    versions/    ← Datenbankmigrationen
```

---

## Entwicklungskonventionen

### Neuer API-Endpunkt
1. Schema in `backends/app/schemas/<domäne>.py` ergänzen
2. Logik in `backends/app/routers/<domäne>.py` ergänzen
3. Falls neuer Router: in `backends/app/main.py` registrieren

### Neues Datenbankfeld / neue Tabelle
1. Modell in `backends/app/models/<datei>.py` anpassen
2. Alembic-Migration: `alembic revision --autogenerate -m "..."` + prüfen + `alembic upgrade head`
3. Pydantic-Schema anpassen

### Neues Frontend-Feature
1. React Query Hook in `mobile/lib/hooks/` ergänzen (Muster: `useRecipes.ts`, `useMealPlan.ts`)
2. Komponente in `mobile/components/` erstellen
3. Screen in `mobile/app/` verwenden

### Plattform-Kompatibilität (Mobile + Web)
- **Nie** `Alert.alert()` direkt verwenden → stattdessen `showAlert` / `showConfirm` aus `mobile/lib/alert.ts`
- Datei-Operationen: `expo-document-picker`, `expo-file-system`, `expo-sharing` (Web-Compat geprüft)
- Responsive Breakpoint: `width >= 768` → Grid-Layout
- **Buttons ohne sichtbaren Text** (nur Icons oder Symbole) müssen stets mit `<Tooltip label="...">` aus `mobile/components/Tooltip.tsx` gewrappt werden – zeigt Hover-Erklärung auf Web, setzt `accessibilityLabel` auf Mobile. Position-Prop: `'left'` für Buttons am rechten Rand, `'right'` für Buttons am linken Rand, `'bottom'` für Buttons am oberen Bildschirmrand, Standard `'top'` sonst.

### Sprache
- UI-Texte: **Deutsch**
- Code, Variablen, Kommentare, Commit-Messages: **Englisch**

---

## Environment-Dateien

**`backends/.env`** (nicht im Git)
```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/meal_planner
```

**`mobile/.env`** (nicht im Git)
```
# Web / lokale Entwicklung:
EXPO_PUBLIC_API_URL=http://localhost:8000

# Mobile via LAN (Expo Go, selbes WLAN):
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000  # LAN-IP des PCs (ipconfig)
```

---

## Wichtige Designentscheidungen

- **Keine Authentifizierung**: Bewusste Entscheidung – Haushalt teilt eine gemeinsame App-Instanz (3 User als Seed-Daten, kein Login)
- **CORS offen**: `allow_origins=["*"]` – für Entwicklung und Einzel-Haushalt-Betrieb akzeptabel
- **LAN-IP des PCs** in `mobile/.env` eintragen (`EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000`) und in `mobile/package.json` → `"mobile"`-Script (`REACT_NATIVE_PACKAGER_HOSTNAME`). LAN-IP ermitteln: `ipconfig` → IPv4-Adresse des WLAN-Adapters. Ändert sich nur bei DHCP-Wechsel – statische IP im Router empfohlen.
- **`MealPlanEntry`**: Entweder `recipe_id` (Rezept) oder `custom_meal` (Freitext), nicht beides

---

## Weitere Dokumentation

- `README.md` – Setup-Anleitung (Ersteinrichtung, Starten)
- `ROADMAP.md` – Feature-Tracker und Entwicklungsphasen
- `docs/architecture.md` – Datenbankschema, Systemarchitektur
- `docs/api.md` – Vollständige API-Referenz
- `docs/frontend.md` – Screens, Hooks, Komponenten

## Dokumentationspflege

**Wichtig:** Nach jeder Änderung am Projekt müssen die betroffenen Dokumentationsdateien aktualisiert werden:

- Neues Datenbankmodell oder Migration → `docs/architecture.md` (Schema, Migrations-Tabelle)
- Neuer oder geänderter API-Endpunkt → `docs/api.md`
- Neuer Screen, Hook oder Komponente → `docs/frontend.md`
- Neuer Befehl, Konvention oder Designentscheidung → `CLAUDE.md`
- Neue Feature-Phase abgeschlossen → `ROADMAP.md` (Tasks als `[x]` markieren)
