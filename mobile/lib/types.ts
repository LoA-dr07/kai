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

export interface Recipe {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  prep_time_minutes: number | null;
  ingredients: RecipeIngredient[];
}

export interface RecipeCreatePayload {
  name: string;
  description?: string | null;
  servings?: number;
  prep_time_minutes?: number | null;
  ingredients?: { ingredient_id: number; amount: number; unit: string }[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface User {
  id: number;
  name: string;
  avatar_color: string;
  short_name: string;
}

export interface MealPlanEntry {
  id: number;
  day_of_week: number; // 0=Montag … 6=Sonntag
  meal_type: MealType;
  recipe_id: number | null;
  custom_meal: string | null;
  recipe: Recipe | null;
  assigned_user_ids: number[];
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
}

export interface MealPlanEntryUpdatePayload {
  planId: number;
  entryId: number;
  recipe_id?: number | null;
  custom_meal?: string | null;
  assigned_user_ids?: number[];
}
