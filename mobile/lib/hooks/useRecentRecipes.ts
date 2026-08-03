import { useMemo } from 'react';
import { addDays, parseIsoDate } from '../dateUtils';
import type { MealPlan, Recipe } from '../types';

/** Last N unique recipes used in a meal plan, most recent first. */
export function useRecentRecipes(plan: MealPlan | undefined, recipes: Recipe[] | undefined, limit = 5): Recipe[] {
  return useMemo(() => {
    if (!plan || !recipes) return [];
    const seen = new Set<number>();
    const result: Recipe[] = [];
    const entries = [...(plan.entries ?? [])].reverse();
    for (const entry of entries) {
      if (entry.recipe_id && !seen.has(entry.recipe_id)) {
        seen.add(entry.recipe_id);
        const recipe = recipes.find(r => r.id === entry.recipe_id);
        if (recipe) result.push(recipe);
      }
      if (result.length >= limit) break;
    }
    return result;
  }, [plan, recipes, limit]);
}

/** Most recently cooked recipe across all meal plans (latest past date with a recipe entry). */
export function useLastCookedRecipe(plans: MealPlan[] | undefined, recipes: Recipe[] | undefined): Recipe | null {
  return useMemo(() => {
    if (!plans || !recipes || plans.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let best: { date: Date; recipeId: number } | null = null;
    for (const plan of plans) {
      const weekStart = parseIsoDate(plan.week_start_date);
      for (const entry of plan.entries ?? []) {
        if (!entry.recipe_id) continue;
        const entryDate = addDays(weekStart, entry.day_of_week);
        if (entryDate > today) continue;
        if (!best || entryDate > best.date) {
          best = { date: entryDate, recipeId: entry.recipe_id };
        }
      }
    }
    if (!best) return null;
    return recipes.find(r => r.id === best!.recipeId) ?? null;
  }, [plans, recipes]);
}
