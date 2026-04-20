import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ShoppingList, ShoppingListItem, GenerateShoppingListPayload } from '../types';

const QUERY_KEY = ['shopping-list'];

export function useShoppingList() {
  const { data, isLoading, error, refetch } = useQuery<ShoppingList | null, Error>({
    queryKey: QUERY_KEY,
    queryFn: () => api.get('/shopping-list').then(r => r.data),
  });
  return { data: data ?? null, isLoading, error: error ?? undefined, refetch };
}

export function useGenerateShoppingList() {
  const qc = useQueryClient();
  return useMutation<ShoppingList, Error, GenerateShoppingListPayload>({
    mutationFn: payload => api.post('/shopping-list/generate', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAddShoppingItem() {
  const qc = useQueryClient();
  return useMutation<ShoppingListItem, Error, { name: string; amount?: number | null; unit?: string | null }>({
    mutationFn: payload => api.post('/shopping-list/items', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation<ShoppingListItem, Error, { id: number; is_checked: boolean }>({
    mutationFn: ({ id, is_checked }) =>
      api.patch(`/shopping-list/items/${id}`, { is_checked }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: id => api.delete(`/shopping-list/items/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useClearDoneItems() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => api.delete('/shopping-list/done').then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteShoppingList() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => api.delete('/shopping-list').then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
