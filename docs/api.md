# API-Referenz – Meal-Planner

**Base URL (Produktion):** `https://meal-planner-api.fly.dev`
**Base URL (lokal):** `http://localhost:8000`
**Interaktive Dokumentation:** `https://meal-planner-api.fly.dev/docs` (Swagger UI)
**Content-Type:** `application/json`

---

## Enums

### MealType
| Wert | Deutsch |
|------|---------|
| `breakfast` | Frühstück |
| `lunch` | Mittagessen |
| `snack` | Snack |
| `dinner` | Abendessen |
| `dessert` | Dessert |

---

## PowerSync-Authentifizierung (`/auth`)

**Voraussetzung:** `POWERSYNC_PRIVATE_KEY` und `POWERSYNC_PUBLIC_KEY` in `backends/.env` konfiguriert.

### `GET /auth/powersync-token`
Gibt einen signierten JWT zurück, den der PowerSync-Client zur Authentifizierung verwendet.

**Response 200:**
```json
{ "token": "eyJ..." }
```
**Response 503:** `POWERSYNC_PRIVATE_KEY` nicht konfiguriert

---

### `GET /auth/jwks.json`
Gibt den öffentlichen RSA-Schlüssel als JWKS zurück. Diese URL wird im PowerSync Dashboard unter **Auth → JWKS URI** hinterlegt.

**Response 200:**
```json
{
  "keys": [{
    "kty": "RSA", "use": "sig", "alg": "RS256",
    "kid": "powersync-key-1", "n": "...", "e": "..."
  }]
}
```
**Response 503:** `POWERSYNC_PUBLIC_KEY` nicht konfiguriert

---

## Health

### `GET /health`
Server-Status prüfen.

**Response 200:**
```json
{ "status": "ok" }
```

---

## Rezepte (`/recipes`)

### `GET /recipes`
Alle Rezepte abrufen (alphabetisch sortiert).

**Response 200:** `Recipe[]`
```json
[{
  "id": 1,
  "name": "Spaghetti Bolognese",
  "description": "Klassisches Nudelgericht",
  "servings": 4,
  "prep_time_minutes": 45,
  "source_url": null,
  "household_id": 1,
  "ingredients": [
    { "id": 1, "ingredient_id": 2, "ingredient_name": "Hackfleisch", "amount": 500, "unit": "g" }
  ],
  "tags": [{ "id": 1, "name": "Mittagessen", "is_predefined": true, "category": "meal_type" }],
  "ratings": [{ "id": 1, "recipe_id": 1, "user_id": 1, "stars": 4 }]
}]
```

### `POST /recipes`
Neues Rezept erstellen.

**Request Body:**
```json
{
  "name": "Spaghetti Bolognese",
  "description": "optional",
  "servings": 4,
  "prep_time_minutes": 45,
  "ingredients": [
    { "ingredient_id": 2, "amount": 500, "unit": "g" }
  ],
  "tag_ids": [1, 3]
}
```

**Response 201:** `Recipe`

### `GET /recipes/{id}`
Einzelnes Rezept abrufen.

**Response 200:** `Recipe`
**Response 404:** Rezept nicht gefunden

### `PATCH /recipes/{id}`
Rezept teilweise aktualisieren (alle Felder optional).
Bei `ingredients`: vollständiger Ersatz der Zutatenliste.
Bei `tag_ids`: vollständiger Ersatz der Tags.

**Request Body:** (alle Felder optional)
```json
{
  "name": "Neuer Name",
  "servings": 2,
  "ingredients": [...],
  "tag_ids": [1]
}
```

**Response 200:** `Recipe`
**Response 404:** Rezept nicht gefunden

### `DELETE /recipes/{id}`
Rezept löschen (inkl. Zutaten-Verknüpfungen und Bewertungen).

**Response 204:** Kein Inhalt
**Response 404:** Rezept nicht gefunden

---

## Rezept Import/Export

### `GET /recipes/export`
Alle Rezepte als JSON exportieren (inkl. Zutaten-Namen, ohne IDs).

