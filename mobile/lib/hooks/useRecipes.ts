import { useMemo } from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery as usePS, useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type {
  Recipe, RecipeCreatePayload, Ingredient, RecipeIngredient,
  RecipeExportItem, RecipeImportResult,
  Tag, RecipeRating,
  BulkUrlImportResult, RecipeBulkPreviewResult,
} from '../types';

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const RECIPES_SQL = `SELECT * FROM recipes ORDER BY name`;

const RECIPE_INGREDIENTS_SQL = `
  SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.amount, ri.unit,
         i.name AS ingredient_name
  FROM recipe_ingredients ri
  JOIN ingredients i ON i.id = ri.ingredient_id
`;

const RECIPE_TAGS_SQL = `
  SELECT rt.recipe_id, t.id, t.name, t.is_predefined, t.category
  FROM recipe_tags rt
  JOIN tags t ON t.id = rt.tag_id
`;

const RECIPE_RATINGS_SQL = `SELECT * FROM recipe_ratings`;

/** Assembles flat SQLite rows into the nested Recipe type. */
function buildRecipes(
  recipeRows: any[] | undefined,
  riRows: any[] | undefined,
  tagRows: any[] | undefined,
  ratingRows: any[] | undefined,
): Recipe[] {
  return (recipeRows ?? []).map(r => ({
    id: Number(r.id),
    name: r.name as string,
    description: r.description as string | null,
    servings: Number(r.servings),
    prep_time_minutes: r.prep_time_minutes != null ? Number(r.prep_time_minutes) : null,
    source_url: r.source_url as string | null,
    ingredients: (riRows ?? [])
      .filter(ri => ri.recipe_id === r.id)
      .map(ri => ({
        id: Number(ri.id),
        ingredient_id: Number(ri.ingredient_id),
        amount: Number(ri.amount),
        unit: ri.unit as string,
        ingredient: {
          id: Number(ri.ingredient_id),
          name: ri.ingredient_name as string,
        },
      })),
    tags: (tagRows ?? [])
      .filter(t => t.recipe_id === r.id)
      .map(t => ({
        id: Number(t.id),
        name: t.name as string,
        is_predefined: Boolean(t.is_predefined),
        category: t.category as string | null,
      })),
    ratings: (ratingRows ?? [])
      .filter(rr => rr.recipe_id === r.id)
      .map(rr => ({
        user_id: Number(rr.user_id),
        stars: Number(rr.stars),
      })),
  }));
}

// ---------------------------------------------------------------------------
// Read hooks – use db.getAll() via TanStack Query to avoid PowerSync watch()
// crash when the sync connection is already active.
// ---------------------------------------------------------------------------

const PS_QUERY_OPTS = {
  staleTime: 0,
  refetchInterval: 15_000,
} as const;

