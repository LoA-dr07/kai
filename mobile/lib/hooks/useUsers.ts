import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { User } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 5 * 60 * 1000, // Users ändern sich selten
  });
}
