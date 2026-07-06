# Architektur – Meal-Planner

## Systemüberblick

```
┌───────────────────────────────────────────────────────┐
│                  Client (Frontend)                    │
│  React Native / Expo · TypeScript · Expo Router       │
│                                                       │
│  Web (Browser)          Native (iOS / Android)        │
│  • Reads: REST API      • Reads: PowerSync SQLite     │
│  • Writes: REST API     • Writes: REST API            │
└──────────┬──────────────────────┬─────────────────────┘
           │ HTTP/JSON (Axios)    │ HTTP/JSON (Axios)
           │ Writes               │ Writes + Token-Fetch
           ▼                      ▼
┌──────────────────────────────────────────────────────┐
│            Backend (FastAPI · Python)                │
│            fly.io · https://kai-api-long-feather-1592.fly.dev                        │
│            Swagger UI: /docs                         │
│            CORS: allow_origins=["*"]                 │
└──────────────────────┬───────────────────────────────┘
                       │ SQLAlchemy ORM
                       ▼
┌──────────────────────────────────────────────────────┐
│          Neon PostgreSQL (Serverless)                │
│          Direct Connection (für PowerSync WAL)       │
└──────────────────────┬───────────────────────────────┘
                       │ Logical Replication (WAL)
                       ▼
┌──────────────────────────────────────────────────────┐
│          PowerSync Cloud                             │
│          Sync Rules → sendet Änderungen an Clients   │
└──────────────────────┬───────────────────────────────┘
                       │ WebSocket / HTTP Sync
                       ▼
             Native App (lokales SQLite)
```

---

## Datenfluss

### Schreibpfad (alle Plattformen)
1. App ruft FastAPI-Endpunkt auf (Axios)
2. FastAPI schreibt in Neon PostgreSQL
3. Neon signalisiert Änderung via WAL (Write-Ahead Log)
4. PowerSync Cloud erkennt Änderung und pusht an verbundene Native-Clients

### Lesepfad Native (offline-fähig)
1. PowerSync hält lokale SQLite-Kopie auf dem Gerät
2. Hooks lesen per SQL direkt aus SQLite (`useQuery` von `@powersync/react`)
3. Daten sind sofort verfügbar, auch ohne Internetverbindung
4. Sync läuft transparent im Hintergrund

### Lesepfad Web
1. Hooks rufen direkt die FastAPI REST API auf (`useQuery` von `@tanstack/react-query`)
2. Kein lokales SQLite – Web ist online-only
3. Grund: `@powersync/web` ist nicht kompatibel mit dem Metro-Bundler von Expo 54

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
Neon PostgreSQL
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
    Native: useQuery (@powersync/react) → PowerSync SQLite
    Web:    useQuery (@tanstack/react-query) → REST API
    Mutations (beide Plattformen): useMutation → FastAPI
    ↓
Axios API-Client (mobile/lib/api.ts)
    • baseURL: EXPO_PUBLIC_API_URL (fly.io)
    • timeout: 10s
    ↓
FastAPI Backend (fly.io)
```

---

## PowerSync-Integration

### Authentifizierung
PowerSync benötigt einen signierten JWT zur Verbindung. Das Backend stellt zwei Endpunkte bereit:

| Endpunkt | Zweck |
|----------|-------|
| `GET /auth/powersync-token` | Gibt JWT zurück (signiert mit `POWERSYNC_PRIVATE_KEY`) |
| `GET /auth/jwks.json` | Gibt Public Key zurück (für PowerSync-Validierung) |

Im PowerSync Dashboard wird die JWKS URI hinterlegt:
`https://<deine-app>.fly.dev/auth/jwks.json`

### Platform-spezifische Dateien

