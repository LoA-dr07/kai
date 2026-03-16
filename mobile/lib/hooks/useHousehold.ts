import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Household, HouseholdSettings } from '../types';

export function useHousehold() {
  return useQuery<Household>({
    queryKey: ['household'],
    queryFn: () => api.get('/household').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateHouseholdSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: HouseholdSettings) =>
      api.put('/household/settings', { settings }).then(r => r.data),
    onSuccess: (data: Household) => {
      queryClient.setQueryData(['household'], data);
    },
  });
}
