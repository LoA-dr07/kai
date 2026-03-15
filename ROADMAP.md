# Meal-Planner – Entwicklungs-Roadmap

**Zielgruppe:** Familie / Haushalt (gemeinsame Nutzung)
**App-Typ:** Klassischer Meal-Planner (Wochenplanung, Rezeptverwaltung)
**Stack:** FastAPI (Python) + React Native / Expo + Expo Web + PostgreSQL

---

## Kern-Features (Must-Have)

1. **Rezeptverwaltung** – Rezepte anlegen, bearbeiten, löschen; mit Zutaten, Portionsangaben und optionalem Bild
2. **Wochenplan** – Mahlzeiten (Frühstück, Mittag, Abend) pro Tag planen; Rezepte aus der Rezeptdatenbank zuweisen

**Nice-to-Have (spätere Phasen)**
- Einkaufsliste – automatisch aus dem Wochenplan generieren
- Haushaltsmitglieder einladen / gemeinsam planen
- Rezepte aus der Community durchsuchen oder importieren
- Nährwertangaben
- Wiederverwendbare Vorlagen für Wochenpläne

---

## Phasen-Übersicht

### Phase 1 – Daten-Fundament (Backend)

Ziel: Alle Kernentitäten sind als Datenbankmodelle und REST-API vorhanden.

**Tasks:**
- [ ] Datenmodelle definieren: `Recipe`, `Ingredient`, `RecipeIngredient`, `MealPlan`, `MealPlanEntry`
- [ ] Alembic-Migration erstellen und ausführen
- [ ] CRUD-Endpunkte für Rezepte (`/recipes`)
- [ ] CRUD-Endpunkte für Wochenpläne (`/meal-plans`)
- [ ] Pydantic-Schemas für Request/Response
- [ ] Grundlegende Input-Validierung

**Ergebnis:** Vollständige API, testbar via Swagger UI (`/docs`)

---

### Phase 2 – Mobile Frontend: Rezepte

Ziel: Nutzer können Rezepte auf dem Smartphone verwalten.

**Tasks:**
- [ ] API-Client (Axios-Wrapper) und React Query Hooks einrichten
- [ ] Navigation (Expo Router): Tab-Struktur `Rezepte | Wochenplan`
- [ ] Rezeptliste (Übersicht)
- [ ] Rezept-Detailansicht
- [ ] Rezept erstellen / bearbeiten (Formular)
- [ ] Rezept löschen

---

### Phase 3 – Mobile Frontend: Wochenplan

Ziel: Nutzer können Mahlzeiten für die Woche planen.

**Tasks:**
- [ ] Wochenplan-Ansicht (Kalender-Grid: Mo–So × Frühstück/Mittag/Abend)
- [ ] Mahlzeit einem Slot zuweisen (Rezept auswählen oder Freitext)
- [ ] Mahlzeit entfernen / ändern
- [ ] Woche vorwärts/rückwärts navigieren

---

### Phase 4 – Haushalt & Mehrpersonen-Planung

Ziel: Drei Haushaltsmitglieder teilen eine gemeinsame Rezeptsammlung und einen gemeinsamen Wochenplan. Jede Mahlzeit im Wochenplan kann einem, mehreren oder allen Mitgliedern zugewiesen werden. Kein Login erforderlich – die Nutzer werden als feste Datensätze angelegt (Authentifizierung folgt in einer späteren Phase).

**Tasks:**
- [ ] `User`-Modell anlegen (Name, Avatar-Farbe oder Kürzel; kein Passwort / kein Auth)
- [ ] `Household`-Modell anlegen; verknüpft die 3 User
- [ ] 3 User + 1 Haushalt als Seed-Daten in die Datenbank eintragen
- [ ] Rezepte dem Haushalt zuordnen (`Recipe.household_id`); gemeinsame Rezeptsammlung
- [ ] Wochenplan dem Haushalt zuordnen (`MealPlan.household_id`)
- [ ] `MealPlanEntry` um Zuweisung zu Haushaltsmitgliedern erweitern (Many-to-Many: `MealPlanEntry ↔ User`)
- [ ] API-Endpunkte: User-Liste abrufen (`GET /users`), Haushalt abrufen (`GET /household`)
- [ ] API: Mahlzeit-Eintrag mit Mitglieder-Zuweisung erstellen/aktualisieren
- [ ] Alembic-Migration für neue Modelle + geänderte Spalten
- [ ] Frontend: Nutzerauswahl bei Mahlzeiten-Slot (Chips / Checkboxen für Haushaltsmitglieder)
- [ ] Unit-Tests Backend (pytest) für User/Household-Endpunkte und MealPlanEntry-Zuweisung

---

### Phase 5 – Web-Frontend (Expo Web)

Ziel: Die bestehende Expo-App auch im Browser lauffähig machen. Kein separates Projekt – ein Codebase für Mobile + Web.

