import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { User, Household } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });
}

export function useHousehold() {
  return useQuery<Household>({
    queryKey: ['household'],
    queryFn: () => api.get('/household').then(r => r.data),
  });
}
