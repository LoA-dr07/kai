import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  MealPlan,
  MealPlanEntry,
  MealPlanEntryCreatePayload,
  MealPlanEntryUpdatePayload,
} from '../types';

export function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans'],
    queryFn: () => api.get('/meal-plans').then(r => r.data),
  });
}

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