export function useRecipes(): { data: Recipe[]; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const { data: recipeRows, isLoading: l1, error } = usePS({
    queryKey: ['recipes'],
    queryFn: () => db.getAll(RECIPES_SQL),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: riRows, isLoading: l2 } = usePS({
    queryKey: ['recipe_ingredients'],
    queryFn: () => db.getAll(RECIPE_INGREDIENTS_SQL),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: tagRows } = usePS({
    queryKey: ['recipe_tags'],
    queryFn: () => db.getAll(RECIPE_TAGS_SQL),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: ratingRows } = usePS({
    queryKey: ['recipe_ratings'],
    queryFn: () => db.getAll(RECIPE_RATINGS_SQL),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });

  const data = useMemo(
    () => buildRecipes(recipeRows ?? [], riRows ?? [], tagRows ?? [], ratingRows ?? []),
    [recipeRows, riRows, tagRows, ratingRows],
  );

  return { data, isLoading: l1 || l2, error };
}

export function useRecipe(id: number): { data: Recipe | undefined; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const sid = String(id);

  const { data: recipeRows, isLoading: l1, error } = usePS({
    queryKey: ['recipes', sid],
    queryFn: () => db.getAll('SELECT * FROM recipes WHERE id = ?', [sid]),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: riRows, isLoading: l2 } = usePS({
    queryKey: ['recipe_ingredients', sid],
    queryFn: () => db.getAll(
      `SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.amount, ri.unit,
              i.name AS ingredient_name
       FROM recipe_ingredients ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ?`,
      [sid],
    ),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: tagRows } = usePS({
    queryKey: ['recipe_tags', sid],
    queryFn: () => db.getAll(
      `SELECT rt.recipe_id, t.id, t.name, t.is_predefined, t.category
       FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id
       WHERE rt.recipe_id = ?`,
      [sid],
    ),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const { data: ratingRows } = usePS({
    queryKey: ['recipe_ratings', sid],
    queryFn: () => db.getAll('SELECT * FROM recipe_ratings WHERE recipe_id = ?', [sid]),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });

  const data = useMemo<Recipe | undefined>(() => {
    const r = (recipeRows ?? [])[0];
    if (!r) return undefined;
    return buildRecipes([r], riRows ?? [], tagRows ?? [], ratingRows ?? [])[0];
  }, [recipeRows, riRows, tagRows, ratingRows]);

  return { data, isLoading: l1 || l2, error };
}

export function useIngredients(): { data: Ingredient[]; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const { data: rows, isLoading, error } = usePS({
    queryKey: ['ingredients'],
    queryFn: () => db.getAll('SELECT * FROM ingredients ORDER BY name'),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const data = useMemo<Ingredient[]>(
    () => (rows ?? []).map(r => ({ id: Number(r.id), name: r.name as string })),
    [rows],
  );
  return { data, isLoading, error };
}

export function useTags(): { data: Tag[]; isLoading: boolean; error: Error | undefined } {
  const db = usePowerSync();
  const { data: rows, isLoading, error } = usePS({
    queryKey: ['tags'],
    queryFn: () => db.getAll('SELECT * FROM tags ORDER BY name'),
    enabled: !!db,
    ...PS_QUERY_OPTS,
  });
  const data = useMemo<Tag[]>(
    () => (rows ?? []).map(t => ({
      id: Number(t.id),
      name: t.name as string,
      is_predefined: Boolean(t.is_predefined),
      category: t.category as string | null,
    })),
    [rows],
  );
  return { data, isLoading, error };
}

// ---------------------------------------------------------------------------
// Write hooks – remain as direct FastAPI calls (PowerSync syncs back the result)
// ---------------------------------------------------------------------------

export function useCreateRecipe() {
  return useMutation<Recipe, Error, RecipeCreatePayload>({
    mutationFn: payload => api.post('/recipes', payload).then(r => r.data),
  });
}

export function useUpdateRecipe(id: number) {
  return useMutation<Recipe, Error, Partial<RecipeCreatePayload>>({
    mutationFn: payload => api.patch(`/recipes/${id}`, payload).then(r => r.data),
  });
}

export function useDeleteRecipe() {
  return useMutation<void, Error, number>({
    mutationFn: id => api.delete(`/recipes/${id}`).then(() => undefined),
  });
}

export function useCreateIngredient() {
  return useMutation<Ingredient, Error, string>({
    mutationFn: name => api.post('/recipes/ingredients', { name }).then(r => r.data),
  });
}

export function useUpdateIngredient() {
  return useMutation<Ingredient, Error, { id: number; name: string }>({
    mutationFn: ({ id, name }) =>
      api.patch(`/recipes/ingredients/${id}`, { name }).then(r => r.data),
  });
}

export function useUpdateRecipeIngredient(recipeId: number) {
  return useMutation<
    RecipeIngredient,
    Error,
    { recipeIngredientId: number; ingredient_id?: number; amount?: number; unit?: string }
  >({
    mutationFn: ({ recipeIngredientId, ...payload }) =>
      api
        .patch(`/recipes/${recipeId}/ingredients/${recipeIngredientId}`, payload)
        .then(r => r.data),
  });
}

export function useRateRecipe(recipeId: number) {
  return useMutation<RecipeRating, Error, { user_id: number; stars: number }>({
    mutationFn: payload =>
      api.post(`/recipes/${recipeId}/ratings`, payload).then(r => r.data),
  });
}

export function useCreateTag() {
  return useMutation<Tag, Error, string>({
    mutationFn: name => api.post('/recipes/tags', { name }).then(r => r.data),
  });
}

export function useImportRecipes() {
  return useMutation<RecipeImportResult, Error, RecipeExportItem[]>({
    mutationFn: recipes => api.post('/recipes/import', recipes).then(r => r.data),
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
  return useMutation<BulkUrlImportResult, Error, { items: BulkUrlItem[] }>({
    mutationFn: payload =>
      api.post('/recipes/import/url/bulk', payload, { timeout: 0 }).then(r => r.data),
  });
}
