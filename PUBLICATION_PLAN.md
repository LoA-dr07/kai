# Plan: GitHub-Veröffentlichung des Meal-Planners

## Stand & Kontext

Das Projekt soll auf GitHub veröffentlicht werden, damit andere Familien es einsetzen können.
Die ursprüngliche Version dieses Plans wurde vor Phase 9 (Multi-Device / fly.io / Neon / PowerSync)
erstellt und ist damit veraltet. Diese Version spiegelt den aktuellen Stand nach Phase 10 wider.

**Aktueller Stack (nach Phase 9/10):**
- Backend: FastAPI → deployed auf **fly.io** (`meal-planner-api-long-feather-1592.fly.dev`)
- Datenbank: **Neon PostgreSQL** (Serverless Cloud, kein lokales PostgreSQL mehr)
- Offline-Sync (Native): **PowerSync** (RSA-JWT-basiert)
- Frontend: React Native / Expo + Expo Web (eine Codebasis)

---

## Kritische Befunde: Secrets in der Git-History

### Befund 1 – `private_key.pem` + `public_key.pem` (KRITISCH)

Diese Dateien sind **noch heute im Index tracked** (`git ls-files` bestätigt dies)
und wurden seit Commit `b1b1c84` ("Add PowerSync offline-first sync infrastructure") in der History verankert.
Sie enthalten **echte RSA-2048-Schlüssel** (kein Platzhalter).

Mit dem privaten Schlüssel kann jeder gültige PowerSync-JWTs erzeugen und Offline-Sync missbrauchen.

→ **Muss vor Veröffentlichung**: aus dem Index entfernt, aus der History getilgt, neu generiert werden.

### Befund 2 – `backends/.env` (mittlere Priorität)

In Commit `f6322bd` (Phase 1, vor Phase 9) war folgendes committed:
```
DATABASE_URL=postgresql://postgres:nkmpfp@localhost:5432/meal_planner
SECRET_KEY=2cd6474efeafd8d9df5b32f5ad9c6f33ee1fc4da0c6232417824fc9bde3a2365
```

Dabei handelt es sich um lokale Entwicklungs-Credentials (kein Neon-Passwort, kein Produktions-Key).
Die `SECRET_KEY`-Variable wird im aktuellen Code nicht mehr verwendet (kein JWT-Auth mehr).
Das Passwort `nkmpfp` galt für eine lokale PostgreSQL-Instanz, die nicht mehr existiert.

→ Trotzdem sollte diese History bereinigt werden (gute Praxis vor öffentlicher Veröffentlichung).

---

## Implementierungsschritte – Reihenfolge

### Schritt 1 – RSA-Schlüssel aus Index und History entfernen (KRITISCH, zuerst)

```bash
# 1a. Dateien aus dem Index entfernen (bleiben lokal, werden aber nicht mehr getrackt)
git rm --cached private_key.pem public_key.pem

# 1b. History bereinigen (beide Secrets in einem Durchgang)
pip install git-filter-repo   # einmalig
git filter-repo --path private_key.pem --invert-paths --force
git filter-repo --path public_key.pem --invert-paths --force
git filter-repo --path backends/.env --invert-paths --force

# 1c. Force-Push
git push --force origin <branch>
```

Nach der History-Bereinigung: **Neues RSA-Schlüsselpaar generieren** und in `backends/.env`
sowie als fly.io Secrets hinterlegen (die alten Schlüssel sind kompromittiert):

```powershell
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$rsa.ExportRSAPrivateKeyPem() | Out-File -FilePath private_key.pem -Encoding ascii
$rsa.ExportSubjectPublicKeyInfoPem() | Out-File -FilePath public_key.pem -Encoding ascii
```

Dann Sync Rules im PowerSync-Dashboard neu deployen und JWKS URI aktualisieren.

---

### Schritt 2 – `.gitignore` bereinigen ✅ (bereits erledigt)

Bereits in diesem Branch ergänzt:
```
private_key.pem
public_key.pem
CLAUDE.md
DOD.md
.idea/
*.iml
.vscode/
```

---

### Schritt 3 – Hardcoded LAN-IP aus `mobile/package.json` entfernen

`mobile/package.json` Zeile ~7 enthält noch:
```json
"mobile": "SET REACT_NATIVE_PACKAGER_HOSTNAME=192.168.178.83 && expo start --dev-client --lan"
```

Ersetzen durch:
```json
"mobile": "expo start --dev-client --lan"
```

Die LAN-IP-Konfiguration ist im README bereits als manuelle Umgebungsvariable dokumentiert.

---

### Schritt 4 – README für öffentliche Nutzung anpassen

Das README ist seit Phase 9 inhaltlich gut (beschreibt Neon/fly.io/PowerSync-Setup).
Folgende Punkte müssen noch angepasst werden:

1. **Persönlicher fly.io App-Name entfernen**: `meal-planner-api-long-feather-1592` durch
   `<deine-app>` ersetzen (in Zeilen 52, 86, 95, 125 des README)
2. **`CLAUDE.md`-Referenz entfernen**: In der Dokumentationstabelle am Ende des README
   wird `CLAUDE.md` aufgeführt – das wird durch .gitignore nicht mehr öffentlich sein,
   der Tabelleneintrag muss entfernt werden
3. **Screenshots hinzufügen** (Nice-to-have): Ein Screenshot der Web-App wäre hilfreich
   für neue Nutzer, die das Projekt einschätzen möchten

