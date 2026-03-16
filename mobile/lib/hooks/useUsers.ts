import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { User, UserPreferences } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 5 * 60 * 1000, // Users ändern sich selten
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
