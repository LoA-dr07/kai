import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { User, UserPreferences, UserCreate, UserUpdate } from '../types';

// ---------------------------------------------------------------------------
// Read hook – REST API (web fallback; native uses PowerSync)
// ---------------------------------------------------------------------------

export function useUsers() {
  const { data = [], isLoading, error } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

// ---------------------------------------------------------------------------
// Write hooks – direct FastAPI calls + cache invalidation
// ---------------------------------------------------------------------------

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation<User, Error, UserCreate>({
    mutationFn: (data: UserCreate) => api.post('/users', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser(userId: number) {
  const qc = useQueryClient();
  return useMutation<User, Error, UserUpdate>({
    mutationFn: (data: UserUpdate) =>
      api.patch(`/users/${userId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (userId: number) =>
      api.delete(`/users/${userId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUserPreferences(userId: number) {
  const qc = useQueryClient();
  return useMutation<User, Error, UserPreferences>({
    mutationFn: (preferences: UserPreferences) =>
      api.put(`/users/${userId}/preferences`, { preferences }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
