import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Household, HouseholdSettings } from '../types';

// ---------------------------------------------------------------------------
// Read hook – REST API (web fallback; native uses PowerSync)
// ---------------------------------------------------------------------------

export function useHousehold() {
  const { data, isLoading, error } = useQuery<Household, Error>({
    queryKey: ['household'],
    queryFn: () => api.get('/household').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

// ---------------------------------------------------------------------------
// Write hook – direct FastAPI call + cache invalidation
// ---------------------------------------------------------------------------

export function useUpdateHouseholdSettings() {
  const qc = useQueryClient();
  return useMutation<Household, Error, HouseholdSettings>({
    mutationFn: (settings: HouseholdSettings) =>
      api.put('/household/settings', { settings }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household'] }),
  });
}
