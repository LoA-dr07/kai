import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useRecipe } from '../../../lib/hooks/useRecipes';
import { RecipeDetailContent } from '../../../components/RecipeDetailContent';
import { ScreenErrorBoundary } from '../../../components/ScreenErrorBoundary';

function RecipeDetailScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);
  const { data: recipe } = useRecipe(recipeId);

  return (
    <>
      <Stack.Screen options={{ title: recipe?.name ?? 'Rezept' }} />
      <RecipeDetailContent
        recipeId={recipeId}
        onNavigate={path => router.push(path)}
        onDeleted={() => router.back()}
      />
    </>
  );
}

export default function RecipeDetailScreen() {
  return (
    <ScreenErrorBoundary>
      <RecipeDetailScreenContent />
    </ScreenErrorBoundary>
  );
}
