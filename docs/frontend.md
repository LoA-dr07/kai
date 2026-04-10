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
│   │   ├── _layout.tsx     # Tab-Navigation (Rezepte | Wochenplan | KI-Chat | Einstellungen)
│   │   ├── recipes.tsx     # Rezeptliste-Screen
│   │   ├── meal-plan.tsx   # Wochenplan-Screen
│   │   ├── ai-chat.tsx     # KI-Chat-Screen
│   │   └── settings.tsx    # Einstellungen-Screen (Haushalt + Mitglieder)
│   └── recipe/
│       ├── new.tsx         # Neues Rezept erstellen
│       └── [id]/
│           ├── index.tsx   # Rezept-Detailansicht
│           ├── edit.tsx    # Rezept bearbeiten
│           └── cook.tsx    # Koch-Ansicht
├── components/             # Wiederverwendbare UI-Komponenten
│   ├── AddToMealPlanModal.tsx # Rezept zum Essensplan hinzufügen (Woche, Tag, Mahlzeit, User)
│   ├── AiSuggestionModal.tsx  # KI-Wochenplan-Modal (Mahlzeitstyp-Filter, Eingabe → Laden → Vorschau → Übernehmen)
│   ├── RecipeForm.tsx         # Rezeptformular (Neu + Bearbeiten)
│   └── Tooltip.tsx            # Hover-Tooltip für icon-only Buttons (Web) + accessibilityLabel (Mobile)
├── lib/
│   ├── api.ts              # Axios-Client
│   ├── types.ts            # TypeScript-Interfaces
│   ├── alert.ts            # Cross-platform Alert-Utility
│   ├── dateUtils.ts        # Datums-Hilfsfunktionen (getMondayOf, isoDate, getISOWeek)
│   └── hooks/              # React Query Custom Hooks
│       ├── useRecipes.ts              # Rezept-Hooks
│       ├── useMealPlan.ts             # Wochenplan-Hooks
│       ├── useUsers.ts                # User-Hooks (inkl. useUpdateUserPreferences)
│       ├── useHousehold.ts            # Haushalt-Hooks
│       ├── useAiMealPlanSuggestion.ts # KI-Wochenplan-Hook
│       └── useAiChat.ts               # KI-Chat-Hook
└── assets/                 # Bilder, Icons
```

---

## Screens

### `(tabs)/recipes.tsx` – Rezeptliste
- Zeigt alle Rezepte als scrollbare Liste (responsive: 1–4 Spalten je nach Bildschirmbreite)
- Zeigt pro Karte: Name, Zubereitungszeit, Portionen, Zutatenanzahl, Durchschnittsbewertung, Tags
- **Tag-Filter-Leiste** (horizontale ScrollView) direkt über der Rezeptliste:
  - Alle verfügbaren Tags als anklickbare Chips
  - Mehrere Tags gleichzeitig wählbar → AND-Verknüpfung (Rezept muss ALLE gewählten Tags besitzen)
  - Wenn Filter aktiv: „Alle"-Chip am Anfang zum Zurücksetzen aller Filter
  - Rein client-seitige Filterung (kein zusätzlicher API-Call)
- Aktionsbuttons im Header:
  - Exportieren → `GET /recipes/export` → Systemteilen-Dialog
  - Importieren → Datei-Picker → `POST /recipes/import`
  - Aus URLs importieren → navigiert zu `recipe/bulk-import`
  - Neues Rezept → navigiert zu `recipe/new`
- Tippt man auf eine Karte → navigiert zu `recipe/[id]`
- Unterstützt `filter_ids`-Query-Parameter (komma-separierte Rezept-IDs): Zeigt nur diese Rezepte und blendet einen Filter-Banner ein ("X neue Rezepte · Filter aktiv"). Banner-✕ entfernt den Filter.

### `(tabs)/meal-plan.tsx` – Wochenplan
- Zeigt eine Woche als Grid: 7 Tage × 5 Mahlzeiten (Frühstück, Mittagessen, Snack, Abendessen, Dessert)
- Wochennavigation: vorherige / nächste Woche; **KI ✨-Button** öffnet den KI-Vorschlagsmodal (`AiSuggestionModal`)
- Pro Zelle: geplantes Rezept oder Freitext, farbige User-Avatar-Chips
- Zelle antippen → Bearbeitungsmodal (Rezept auswählen oder Freitext eingeben, User zuweisen)
- Responsiv: Tablet-Layout ab 768px Breite

### `(tabs)/ai-chat.tsx` – KI-Chat
- Chat-Interface mit KI-Assistent (Claude API via `POST /ai/chat`)
- Haushaltsmitglieder, Präferenzen, Nie-Bewertungen und verfügbare Rezepte werden automatisch als Kontext mitgegeben
- **Nachrichtenblase:** User-Nachrichten rechts (grün), KI-Antworten links (weiß)
- **Rezeptvorschlag-Karten:** Erscheinen direkt unter KI-Antworten für jedes vorgeschlagene Gericht
  - Zeigt: Rezeptname, Begründung, ✨-Markierung für neue Rezepte (nicht in DB)
  - **„+ Zum Wochenplan hinzufügen":** Klappt Inline-Picker auf mit Wochentag- und Mahlzeitstyp-Chips
  - Nach Auswahl von Tag + Mahlzeit: „Eintragen"-Button → Eintrag wird sofort gespeichert
  - Bestätigung: Button wechselt zu „✓ Zum Wochenplan hinzugefügt"
- Willkommensnachricht beim ersten Öffnen (zählt nicht zur API-Gesprächshistorie)
- Wochenbanner zeigt die aktuelle Kalenderwoche
- `KeyboardAvoidingView` für iOS-Tastatur-Handling

### `recipe/bulk-import.tsx` – Rezepte aus URLs importieren (Bulk)
Dreistufiger Flow:
1. **URL-Eingabe**: Dynamische URL-Felder (neues Feld erscheint automatisch). Validierung: alle leer → Fehler, ungültige URLs → Feld rot markiert. Klick auf "Vorschau laden" scrapt alle URLs via `useBulkPreviewFromUrl()`.
2. **Konfiguration (pro Rezept)**: Pro erfolgreich gescraptem Rezept eine Karte mit Rezeptname, URL, individuallem Tag-Chip-Auswahl und Sternebewertung pro Haushaltsmitglied. Fehlgeschlagene Vorschau-URLs werden als Fehler-Banner oben angezeigt. Klick auf "X Rezepte importieren" → `useBulkImportFromUrl()`.
3. **Ergebnis**: Erfolgsanzahl + Liste aller fehlgeschlagenen URLs (Vorschau-Fehler + Import-Fehler). "Zur Rezeptübersicht" navigiert mit `filter_ids`-Parameter.

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
- **Sektion Haushaltsmitglieder:** Pro Mitglied eine Karte mit:
  - **Name bearbeiten** (Stift-Icon): Inline-Editierung von Name, Kürzel (max 4 Zeichen) und Farbe (8 vordefinierte Farben) → `useUpdateUser`; der zugehörige `family`-Tag an Rezepten wird automatisch umbenannt
  - **Mitglied löschen** (Mülleimer-Icon mit `showConfirm`): entfernt User + family-Tag + alle Rezept-Zuordnungen → `useDeleteUser`
  - Präferenz-Felder: Ernährungsweise, Allergien, ungemochte Zutaten (Freitext-Tag-Input), bevorzugte Küchen, Schärfeverträglichkeit, Portionsgröße → `useUpdateUserPreferences`
- **„+ Mitglied hinzufügen"**-Button im Sektions-Header öffnet `AddMemberForm`-Karte: Name, Kürzel (auto-generiert), Farbauswahl → `useCreateUser`; erstellt gleichzeitig family-Tag
- Feedback via `showAlert` / `showConfirm` aus `mobile/lib/alert.ts`

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
| `useImportRecipes()` | Mutation | JSON-Bulk-Import, invalidiert `['recipes']` + `['ingredients']` |
| `useBulkPreviewFromUrl()` | Mutation | Scrape mehrere URLs ohne Speichern (`POST /recipes/import/url/bulk-preview`) |
| `useBulkImportFromUrl()` | Mutation | URL-Bulk-Import mit per-item-Konfiguration, invalidiert `['recipes']` + `['ingredients']` |

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
| `useUsers()` | Query | Alle Haushaltsmitglieder, `staleTime: 5min` |
| `useCreateUser()` | Mutation | Neues Mitglied anlegen (`POST /users`), invalidiert `['users']` + `['household']` |
| `useUpdateUser(userId)` | Mutation | Name/Kürzel/Farbe ändern (`PATCH /users/{id}`), invalidiert `['users']`, `['household']`, `['recipes']` |
| `useDeleteUser()` | Mutation | Mitglied löschen (`DELETE /users/{id}`), invalidiert `['users']`, `['household']`, `['recipes']` |
| `useUpdateUserPreferences(userId)` | Mutation | Präferenzen speichern, aktualisiert `['users']` Cache |

### Haushalt-Hooks (`useHousehold.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useHousehold()` | Query | Haushalt mit Einstellungen (Cache-Key: `['household']`, `staleTime: 5min`) |
| `useUpdateHouseholdSettings()` | Mutation | Einstellungen speichern, aktualisiert `['household']` Cache |

### KI-Hooks

| Hook | Datei | Typ | Beschreibung |
|------|-------|-----|--------------|
| `useAiMealPlanSuggestion()` | `useAiMealPlanSuggestion.ts` | Mutation | KI-Wochenplan generieren (`POST /ai/meal-plan-suggestion`), Timeout 60 s |
| `useAiChat()` | `useAiChat.ts` | Mutation | KI-Chat-Nachricht senden (`POST /ai/chat`), Timeout 60 s |

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

// Kurzform für Ja/Nein-Dialog
import { showConfirm } from '../lib/alert';
showConfirm('Mitglied löschen', 'Wirklich löschen?', () => deleteUser());
```

