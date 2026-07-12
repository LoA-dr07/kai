import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  MealPlan,
  MealPlanEntry,
  MealPlanEntryCreatePayload,
  MealPlanEntryUpdatePayload,
} from '../types';

// ---------------------------------------------------------------------------
// Read hooks – REST API (web fallback; native uses PowerSync)
// ---------------------------------------------------------------------------

export function useMealPlans() {
  const { data = [], isLoading, error } = useQuery<MealPlan[], Error>({
    queryKey: ['meal-plans'],
    queryFn: () => api.get('/meal-plans').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

export function useMealPlan(id: number) {
  const { data, isLoading, error } = useQuery<MealPlan, Error>({
    queryKey: ['meal-plans', id],
    queryFn: () => api.get(`/meal-plans/${id}`).then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

// ---------------------------------------------------------------------------
// Write hooks – direct FastAPI calls + cache invalidation
// ---------------------------------------------------------------------------

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation<MealPlan, Error, { name: string; week_start_date: string }>({
    mutationFn: payload => api.post('/meal-plans', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

export function useAddEntry() {
  const qc = useQueryClient();
  return useMutation<MealPlanEntry, Error, MealPlanEntryCreatePayload>({
    mutationFn: ({ planId, ...payload }) =>
      api.post(`/meal-plans/${planId}/entries`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation<MealPlanEntry, Error, MealPlanEntryUpdatePayload>({
    mutationFn: ({ planId, entryId, ...payload }) =>
      api.patch(`/meal-plans/${planId}/entries/${entryId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation<void, Error, { planId: number; entryId: number }>({
    mutationFn: ({ planId, entryId }) =>
      api.delete(`/meal-plans/${planId}/entries/${entryId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
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
