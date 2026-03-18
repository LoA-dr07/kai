# Architektur – Meal-Planner

## Systemüberblick

```
┌─────────────────────────────────────────┐
│           Client (Frontend)             │
│  React Native / Expo                    │
│  • Mobile (iOS/Android via Expo Go)     │
│  • Web (Browser via Expo Web)           │
└────────────────┬────────────────────────┘
                 │ HTTP/JSON (Axios, 10s Timeout)
                 │ EXPO_PUBLIC_API_URL
                 ▼
┌─────────────────────────────────────────┐
│           Backend (FastAPI)             │
│  Python · Uvicorn · CORS: *             │
│  http://localhost:8000                  │
│  Swagger UI: /docs                      │
└────────────────┬────────────────────────┘
                 │ SQLAlchemy ORM
                 ▼
┌─────────────────────────────────────────┐
│         PostgreSQL Datenbank            │
│  Migrationen via Alembic                │
└─────────────────────────────────────────┘
```

---

## Backend-Schichten

```
HTTP Request
    ↓
Router (backends/app/routers/)
    • Validierung via Pydantic-Schema
    • FastAPI Dependency Injection (DB-Session)
    ↓
Business-Logik (inline im Router)
    • SQLAlchemy-Queries
    • Fehlerbehandlung (HTTPException)
    ↓
SQLAlchemy ORM (backends/app/models/)
    ↓
PostgreSQL
    ↓
Pydantic-Schema (Response-Serialisierung)
    ↓
JSON Response
```

---

## Frontend-Schichten

```
Screen (mobile/app/)
    ↓
React Query Hook (mobile/lib/hooks/)
    • useQuery  → GET-Anfragen (gecacht)
    • useMutation → POST/PATCH/DELETE + Cache-Invalidierung
    ↓
Axios API-Client (mobile/lib/api.ts)
    • baseURL: EXPO_PUBLIC_API_URL
    • timeout: 10s
    ↓
FastAPI Backend
```

---

## Datenbankschema

### Tabellen

#### `households`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(255) | Haushalt-Name |
| settings | JSONB | KI-Einstellungen (Kochtage, Mahlzeitenzeit, Budget, …) |

#### `users`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(100) | Vollständiger Name |
| avatar_color | VARCHAR(20) | Hex-Farbe, z.B. `#2E7D32` |
| short_name | VARCHAR(4) | Kürzel, z.B. `MA`, `PA`, `KI` |
| preferences | JSONB | Persönliche Präferenzen (Ernährung, Allergien, …) |

#### `household_members` *(Junction)*
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| household_id | INTEGER FK → households.id | |
| user_id | INTEGER FK → users.id | |

#### `ingredients`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(255) UNIQUE | Zutat-Name |

#### `tags`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(100) UNIQUE | Tag-Name |
| is_predefined | BOOLEAN | Vordefiniert oder benutzerdefiniert |
| category | VARCHAR(50) NULL | Kategorie: `meal_type`, `family`, oder NULL (custom) |

#### `recipes`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(255) | Rezept-Name |
| description | TEXT | Freitext-Beschreibung |
| servings | INTEGER | Portionen (default: 2) |
| prep_time_minutes | INTEGER | Zubereitungszeit |
| household_id | INTEGER FK → households.id | Haushalt-Zuordnung |

#### `recipe_ingredients` *(Junction)*
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| recipe_id | INTEGER FK → recipes.id CASCADE | |
| ingredient_id | INTEGER FK → ingredients.id | |
| amount | FLOAT | Menge |
| unit | VARCHAR(50) | Einheit (z.B. `g`, `ml`, `Stück`) |

*UNIQUE(recipe_id, ingredient_id)*

#### `recipe_tags` *(Junction)*
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| recipe_id | INTEGER FK → recipes.id CASCADE | |
| tag_id | INTEGER FK → tags.id CASCADE | |

#### `recipe_ratings`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| recipe_id | INTEGER FK → recipes.id CASCADE | |
| user_id | INTEGER FK → users.id CASCADE | |
| stars | INTEGER | 0–5 Sterne |

*UNIQUE(recipe_id, user_id) – Upsert pro Nutzer*

#### `meal_plans`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| name | VARCHAR(255) | Plan-Name |
| week_start_date | DATE | Montag der Woche |
| household_id | INTEGER FK → households.id | |

#### `meal_plan_entries`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| meal_plan_id | INTEGER FK → meal_plans.id CASCADE | |
| day_of_week | INTEGER | 0=Mo, 1=Di, …, 6=So |
| meal_type | ENUM | `breakfast`, `lunch`, `snack`, `dinner`, `dessert` |
| recipe_id | INTEGER FK → recipes.id SET NULL | Optional |
| custom_meal | VARCHAR(255) | Freitext (Alternative zu recipe_id) |

#### `meal_plan_entry_users` *(Junction)*
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| entry_id | INTEGER FK → meal_plan_entries.id CASCADE | |
| user_id | INTEGER FK → users.id CASCADE | |

---

## Beziehungsdiagramm

```
Household ──< HouseholdMember >── User
    │                               │
    ├──< MealPlan                   │
    │       └──< MealPlanEntry >────┘ (assigned_users)
    │               └── Recipe (optional)
    │               └── custom_meal (optional)
    │
    └──< Recipe
            ├──< RecipeIngredient >── Ingredient
            ├──< RecipeTag >── Tag
            └──< RecipeRating >── User
```

---

## Datenbankmigrationen

| Datei | Inhalt |
|-------|--------|
| `0001_initial_schema.py` | Basistabellen: `recipes`, `ingredients`, `recipe_ingredients`, `meal_plans`, `meal_plan_entries` |
| `0002_phase4_household_users.py` | Neue Tabellen: `users`, `households`, `household_members`, `meal_plan_entry_users`; `household_id` zu Rezepten und Plänen |
| `0003_phase6_mealtype.py` | `meal_type`-Enum erweitert um `snack` und `dessert` |
| `0004_phase6_tags_ratings.py` | Neue Tabellen: `tags`, `recipe_tags`, `recipe_ratings` |
| `0005_phase7_ai_settings.py` | Neue Spalten: `households.settings` (JSONB), `users.preferences` (JSONB) |
| `0006_add_tag_category_family_members.py` | Neue Spalte `tags.category`; Familienmitglieder-Tags (Mama, Papa, Kind) |

Migration ausführen: `alembic upgrade head`

---

## Seed-Daten

`backends/app/db/seed.py` legt an:
- 1 Haushalt
- 3 User (vordefiniert, kein Login nötig)
- Vordefinierte Tags (Mahlzeiten-Typ): Frühstück, Mittagessen, Snack, Abendessen, Dessert
- Vordefinierte Tags (Familienmitglieder): Mama, Papa, Kind
