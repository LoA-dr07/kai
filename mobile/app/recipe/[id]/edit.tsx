import { ActivityIndicator, View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RecipeForm from '../../../components/RecipeForm';
import { useRecipe, useUpdateRecipe } from '../../../lib/hooks/useRecipes';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { data: recipe, isLoading } = useRecipe(recipeId);
  const updateRecipe = useUpdateRecipe(recipeId);

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32" />;
  }

  if (!recipe) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#D32F2F', fontSize: 16 }}>Rezept nicht gefunden.</Text>
      </View>
    );
  }

  const initialIngredients = recipe.ingredients.map(ing => ({
    ingredient_id: ing.ingredient_id,
    ingredient_name: ing.ingredient.name,
    amount: String(ing.amount),
    unit: ing.unit,
  }));

  return (
    <RecipeForm
      initialName={recipe.name}
      initialDescription={recipe.description ?? ''}
      initialServings={recipe.servings}
      initialPrepTime={recipe.prep_time_minutes}
      initialIngredients={initialIngredients}
      onSubmit={async data => {
        try {
          await updateRecipe.mutateAsync(data);
          router.back();
        } catch {
          Alert.alert('Fehler', 'Änderungen konnten nicht gespeichert werden.');
        }
      }}
      isSubmitting={updateRecipe.isPending}
      submitLabel="Änderungen speichern"
    />
  );
}
