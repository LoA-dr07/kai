# Frontend-Dokumentation – Meal-Planner

**Framework:** React Native / Expo · TypeScript · Expo Router
**Plattformen:** iOS · Android (via Expo Go) · Web (Expo Web)

---

## Verzeichnisstruktur

```
mobile/
├── app/                    # Expo Router – file-based Routing
│   ├── _layout.tsx         # Root-Layout (QueryClientProvider)
│   ├── index.tsx           # Weiterleitung → /recipes
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Tab-Navigation (Rezepte | Wochenplan | Einstellungen)
│   │   ├── recipes.tsx     # Rezeptliste-Screen
│   │   ├── meal-plan.tsx   # Wochenplan-Screen
│   │   └── settings.tsx    # Einstellungen-Screen (Haushalt + Mitglieder)
│   └── recipe/
│       ├── new.tsx         # Neues Rezept erstellen
│       └── [id]/
│           ├── index.tsx   # Rezept-Detailansicht
│           ├── edit.tsx    # Rezept bearbeiten
│           └── cook.tsx    # Koch-Ansicht
├── components/             # Wiederverwendbare UI-Komponenten
│   └── AiSuggestionModal.tsx  # KI-Wochenplan-Modal (Eingabe → Laden → Vorschau → Übernehmen)
├── lib/
│   ├── api.ts              # Axios-Client
│   ├── types.ts            # TypeScript-Interfaces
│   ├── alert.ts            # Cross-platform Alert-Utility
│   └── hooks/              # React Query Custom Hooks
│       ├── useRecipes.ts              # Rezept-Hooks
│       ├── useMealPlan.ts             # Wochenplan-Hooks
│       ├── useUsers.ts                # User-Hooks (inkl. useUpdateUserPreferences)
│       ├── useHousehold.ts            # Haushalt-Hooks
│       └── useAiMealPlanSuggestion.ts # KI-Wochenplan-Hook
└── assets/                 # Bilder, Icons
```

---

## Screens

### `(tabs)/recipes.tsx` – Rezeptliste
- Zeigt alle Rezepte als scrollbare Liste
- Zeigt pro Karte: Name, Zubereitungszeit, Portionen, Zutatenanzahl, Durchschnittsbewertung, Tags
- Aktionsbuttons im Header:
  - Exportieren → `GET /recipes/export` → Systemteilen-Dialog
  - Importieren → Datei-Picker → `POST /recipes/import`
  - Aus URL importieren → Modal mit URL-Eingabe → Vorschau → Speichern
  - Neues Rezept → navigiert zu `recipe/new`
- Tippt man auf eine Karte → navigiert zu `recipe/[id]`

### `(tabs)/meal-plan.tsx` – Wochenplan
- Zeigt eine Woche als Grid: 7 Tage × 5 Mahlzeiten (Frühstück, Mittagessen, Snack, Abendessen, Dessert)
- Wochennavigation: vorherige / nächste Woche; **KI ✨-Button** öffnet den KI-Vorschlagsmodal (`AiSuggestionModal`)
- Pro Zelle: geplantes Rezept oder Freitext, farbige User-Avatar-Chips
- Zelle antippen → Bearbeitungsmodal (Rezept auswählen oder Freitext eingeben, User zuweisen)
- Responsiv: Tablet-Layout ab 768px Breite

### `recipe/new.tsx` – Neues Rezept
- Verwendet `RecipeForm`-Komponente
- Speichert via `useCreateRecipe()`

### `components/RecipeForm.tsx` – Rezeptformular
- Tag-Auswahl in drei Gruppen: **Mahlzeiten-Typ** (grün), **Familienmitglieder** (orange), **Eigene Tags** (lila)
- Gruppierung erfolgt über `tag.category`: `meal_type` → Mahlzeiten-Typ, `family` → Familienmitglieder, `null` → Eigene Tags

### `recipe/[id]/index.tsx` – Rezeptdetail
- Vollständige Rezeptinfos: Zutaten, Tags, Sternebewertungen pro User
- Bewertung pro Haushaltsmitglied (1–5 Sterne, 0 = nicht bewertet)
- Buttons: Bearbeiten (→ `recipe/[id]/edit`) · Löschen

### `recipe/[id]/edit.tsx` – Rezept bearbeiten
- Verwendet `RecipeForm`-Komponente mit vorausgefüllten Daten
- Speichert via `useUpdateRecipe(id)`

### `recipe/[id]/cook.tsx` – Koch-Ansicht
- Vereinfachte Ansicht der Zutaten für die Küche

### `(tabs)/settings.tsx` – Einstellungen
- **Sektion Haushalt:** Kochtage (Checkbox-Grid Mo–So), warme Mahlzeit (Mittags/Abends/Beides), Tage mit kalten Mahlzeiten, Reste-Häufigkeit (Nie/Manchmal/Oft), Gemeinsames-Essen-Skala (1–5), Kochkenntnisse, bevorzugte Küchen, Wochenbudget
- **Sektion Haushaltsmitglieder:** Pro Mitglied aufklappbare Karte mit Ernährungsweise, Allergien, ungemochten Zutaten (Freitext-Chips), bevorzugten Küchen, Schärfeverträglichkeit, Portionsgröße
- Speichern per Button pro Sektion; Feedback via `showAlert`

---

## React Query Hooks

Alle Hooks befinden sich in `mobile/lib/hooks/`. Sie wrappen Axios-Calls und verwalten automatisch Cache-Invalidierung.

