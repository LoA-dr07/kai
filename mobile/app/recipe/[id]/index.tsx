import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { showAlert } from '../../../lib/alert';
import { useRecipe, useDeleteRecipe } from '../../../lib/hooks/useRecipes';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { data: recipe, isLoading, error } = useRecipe(recipeId);
  const deleteRecipe = useDeleteRecipe();

  if (isLoading) {
    return <ActivityIndicator style={styles.center} size="large" color="#2E7D32" />;
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Rezept nicht gefunden.</Text>
      </View>
    );
  }

  function handleDelete() {
    showAlert(
      'Rezept löschen',
      `"${recipe!.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await deleteRecipe.mutateAsync(recipeId);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: recipe.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <MetaCard label="Portionen" value={String(recipe.servings)} />
          {recipe.prep_time_minutes ? (
            <MetaCard label="Zubereitung" value={`${recipe.prep_time_minutes} Min.`} />
          ) : null}
        </View>

        {recipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zutaten</Text>
            {recipe.ingredients.map(ing => (
              <View key={ing.id} style={styles.ingRow}>
                <Text style={styles.ingName}>{ing.ingredient.name}</Text>
                <Text style={styles.ingAmount}>
                  {ing.amount} {ing.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cookBtn}
            onPress={() => router.push(`/recipe/${recipeId}/cook`)}
          >
            <Text style={styles.cookBtnText}>Kochen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/recipe/${recipeId}/edit`)}
          >
            <Text style={styles.editBtnText}>Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleteRecipe.isPending}
          >
            {deleteRecipe.isPending ? (
              <ActivityIndicator color="#D32F2F" />
            ) : (
              <Text style={styles.deleteBtnText}>Löschen</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#D32F2F' },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
  },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metaCard: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaLabel: { fontSize: 12, color: '#4CAF50', fontWeight: '500', marginBottom: 4 },
  metaValue: { fontSize: 22, fontWeight: '700', color: '#2E7D32' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  ingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ingName: { fontSize: 15, color: '#1A1A1A' },
  ingAmount: { fontSize: 15, color: '#666' },
  actions: { flexDirection: 'row', gap: 12 },
  cookBtn: {
    flex: 1,
    backgroundColor: '#1B5E20',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cookBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editBtn: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D32F2F',
  },
  deleteBtnText: { color: '#D32F2F', fontSize: 16, fontWeight: '600' },
});
