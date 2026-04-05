import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '../../lib/alert';
import RecipeForm from '../../components/RecipeForm';
import { useCreateRecipe } from '../../lib/hooks/useRecipes';
import type { RecipeUrlPreview } from '../../lib/types';
import type { FormIngredient } from '../../components/RecipeForm';

export default function ImportPreviewScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const createRecipe = useCreateRecipe();

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#D32F2F', fontSize: 16 }}>Keine Importdaten vorhanden.</Text>
      </View>
    );
  }

  let preview: RecipeUrlPreview;
  try {
    preview = JSON.parse(data);
  } catch {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#D32F2F', fontSize: 16 }}>Importdaten konnten nicht gelesen werden.</Text>
      </View>
    );
  }

  const initialIngredients: FormIngredient[] = preview.ingredients.map((ing, idx) => ({
    key: `import_${idx}`,
    ingredient_id: 0,
    ingredient_name: ing.ingredient_name,
    amount: String(ing.amount),
    unit: ing.unit,
  }));

  return (
    <RecipeForm
      initialName={preview.name}
      initialDescription={preview.description ?? ''}
      initialServings={preview.servings}
      initialPrepTime={preview.prep_time_minutes ?? null}
      initialIngredients={initialIngredients}
      onSubmit={async data => {
        try {
          const recipe = await createRecipe.mutateAsync({
            ...data,
            source_url: preview.source_url ?? null,
          });
          router.replace(`/recipe/${recipe.id}`);
        } catch {
          showAlert('Fehler', 'Rezept konnte nicht gespeichert werden.');
        }
      }}
      isSubmitting={createRecipe.isPending}
      submitLabel="Rezept speichern"
    />
  );
}
