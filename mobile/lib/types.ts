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

export interface User {
  id: number;
  name: string;
  abbreviation: string;
  avatar_color: string;
  household_id: number | null;
}

export interface Household {
  id: number;
  name: string;
  members: User[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  id: number;
  day_of_week: number;
  meal_type: MealType;
  recipe_id: number | null;
  custom_meal: string | null;
  recipe: Recipe | null;
  assigned_users: User[];
}

export interface MealPlan {
  id: number;
  name: string;
  week_start_date: string;
  entries: MealPlanEntry[];
}

export interface MealPlanEntryCreatePayload {
  day_of_week: number;
  meal_type: MealType;
  recipe_id?: number | null;
  custom_meal?: string | null;
  user_ids?: number[];
}

export interface MealPlanEntryUpdatePayload {
  recipe_id?: number | null;
  custom_meal?: string | null;
  user_ids?: number[];
}