---

### Schritt 5 – LICENSE-Datei hinzufügen

Neue Datei **`LICENSE`** (MIT empfohlen für ein offenes Familienprojekt):

```
MIT License

Copyright (c) 2026 [GitHub-Username]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### Schritt 6 – Docker-Setup für lokale Entwicklung (empfohlen)

Das aktuelle Setup erfordert externe Dienste (Neon, fly.io, PowerSync).
Für lokale Entwicklung und für Nutzer, die keine Cloud-Dienste nutzen möchten,
ist ein `docker-compose.yml` sinnvoll – **als Alternative, nicht als Ersatz**.

**`docker-compose.yml`** (Root, nur für lokale Entwicklung):
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: meal_planner
      POSTGRES_USER: meal_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-local_dev_password}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ["5432:5432"]

  backend:
    build: ./backends
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://meal_user:${POSTGRES_PASSWORD:-local_dev_password}@db:5432/meal_planner
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      # PowerSync-Keys nur nötig für Native Offline-Sync
      POWERSYNC_PRIVATE_KEY: ${POWERSYNC_PRIVATE_KEY:-}
      POWERSYNC_PUBLIC_KEY: ${POWERSYNC_PUBLIC_KEY:-}
    depends_on: [db]
    command: >
      sh -c "alembic upgrade head && python -m app.db.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

volumes:
  pgdata:
```

Das vorhandene `backends/Dockerfile` ist bereits für fly.io konfiguriert und kann
unverändert auch für docker-compose verwendet werden.

---

### Schritt 7 – Dokumentation nachziehen

- **`ROADMAP.md`**: Phase "GitHub-Veröffentlichung" als abgeschlossene Phase eintragen und
  als `[x]` markieren sobald Repo public ist
- **`README.md`**: Lokale Entwicklung per docker-compose als Option ergänzen (nach Schritt 6)
- **`docs/architecture.md`**: Docker-lokale-Entwicklung Abschnitt ergänzen (optional)

---

## Was sich gegenüber dem alten Plan geändert hat

| Aspekt | Alter Plan | Aktueller Stand |
|--------|------------|-----------------|
| Deployment | Docker als Hauptweg | fly.io + Neon + PowerSync (Cloud-first) |
| Datenbank | Lokales PostgreSQL | Neon (Serverless Cloud) |
| Hauptsecret-Problem | `backends/.env` (DB-Passwort + SECRET_KEY) | **`private_key.pem` / `public_key.pem`** (echte RSA-Keys, noch getrackt) |
| SECRET_KEY | Vorhanden, zu rotieren | Nicht mehr vorhanden im Code |
| Hardcoded IP | Noch offen | Noch offen |
| `backends/.env.example` | Noch anzulegen | Bereits vorhanden (Neon/PowerSync-Vorlage) |
| Docker | Hauptempfehlung | Optionale lokale Dev-Alternative |
| README | Stark veraltet (private IPs, kein fly.io) | Inhaltlich gut, kleinere Fixes nötig |
| Features | Phase 1–5 | Phase 1–10 abgeschlossen |

---

## Kritische Dateien – Zusammenfassung

| Datei | Status | Aktion |
|-------|--------|--------|
| `private_key.pem` | **Noch getrackt, echte Keys!** | Aus Index + History entfernen, neu generieren |
| `public_key.pem` | **Noch getrackt, echte Keys!** | Aus Index + History entfernen, neu generieren |
| `backends/.env` | Aus Index entfernt, aber in History | Aus History entfernen (low-risk, aber gute Praxis) |
| `.gitignore` | ✅ Aktualisiert | `private_key.pem`, `public_key.pem`, `CLAUDE.md`, `DOD.md` ergänzt |
| `mobile/package.json` | Hardcoded IP | IP-Zeile bereinigen |
| `README.md` | Gut, kleinere Fixes nötig | Persönlichen App-Namen + CLAUDE.md-Referenz entfernen |
| `LICENSE` | Fehlt | Neu anlegen (MIT) |
| `docker-compose.yml` | Fehlt | Neu anlegen (lokale Dev-Alternative) |

---

## Reihenfolge (Abhängigkeiten)

```
Schritt 1 (History bereinigen + neue RSA-Keys generieren)  ← BLOCKIERT alles andere
    ↓
Schritt 2 (.gitignore) ✅ bereits erledigt
Schritt 3 (IP in package.json) + Schritt 5 (LICENSE)       [parallel möglich]
    ↓
Schritt 4 (README-Fixes)
    ↓
Schritt 6 (Docker-Setup)
    ↓
Schritt 7 (Doku aktualisieren)
    ↓
Commit + Push + Repo public schalten
```

---

## Verifikation vor dem Public-Schalten

1. `git ls-files | grep -E "\.(pem|key)"` → darf keine Treffer zeigen
2. `git log --all -- private_key.pem public_key.pem backends/.env` → darf keine Commits zeigen
3. `git ls-files | grep "\.env"` → darf nur `.env.example`-Dateien zeigen
4. `grep -r "192.168.178" .` → darf keine Treffer zeigen (hardcoded private IP)
5. `grep -r "meal-planner-api-long-feather-1592" README.md` → sollte keine Treffer zeigen
6. Web-App auf frischem Clone testen: `cd mobile && npx expo start --web`
7. Repo auf GitHub public schalten, Clone von einem anderen Account testen
