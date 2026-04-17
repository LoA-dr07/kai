import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { Household, HouseholdSettings, User, UserPreferences } from '../types';

// ---------------------------------------------------------------------------
// Read hook – PowerSync (local SQLite, reactive, offline-capable)
// ---------------------------------------------------------------------------

export function useHousehold(): { data: Household | undefined; isLoading: boolean; error: Error | undefined } {
  const { data: householdRows, isLoading: l1, error } = useQuery(
    'SELECT * FROM households LIMIT 1',
  );
  const { data: memberRows, isLoading: l2 } = useQuery(`
    SELECT u.id, u.name, u.avatar_color, u.short_name, u.preferences,
           hm.household_id
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
  `);

  const data = useMemo<Household | undefined>(() => {
    const h = householdRows[0];
    if (!h) return undefined;

    const settings: HouseholdSettings =
      typeof h.settings === 'string'
        ? JSON.parse(h.settings || '{}')
        : (h.settings ?? {});

    const members: User[] = memberRows
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
