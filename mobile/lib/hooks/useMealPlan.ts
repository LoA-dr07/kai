import { useMemo } from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery as usePS, useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type {
  MealPlan,
  MealPlanEntry,
  MealPlanEntryCreatePayload,
  MealPlanEntryUpdatePayload,
  MealType,
} from '../types';

const PS_QUERY_OPTS = { staleTime: 0, refetchInterval: 15_000 } as const;

// ---------------------------------------------------------------------------
// Read hook – db.getAll() via TanStack Query (avoids PowerSync watch() crash)
// ---------------------------------------------------------------------------

export function useMealPlans(): { data: MealPlan[]; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const { data: planRows, isLoading: l1, error } = usePS({
    queryKey: ['meal_plans'],
    queryFn: () => db.getAll('SELECT * FROM meal_plans ORDER BY week_start_date DESC'),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: entryRows, isLoading: l2 } = usePS({
    queryKey: ['meal_plan_entries'],
    queryFn: () => db.getAll(`
      SELECT mpe.id, mpe.meal_plan_id, mpe.day_of_week, mpe.meal_type,
             mpe.recipe_id, mpe.custom_meal, mpe.repeat_weekly,
             r.name  AS recipe_name,
             r.description AS recipe_description,
             r.servings AS recipe_servings,
             r.prep_time_minutes AS recipe_prep_time_minutes,
             r.source_url AS recipe_source_url
      FROM meal_plan_entries mpe
      LEFT JOIN recipes r ON r.id = mpe.recipe_id
    `),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: entryUserRows } = usePS({
    queryKey: ['meal_plan_entry_users'],
    queryFn: () => db.getAll('SELECT * FROM meal_plan_entry_users'),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });

  const data = useMemo<MealPlan[]>(() =>
    (planRows ?? []).map(plan => ({
      id: Number(plan.id),
      name: plan.name as string,
      week_start_date: plan.week_start_date as string,
      entries: (entryRows ?? [])
        .filter(e => e.meal_plan_id === plan.id)
        .map(e => ({
          id: Number(e.id),
          day_of_week: Number(e.day_of_week),
          meal_type: e.meal_type as MealType,
          recipe_id: e.recipe_id != null ? Number(e.recipe_id) : null,
          custom_meal: e.custom_meal as string | null,
          recipe: e.recipe_id != null
            ? {
                id: Number(e.recipe_id),
                name: e.recipe_name as string,
                description: e.recipe_description as string | null,
                servings: Number(e.recipe_servings),
                prep_time_minutes:
                  e.recipe_prep_time_minutes != null
                    ? Number(e.recipe_prep_time_minutes)
                    : null,
                source_url: e.recipe_source_url as string | null,
                // Ingredients / tags / ratings are not needed in the meal plan view
                ingredients: [],
                tags: [],
                ratings: [],
              }
            : null,
          repeat_weekly: Boolean(e.repeat_weekly),
          assigned_user_ids: (entryUserRows ?? [])
            .filter(eu => eu.entry_id === e.id)
            .map(eu => Number(eu.user_id)),
        })) as MealPlanEntry[],
    })),
  [planRows, entryRows, entryUserRows]);

  return { data, isLoading: l1 || l2, error };
}

// ---------------------------------------------------------------------------
// Write hooks – direct FastAPI calls; PowerSync syncs the changes back
// ---------------------------------------------------------------------------

export function useCreateMealPlan() {
  return useMutation<MealPlan, Error, { name: string; week_start_date: string }>({
    mutationFn: payload => api.post('/meal-plans', payload).then(r => r.data),
  });
}

export function useAddEntry() {
  return useMutation<MealPlanEntry, Error, MealPlanEntryCreatePayload>({
    mutationFn: ({ planId, ...payload }) =>
      api.post(`/meal-plans/${planId}/entries`, payload).then(r => r.data),
  });
}

export function useUpdateEntry() {
  return useMutation<MealPlanEntry, Error, MealPlanEntryUpdatePayload>({
    mutationFn: ({ planId, entryId, ...payload }) =>
      api.patch(`/meal-plans/${planId}/entries/${entryId}`, payload).then(r => r.data),
  });
}

export function useDeleteEntry() {
  return useMutation<void, Error, { planId: number; entryId: number }>({
    mutationFn: ({ planId, entryId }) =>
      api.delete(`/meal-plans/${planId}/entries/${entryId}`).then(() => undefined),
  });
}

/** Find the meal plan for `weekStartIso` in `allPlans`, or create one on demand.
 * Shared by the meal-plan screen's own picker and AddToMealPlanModal, which
 * both need "ensure a plan exists for this week" before adding an entry. */
export async function ensurePlanForWeek(
  allPlans: MealPlan[] | undefined,
  weekStartIso: string,
  planName: string,
  createPlan: ReturnType<typeof useCreateMealPlan>
): Promise<number> {
  const existingId = allPlans?.find(p => p.week_start_date === weekStartIso)?.id;
  if (existingId) return existingId;
  const newPlan = await createPlan.mutateAsync({ name: planName, week_start_date: weekStartIso });
  return newPlan.id;
}
