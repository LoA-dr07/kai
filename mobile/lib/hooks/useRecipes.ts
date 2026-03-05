import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Recipe, RecipeCreatePayload, Ingredient } from '../types';

export function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes').then(r => r.data),
  });
}

export function useRecipe(id: number) {
  return useQuery<Recipe>({
    queryKey: ['recipes', id],
    queryFn: () => api.get(`/recipes/${id}`).then(r => r.data),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation<Recipe, Error, RecipeCreatePayload>({
    mutationFn: payload => api.post('/recipes', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useUpdateRecipe(id: number) {
  const qc = useQueryClient();
  return useMutation<Recipe, Error, Partial<RecipeCreatePayload>>({
    mutationFn: payload => api.patch(`/recipes/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', id] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: id => api.delete(`/recipes/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useIngredients() {
  return useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: () => api.get('/recipes/ingredients').then(r => r.data),
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation<Ingredient, Error, string>({
    mutationFn: name => api.post('/recipes/ingredients', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}
