# Changelog

Alle wichtigen Änderungen an KAI werden in dieser Datei dokumentiert.
Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Added

- Neue Mobile/Tablet-Navigation ("Konzept B – KAI vorne, Werkzeuge dahinter"): statt fünf gleichwertiger Tabs gibt es jetzt zwei globale Modi, KAI-Modus (KI-Assistent als Startpunkt, mit neuem Fokus-Karten/Composer/Schnellaufgaben-Startscreen unter `/kai`) und Werkzeuge-Modus (Rezepte, Wochenplan, Einkauf, Einstellungen als Kartenraster unter `/tools`, Tablet-Querformat zeigt eine permanente linke Sidebar statt Kartenraster); Phase 1 der geplanten Umsetzung (siehe `docs/wireframes-mobile.html` / `docs/wireframes-tablet.html`), rein UI-seitig, keine Backend-Änderungen
- Neue Design-Tokens (`Colors.night/blue/cyan/...`, `Fonts`, `Spacing`, `Radii`) in `mobile/lib/theme.ts`; das visuelle Reskin auf die neue Night/Cyan-Palette ist jetzt für die komplette Mobile/Tablet-UI abgeschlossen (Werkzeuge-Screens, KI-Chat, alle Rezept-Screens und -Komponenten, `SyncStatusBanner`, reines Reskin ohne Logikänderung) – die alte grüne Palette wurde vollständig aus `theme.ts` entfernt
- Werkzeuge-Kartenraster: Wochenplan-Karte zeigt jetzt die aktuelle Kalenderwoche und die Anzahl offener Mahlzeiten-Slots (statt eines statischen Textes), Tablet-Querformat zeigt korrekt 3 statt 2 Spalten
- Tablet-Querformat-Sidebar: der aktuell geöffnete Werkzeug-Bereich wird in der Linkliste jetzt hervorgehoben
- Strukturelles Layout-Update für sechs Kern-Screens auf Mobile/Tablet, um näher an `docs/wireframes-tablet.html` heranzukommen (zuvor nur Farb-Reskin, gleiche Struktur wie vor dem Redesign):
  - **Rezepte-Übersicht:** Suchleiste, „Zuletzt gekocht"-Hero-Karte (schmal) bzw. feste Sidebar (breit) mit „Zum Wochenplan"/„Öffnen"
  - **Rezept-Detailansicht:** „Auf einen Blick"-Sidebar (Kennzahlen + Aktionsleiste) auf breiten Bildschirmen
  - **Wochenplan:** echter Personen-Filter (Haushalt/einzelne Mitglieder), filtert die bestehenden Pro-Person-Zeilen
  - **Einkaufsliste:** Fortschritts-Sidebar/-Karte mit echtem „Mit KI prüfen"-Kurzweg (öffnet KI-Chat mit vorformuliertem Prompt)
  - **Kochansicht:** abhakbare Zutaten (lokaler UI-Zustand) und automatisch erkannte nummerierte Zubereitungsschritte
  - **KI-Chat:** permanente Verlauf-Sidebar zeigt jetzt ab Tablet-Breite (`isWide`, ≥768px) statt erst ab Desktop-Ultra-Wide (≥2560px)
- Wochenplan: Tap auf einen Eintrag mit Rezept öffnet die Rezeptdetailansicht als Modal (statt direkt die Rezeptauswahl); über einen "Austauschen"-Button im Modal-Header kann das Rezept im Slot weiterhin direkt ersetzt werden, wahlweise durch ein anderes Rezept oder per Freitext
- PowerSync Stop/Start: neuer "PowerSync stoppen"-Button in den Einstellungen (nur Native), abgesichert per Face-ID/Fingerabdruck, stoppt die PowerSync-Cloud-Instanz, damit Neon zwischen Nutzungsphasen auto-suspenden kann; zusätzlich jetzt ein "PowerSync starten"-Button daneben für den manuellen Neustart (`useStartPowerSync()`)
- Offline-Modus beim App-Start: der automatische PowerSync-Neustart bei jedem App-Öffnen fragt jetzt zuerst per Dialog "Jetzt synchronisieren" vs. "Offline-Modus" ab, bevor überhaupt Biometrie abgefragt wird – im Offline-Modus wird kein Request geschickt und die App nutzt direkt den zuletzt synchronisierten Stand
- Einkaufsliste: Zutatenmengen werden bei der Generierung jetzt anhand der Anzahl zugewiesener Personen relativ zu den Rezept-Portionen skaliert (z.B. Rezept für 2 Portionen, 3 zugewiesene Personen → Menge × 1,5); ohne Personen-Zuweisung bleibt die volle Rezeptmenge unverändert

### Changed

- Rezeptdetail-Logik in `RecipeDetailContent` extrahiert, damit sie sowohl im Vollbild-Screen (`recipe/[id]/index.tsx`) als auch im neuen Wochenplan-Modal genutzt werden kann

### Fixed

- Bulk-Import: Sprung zur Rezeptübersicht nach erfolgreichem Import zeigte auf die beim Navigations-Umbau entfernte Route `/(tabs)/recipes` und landete damit ins Leere – zeigt jetzt korrekt auf `/tools/recipes`
- Einkaufsliste: Zutaten konnten doppelt übernommen werden, wenn ein Rezept für dieselbe Woche eingeplant wurde – Ursache war eine Race Condition, durch die für eine Woche mehrere Wochenpläne statt einem einzigen angelegt werden konnten. `POST /meal-plans` ist jetzt idempotent bezüglich `week_start_date`; bereits bestehende Duplikat-Wochenpläne wurden per Migration bereinigt

