# Changelog

Alle wichtigen Änderungen an KAI werden in dieser Datei dokumentiert.
Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

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
