import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { AiMealPlanRequest, AiMealPlanSuggestion } from '../types';

export function useAiMealPlanSuggestion() {
  return useMutation<AiMealPlanSuggestion, Error, AiMealPlanRequest>({
    mutationFn: (payload) =>
      api
        .post<AiMealPlanSuggestion>('/ai/meal-plan-suggestion', payload, { timeout: 60_000 })
        .then((r) => r.data),
  });
}
