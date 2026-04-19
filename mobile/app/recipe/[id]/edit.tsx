import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '../../../lib/alert';
import RecipeForm from '../../../components/RecipeForm';
import { useRecipe, useUpdateRecipe } from '../../../lib/hooks/useRecipes';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { data: recipe, isLoading } = useRecipe(recipeId);
  const updateRecipe = useUpdateRecipe(recipeId);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32" />
      </GestureHandlerRootView>
    );
  }

  if (!recipe) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#D32F2F', fontSize: 16 }}>Rezept nicht gefunden.</Text>
        </View>
      </GestureHandlerRootView>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
