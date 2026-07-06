# Frontend-Dokumentation – KAI

**Framework:** React Native / Expo · TypeScript · Expo Router
**Plattformen:** iOS · Android (via Expo Go) · Web (Expo Web)
**Offline-Sync:** PowerSync (nur Native; Web nutzt REST API direkt)

---

## Verzeichnisstruktur

```
mobile/
├── app/                    # Expo Router – file-based Routing
│   ├── _layout.tsx         # Root-Layout (QueryClientProvider)
│   ├── index.tsx           # Weiterleitung → /recipes
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab-Navigation (Rezepte | Wochenplan | Einkaufsliste | KI-Chat | Einstellungen)
│   │   ├── recipes.tsx         # Rezeptliste-Screen
│   │   ├── meal-plan.tsx       # Wochenplan-Screen
│   │   ├── shopping-list.tsx   # Einkaufsliste-Screen
│   │   ├── ai-chat.tsx         # KI-Chat-Screen
│   │   └── settings.tsx        # Einstellungen-Screen (Haushalt + Mitglieder)
│   └── recipe/
│       ├── new.tsx         # Neues Rezept erstellen
│       └── [id]/
│           ├── index.tsx   # Rezept-Detailansicht
│           ├── edit.tsx    # Rezept bearbeiten
│           └── cook.tsx    # Koch-Ansicht
├── components/             # Wiederverwendbare UI-Komponenten
│   ├── AddToMealPlanModal.tsx # Rezept zum Essensplan hinzufügen (Woche, Tag, Mahlzeit, User)
│   ├── AiSuggestionModal.tsx  # KI-Wochenplan-Modal (Mahlzeitstyp-Filter, Eingabe → Laden → Vorschau → Übernehmen)
│   ├── BaseModal.tsx          # Gemeinsame Modal-Hülle (Header + Schließen-Button) für alle pageSheet-Modals
│   ├── RecipeDetailContent.tsx # Reine Rezept-Detaildarstellung (Zutaten, Bewertungen, Tags, Aktionen) – von Screen & Modal genutzt
│   ├── RecipeDetailModal.tsx  # Rezeptdetail als Modal über dem Wochenplan, inkl. "Austauschen"-Flow
│   ├── RecipeSearchPanel.tsx  # Rezeptsuche mit Tag-/Bewertungsfilter + "Zuletzt verwendet" (Essensplan-Rezeptauswahl & Austausch)
│   ├── RecipeForm.tsx         # Rezeptformular (Neu + Bearbeiten)
│   ├── Tooltip.tsx            # Hover-Tooltip für icon-only Buttons (Web) + accessibilityLabel (Mobile)
│   └── UserChipRow.tsx        # Zeile mit Personen-Auswahl-Chips (Avatarfarbe bei Auswahl)
├── lib/
│   ├── api.ts              # Axios-Client
│   ├── types.ts            # TypeScript-Interfaces
│   ├── constants.ts        # DAYS_DE/DAYS_SHORT, MEAL_TYPES
│   ├── alert.ts            # Cross-platform Alert-Utility
│   ├── dateUtils.ts        # Datums-Hilfsfunktionen (getMondayOf, isoDate, getISOWeek)
│   ├── powersync/          # PowerSync-Konfiguration
│   │   ├── schema.ts          # SQLite-Schema (spiegelt Server-Modelle)
│   │   ├── connector.ts       # BackendConnector (JWT-Fetch, uploadData no-op)
│   │   ├── database.ts        # Web: db = null (PowerSync deaktiviert)
│   │   └── database.native.ts # Native: PowerSyncDatabase mit wa-sqlite
│   └── hooks/              # React Query / PowerSync Custom Hooks
│       ├── useRecipes.ts              # Native: PowerSync SQLite
│       ├── useRecipes.web.ts          # Web: REST API Fallback
│       ├── useMealPlan.ts             # Native: PowerSync SQLite; exportiert außerdem ensurePlanForWeek()
│       ├── useMealPlan.web.ts         # Web: REST API Fallback
│       ├── useWeekNavigation.ts       # Wochenauswahl-State (weekStart, prev/next) für Woche-Picker
│       ├── useRecentRecipes.ts        # Letzte N eindeutige Rezepte aus einem Wochenplan
│       ├── useUsers.ts                # Native: PowerSync SQLite
│       ├── useUsers.web.ts            # Web: REST API Fallback
│       ├── useHousehold.ts            # Native: PowerSync SQLite
│       ├── useHousehold.web.ts        # Web: REST API Fallback
│       ├── useAiMealPlanSuggestion.ts # KI-Wochenplan-Hook (beide Plattformen)
│       ├── useAiChat.ts               # KI-Chat-Hook (beide Plattformen)
│       ├── useShoppingList.ts         # Einkaufslisten-Hooks (beide Plattformen)
│       └── useConversations.ts        # KI-Konversations-Hooks (beide Plattformen)
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
- **Pro-Person-Zeilen:** Bei unterschiedlichen Mahlzeiten pro Haushaltsmitglied werden separate Zeilen pro Person angezeigt
- **Long-Press Bottom Sheet:** Langes Drücken auf einen Eintrag öffnet ein Action-Sheet mit Optionen: Verschieben, Kopieren, Löschen, Wöchentlich wiederholen
- **Zuletzt verwendete Rezepte:** Schnellzugriff auf kürzlich eingetragene Rezepte beim Hinzufügen eines Eintrags
- **Web Drag & Drop:** Einträge können per Drag & Drop zwischen Zellen verschoben werden (nur Web)
- **`repeat_weekly`-Indikator:** Wiederholende Einträge werden visuell gekennzeichnet
- Eintrag antippen:
  - Hat der Eintrag ein Rezept (`recipe_id` gesetzt) → öffnet `RecipeDetailModal` (Rezeptdetailansicht direkt über dem Wochenplan, kein Screen-Wechsel). Im Modal-Header kann über den "Austauschen"-Icon-Button (Tooltip) auf eine Rezeptsuche (`RecipeSearchPanel`) umgeschaltet werden, um das Rezept im Slot direkt zu ersetzen
  - Freitext-Einträge (`custom_meal`, kein Rezept) → weiterhin das Bearbeitungsmodal (Rezept auswählen oder Freitext eingeben, User zuweisen)
- Leere Zelle antippen → Bearbeitungsmodal zum Neuanlegen
- Responsiv: Tablet-Layout ab 768px Breite

### `(tabs)/shopping-list.tsx` – Einkaufsliste
- Einkaufsliste mit Generierung aus dem Mahlzeitenplan, Checkbox-System und manuellen Einträgen
- **Generieren:** Zeitraum (Datum von/bis) auswählen und Liste aus den geplanten Mahlzeiten erzeugen; Konflikt-Dialog bei bereits vorhandener Liste (zusammenführen oder ersetzen)
- **Checkbox-System:** Einträge abhaken; abgehakte Einträge werden in einem „Erledigt"-Abschnitt gesammelt
- **Manuelle Einträge:** Einzelne Artikel mit Name, Menge und Einheit manuell hinzufügen
- **Erledigt-Sektion:** Zusammenführung aller abgehakten Einträge mit Option „Erledigte löschen"
- **Gesamte Liste löschen** über Header-Button

### `(tabs)/ai-chat.tsx` – KI-Chat
- Chat-Interface mit KI-Assistent (Claude API via `POST /ai/chat`)
- Haushaltsmitglieder, Präferenzen, Nie-Bewertungen und verfügbare Rezepte werden automatisch als Kontext mitgegeben
- **Multi-Konversationen:** Konversationsliste-Modal zum Wechseln, Erstellen und Löschen von Gesprächsverläufen
- **Nachrichtenblase:** User-Nachrichten rechts (grün), KI-Antworten links (weiß)
- **Rezeptvorschlag-Karten:** Erscheinen direkt unter KI-Antworten für jedes vorgeschlagene Gericht
  - Zeigt: Rezeptname, Begründung, ✨-Markierung für neue Rezepte (nicht in DB)
  - **„+ Zum Wochenplan hinzufügen":** Klappt Inline-Picker auf mit Wochentag- und Mahlzeitstyp-Chips
  - Nach Auswahl von Tag + Mahlzeit: „Eintragen"-Button → Eintrag wird sofort gespeichert
  - Bestätigung: Button wechselt zu „✓ Zum Wochenplan hinzugefügt"
- **Pending Action Cards:** Aktionskarten für KI-vorgeschlagene Aktionen (z.B. Mahlzeit eintragen, Einkaufsliste generieren), die der Nutzer bestätigen oder ablehnen kann
- **TTS (Text-to-Speech):** Vorlesen von KI-Antworten via `expo-speech` (nur Mobile)
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
- Dünner Wrapper: setzt den Stack-Screen-Titel und delegiert die Darstellung an `RecipeDetailContent` (siehe Komponenten-Abschnitt), verdrahtet mit `router.push`/`router.back`
- Vollständige Rezeptinfos: Zutaten, Tags, Sternebewertungen pro User
- Bewertung pro Haushaltsmitglied (1–5 Sterne, 0 = nicht bewertet)
- Buttons: Kochen · Zum Essensplan · Bearbeiten (→ `recipe/[id]/edit`) · Löschen

### `recipe/[id]/edit.tsx` – Rezept bearbeiten
- Verwendet `RecipeForm`-Komponente mit vorausgefüllten Daten
- Speichert via `useUpdateRecipe(id)`

### `recipe/[id]/cook.tsx` – Koch-Ansicht
- Vereinfachte Ansicht der Zutaten für die Küche

### `(tabs)/settings.tsx` – Einstellungen
- **Sektion Haushalt:** Kochtage (Checkbox-Grid Mo–So), warme Mahlzeit (Mittags/Abends/Beides), Tage mit kalten Mahlzeiten, Reste-Häufigkeit (Nie/Manchmal/Oft), Gemeinsames-Essen-Skala (1–5), Kochkenntnisse, bevorzugte Küchen, Wochenbudget, **Notizen für die KI** (mehrzeiliges Freitextfeld – wird als `HAUSHALT-NOTIZEN` in beide KI-Endpunkte injiziert)
- **Sektion Haushaltsmitglieder:** Pro Mitglied eine Karte mit:
  - **Name bearbeiten** (Stift-Icon): Inline-Editierung von Name, Kürzel (max 4 Zeichen) und Farbe (8 vordefinierte Farben) → `useUpdateUser`; der zugehörige `family`-Tag an Rezepten wird automatisch umbenannt
  - **Mitglied löschen** (Mülleimer-Icon mit `showConfirm`): entfernt User + family-Tag + alle Rezept-Zuordnungen → `useDeleteUser`
  - Präferenz-Felder: Ernährungsweise, Allergien, ungemochte Zutaten (Freitext-Tag-Input), bevorzugte Küchen, Schärfeverträglichkeit, Portionsgröße → `useUpdateUserPreferences`
- **„+ Mitglied hinzufügen"**-Button im Sektions-Header öffnet `AddMemberForm`-Karte: Name, Kürzel (auto-generiert), Farbauswahl → `useCreateUser`; erstellt gleichzeitig family-Tag
- Feedback via `showAlert` / `showConfirm` aus `mobile/lib/alert.ts`

---

## PowerSync-Integration

PowerSync ermöglicht Offline-Unterstützung auf Native (iOS/Android). Auf Web ist es nicht kompatibel mit dem Metro-Bundler von Expo 54.

### Datenfluss Native
1. `_layout.tsx` verbindet `db.connect(connector)` beim App-Start
2. `connector.fetchCredentials()` holt einen JWT von `GET /auth/powersync-token`
3. PowerSync Cloud sendet Datenbankänderungen via WebSocket an die lokale SQLite
4. Hooks lesen per SQL aus SQLite – reaktiv, sofort, offline-fähig

### Datenfluss Web
- `database.ts` exportiert `db = null` → PowerSync wird nicht initialisiert
- Metro wählt automatisch `.web.ts`-Hooks → REST API via React Query
- `_layout.tsx` rendert `PowerSyncContext.Provider` nur wenn `db !== null`

### Platform-Resolution
Metro wählt automatisch nach Priorität:
- `.web.ts` → Expo Web
- `.native.ts` → iOS & Android
- `.ts` → Fallback (alle Plattformen)

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

`useMealPlan.ts` exportiert zusätzlich `ensurePlanForWeek(allPlans, weekStartIso, planName, createPlan)`: sucht den Plan für die gegebene Woche in `allPlans` oder legt ihn per `createPlan` neu an. Gemeinsam genutzt von `AddToMealPlanModal` und `(tabs)/meal-plan.tsx`, die beide "Plan für diese Woche sicherstellen" vor dem Eintragen brauchen.

### Wochenauswahl-Hook (`useWeekNavigation.ts`)

| Hook | Rückgabe | Beschreibung |
|------|----------|--------------|
| `useWeekNavigation(initial?)` | `{ weekStart, setWeekStart, weekStartIso, weekNum, year, navigateWeek, resetToToday }` | Verwaltet den "Montag der gewählten Woche"-State inkl. Vor/Zurück-Navigation. Genutzt von `AddToMealPlanModal` und `(tabs)/meal-plan.tsx`. |

### Zuletzt-verwendet-Hook (`useRecentRecipes.ts`)

| Hook | Rückgabe | Beschreibung |
|------|----------|--------------|
| `useRecentRecipes(plan, recipes, limit=5)` | `Recipe[]` | Letzte `limit` eindeutige Rezepte, die im übergebenen Wochenplan verwendet wurden (neueste zuerst). Genutzt von `(tabs)/meal-plan.tsx` für den "Zuletzt verwendet"-Block in `RecipeSearchPanel`. |

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

### Einkaufslisten-Hooks (`useShoppingList.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useShoppingList()` | Query | Aktive Einkaufsliste abrufen (`GET /shopping-list`), Cache-Key: `['shopping-list']` |
| `useGenerateShoppingList()` | Mutation | Liste aus Mahlzeitenplan generieren (`POST /shopping-list/generate`), invalidiert `['shopping-list']` |
| `useAddShoppingItem()` | Mutation | Manuellen Eintrag hinzufügen (`POST /shopping-list/items`), invalidiert `['shopping-list']` |
| `useToggleShoppingItem()` | Mutation | Eintrag abhaken/wiederherstellen (`PATCH /shopping-list/items/{id}`), invalidiert `['shopping-list']` |
| `useDeleteShoppingItem()` | Mutation | Einzelnen Eintrag löschen (`DELETE /shopping-list/items/{id}`), invalidiert `['shopping-list']` |
| `useClearDoneItems()` | Mutation | Alle abgehakten Einträge löschen (`DELETE /shopping-list/done`), invalidiert `['shopping-list']` |
| `useDeleteShoppingList()` | Mutation | Gesamte Liste löschen (`DELETE /shopping-list`), invalidiert `['shopping-list']` |

### Orientierungs-Hook (`useOrientation.ts`)

| Hook | Rückgabe | Beschreibung |
|------|----------|--------------|
| `useOrientation()` | `{ isLandscape, isPortrait, isTablet }` | Erkennt Geräteausrichtung und Tablet-Formfaktor via `useWindowDimensions`. Tablet = längste Seite ≥ 768px. |

Wird u.a. in `app/(tabs)/_layout.tsx` verwendet, um die Tab-Leiste im Querformat auf Tablets seitlich (`left`) statt unten (`bottom`) anzuzeigen.

### Konversations-Hooks (`useConversations.ts`)

| Hook | Typ | Beschreibung |
|------|-----|--------------|
| `useConversations()` | Query | Alle Konversationen abrufen (`GET /ai/conversations`), Cache-Key: `['conversations']` |
| `useConversationMessages(id)` | Query | Alle Nachrichten einer Konversation (`GET /ai/conversations/{id}/messages`), Cache-Key: `['conversations', id, 'messages']` |
| `useCreateConversation()` | Mutation | Neue Konversation erstellen (`POST /ai/conversations`), invalidiert `['conversations']` |
| `useUpdateConversationTitle()` | Mutation | Konversationstitel ändern (`PATCH /ai/conversations/{id}`), invalidiert `['conversations']` |
| `useDeleteConversation()` | Mutation | Konversation löschen (`DELETE /ai/conversations/{id}`), invalidiert `['conversations']` |

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
  repeat_weekly: boolean;  // Eintrag wöchentlich wiederholen
}

interface User {
  id: number;
  name: string;
  avatar_color: string;  // Hex, z.B. "#2E7D32"
  short_name: string;    // z.B. "MA"
}

// Einkaufsliste
interface ShoppingList {
  id: number;
  household_id: number;
  created_at: string;
  items: ShoppingListItem[];
}

interface ShoppingListItem {
  id: number;
  shopping_list_id: number;
  name: string;
  amount: number | null;
  unit: string | null;
  is_checked: boolean;
}

interface GenerateShoppingListPayload {
  date_from: string;  // "YYYY-MM-DD"
  date_to: string;    // "YYYY-MM-DD"
  merge: boolean;
}

// KI-Konversationen
interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// KI-Chat – Pending Actions
interface PendingAction {
  type: 'add_meal_plan_entry' | 'delete_meal_plan_entry' | 'generate_shopping_list' | 'add_shopping_item';
  description: string;
  data: Record<string, unknown>;
}

// Aktualisierte KI-Chat-Typen
interface AiChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  week_start_date?: string;
  conversation_id?: number;  // Optional: Verknüpfung mit gespeicherter Konversation
}

interface AiChatResponse {
  reply: string;
  recipe_suggestions: RecipeSuggestion[];
  pending_actions: PendingAction[];  // Aktionen zur Nutzerbestätigung
  conversation_id?: number;          // ID der verknüpften Konversation
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

## Komponenten: RecipeDetailContent, RecipeDetailModal, RecipeSearchPanel

Drei zusammenhängende Komponenten, mit denen die Rezeptdetailansicht sowohl als Vollbild-Screen (Rezepte-Tab) als auch als Modal über dem Wochenplan (mit Austausch-Funktion) dargestellt werden kann, ohne Logik zu duplizieren.

### `RecipeDetailContent` (`mobile/components/RecipeDetailContent.tsx`)
Reine Darstellungskomponente mit der vollständigen Rezeptdetail-Logik (Beschreibung, Quelle, Meta, Tags, Bewertungen, Zutaten-Inline-Editing, Aktionsleiste Kochen/Zum Essensplan/Bearbeiten/Löschen). Kennt keine Navigation direkt, sondern bekommt sie über Props gereicht – dadurch kann sie sowohl in einem Stack-Screen als auch in einem Modal verwendet werden.

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `recipeId` | `number` | ID des anzuzeigenden Rezepts |
| `onNavigate` | `(path: string) => void` | Aufgerufen bei Kochen-/Bearbeiten-Button (Ziel-Pfad als String) |
| `onDeleted` | `() => void` | Aufgerufen nach erfolgreichem Löschen |

Wird von `recipe/[id]/index.tsx` (mit `router.push`/`router.back`) und von `RecipeDetailModal` (mit `onClose` vor der Navigation) verwendet.

### `RecipeDetailModal` (`mobile/components/RecipeDetailModal.tsx`)
Zeigt `RecipeDetailContent` als `pageSheet`-Modal an. Enthält zusätzlich einen "Austauschen"-Icon-Button im Header (nur wenn `onSwap` übergeben wird), der intern auf einen Austausch-Bereich mit zwei Tabs umschaltet: **Rezept** (`RecipeSearchPanel`) oder **Freitext** (Textfeld, analog zum Freitext-Tab im Essensplan-Modal).

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `recipeId` | `number \| null` | ID des Rezepts; `null` → Modal rendert nichts |
| `visible` | `boolean` | Steuert die Sichtbarkeit |
| `onClose` | `() => void` | Schließen-Button, nach Löschen, nach Navigation |
| `onSwap` | `(recipeId: number \| null, customMeal: string \| null) => void` (optional) | Wird bei Auswahl eines neuen Rezepts (`customMeal: null`) oder beim Speichern des Freitexts (`recipeId: null`) aufgerufen; ohne diese Prop wird kein Austauschen-Button angezeigt |

**Einstiegspunkt:** `(tabs)/meal-plan.tsx` – Tap auf einen Plan-Eintrag mit Rezept; `onSwap` ruft dort `useUpdateEntry` auf (mit `recipe_id` oder `custom_meal`, je nach gewähltem Tab) und schließt danach das Modal.

### `RecipeSearchPanel` (`mobile/components/RecipeSearchPanel.tsx`)
In sich geschlossene Rezeptsuche: Suchfeld, Tag-Filter, Mindestbewertungs-Filter pro Haushaltsmitglied, „Zuletzt verwendet"-Liste (optional) und Ergebnisliste. Verwaltet Such-/Filterzustand intern.

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `recipes` | `Recipe[]` | Zu durchsuchende Rezepte |
| `tags` | `Tag[]` | Für den Tag-Filter |
| `users` | `User[]` | Für den Mindestbewertungs-Filter |
| `recentRecipes` | `Recipe[]` | Zeigt einen „Zuletzt verwendet"-Block, sofern nicht leer und kein Filter aktiv |
| `initialTagIds` | `number[]` (optional) | Vorausgewählte Tag-Filter beim ersten Rendern (z.B. passend zur Mahlzeit) |
| `onSelect` | `(recipeId: number) => void` | Aufgerufen bei Auswahl eines Rezepts |

Verwendet im Rezept-Auswahl-Tab des Essensplan-Modals (`(tabs)/meal-plan.tsx`, mit `key`-Prop zum gezielten Zurücksetzen beim erneuten Öffnen) und im Austausch-Modus von `RecipeDetailModal`.

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

## Komponente: BaseModal (`mobile/components/BaseModal.tsx`)

Gemeinsame Hülle für alle `pageSheet`-Modals: `Modal` + Header-Zeile (links: Titel oder Zurück-Button, rechts: optionale Extra-Buttons + „Schließen") + Content-Bereich. Ersetzt die zuvor in `AddToMealPlanModal`, `RecipeDetailModal`, `AiSuggestionModal` und dem Rezept-Picker-Modal in `(tabs)/meal-plan.tsx` jeweils separat implementierte Kombination aus `Modal`+Header.

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `visible` | `boolean` | — | Sichtbarkeit |
| `onClose` | `() => void` | — | Schließen-Callback (Header-Button + `onRequestClose`) |
| `headerLeft` | `ReactNode` | — | Titel-String oder eigenes Element (z.B. Zurück-Button) |
| `headerRight` | `ReactNode` | — | Zusätzliche Header-Buttons vor „Schließen" |
| `closable` | `boolean` | `true` | Blendet den „Schließen"-Button aus (z.B. während eines laufenden Speichervorgangs) |
| `isWide` | `boolean` | — | Zentriert den Inhalt mit `maxWidth` auf breiten Bildschirmen |
| `maxWidth` | `number` | `680` | Maximale Breite im Wide-Modus |
| `containerStyle` | `StyleProp<ViewStyle>` | — | Zusätzlicher Style für den äußeren Container (z.B. `maxHeight` im Querformat) |

**Verwendung (Beispiel):**
```tsx
<BaseModal visible={visible} onClose={onClose} headerLeft="Zum Essensplan hinzufügen" isWide={isWide}>
  {/* Inhalt */}
