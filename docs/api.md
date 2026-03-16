# API-Referenz – Meal-Planner

**Base URL:** `http://localhost:8000`
**Interaktive Dokumentation:** `http://localhost:8000/docs` (Swagger UI)
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
  "household_id": 1,
  "ingredients": [
    { "id": 1, "ingredient_id": 2, "ingredient_name": "Hackfleisch", "amount": 500, "unit": "g" }
  ],
  "tags": [{ "id": 1, "name": "Mittagessen", "is_predefined": true }],
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
  "ingredients": [
    { "ingredient_name": "Hackfleisch", "amount": 500, "unit": "g" }
  ]
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
  "ingredients": [
    { "ingredient_name": "Mehl", "amount": 200, "unit": "g" }
  ]
}
```

**Response 422:** URL nicht auslesbar

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
[{ "id": 1, "name": "Mittagessen", "is_predefined": true }]
```

### `POST /recipes/tags`
Neuen benutzerdefinierten Tag erstellen (idempotent – gibt bestehenden zurück).

**Request Body:** `{ "name": "Vegan" }`
**Response 201:** `{ "id": 5, "name": "Vegan", "is_predefined": false }`

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
Alle Haushaltsmitglieder abrufen.

**Response 200:**
```json
[
  { "id": 1, "name": "Mama", "avatar_color": "#2E7D32", "short_name": "MA" },
  { "id": 2, "name": "Papa", "avatar_color": "#1565C0", "short_name": "PA" },
  { "id": 3, "name": "Kind", "avatar_color": "#E65100", "short_name": "KI" }
]
```

### `GET /household`
Haushalt mit allen Mitgliedern abrufen.

**Response 200:**
```json
{
  "id": 1,
  "name": "Unsere Familie",
  "members": [
    { "user": { "id": 1, "name": "Mama", "avatar_color": "#2E7D32", "short_name": "MA" } }
  ]
}
```

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