| Datei | Plattform | Implementierung |
|-------|-----------|-----------------|
| `mobile/lib/powersync/database.ts` | Web | `db = null` (PowerSync deaktiviert) |
| `mobile/lib/powersync/database.native.ts` | Native | `PowerSyncDatabase` mit wa-sqlite |
| `mobile/lib/hooks/useRecipes.web.ts` | Web | React Query + REST API |
| `mobile/lib/hooks/useRecipes.ts` | Native | PowerSync `useQuery` |
| `mobile/lib/hooks/useMealPlan.web.ts` | Web | React Query + REST API |
| `mobile/lib/hooks/useMealPlan.ts` | Native | PowerSync `useQuery` |
| `mobile/lib/hooks/useHousehold.web.ts` | Web | React Query + REST API |
| `mobile/lib/hooks/useHousehold.ts` | Native | PowerSync `useQuery` |
| `mobile/lib/hooks/useUsers.web.ts` | Web | React Query + REST API |
| `mobile/lib/hooks/useUsers.ts` | Native | PowerSync `useQuery` |

Metro wählt `.web.ts`-Dateien automatisch für Web-Builds.

### Schema-Duplikation (bekannte Einschränkung)

`mobile/lib/powersync/schema.ts` bildet die SQLAlchemy-Modelle aus `backends/app/models/*.py` **manuell** nach – es gibt keinen Codegen und keinen automatisierten Abgleich. Bei jeder Modell-/Migrationsänderung muss `schema.ts` von Hand mitgepflegt werden, sonst fehlen native Clients neue Felder stillschweigend.

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
| source_url | VARCHAR(2048) | Quell-URL (Web-Import, optional) |
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
| repeat_weekly | BOOLEAN | Eintrag wöchentlich wiederholen |

#### `meal_plan_entry_users` *(Junction)*
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| entry_id | INTEGER FK → meal_plan_entries.id CASCADE | |
| user_id | INTEGER FK → users.id CASCADE | |

#### `shopping_lists`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| household_id | INTEGER FK → households.id | |
| created_at | TIMESTAMP | Erstellungszeitpunkt |

#### `shopping_list_items`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| shopping_list_id | INTEGER FK → shopping_lists.id CASCADE | |
| name | VARCHAR(255) | Artikel-Name |
| amount | FLOAT | Menge (optional) |
| unit | VARCHAR(50) | Einheit (optional, z.B. `g`, `ml`, `Stück`) |
| is_checked | BOOLEAN | Abgehakt (erledigt) |
| is_manual | BOOLEAN | Manuell hinzugefügt (nicht aus Rezept generiert) |
| sort_order | INTEGER | Reihenfolge innerhalb der Liste |
| custom_meal_ref | VARCHAR(255) | Verweis auf Freitext-Mahlzeit (falls aus custom_meal generiert) |

#### `conversations`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| household_id | INTEGER FK → households.id | |
| title | VARCHAR(255) | Konversationstitel (auto-generiert aus erster Nachricht) |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzte Aktualisierung |

#### `conversation_messages`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INTEGER PK | |
| conversation_id | INTEGER FK → conversations.id CASCADE | |
| role | VARCHAR(20) | `user` oder `assistant` |
| content | TEXT | Nachrichteninhalt |
| created_at | TIMESTAMP | Erstellungszeitpunkt |

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
| `0007_add_recipe_source_url.py` | Neue Spalte `recipes.source_url` (VARCHAR 2048, nullable) |
| `0008_shopping_list_conversations.py` | Neue Tabellen: `shopping_lists`, `shopping_list_items`, `conversations`, `conversation_messages`; neue Spalte `meal_plan_entries.repeat_weekly` (BOOLEAN) |

Migration ausführen: `alembic upgrade head`

---

## Seed-Daten

`backends/app/db/seed.py` legt an:
- 1 Haushalt
- 3 User (vordefiniert, kein Login nötig)
- Vordefinierte Tags (Mahlzeiten-Typ): Frühstück, Mittagessen, Snack, Abendessen, Dessert
- Vordefinierte Tags (Familienmitglieder): Mama, Papa, Kind
