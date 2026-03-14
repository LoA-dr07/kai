import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  MealPlan,
  MealPlanEntryCreatePayload,
  MealPlanEntryUpdatePayload,
} from '../types';

export function useMealPlans() {
  return useQuery<MealPlan[]>({
    queryKey: ['meal-plans'],
    queryFn: () => api.get('/meal-plans').then(r => r.data),
  });
}

export function useMealPlan(id: number | null) {
  return useQuery<MealPlan>({
    queryKey: ['meal-plans', id],
    queryFn: () => api.get(`/meal-plans/${id}`).then(r => r.data),
    enabled: id !== null,
  });
}

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation<MealPlan, Error, { name: string; week_start_date: string }>({
    mutationFn: payload => api.post('/meal-plans', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

export function useAddEntry(planId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, MealPlanEntryCreatePayload>({
    mutationFn: payload =>
      api.post(`/meal-plans/${planId}/entries`, payload).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans', planId] }),
  });
}

export function useUpdateEntry(planId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, { entryId: number; payload: MealPlanEntryUpdatePayload }>({
    mutationFn: ({ entryId, payload }) =>
      api.patch(`/meal-plans/${planId}/entries/${entryId}`, payload).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans', planId] }),
  });
}

export function useDeleteEntry(planId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: entryId =>
      api.delete(`/meal-plans/${planId}/entries/${entryId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans', planId] }),
  });
}