</BaseModal>
```

---

## Komponente: UserChipRow (`mobile/components/UserChipRow.tsx`)

Zeile mit einer anklickbaren Chip-Auswahl pro Haushaltsmitglied (Kürzel als Text, Avatarfarbe als Hintergrund bei Auswahl). Ersetzt die zuvor in `(tabs)/meal-plan.tsx` und `AddToMealPlanModal` separat implementierte, identische Chip-Logik für die "Für wen?"-Auswahl.

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `users` | `User[]` | Anzuzeigende Haushaltsmitglieder |
| `selectedIds` | `number[]` | Aktuell ausgewählte User-IDs |
| `onToggle` | `(userId: number) => void` | Aufgerufen bei Klick auf einen Chip |

Der umgebende Abschnitts-Titel ("Für wen?") und dessen Styling bleiben Sache des jeweiligen Aufrufers, da sich das Layout drumherum je nach Kontext unterscheidet.

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
| `/(tabs)/shopping-list` | Einkaufsliste |
| `/(tabs)/ai-chat` | KI-Chat |
| `/recipe/bulk-import` | Bulk-Import aus URLs |
| `/recipe/new` | Neues Rezept |
| `/recipe/[id]` | Rezeptdetail |
| `/recipe/[id]/edit` | Rezept bearbeiten |
| `/recipe/[id]/cook` | Koch-Ansicht |

Navigation mit `router.push('/recipe/new')` oder `router.replace(...)` aus `expo-router`.