Auf Web: `window.alert()` / `window.confirm()`
Auf Mobile: `Alert.alert()` aus React Native

---

## Komponente: AddToMealPlanModal (`mobile/components/AddToMealPlanModal.tsx`)

Wiederverwendbares Modal, um ein Rezept direkt aus der Rezeptliste oder der Rezept-Detailansicht in den Essensplan einzutragen.

**Props:**

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `recipeId` | `number` | ID des einzutragenden Rezepts |
| `recipeName` | `string` | Angezeigter Name (read-only) |
| `visible` | `boolean` | Steuert die Sichtbarkeit |
| `onClose` | `() => void` | Callback beim Schließen oder nach erfolgreichem Speichern |

**Verhalten:**
- Beim Öffnen wird der Zustand auf aktuelle Woche, heutigen Wochentag und Mahlzeit "Abendessen" zurückgesetzt
- Wochennavigation: vorherige / nächste Woche per Pfeil-Buttons
- Erstellt bei Bedarf automatisch einen neuen Essensplan für die gewählte Woche (`KW X YYYY`)
- User-Chips werden nur angezeigt, wenn mindestens ein User vorhanden ist
- Fehler werden via `showAlert` angezeigt

**Verwendung (Beispiel):**
```tsx
import { AddToMealPlanModal } from '../components/AddToMealPlanModal';

const [visible, setVisible] = useState(false);

<AddToMealPlanModal
  recipeId={recipe.id}
  recipeName={recipe.name}
  visible={visible}
  onClose={() => setVisible(false)}
/>
```

