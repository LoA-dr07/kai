# Definition of Done

Jede Änderung gilt als fertig, wenn alle zutreffenden Punkte erfüllt sind.

---

## Code

- Kein TypeScript-Fehler (`tsc --noEmit` fehlerfrei)
- Kein `Alert.alert()` direkt verwendet – stattdessen `showAlert` / `showConfirm` aus `mobile/lib/alert.ts`
- Buttons ohne sichtbaren Text sind in `<Tooltip>` gewrapped (inkl. korrekter `position`-Prop)
- Keine Secrets oder `.env`-Werte im Code oder Git

## Backend

- Neue Endpunkte haben Pydantic-Schemas für Request **und** Response
- Eingabe-Validierung an API-Grenzen vorhanden
- Fehlerfälle liefern aussagekräftige HTTP-Status-Codes (z. B. 404, 422)
- Bei neuem DB-Feld / neuer Tabelle: Alembic-Migration erstellt, geprüft und ausgeführt
- Neuer Router in `main.py` registriert
- Pytest-Tests für neue Endpunkte vorhanden und grün

## Frontend

- Feature läuft auf **Web** (`npx expo start --web`) **und** Mobile (Expo Go) ohne Fehler
- Responsive: Layout korrekt bei `width >= 768`
- React Query Cache wird nach Mutationen invalidiert (`queryClient.invalidateQueries`)
- Datei-Operationen nur via `expo-document-picker` / `expo-file-system` / `expo-sharing`

## Sprache

- UI-Texte: **Deutsch**
- Code, Variablen, Kommentare, Commit-Messages: **Englisch**

## Dokumentation

- Neues/geändertes DB-Modell → `docs/architecture.md` aktualisiert
- Neuer/geänderter API-Endpunkt → `docs/api.md` aktualisiert
- Neuer Screen, Hook oder Komponente → `docs/frontend.md` aktualisiert
- Abgeschlossene Phase → `ROADMAP.md` Tasks als `[x]` markiert
- Implementiertes Feature → Eintrag aus `FEATURES.md` entfernt

## Deployment (bei Backend-Änderungen)

- `flyctl deploy` aus `backends/` erfolgreich durchgeführt
- Swagger UI (`/docs`) zeigt neue Endpunkte korrekt an

## Testanleitung (Pflicht)

Nach jeder Implementierung gebe ich immer an:

1. **Welche Schritte** nötig sind, um das Feature zu sehen (z. B. App starten, Deploy, Seed ausführen)
2. **Wie das Feature getestet** werden kann (konkreter Ablauf: Wo klicken, was eingeben, was erscheinen soll)
3. **Was im Fehlerfall** zu prüfen ist (z. B. Backend-Logs, Browser-Konsole)