**Response 200:**
```json
[{
  "name": "Spaghetti Bolognese",
  "description": "...",
  "servings": 4,
  "prep_time_minutes": 45,
  "source_url": null,
  "ingredients": [
    { "ingredient_name": "Hackfleisch", "amount": 500, "unit": "g" }
  ],
  "ratings": [{ "user_id": 1, "stars": 5 }],
  "tags": ["Pasta", "Fleisch"]
}]
```

### `POST /recipes/import`
Rezepte aus JSON-Array importieren. Duplikate (gleicher Name) werden übersprungen. Fehlende Zutaten werden automatisch angelegt.

**Request Body:** `RecipeExportItem[]` (gleiche Struktur wie Export)

**Response 200:**
```json
{ "created": 3, "skipped": 1 }
```

### `POST /recipes/import/url`
Rezept von einer URL einlesen (via `recipe-scrapers`, unterstützt 300+ Rezeptseiten).

**Request Body:**
```json
{ "url": "https://example.com/rezept" }
```

**Response 200:** Vorschau-Objekt (noch nicht gespeichert):
```json
{
  "name": "Titel vom Web",
  "description": "...",
  "servings": 4,
  "prep_time_minutes": 30,
  "source_url": "https://example.com/rezept",
  "ingredients": [
    { "ingredient_name": "Mehl", "amount": 200, "unit": "g" }
  ]
}
```

**Response 422:** URL nicht auslesbar

---

### `POST /recipes/import/url/bulk-preview`
Scrape mehrere URLs und gib Vorschau-Objekte zurück, **ohne** etwas zu speichern. Fehler pro URL werden zurückgegeben, nicht als HTTP-Fehler.

**Request Body:**
```json
{ "items": [{ "url": "https://example.com/rezept1" }, { "url": "https://example.com/rezept2" }] }
```

**Response 200:**
```json
{
  "results": [
    { "url": "https://example.com/rezept1", "preview": { "name": "Spaghetti", ... }, "error": null },
    { "url": "https://example.com/rezept2", "preview": null, "error": "Kein Rezept-Schema gefunden" }
  ]
}
```

---

### `POST /recipes/import/url/bulk`
Mehrere Rezepte direkt speichern. Tags und Bewertungen werden **pro Rezept** individuell angegeben. Jede URL wird in einem Savepoint isoliert verarbeitet.

**Request Body:**
```json
{
  "items": [
    {
      "url": "https://example.com/rezept1",
      "tag_ids": [1, 3],
      "ratings": [{ "user_id": 1, "stars": 4 }, { "user_id": 2, "stars": 3 }]
    },
    {
      "url": "https://example.com/rezept2",
      "tag_ids": [],
      "ratings": []
    }
  ]
}
```

**Response 200:**
```json
{
  "created_ids": [42, 43],
  "failed": [{ "url": "https://example.com/rezept3", "error": "..." }]
}
```

---

## Bewertungen

### `POST /recipes/{id}/ratings`
Sternebewertung erstellen oder aktualisieren (Upsert pro User).

**Request Body:**
```json
{ "user_id": 1, "stars": 4 }
```
`stars`: 0–5

**Response 200:**
```json
{ "id": 1, "recipe_id": 1, "user_id": 1, "stars": 4 }
```

---

## Zutaten (`/recipes/ingredients`)

### `GET /recipes/ingredients`
Alle Zutaten abrufen (alphabetisch).

**Response 200:**
```json
[{ "id": 1, "name": "Hackfleisch" }]
```

### `POST /recipes/ingredients`
Neue Zutat erstellen.

**Request Body:** `{ "name": "Mehl" }`
**Response 201:** `{ "id": 2, "name": "Mehl" }`
**Response 409:** Zutat existiert bereits

---

## Tags (`/recipes/tags`)

### `GET /recipes/tags`
Alle Tags abrufen (vordefinierte zuerst, dann alphabetisch).

**Response 200:**
```json
[
  { "id": 1, "name": "Mittagessen", "is_predefined": true, "category": "meal_type" },
  { "id": 6, "name": "Mama", "is_predefined": true, "category": "family" }
]
```