**Einstiegspunkte:**
- `(tabs)/recipes.tsx`: Kalender-Icon-Button auf jeder Rezeptkarte (oben rechts)
- `recipe/[id]/index.tsx`: "Zum Essensplan"-Button in der Aktionsleiste

---

## Plattform-Utility: Tooltip (`mobile/components/Tooltip.tsx`)

Wrapper-Komponente für Buttons ohne sichtbaren Text (icon-only). Zeigt auf Web beim Hover ein Tooltip-Bubble; auf Mobile wird ausschließlich `accessibilityLabel` gesetzt.

**Props:**

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `label` | `string` | — | Tooltip-Text (Deutsch). Wird auch als `accessibilityLabel` verwendet. |
| `children` | `ReactNode` | — | Der zu wrappende Button |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Richtung des Tooltip-Bubbles |

**Positionierung:**
- `'top'` (Standard): Tooltip erscheint oberhalb – für Buttons in der Mitte der Seite
- `'bottom'`: Tooltip erscheint unterhalb – für Buttons am oberen Bildschirmrand (z.B. Navigationsleiste)
- `'left'`: Tooltip erscheint links – für Buttons am rechten Rand
- `'right'`: Tooltip erscheint rechts – für Buttons am linken Rand

**Verwendung:**
```tsx
import { Tooltip } from '../components/Tooltip';

<Tooltip label="Rezepte exportieren (JSON)">
  <TouchableOpacity onPress={handleExport}>
    <Ionicons name="share-outline" size={22} />
  </TouchableOpacity>
</Tooltip>
```

**Konvention:** Jeder Button ohne sichtbaren Textlabel muss mit `<Tooltip>` gewrappt werden (siehe CLAUDE.md → Plattform-Kompatibilität).

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
| `/(tabs)/ai-chat` | KI-Chat |
| `/recipe/bulk-import` | Bulk-Import aus URLs |
| `/recipe/new` | Neues Rezept |
| `/recipe/[id]` | Rezeptdetail |
| `/recipe/[id]/edit` | Rezept bearbeiten |
| `/recipe/[id]/cook` | Koch-Ansicht |

Navigation mit `router.push('/recipe/new')` oder `router.replace(...)` aus `expo-router`.