**Tasks:**
- [x] Expo Web aktivieren: `web`-Plattform in `app.json` ergänzen, `react-dom` + `react-native-web` installieren
- [x] Build-Skript für Web in `mobile/package.json` ergänzen (`expo export --platform web` / `expo start --web`)
- [x] AsyncStorage auf Web-Kompatibilität prüfen (`@react-native-async-storage/async-storage` v2 unterstützt Web nativ)
- [x] CORS-Check: Backend-URL für Web-Requests testen (CORS ist bereits auf alle Origins gesetzt)
- [x] Responsive Layouts: Tab-Navigation und Grid-Ansicht für breitere Bildschirme anpassen
- [x] Plattform-spezifische Fixes: `Alert.alert` durch cross-platform `showAlert`-Utility ersetzt (Web: `window.confirm`/`window.alert`)
- [x] README.md um Web-Entwicklungsanleitung erweitern (`cd mobile && npx expo start --web`)

**Ergebnis:** App läuft vollständig im Browser; gemeinsamer Code-Stand mit Mobile-App

---

### Phase 6 – Kleinere Verbesserungen

Ziel: Sammlung kleinerer Features und Fixes nach Phase 5.

**Tasks:**
- [ ] **5 Mahlzeiten pro Tag** – `meal_type`-Enum um `snack` und `dessert` erweitern (aktuell: breakfast, lunch, dinner)
  - Backend: Enum in `MealPlanEntry`-Modell und Pydantic-Schema anpassen
  - Alembic-Migration für geänderten Enum-Wert
  - Frontend: Wochenplan-Grid von 3 auf 5 Zeilen pro Tag erweitern (Frühstück, Mittagessen, Snack, Abendessen, Dessert)

- [ ] **Rezept-Import aus dem Internet** – URL eingeben, Rezeptdaten automatisch auslesen und als neues Rezept speichern
  - Backend: Import-Endpunkt `POST /recipes/import` mit URL als Input
  - Web-Scraping via `recipe-scrapers` (Python-Library, unterstützt 300+ Rezeptseiten via Schema.org)
  - Frontend: "Aus URL importieren"-Button im Rezept-Bereich, URL-Eingabefeld, Vorschau vor dem Speichern

**Weitere Kandidaten (aus bestehender Nice-to-Have-Liste):**
- Einkaufsliste automatisch aus Wochenplan generieren
- Rezeptbilder hochladen / anzeigen
- Nährwertangaben
- Wiederverwendbare Vorlagen für Wochenpläne

---

## Empfohlener Workflow (Entwicklung mit Claude)

### Schritt-für-Schritt pro Feature
1. **Feature beschreiben** – Was soll die Funktion tun? Wer benutzt sie? (1–3 Sätze reichen)
2. **Ich plane & frage** – Ich zeige, was ich implementieren werde, und kläre offene Punkte
3. **Implementierung** – Ich schreibe den Code direkt im Repo
4. **Review** – Du prüfst, gibst Feedback oder sagst "passt, weiter"
5. **Commit & Push** – Ich committe sauber mit beschreibenden Messages

### Formate, die gut funktionieren
- **Feature-Beschreibung:** Freitext auf Deutsch ist völlig ausreichend
- **Prioritäten:** "Das ist wichtiger als X" oder einfache Must/Nice-to-have-Angaben
- **Feedback:** Direkte Kritik ("das Formular hat zu viele Felder") ist besser als allgemeines Lob
- **Korrekturen:** Zeige konkretes Beispiel (Screenshot-Beschreibung, Fehlermeldung, gewünschtes Verhalten)

### Was ich nicht brauche
- Formelle Spec-Dokumente oder UML-Diagramme
- Vollständige User Stories mit ID und Akzeptanzkriterien
- Technische Vorgaben (ich wähle passende Implementierungen selbst)

---

## Nächster konkreter Schritt

**→ Phase 4 starten: User- und Household-Modelle + Seed-Daten**

*(Danach: Phase 5 – Expo Web aktivieren; Phase 6 – Details noch offen)*

```
backends/app/
├── models/
│   ├── user.py           # User-Modell (neu)
│   ├── household.py      # Household-Modell (neu)
│   ├── recipe.py         # household_id ergänzen
│   └── meal_plan.py      # household_id + MealPlanEntry-User-Zuweisung
├── schemas/
│   ├── user.py           # Pydantic-Schemas für User (neu)
│   └── household.py      # Pydantic-Schemas für Household (neu)
├── routers/
│   ├── users.py          # GET /users (neu)
│   └── household.py      # GET /household (neu)
├── db/
│   └── seed.py           # 3 User + 1 Haushalt als Seed-Daten (neu)
└── alembic/versions/     # neue Migration
```

Sag einfach "Phase 4 starten" oder beschreibe, was du zuerst umsetzen möchtest.