### Rezept-Hooks (`useRecipes.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useRecipes()` | Query | Alle Rezepte (Cache-Key: `['recipes']`) |
| `useRecipe(id)` | Query | Einzelnes Rezept (Cache-Key: `['recipes', id]`) |
| `useCreateRecipe()` | Mutation | Neues Rezept erstellen, invalidiert `['recipes']` |
| `useUpdateRecipe(id)` | Mutation | Rezept aktualisieren, invalidiert `['recipes']` + `['recipes', id]` |
| `useDeleteRecipe()` | Mutation | Rezept löschen, invalidiert `['recipes']` |
| `useIngredients()` | Query | Alle Zutaten (Cache-Key: `['ingredients']`) |
| `useCreateIngredient()` | Mutation | Neue Zutat, invalidiert `['ingredients']` |
| `useTags()` | Query | Alle Tags (Cache-Key: `['tags']`) |
| `useCreateTag()` | Mutation | Neuer Tag, invalidiert `['tags']` |
| `useRateRecipe(recipeId)` | Mutation | Bewertung Upsert, invalidiert `['recipes']` + `['recipes', recipeId]` |
| `useImportRecipes()` | Mutation | Bulk-Import, invalidiert `['recipes']` + `['ingredients']` |

### Wochenplan-Hooks (`useMealPlan.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useMealPlans()` | Query | Alle Wochenpläne (Cache-Key: `['meal-plans']`) |
| `useCreateMealPlan()` | Mutation | Neuen Plan erstellen |
| `useAddEntry()` | Mutation | Eintrag hinzufügen |
| `useUpdateEntry()` | Mutation | Eintrag aktualisieren |
| `useDeleteEntry()` | Mutation | Eintrag entfernen |

Alle Meal-Plan-Mutations invalidieren `['meal-plans']`.

### User-Hooks (`useUsers.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useUsers()` | Query | Alle Haushaltsmitglieder, `staleTime: 5min` (ändern sich selten) |
| `useUpdateUserPreferences(userId)` | Mutation | Präferenzen speichern, aktualisiert `['users']` Cache |

### Haushalt-Hooks (`useHousehold.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useHousehold()` | Query | Haushalt mit Einstellungen (Cache-Key: `['household']`, `staleTime: 5min`) |
| `useUpdateHouseholdSettings()` | Mutation | Einstellungen speichern, aktualisiert `['household']` Cache |

### KI-Hooks (`useAiMealPlanSuggestion.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useAiMealPlanSuggestion()` | Mutation | KI-Wochenplan generieren (`POST /ai/meal-plan-suggestion`), Timeout 60 s |

---

## TypeScript-Typen (`mobile/lib/types.ts`)

Wichtige Interfaces:

```typescript
interface Recipe {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  prep_time_minutes: number | null;
  ingredients: RecipeIngredient[];
  tags: Tag[];
  ratings: RecipeRating[];
}

interface MealPlanEntry {
  id: number;
  day_of_week: number;  // 0=Mo … 6=So
  meal_type: MealType;  // 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'dessert'
  recipe_id: number | null;
  custom_meal: string | null;
  recipe: Recipe | null;
  assigned_user_ids: number[];
}

interface User {
  id: number;
  name: string;
  avatar_color: string;  // Hex, z.B. "#2E7D32"
  short_name: string;    // z.B. "MA"
}
```

---

## API-Client (`mobile/lib/api.ts`)

```typescript
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});
```

Base URL wird aus der Umgebungsvariable `EXPO_PUBLIC_API_URL` gelesen (`.env` in `mobile/`).

---

## Plattform-Utility: Alert (`mobile/lib/alert.ts`)

**Niemals** `Alert.alert()` aus React Native direkt verwenden – funktioniert nicht auf Web.

```typescript
import { showAlert } from '../lib/alert';

// Einfache Meldung
showAlert('Gespeichert', 'Das Rezept wurde gespeichert.');

// Bestätigung mit Aktions-Button
showAlert('Löschen?', 'Das Rezept wird gelöscht.', [
  { text: 'Abbrechen', style: 'cancel' },
  { text: 'Löschen', style: 'destructive', onPress: () => deleteRecipe() },
]);
```

Auf Web: `window.alert()` / `window.confirm()`
Auf Mobile: `Alert.alert()` aus React Native

---

## Datei-Operationen (Import/Export)

Verwendet plattformkompatible Expo-Pakete:

| Paket | Verwendung |
|-------|-----------|
| `expo-document-picker` | JSON-Datei zum Import auswählen |
| `expo-file-system` | Datei lesen (Mobile) |
| `expo-sharing` | Export-Datei teilen (Mobile) |

Auf Web: Browser-native APIs (`FileReader`, Download-Link).

---

## Responsive Design

Breakpoint für Tablet/Desktop-Layout: **`width >= 768px`**

Komponenten prüfen mit:
```typescript
import { useWindowDimensions } from 'react-native';
const { width } = useWindowDimensions();
const isTablet = width >= 768;
```

---

## Routing (Expo Router)

| Pfad | Beschreibung |
|------|-------------|
| `/` | Weiterleitung → `/recipes` |
| `/(tabs)/recipes` | Rezeptliste |
| `/(tabs)/meal-plan` | Wochenplan |
| `/recipe/new` | Neues Rezept |
| `/recipe/[id]` | Rezeptdetail |
| `/recipe/[id]/edit` | Rezept bearbeiten |
| `/recipe/[id]/cook` | Koch-Ansicht |

Navigation mit `router.push('/recipe/new')` oder `router.replace(...)` aus `expo-router`.
