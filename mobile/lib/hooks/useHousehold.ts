import { useMemo } from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery as usePS, useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { Household, HouseholdSettings, User, UserPreferences } from '../types';

const PS_QUERY_OPTS = { staleTime: 0, refetchInterval: 15_000 } as const;

// ---------------------------------------------------------------------------
// Read hook – db.getAll() via TanStack Query (avoids PowerSync watch() crash)
// ---------------------------------------------------------------------------

export function useHousehold(): { data: Household | undefined; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const { data: householdRows, isLoading: l1, error } = usePS({
    queryKey: ['households'],
    queryFn: () => db.getAll('SELECT * FROM households LIMIT 1'),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: memberRows, isLoading: l2 } = usePS({
    queryKey: ['household_members'],
    queryFn: () => db.getAll(`
      SELECT u.id, u.name, u.avatar_color, u.short_name, u.preferences,
             hm.household_id
      FROM household_members hm
      JOIN users u ON u.id = hm.user_id
    `),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });

  const data = useMemo<Household | undefined>(() => {
    const h = (householdRows ?? [])[0];
    if (!h) return undefined;

    const settings: HouseholdSettings =
      typeof h.settings === 'string'
        ? JSON.parse(h.settings || '{}')
        : (h.settings ?? {});

    const members: User[] = (memberRows ?? [])
      .filter(m => m.household_id === h.id)
      .map(m => ({
        id: Number(m.id),
        name: m.name as string,
        avatar_color: m.avatar_color as string,
        short_name: m.short_name as string,
        preferences: (
          typeof m.preferences === 'string'
            ? JSON.parse(m.preferences || '{}')
            : (m.preferences ?? {})
        ) as UserPreferences,
      }));

    return { id: Number(h.id), name: h.name as string, settings, members };
  }, [householdRows, memberRows]);

  return { data, isLoading: l1 || l2, error };
}

// ---------------------------------------------------------------------------
// Write hook – direct FastAPI call; PowerSync syncs the change back
// ---------------------------------------------------------------------------

export function useUpdateHouseholdSettings() {
  return useMutation<Household, Error, HouseholdSettings>({
    mutationFn: (settings: HouseholdSettings) =>
      api.put('/household/settings', { settings }).then(r => r.data),
  });
}