---

## [1.0.0] – 2026-05-10

Erster öffentlicher Release von KAI – dem KI-gestützten Familien-Mahlzeitenplaner für bis zu 3 Haushaltsmitglieder.

### Rezeptverwaltung

- Rezepte anlegen, bearbeiten und löschen (Name, Beschreibung, Portionen, Zubereitungszeit, Quell-URL)
- Zutaten mit Mengenangaben und Einheiten verwalten
- Sternebewertungen (1–5) pro Haushaltsmitglied
- Tags für Kategorisierung (Mahlzeitentyp, Familienmitglied, eigene Tags)
- Tag-basierte Filterung mit Multi-Select (AND-Logik)
- Rezepte als JSON exportieren und importieren
- Einzelrezepte per URL scrapen und importieren
- Bulk-Import mehrerer Rezepte per URL-Liste (dreistufiger Workflow: URL-Eingabe → Vorschau/Konfiguration → Ergebnisse)
- Tag- und Bewertungskonfiguration pro Rezept beim Bulk-Import
- Familien-Tags werden bei Umbenennung automatisch synchronisiert

### Wochenplanung

- Wöchentliche Planung mit 5 Mahlzeitentypen pro Tag (Frühstück, Mittagessen, Snack, Abendessen, Dessert)
- Mahlzeiten pro Haushaltsmitglied zuweisen
- Freitexteingabe für eigene Mahlzeiten
- Drag & Drop auf der Web-Plattform
- Long-Press-Kontextmenü (Verschieben, Kopieren, Löschen) auf nativen Plattformen
- Wochenkopie-Funktion für wiederkehrende Pläne
- Schnellzugriff auf zuletzt verwendete Rezepte beim Hinzufügen
- Wochennavigation mit „Heute"-Button
- Responsives Layout: mobil (< 768 px), Tablet, Desktop bis 4K (≥ 2560 px, 7 Tage nebeneinander)
- Zeitzonen-sichere Datumsberechnung

### Einkaufsliste

- Automatische Generierung aus dem Wochenplan für beliebige Datumsbereiche (Schnellauswahl + freier Datepicker)
- Erledigtes in eigene „Erledigt"-Sektion verschieben; Batch-Löschen per Knopf
- Manuelle Einträge (Artikel, Menge, Einheit) hinzufügen
- Verpackungsgrößen-Umrechnung (z. B. 16 g Backpulver → „≈ 1 Pkg.")
- Frischware-Handling: Grammangabe, wenn keine Standardverpackung existiert
- Eigene Mahlzeiten in der Liste farblich hervorgehoben (amber)
- Listenkonflikt-Handling: Zusammenführen oder Ersetzen beim Neugenerieren

### KI-Assistent

- Claude-basierter Chat mit vollständigem Lesezugriff auf alle App-Daten (Rezepte, Wochenplan, Einkaufsliste, Haushaltsmitglieder, Einstellungen)
- Schreibzugriff: Rezepte erstellen/bearbeiten/löschen, Wochenplaneinträge verwalten, Einkaufsliste bearbeiten
- Bestätigungsdialog vor jeder Schreibaktion
- Mehrere unabhängige Konversationen mit automatischer Titelvergabe
- Konversationshistorie laden und wechseln
- Spracherkennung (Sprache → Text) und Sprachausgabe (Text → Sprache) auf iOS/Android
- Strg+Enter Tastaturkürzel zum Absenden (Web)
- Haushalt-Notizen fließen automatisch in den KI-Kontext ein

### Einstellungen & Haushaltsverwaltung

- Haushaltspräferenzen: Kochtage, Warme-Mahlzeiten-Häufigkeit, Reste-Frequenz, Kochskill, Lieblingsküchen, Wochenbudget
- Haushalt-Notizen für den KI-Kontext
- Mitgliederprofil: Name, Kürzel, Farbe, Ernährungsstil, Allergien, Abneigungen, Lieblingsküchen, Schärfetoleranz, Portionsgröße
- Mitglieder hinzufügen und entfernen

### Multiplattform-Unterstützung

- **Web:** Expo Web, vollständige REST-API-Integration, Drag & Drop
- **iOS & Android:** Expo + React Native, PowerSync Offline-First-Synchronisation, nativer Dev Client via EAS
- Plattformspezifische Fehler-Boundaries verhindern komplette App-Abstürze
- Globaler JS-Fehler-Overlay mit vollständigem Stack Trace

### Synchronisation & Infrastruktur

- PowerSync Offline-First-Architektur (native): lokale SQLite-Datenbank, automatischer Sync bei Verbindung
- Neon PostgreSQL (serverless) als Backend-Datenbank
- JWT-basierte PowerSync-Authentifizierung mit RSA-Schlüsseln
- Alembic-Datenbankmigrationen
- fly.io Backend-Hosting (FastAPI)
- Docker Compose für lokale Entwicklungsumgebung
- EAS Build-Konfiguration für native Apps
- Apache 2.0 Open-Source-Lizenz

### Technische Stabilitätsverbesserungen

- PowerSync-Abstürze durch whatwg-url Modul-Konflikte behoben
- TextDecoder/TextEncoder Polyfills für Hermes-Kompatibilität
- Per-Screen Fehler-Boundaries mit wiederverwendbarem `ErrorScreen`-Komponent
- Modal-Präsentations-Abstürze auf Android behoben
- TanStack Query ersetzt fehlerhaftes PowerSync `useQuery`
- Zeitzonen-Fehler bei Datumsberechnung behoben
- Responsives Verhalten auf 4K-Displays optimiert