### `POST /recipes/tags`
Neuen benutzerdefinierten Tag erstellen (idempotent – gibt bestehenden zurück).

**Request Body:** `{ "name": "Vegan" }`
**Response 201:** `{ "id": 9, "name": "Vegan", "is_predefined": false, "category": null }`

---

## Wochenpläne (`/meal-plans`)

### `GET /meal-plans`
Alle Wochenpläne abrufen (neueste zuerst).

**Response 200:** `MealPlan[]`
```json
[{
  "id": 1,
  "name": "KW 12",
  "week_start_date": "2026-03-16",
  "household_id": null,
  "entries": [
    {
      "id": 1,
      "meal_plan_id": 1,
      "day_of_week": 0,
      "meal_type": "lunch",
      "recipe_id": 1,
      "custom_meal": null,
      "assigned_users": [{ "id": 1, "name": "Mama", "avatar_color": "#2E7D32", "short_name": "MA" }]
    }
  ]
}]
```

### `POST /meal-plans`
Neuen Wochenplan erstellen (optional mit initialen Einträgen).

**Request Body:**
```json
{
  "name": "KW 12",
  "week_start_date": "2026-03-16",
  "entries": [
    {
      "day_of_week": 0,
      "meal_type": "lunch",
      "recipe_id": 1,
      "custom_meal": null,
      "assigned_user_ids": [1, 2]
    }
  ]
}
```

`week_start_date`: ISO-Datum (sollte ein Montag sein)
`day_of_week`: 0 = Montag, …, 6 = Sonntag
`recipe_id` oder `custom_meal`: mindestens eines angeben (beide optional, beide null möglich)

**Response 201:** `MealPlan`

### `GET /meal-plans/{id}`
Einzelnen Wochenplan mit allen Einträgen abrufen.

**Response 200:** `MealPlan`
**Response 404:** Plan nicht gefunden

### `PATCH /meal-plans/{id}`
Plan-Name oder -Datum aktualisieren.

**Request Body:** (alle Felder optional)
```json
{ "name": "KW 13", "week_start_date": "2026-03-23" }
```

**Response 200:** `MealPlan`

### `DELETE /meal-plans/{id}`
Wochenplan löschen (inkl. aller Einträge).

**Response 204:** Kein Inhalt

---

## Mahlzeit-Einträge (`/meal-plans/{plan_id}/entries`)

### `POST /meal-plans/{plan_id}/entries`
Einzelnen Mahlzeit-Eintrag zu einem Plan hinzufügen.

**Request Body:**
```json
{
  "day_of_week": 1,
  "meal_type": "dinner",
  "recipe_id": null,
  "custom_meal": "Pizza bestellen",
  "assigned_user_ids": [1, 2, 3]
}
```

**Response 201:** `MealPlanEntry`

### `PATCH /meal-plans/{plan_id}/entries/{entry_id}`
Mahlzeit-Eintrag aktualisieren.

**Request Body:** (alle Felder optional)
```json
{
  "recipe_id": 5,
  "custom_meal": null,
  "assigned_user_ids": [2]
}
```

**Response 200:** `MealPlanEntry`
**Response 404:** Plan oder Eintrag nicht gefunden

### `DELETE /meal-plans/{plan_id}/entries/{entry_id}`
Mahlzeit-Eintrag entfernen.

**Response 204:** Kein Inhalt

---

## Haushalt & User

### `GET /users`
Alle Haushaltsmitglieder abrufen (inkl. Präferenzen).

**Response 200:**
```json
[
  {
    "id": 1, "name": "Mama", "avatar_color": "#2E7D32", "short_name": "MA",
    "preferences": {
      "dietary_restrictions": ["vegetarian"],
      "allergies": [],
      "disliked_ingredients": [],
      "liked_cuisines": ["italian"],
      "spice_tolerance": "medium",
      "portion_size": "normal"
    }
  }
]
```

### `POST /users`
Neues Haushaltsmitglied anlegen. Erstellt gleichzeitig einen `category='family'`-Tag mit dem gleichen Namen, der Rezepten zugewiesen werden kann.

**Request Body:**
```json
{ "name": "Oma", "avatar_color": "#00838F", "short_name": "OM" }
```

