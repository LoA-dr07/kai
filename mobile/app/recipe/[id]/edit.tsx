import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '../../../lib/alert';
import { ErrorScreen } from '../../../components/ErrorScreen';
import { ScreenErrorBoundary } from '../../../components/ScreenErrorBoundary';
import RecipeForm from '../../../components/RecipeForm';
import { useRecipe, useUpdateRecipe } from '../../../lib/hooks/useRecipes';
import { Colors } from '../../../lib/theme';

function EditRecipeScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { data: recipe, isLoading } = useRecipe(recipeId);
  const updateRecipe = useUpdateRecipe(recipeId);

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.cyanDark} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={{ flex: 1 }}>
        <ErrorScreen message="Rezept nicht gefunden." />
      </View>
    );
  }

  const initialIngredients = recipe.ingredients.map(ing => ({
    key: `${ing.ingredient_id}_init`,
    ingredient_id: ing.ingredient_id,
    ingredient_name: ing.ingredient.name,
    amount: String(ing.amount),
    unit: ing.unit,
  }));

  const initialTagIds = recipe.tags.map(t => t.id);

  return (
    <View style={{ flex: 1 }}>
      <RecipeForm
        initialName={recipe.name}
        initialDescription={recipe.description ?? ''}
        initialServings={recipe.servings}
        initialPrepTime={recipe.prep_time_minutes}
        initialIngredients={initialIngredients}
        initialTagIds={initialTagIds}
        onSubmit={async data => {
          try {
            await updateRecipe.mutateAsync(data);
            router.back();
          } catch {
            showAlert('Fehler', 'Änderungen konnten nicht gespeichert werden.');
          }
        }}
        isSubmitting={updateRecipe.isPending}
        submitLabel="Änderungen speichern"
      />
    </View>
  );
}

export default function EditRecipeScreen() {
  return (
    <ScreenErrorBoundary>
      <EditRecipeScreenContent />
    </ScreenErrorBoundary>
  );
}
