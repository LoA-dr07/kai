import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { User, UserPreferences, UserCreate, UserUpdate } from '../types';

// ---------------------------------------------------------------------------
// Read hook – PowerSync (local SQLite, reactive, offline-capable)
// ---------------------------------------------------------------------------

export function useUsers(): { data: User[]; isLoading: boolean; error: Error | undefined } {
  const { data: rows, isLoading, error } = useQuery(
    'SELECT * FROM users ORDER BY name',
  );
  const data = useMemo<User[]>(
    () =>
      rows.map(r => ({
        id: Number(r.id),
        name: r.name as string,
        avatar_color: r.avatar_color as string,
        short_name: r.short_name as string,
        preferences: (
          typeof r.preferences === 'string'
            ? JSON.parse(r.preferences || '{}')
            : (r.preferences ?? {})
        ) as UserPreferences,
      })),
    [rows],
  );
  return { data, isLoading, error };
}

// ---------------------------------------------------------------------------
// Write hooks – direct FastAPI calls; PowerSync syncs the changes back
// ---------------------------------------------------------------------------

export function useCreateUser() {
  return useMutation<User, Error, UserCreate>({
    mutationFn: (data: UserCreate) => api.post('/users', data).then(r => r.data),
  });
}

export function useUpdateUser(userId: number) {
  return useMutation<User, Error, UserUpdate>({
    mutationFn: (data: UserUpdate) =>
      api.patch(`/users/${userId}`, data).then(r => r.data),
  });
}

export function useDeleteUser() {
  return useMutation<void, Error, number>({
    mutationFn: (userId: number) =>
      api.delete(`/users/${userId}`).then(() => undefined),
  });
}

export function useUpdateUserPreferences(userId: number) {
  return useMutation<User, Error, UserPreferences>({
    mutationFn: (preferences: UserPreferences) =>
      api.put(`/users/${userId}/preferences`, { preferences }).then(r => r.data),
  });
}
