import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '../../lib/alert';
import { ErrorScreen } from '../../components/ErrorScreen';
import { ScreenErrorBoundary } from '../../components/ScreenErrorBoundary';
import RecipeForm from '../../components/RecipeForm';
import { RatingSection } from '../../components/RatingSection';
import { useCreateRecipe } from '../../lib/hooks/useRecipes';
import { useUsers } from '../../lib/hooks/useUsers';
import { api } from '../../lib/api';
import type { RecipeUrlPreview } from '../../lib/types';
import type { FormIngredient } from '../../components/RecipeForm';
import { Colors } from '../../lib/theme';

function ImportPreviewScreenContent() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const createRecipe = useCreateRecipe();
  const { data: users = [], isLoading: usersLoading, error: usersError } = useUsers();
  const [ratings, setRatings] = useState<Record<number, number>>({});

  function handleRate(userId: number, stars: number | undefined) {
    setRatings(prev => {
      const next = { ...prev };
      if (stars === undefined) delete next[userId];
      else next[userId] = stars;
      return next;
    });
  }

  if (usersLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.green} />
      </View>
    );
  }

  if (usersError) {
    return <ErrorScreen message="Nutzer konnten nicht geladen werden." />;
  }

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

  const ratingsContent = users.length > 0 ? (
    <View style={styles.ratingsSection}>
      <Text style={styles.ratingsSectionTitle}>Bewertungen</Text>
      <RatingSection users={users} ratings={ratings} onRate={handleRate} />
    </View>
  ) : null;

  return (
    <RecipeForm
      initialName={preview.name}
      initialDescription={preview.description ?? ''}
      initialServings={preview.servings}
      initialPrepTime={preview.prep_time_minutes ?? null}
      initialIngredients={initialIngredients}
      extraContent={ratingsContent}
      onSubmit={async formData => {
        try {
          const recipe = await createRecipe.mutateAsync({
            ...formData,
            source_url: preview.source_url ?? null,
          });
          for (const [uid, stars] of Object.entries(ratings)) {
            await api.post(`/recipes/${recipe.id}/ratings`, {
              user_id: Number(uid),
              stars,
            });
          }
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

const styles = StyleSheet.create({
  ratingsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
});

export default function ImportPreviewScreen() {
  return (
    <ScreenErrorBoundary>
      <ImportPreviewScreenContent />
    </ScreenErrorBoundary>
  );
}
