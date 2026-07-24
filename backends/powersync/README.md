# PowerSync Cloud CLI-Anbindung

Dieses Verzeichnis verknüpft das Backend per PowerSync-CLI mit der bestehenden
PowerSync-Cloud-Instanz, damit `POST /admin/powersync/stop` und `/start` sie
deprovisionieren bzw. wieder hochfahren können.

## Einmaliges Setup (lokal, nicht im Container)

1. CLI lokal installieren:
   ```powershell
   npm install -g powersync
   ```
2. Interaktiv einloggen (öffnet Browser, PowerSync-Account-Login):
   ```powershell
   powersync login
   ```
3. Mit der bestehenden Cloud-Instanz verknüpfen (Instanz-ID steht im PowerSync
   Dashboard unter der Instanz-Übersicht/URL):
   ```powershell
   cd backends/powersync
   powersync link cloud --instance-id=<eure-instanz-id>
   ```
   Das erzeugt eine `cli.yaml` in diesem Ordner – enthält zwar keine Secrets,
   aber instanzspezifische IDs (`instance_id`, `org_id`, `project_id`).
   **Nicht committen** – jede:r Nutzer:in mit eigener PowerSync-Cloud-Instanz
   erzeugt sich diese Datei lokal selbst (ist in `.gitignore` ausgeschlossen).
4. Personal Access Token erzeugen: PowerSync Dashboard → Account →
   Access Tokens. Dieser Wert ist `PS_ADMIN_TOKEN` (siehe `backends/.env.example`)
   – **niemals committen**, nur als fly.io-Secret setzen:
   ```powershell
   flyctl secrets set PS_ADMIN_TOKEN=<token> --app kai-api-long-feather-1592
   flyctl secrets set POWERSYNC_ADMIN_SECRET=<beliebiges-langes-zufalls-passwort> --app kai-api-long-feather-1592
   ```
5. `POWERSYNC_ADMIN_SECRET` zusätzlich in `mobile/.env` als
   `EXPO_PUBLIC_POWERSYNC_ADMIN_SECRET` eintragen (muss mit dem fly.io-Secret
   übereinstimmen) und die App neu bauen.
6. Backend deployen: `flyctl deploy` aus `backends/`.

Ohne diese Schritte antworten `/admin/powersync/stop` und `/start` mit
HTTP 503 (`PS_ADMIN_TOKEN not configured` bzw. `cli.yaml missing`).
