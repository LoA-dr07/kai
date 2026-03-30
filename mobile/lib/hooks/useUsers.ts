import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { User, UserPreferences, UserCreate, UserUpdate } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreate) => api.post('/users', data).then(r => r.data),
    onSuccess: (newUser: User) => {
      queryClient.setQueryData<User[]>(['users'], old => [...(old ?? []), newUser]);
      queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
}

export function useUpdateUser(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdate) =>
      api.patch(`/users/${userId}`, data).then(r => r.data),
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData<User[]>(['users'], old =>
        old ? old.map(u => (u.id === userId ? updatedUser : u)) : [updatedUser]
      );
      queryClient.invalidateQueries({ queryKey: ['household'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.delete(`/users/${userId}`),
    onSuccess: (_: unknown, userId: number) => {
      queryClient.setQueryData<User[]>(['users'], old =>
        old ? old.filter(u => u.id !== userId) : []
      );
      queryClient.invalidateQueries({ queryKey: ['household'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateUserPreferences(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: UserPreferences) =>
      api.put(`/users/${userId}/preferences`, { preferences }).then(r => r.data),
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData<User[]>(['users'], old =>
        old ? old.map(u => (u.id === userId ? updatedUser : u)) : [updatedUser]
      );
    },
  });
}
