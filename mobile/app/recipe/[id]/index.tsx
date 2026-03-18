import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { showAlert } from '../../../lib/alert';
import { useRecipe, useDeleteRecipe, useRateRecipe, useUpdateIngredient } from '../../../lib/hooks/useRecipes';
import { useUsers } from '../../../lib/hooks/useUsers';
import type { Tag, User } from '../../../lib/types';

// --- Hilfkomponenten ---

function TagChip({ tag }: { tag: Tag }) {
  const isCustom = !tag.is_predefined;
  return (
    <View style={[styles.tagChip, isCustom && styles.tagChipCustom]}>
      <Text style={[styles.tagChipText, isCustom && styles.tagChipTextCustom]}>{tag.name}</Text>
    </View>
  );
}

function StarRow({
  user,
  stars,
  recipeId,
  onRate,
}: {
  user: User;
  stars: number;
  recipeId: number;
  onRate: (userId: number, stars: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      <View style={[styles.avatarBadge, { backgroundColor: user.avatar_color }]}>
        <Text style={styles.avatarText}>{user.short_name}</Text>
      </View>
      <Text style={styles.userName}>{user.name}</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onRate(user.id, stars === n ? 0 : n)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[styles.star, n <= stars && styles.starFilled]}>
              {n <= stars ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
        {stars > 0 && (
          <Text style={styles.starsValue}>{stars}/5</Text>
        )}
      </View>
    </View>
  );
}

// --- Hauptkomponente ---

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isNarrow = width < 400;

  const { data: recipe, isLoading, error } = useRecipe(recipeId);
  const { data: users = [] } = useUsers();
  const deleteRecipe = useDeleteRecipe();
  const rateRecipe = useRateRecipe(recipeId);
  const updateIngredient = useUpdateIngredient();

  const [editingIngId, setEditingIngId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

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

  function handleRate(userId: number, stars: number) {
    rateRecipe.mutate({ user_id: userId, stars });
  }

  function startEditIngredient(ingId: number, currentName: string) {
    setEditingIngId(ingId);
    setEditingName(currentName);
  }

  function cancelEditIngredient() {
    setEditingIngId(null);
    setEditingName('');
  }

  function confirmEditIngredient(ingId: number) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      cancelEditIngredient();
      return;
    }
    updateIngredient.mutate(
      { id: ingId, name: trimmed },
      {
        onSuccess: () => {
          setEditingIngId(null);
          setEditingName('');
        },
        onError: (err: any) => {
          const is409 = err?.response?.status === 409;
          showAlert(
            'Fehler',
            is409
              ? 'Eine Zutat mit diesem Namen existiert bereits.'
              : 'Die Zutat konnte nicht umbenannt werden.',
          );
        },
      },
    );
  }

  const getRating = (userId: number) =>
    recipe.ratings.find(r => r.user_id === userId)?.stars ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: recipe.name }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <MetaCard label="Portionen" value={String(recipe.servings)} />
          {recipe.prep_time_minutes ? (
            <MetaCard label="Zubereitung" value={`${recipe.prep_time_minutes} Min.`} />
          ) : null}
        </View>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagRow}>
              {recipe.tags.map(tag => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </View>
          </View>
        )}

        {/* Bewertungen */}
        {users.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bewertungen</Text>
            {users.map(user => (
              <StarRow
                key={user.id}
                user={user}
                stars={getRating(user.id)}
                recipeId={recipeId}
                onRate={handleRate}
              />
            ))}
          </View>
        )}

        {/* Zutaten */}
        {recipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zutaten</Text>
            {recipe.ingredients.map(ing => {
              const isEditing = editingIngId === ing.ingredient.id;
              const isSaving = isEditing && updateIngredient.isPending;
              return (
                <View key={ing.id} style={styles.ingRow}>
                  {isEditing ? (
                    <View style={styles.ingEditRow}>
                      <TextInput
                        style={styles.ingEditInput}
                        value={editingName}
                        onChangeText={setEditingName}
                        autoFocus
                        onSubmitEditing={() => confirmEditIngredient(ing.ingredient.id)}
                        returnKeyType="done"
                      />
                      {isSaving ? (
                        <ActivityIndicator size="small" color={GREEN} style={styles.ingEditBtn} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.ingEditBtn}
                            onPress={() => confirmEditIngredient(ing.ingredient.id)}
                          >
                            <Text style={styles.ingConfirmText}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.ingEditBtn}
                            onPress={cancelEditIngredient}
                          >
                            <Text style={styles.ingCancelText}>✕</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => startEditIngredient(ing.ingredient.id, ing.ingredient.name)}>
                      <Text style={styles.ingName}>{ing.ingredient.name}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.ingAmount}>
                    {ing.amount} {ing.unit}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.actions, isNarrow && styles.actionsNarrow]}>
          <TouchableOpacity
            style={[styles.cookBtn, isNarrow && styles.actionBtnFull]}
            onPress={() => router.push(`/recipe/${recipeId}/cook`)}
          >
            <Text style={styles.cookBtnText}>Kochen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editBtn, isNarrow && styles.actionBtnFull]}
            onPress={() => router.push(`/recipe/${recipeId}/edit`)}
          >
            <Text style={styles.editBtnText}>Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, isNarrow && styles.actionBtnFull]}
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

const GREEN = '#2E7D32';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 48 },
  contentWide: { maxWidth: 800, alignSelf: 'center', width: '100%' },
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
  metaValue: { fontSize: 22, fontWeight: '700', color: GREEN },
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

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GREEN,
  },
  tagChipCustom: { backgroundColor: '#EDE7F6', borderColor: '#5C6BC0' },
  tagChipText: { fontSize: 13, fontWeight: '600', color: GREEN },
  tagChipTextCustom: { color: '#5C6BC0' },

  // Ratings
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  userName: { fontSize: 15, color: '#1A1A1A', flex: 1 },
  starsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 24, color: '#DDD' },
  starFilled: { color: '#FFC107' },
  starsValue: { fontSize: 12, color: '#888', marginLeft: 4 },

  // Ingredients
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
  ingEditRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  ingEditInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    borderBottomWidth: 1.5,
    borderBottomColor: GREEN,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  ingEditBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  ingConfirmText: { fontSize: 18, color: GREEN, fontWeight: '700' },
  ingCancelText: { fontSize: 16, color: '#888' },

  // Actions
  actions: { flexDirection: 'row', gap: 12 },
  actionsNarrow: { flexDirection: 'column' },
  actionBtnFull: { flex: undefined, width: '100%' },
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
    backgroundColor: GREEN,
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
