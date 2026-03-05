# Meal-Planner – Entwicklungs-Roadmap

**Zielgruppe:** Familie / Haushalt (gemeinsame Nutzung)
**App-Typ:** Klassischer Meal-Planner (Wochenplanung, Rezeptverwaltung, Einkaufsliste)
**Stack:** FastAPI (Python) + React Native / Expo + PostgreSQL

---

## Kern-Features (Must-Have)

1. **Rezeptverwaltung** – Rezepte anlegen, bearbeiten, löschen; mit Zutaten, Portionsangaben und optionalem Bild
2. **Wochenplan** – Mahlzeiten (Frühstück, Mittag, Abend) pro Tag planen; Rezepte aus der Rezeptdatenbank zuweisen
3. **Einkaufsliste** – Automatisch aus dem Wochenplan generieren; Zutaten zusammenfassen, abhaken

**Nice-to-Have (spätere Phasen)**
- Haushaltsmitglieder einladen / gemeinsam planen
- Rezepte aus der Community durchsuchen oder importieren
- Nährwertangaben
- Wiederverwendbare Vorlagen für Wochenpläne

---

## Phasen-Übersicht

### Phase 1 – Daten-Fundament (Backend)

Ziel: Alle Kernentitäten sind als Datenbankmodelle und REST-API vorhanden.

**Tasks:**
- [ ] Datenmodelle definieren: `Recipe`, `Ingredient`, `RecipeIngredient`, `MealPlan`, `MealPlanEntry`, `ShoppingList`, `ShoppingListItem`
- [ ] Alembic-Migration erstellen und ausführen
- [ ] CRUD-Endpunkte für Rezepte (`/recipes`)
- [ ] CRUD-Endpunkte für Wochenpläne (`/meal-plans`)
- [ ] Endpunkt: Einkaufsliste aus Wochenplan generieren (`/meal-plans/{id}/shopping-list`)
- [ ] Pydantic-Schemas für Request/Response
- [ ] Grundlegende Input-Validierung

**Ergebnis:** Vollständige API, testbar via Swagger UI (`/docs`)

---

### Phase 2 – Mobile Frontend: Rezepte

Ziel: Nutzer können Rezepte auf dem Smartphone verwalten.

**Tasks:**
- [ ] API-Client (Axios-Wrapper) und React Query Hooks einrichten
- [ ] Navigation (Expo Router): Tab-Struktur `Rezepte | Wochenplan | Einkaufsliste`
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

### Phase 4 – Mobile Frontend: Einkaufsliste

Ziel: Einkaufsliste wird automatisch generiert und ist interaktiv.

**Tasks:**
- [ ] Einkaufsliste aus aktuellem Wochenplan generieren (API-Aufruf)
- [ ] Zutaten anzeigen (gruppiert nach Kategorie oder sortiert)
- [ ] Artikel abhaken (lokaler Status)
- [ ] Liste zurücksetzen / neu generieren

---

### Phase 5 – Haushalt & Qualität

Ziel: Mehrere Personen können den Planer gemeinsam nutzen; Code ist stabil.

**Tasks:**
- [ ] Entscheidung: Authentifizierung (einfaches Passwort / E-Mail-Login vs. kein Login)
- [ ] Haushalt-Konzept: Mehrere Nutzer teilen einen Wochenplan
- [ ] Unit-Tests Backend (pytest)
- [ ] Grundlegende Tests Frontend (Jest / React Testing Library)
- [ ] CI/CD-Pipeline (GitHub Actions: Lint + Tests bei jedem Push)
- [ ] Deployment-Strategie klären (Backend: Railway / Fly.io / VPS; App: Expo Go / EAS Build)

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

**→ Phase 1 starten: Datenmodelle und erste API-Endpunkte**

```
backends/app/
├── models/          # SQLAlchemy-Modelle (neu)
│   ├── recipe.py
│   ├── meal_plan.py
│   └── shopping_list.py
├── schemas/         # Pydantic-Schemas (neu)
├── routers/         # FastAPI-Router (neu)
└── main.py          # Router einbinden
```

Sag einfach "Phase 1 starten" oder beschreibe, was du zuerst umsetzen möchtest.
