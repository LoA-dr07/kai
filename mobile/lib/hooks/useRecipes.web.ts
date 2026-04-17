import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  Recipe, RecipeCreatePayload, Ingredient, RecipeIngredient,
  RecipeExportItem, RecipeImportResult,
  Tag, RecipeRating,
  BulkUrlImportResult, RecipeBulkPreviewResult,
} from '../types';

// ---------------------------------------------------------------------------
// Read hooks – REST API (web fallback; native uses PowerSync)
// ---------------------------------------------------------------------------

export function useRecipes() {
  const { data = [], isLoading, error } = useQuery<Recipe[], Error>({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

export function useRecipe(id: number) {
  const { data, isLoading, error } = useQuery<Recipe, Error>({
    queryKey: ['recipes', id],
    queryFn: () => api.get(`/recipes/${id}`).then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

export function useIngredients() {
  const { data = [], isLoading, error } = useQuery<Ingredient[], Error>({
    queryKey: ['ingredients'],
    queryFn: () => api.get('/recipes/ingredients').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

export function useTags() {
  const { data = [], isLoading, error } = useQuery<Tag[], Error>({
    queryKey: ['tags'],
    queryFn: () => api.get('/recipes/tags').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined };
}

// ---------------------------------------------------------------------------
// Write hooks – direct FastAPI calls + cache invalidation
// ---------------------------------------------------------------------------

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: id => api.delete(`/recipes/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation<Ingredient, Error, string>({
    mutationFn: name => api.post('/recipes/ingredients', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation<Ingredient, Error, { id: number; name: string }>({
    mutationFn: ({ id, name }) =>
      api.patch(`/recipes/ingredients/${id}`, { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}

export function useUpdateRecipeIngredient(recipeId: number) {
  const qc = useQueryClient();
  return useMutation<
    RecipeIngredient,
    Error,
    { recipeIngredientId: number; ingredient_id?: number; amount?: number; unit?: string }
  >({
    mutationFn: ({ recipeIngredientId, ...payload }) =>
      api
        .patch(`/recipes/${recipeId}/ingredients/${recipeIngredientId}`, payload)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useRateRecipe(recipeId: number) {
  const qc = useQueryClient();
  return useMutation<RecipeRating, Error, { user_id: number; stars: number }>({
    mutationFn: payload =>
      api.post(`/recipes/${recipeId}/ratings`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation<Tag, Error, string>({
    mutationFn: name => api.post('/recipes/tags', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useImportRecipes() {
  const qc = useQueryClient();
  return useMutation<RecipeImportResult, Error, RecipeExportItem[]>({
    mutationFn: recipes => api.post('/recipes/import', recipes).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

interface BulkUrlItem {
  url: string;
  tag_ids: number[];
  ratings: { user_id: number; stars: number }[];
}

export function useBulkPreviewFromUrl() {
  return useMutation<RecipeBulkPreviewResult, Error, { items: Pick<BulkUrlItem, 'url'>[] }>({
    mutationFn: payload =>
      api
        .post('/recipes/import/url/bulk-preview', payload, { timeout: 0 })
        .then(r => r.data),
  });
}

export function useBulkImportFromUrl() {
  const qc = useQueryClient();
  return useMutation<BulkUrlImportResult, Error, { items: BulkUrlItem[] }>({
    mutationFn: payload =>
      api.post('/recipes/import/url/bulk', payload, { timeout: 0 }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}
