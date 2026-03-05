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
