# Plan: GitHub-Veröffentlichung des Meal-Planners

Das Projekt soll auf GitHub veröffentlicht werden, damit andere Familien es einsetzen können.

**Stack:** FastAPI · fly.io · Neon PostgreSQL · PowerSync · React Native / Expo + Expo Web

---

## Legende

- 🤖 **Claude erledigt das** – einfach beauftragen
- 👤 **Du musst das tun** – erfordert deinen Zugang / deine Entscheidung
- ✅ **Bereits erledigt**

---

## Schritt 1 – RSA-Schlüssel aus Git-History entfernen ⚠️ KRITISCH – zuerst!

`private_key.pem` und `public_key.pem` wurden mit echten RSA-Schlüsseln in die Git-History
committed. Damit kann jeder, der die History liest, gültige PowerSync-JWTs ausstellen.

| # | Aufgabe | Wer |
|---|---------|-----|
| 1.1 | `git filter-repo` installieren: `pip install git-filter-repo` | 👤 |
| 1.2 | PEM-Dateien aus der gesamten History tilgen:<br>`git filter-repo --path private_key.pem --invert-paths --force`<br>`git filter-repo --path public_key.pem --invert-paths --force`<br>`git filter-repo --path backends/.env --invert-paths --force` | 👤 |
| 1.3 | Force-Push des bereinigten Repos: `git push --force origin main` | 👤 |
| 1.4 | Neues RSA-Schlüsselpaar generieren (alte Keys sind kompromittiert):<br>`$rsa = [System.Security.Cryptography.RSA]::Create(2048)`<br>`$rsa.ExportRSAPrivateKeyPem() \| Out-File private_key.pem -Encoding ascii`<br>`$rsa.ExportSubjectPublicKeyInfoPem() \| Out-File public_key.pem -Encoding ascii` | 👤 |
| 1.5 | Neue Schlüssel einzeilig für `.env` formatieren:<br>`(Get-Content private_key.pem -Raw) -replace "\`r\`n","\n" -replace "\`n","\n"`<br>`(Get-Content public_key.pem -Raw) -replace "\`r\`n","\n" -replace "\`n","\n"` | 👤 |
| 1.6 | `backends/.env` mit neuen Schlüsseln aktualisieren | 👤 |
| 1.7 | fly.io Secrets mit neuen Schlüsseln aktualisieren:<br>`fly secrets set POWERSYNC_PRIVATE_KEY="..." -a <deine-app>`<br>`fly secrets set POWERSYNC_PUBLIC_KEY="..." -a <deine-app>` | 👤 |
| 1.8 | Sync Rules im PowerSync-Dashboard neu deployen und JWKS URI prüfen | 👤 |

---

## Schritt 2 – .gitignore bereinigen ✅

Bereits erledigt. Folgende Dateien werden nicht mehr getrackt:
`private_key.pem` · `public_key.pem` · `CLAUDE.md` · `DOD.md` · `FEATURES.md` · `ROADMAP.md` · `.idea/` · `.vscode/`

> **Hinweis:** `.gitignore` verhindert nur das Tracken neuer Dateien. Bereits getrackte Dateien
> müssen zusätzlich mit `git rm --cached <datei>` aus dem Index entfernt werden – das wurde
> für die PEM-Dateien erledigt.

---

## Schritt 3 – Hardcoded LAN-IP entfernen

`mobile/package.json` enthält noch die private IP `192.168.178.83` im `mobile`-Script.

| # | Aufgabe | Wer |
|---|---------|-----|
| 3.1 | IP aus `mobile/package.json` entfernen – Script auf `expo start --dev-client --lan` kürzen | 🤖 |

---

## Schritt 4 – README für öffentliche Nutzung anpassen

Das README beschreibt den Stack korrekt, enthält aber noch persönliche Werte.

| # | Aufgabe | Wer |
|---|---------|-----|
| 4.1 | Persönlichen fly.io App-Namen `meal-planner-api-long-feather-1592` durch `<deine-app>` ersetzen (4 Stellen) | 🤖 |
| 4.2 | `CLAUDE.md`-Eintrag aus der Dokumentationstabelle am Ende des README entfernen | 🤖 |
| 4.3 | Entscheiden, ob ein Screenshot der Web-App hinzugefügt werden soll (Nice-to-have) | 👤 |
| 4.4 | Screenshot erstellen und ins README einbinden, falls gewünscht | 🤖 |

---

## Schritt 5 – LICENSE-Datei anlegen

Das Repo hat noch keine Lizenz. Ohne Lizenz darf niemand den Code rechtlich nutzen.

| # | Aufgabe | Wer |
|---|---------|-----|
| 5.1 | Lizenztyp bestätigen – MIT empfohlen | 👤 |
| 5.2 | `LICENSE`-Datei mit MIT-Text und deinem GitHub-Nutzernamen anlegen | 🤖 |

---

## Schritt 6 – Docker-Setup für lokale Entwicklung

Das aktuelle Setup erfordert externe Cloud-Dienste (Neon, fly.io, PowerSync).
Ein `docker-compose.yml` ermöglicht anderen Familien, das Projekt lokal auszuprobieren,
ohne sofort alle Cloud-Dienste einrichten zu müssen.

| # | Aufgabe | Wer |
|---|---------|-----|
| 6.1 | `docker-compose.yml` im Projektstamm anlegen (PostgreSQL + Backend) | 🤖 |
| 6.2 | README um Abschnitt "Lokale Entwicklung mit Docker" ergänzen | 🤖 |
| 6.3 | Docker-Setup lokal testen: `docker compose up` → `http://localhost:8000/docs` erreichbar | 👤 |

---

## Schritt 7 – Abschluss & Veröffentlichung

| # | Aufgabe | Wer |
|---|---------|-----|
| 7.1 | Verifikation PEM-Dateien nicht mehr getrackt (PowerShell):<br>`git ls-files \| Select-String -Pattern "\.(pem\|key)"`<br>→ keine Ausgabe | 👤 |
| 7.2 | Verifikation History bereinigt:<br>`git log --all -- private_key.pem public_key.pem backends/.env`<br>→ keine Commits | 👤 |
| 7.3 | Verifikation keine private IP mehr im Code (PowerShell):<br>`git ls-files \| ForEach-Object { Select-String -Path $_ -Pattern "192\.168\.178" } `<br>→ keine Ausgabe | 👤 |
| 7.4 | Web-App auf frischem Clone testen: `cd mobile && npx expo start --web` | 👤 |
| 7.5 | Repo auf GitHub auf "Public" umstellen | 👤 |
| 7.6 | Clone von einem anderen Account testen | 👤 |