**Response 201:** `UserOut`
**Fehler:** 409 wenn der Name bereits als family-Tag vergeben ist und nicht zugeordnet werden kann.

---

### `PATCH /users/{user_id}`
Name, Kürzel und/oder Farbe eines Haushaltsmitglieds ändern. Bei Namensänderung wird der zugehörige `family`-Tag automatisch umbenannt (alle Rezept-Zuordnungen bleiben erhalten).

**Request Body** (alle Felder optional):
```json
{ "name": "Anna", "short_name": "AN", "avatar_color": "#C62828" }
```

**Response 200:** `UserOut` (aktualisiert)
**Response 404:** User nicht gefunden

---

### `DELETE /users/{user_id}`
Haushaltsmitglied löschen. Folgende Daten werden dabei entfernt:
- Der zugehörige `family`-Tag (und damit alle Rezept-Zuordnungen über diesen Tag)
- Alle Bewertungen (`recipe_ratings`) des Users (DB-CASCADE)
- Alle Wochenplan-Zuordnungen (`meal_plan_entry_users`) des Users (DB-CASCADE)
- Die Haushaltsmitgliedschaft (`household_members`) (DB-CASCADE)

**Response 204:** Kein Inhalt
**Response 404:** User nicht gefunden

---

### `PUT /users/{user_id}/preferences`
Persönliche Präferenzen eines Haushaltsmitglieds speichern (vollständiger Ersatz).

**Request Body:**
```json
{
  "preferences": {
    "dietary_restrictions": ["vegetarian"],
    "allergies": ["peanuts"],
    "disliked_ingredients": ["Rosenkohl"],
    "liked_cuisines": ["italian", "asian"],
    "spice_tolerance": "mild",
    "portion_size": "normal"
  }
}
```

**Response 200:** `UserOut` (mit aktualisierten Präferenzen)
**Response 404:** User nicht gefunden

Erlaubte Werte:
- `dietary_restrictions`: `vegetarian`, `vegan`, `pescatarian`, `gluten_free`, `lactose_free`, `low_carb`, `halal`, `kosher`
- `allergies`: `peanuts`, `tree_nuts`, `dairy`, `eggs`, `wheat`, `shellfish`, `fish`, `soy`, `sesame`
- `spice_tolerance`: `mild`, `medium`, `spicy`
- `portion_size`: `small`, `normal`, `large`

### `GET /household`
Haushalt mit allen Mitgliedern und Einstellungen abrufen.

**Response 200:**
```json
{
  "id": 1,
  "name": "Unser Haushalt",
  "members": [
    { "id": 1, "name": "Mama", "avatar_color": "#2E7D32", "short_name": "MA", "preferences": {} }
  ],
  "settings": {
    "cooking_days": ["monday","tuesday","wednesday","thursday","friday"],
    "hot_meal_time": "dinner",
    "cold_meal_days": [],
    "leftovers_frequency": "sometimes",
    "shared_meals_importance": 3,
    "weekly_budget": null,
    "preferred_cuisines": [],
    "cooking_skill_level": "medium",
    "notes": ""
  }
}
```

### `PUT /household/settings`
Haushalts-Einstellungen speichern (vollständiger Ersatz).

**Request Body:**
```json
{
  "settings": {
    "cooking_days": ["monday","wednesday","friday"],
    "hot_meal_time": "dinner",
    "cold_meal_days": ["saturday"],
    "leftovers_frequency": "often",
    "shared_meals_importance": 4,
    "weekly_budget": 120.0,
    "preferred_cuisines": ["italian","german"],
    "cooking_skill_level": "medium",
    "notes": "Wir kochen unter der Woche max. 30 Minuten."
  }
}
```

**Response 200:** `HouseholdOut` (mit aktualisierten Einstellungen)
**Response 404:** Haushalt nicht gefunden

