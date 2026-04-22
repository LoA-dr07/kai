export interface Ingredient {
  id: number;
  name: string;
}

export interface RecipeIngredient {
  id: number;
  ingredient_id: number;
  amount: number;
  unit: string;
  ingredient: Ingredient;
}

export interface Tag {
  id: number;
  name: string;
  is_predefined: boolean;
  category: string | null;
}

export interface RecipeRating {
  user_id: number;
  stars: number;
}

export interface Recipe {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  prep_time_minutes: number | null;
  source_url: string | null;
  ingredients: RecipeIngredient[];
  tags: Tag[];
  ratings: RecipeRating[];
}

export interface RecipeCreatePayload {
  name: string;
  description?: string | null;
  servings?: number;
  prep_time_minutes?: number | null;
  source_url?: string | null;
  ingredients?: { ingredient_id: number; amount: number; unit: string }[];
  tag_ids?: number[];
}

// --- Import / Export ---

export interface RecipeExportIngredient {
  ingredient_name: string;
  amount: number;
  unit: string;
}

export interface RecipeExportItem {
  name: string;
  description?: string | null;
  servings: number;
  prep_time_minutes?: number | null;
  source_url?: string | null;
  ingredients: RecipeExportIngredient[];
  ratings?: RecipeRating[];
  tags?: string[];
}

export interface RecipeImportResult {
  created: number;
  skipped: number;
  created_ids: number[];
}

export interface BulkUrlImportFailure {
  url: string;
  error: string;
}

export interface BulkUrlImportResult {
  created_ids: number[];
  failed: BulkUrlImportFailure[];
}

export interface RecipeUrlPreviewResult {
  url: string;
  preview: RecipeUrlPreview | null;
  error: string | null;
}

export interface RecipeBulkPreviewResult {
  results: RecipeUrlPreviewResult[];
}

export interface RecipeUrlPreview {
  name: string;
  description?: string | null;
  servings: number;
  prep_time_minutes?: number | null;
  source_url?: string | null;
  ingredients: RecipeExportIngredient[];
}

// --- User management ---

export interface UserCreate {
  name: string;
  avatar_color: string;
  short_name: string;
}

export interface UserUpdate {
  name?: string;
  avatar_color?: string;
  short_name?: string;
}

// --- Household & Users ---

export interface UserPreferences {
  dietary_restrictions: string[]; // "vegetarian"|"vegan"|"pescatarian"|"gluten_free"|"lactose_free"|"low_carb"|"halal"|"kosher"
  allergies: string[];            // "peanuts"|"tree_nuts"|"dairy"|"eggs"|"wheat"|"shellfish"|"fish"|"soy"|"sesame"
  disliked_ingredients: string[];
  liked_cuisines: string[];
  spice_tolerance: string;        // "mild"|"medium"|"spicy"
  portion_size: string;           // "small"|"normal"|"large"
}

export interface User {
  id: number;
  name: string;
  avatar_color: string;
  short_name: string;
  preferences: UserPreferences;
}

export interface HouseholdSettings {
  cooking_days: string[];          // ["monday","tuesday",...]
  hot_meal_time: string;           // "lunch"|"dinner"|"both"
  cold_meal_days: string[];
  leftovers_frequency: string;     // "never"|"sometimes"|"often"
  shared_meals_importance: number; // 1–5
  weekly_budget: number | null;
  preferred_cuisines: string[];
  cooking_skill_level: string;     // "beginner"|"medium"|"advanced"
  notes?: string;                  // free-text context for AI
}

export interface Household {
  id: number;
  name: string;
  members: User[];
  settings: HouseholdSettings;
}

// --- Meal Plan ---

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'dessert';

export interface MealPlanEntry {
  id: number;
  day_of_week: number; // 0=Montag … 6=Sonntag
  meal_type: MealType;
  recipe_id: number | null;
  custom_meal: string | null;
  recipe: Recipe | null;
  assigned_user_ids: number[];
  repeat_weekly: boolean;
}

export interface MealPlan {
  id: number;
  name: string;
  week_start_date: string; // ISO-Datum (Montag der Woche)
  entries: MealPlanEntry[];
}

export interface MealPlanEntryCreatePayload {
  planId: number;
  day_of_week: number;
  meal_type: MealType;
  recipe_id?: number | null;
  custom_meal?: string | null;
  assigned_user_ids?: number[];
  repeat_weekly?: boolean;
}

export interface MealPlanEntryUpdatePayload {
  planId: number;
  entryId: number;
  recipe_id?: number | null;
  custom_meal?: string | null;
  assigned_user_ids?: number[];
  repeat_weekly?: boolean;
}

// --- AI Meal Plan Suggestion ---

export interface AiMealPlanRequest {
  week_start_date: string;
  requesting_user_id: number;
  special_wishes: string;
  meal_types: MealType[];
}

export interface AiMealPlanSuggestionEntry {
  day_of_week: number;
  meal_type: MealType;
  recipe_id: number | null;
  recipe_name: string | null;
  custom_meal: string | null;
  assigned_user_ids: number[];
  reason: string | null;
}

export interface AiMealPlanSuggestion {
  week_start_date: string;
  entries: AiMealPlanSuggestionEntry[];
}

// --- Shopping List ---

export interface ShoppingListItem {
  id: number;
  name: string;
  amount: number | null;
  unit: string | null;
  is_checked: boolean;
  is_manual: boolean;
  sort_order: number;
  custom_meal_ref: string | null;
}

export interface ShoppingList {
  id: number;
  household_id: number | null;
  created_at: string;
  items: ShoppingListItem[];
}

export interface GenerateShoppingListPayload {
  date_from: string;
  date_to: string;
  merge: boolean;
}

// --- Conversations ---

export interface Conversation {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// --- AI Chat ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RecipeSuggestion {
  recipe_id?: number | null;
  recipe_name: string;
  reason: string;
  is_new_recipe: boolean;
}

export interface PendingAction {
  type: 'add_meal_plan_entry' | 'delete_meal_plan_entry' | 'generate_shopping_list' | 'add_shopping_item' | 'create_recipe';
  description: string;
  data: Record<string, unknown>;
}

export interface AiChatRequest {
  messages: ChatMessage[];
  week_start_date?: string;
  conversation_id?: number | null;
}

export interface AiChatResponse {
  reply: string;
  recipe_suggestions: RecipeSuggestion[];
  pending_actions: PendingAction[];
  conversation_id: number | null;
}
