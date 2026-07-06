import { useMemo } from 'react';
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