Erlaubte Werte:
- `cooking_days` / `cold_meal_days`: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- `hot_meal_time`: `lunch`, `dinner`, `both`
- `leftovers_frequency`: `never`, `sometimes`, `often`
- `shared_meals_importance`: `1`–`5`
- `cooking_skill_level`: `beginner`, `medium`, `advanced`
- `notes`: Freitext – wird als `HAUSHALT-NOTIZEN` in den KI-Prompt beider AI-Endpunkte injiziert (leer = kein Abschnitt)

---

## KI-Mahlzeitenplanung (`/ai`)

**Voraussetzung:** `ANTHROPIC_API_KEY` in `backends/.env` konfiguriert.

### `POST /ai/meal-plan-suggestion`
KI-gestützten Wochenplan-Vorschlag generieren (via Claude API).

**Request Body:**
```json
{
  "week_start_date": "2026-03-23",
  "requesting_user_id": 1,
  "special_wishes": "Bitte viel Pasta diese Woche",
  "meal_types": ["breakfast", "dinner"]
}
```

`meal_types`: Optional. Welche Mahlzeitstypen geplant werden sollen. Default: alle 5 (`breakfast`, `lunch`, `snack`, `dinner`, `dessert`). Min. 1 Eintrag.

**Response 200:**
```json
{
  "week_start_date": "2026-03-23",
  "entries": [
    {
      "day_of_week": 0,
      "meal_type": "breakfast",
      "recipe_id": 3,
      "recipe_name": "Haferflocken mit Beeren",
      "custom_meal": null,
      "assigned_user_ids": [1, 2, 3],
      "reason": "Schnelles Frühstück für alle"
    }
  ]
}
```

`day_of_week`: 0=Montag … 6=Sonntag.
Die Antwort enthält `7 × len(meal_types)` Basiseinträge. Bei unterschiedlichen Präferenzen der Haushaltsmitglieder für denselben Slot (z.B. wegen „Nie"-Bewertungen) können zusätzliche Einträge pro Person/Gruppe entstehen.
Rezepte, die ein Haushaltsmitglied mit 0 Sternen („Nie") bewertet hat, werden nie für dieses Mitglied eingeplant.

**Response 404:** Nutzer oder Haushalt nicht gefunden
**Response 503:** `ANTHROPIC_API_KEY` nicht konfiguriert
**Response 502:** Claude API-Fehler oder ungültige KI-Antwort

---

### `POST /ai/chat`
Freier KI-Chat für Rezeptvorschläge und Ernährungsberatung (via Claude API).

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Schlage mir ein schnelles Abendessen vor" }
  ],
  "week_start_date": "2026-03-23"
}
```

`messages`: Vollständige Gesprächshistorie (abwechselnd `user` / `assistant`). `week_start_date`: Optional, wird als Kontext mitgeliefert.

**Response 200:**
```json
{
  "reply": "Ich empfehle dir diese drei Gerichte für ein schnelles Abendessen:",
  "recipe_suggestions": [
    {
      "recipe_id": 5,
      "recipe_name": "Pasta Carbonara",
      "reason": "Nur 20 Minuten Zubereitungszeit",
      "is_new_recipe": false
    },
    {
      "recipe_id": null,
      "recipe_name": "Avocado-Toast",
      "reason": "Sehr schnell, kein Kochen nötig",
      "is_new_recipe": true
    }
  ]
}
```

`recipe_id`: Gesetzt wenn das Rezept in der Haushaltsdatenbank existiert, sonst `null`.
`is_new_recipe`: `true` wenn das Rezept nicht in der Datenbank ist.
`recipe_suggestions`: Leer wenn keine Rezeptvorschläge gemacht werden.

**Response 503:** `ANTHROPIC_API_KEY` nicht konfiguriert
**Response 502:** Claude API-Fehler

---

## HTTP-Status-Codes

| Code | Bedeutung |
|------|-----------|
| 200 | OK |
| 201 | Erstellt |
| 204 | Kein Inhalt (nach DELETE) |
| 404 | Ressource nicht gefunden |
| 409 | Konflikt (z.B. Zutat existiert bereits) |
| 422 | Validierungsfehler / URL nicht auslesbar |
| 502 | KI-Fehler (Anthropic API oder Antwortformat) |
| 503 | KI-Funktion nicht konfiguriert (fehlender API-Key) |
