import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { showAlert } from '../../../lib/alert';
import { useRecipe, useDeleteRecipe, useRateRecipe, useUpdateIngredient, useUpdateRecipeIngredient, useIngredients, useUpdateRecipe } from '../../../lib/hooks/useRecipes';
import { useUsers } from '../../../lib/hooks/useUsers';
import type { Tag, User } from '../../../lib/types';
import { Tooltip } from '../../../components/Tooltip';
import { Colors } from '../../../lib/theme';

// --- Konstanten ---

const RATING_LABELS: Record<number, string> = {
  0: 'Nie',
  1: 'Selten',
  2: 'Gelegentlich',
  3: 'Gerne',
  4: 'Häufig',
  5: 'Sehr häufig',
};

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
  stars: number | null;
  recipeId: number;
  onRate: (userId: number, stars: number) => void;
}) {
  const filledStars = stars ?? 0;
  const label = stars !== null ? RATING_LABELS[stars] : null;

  return (
    <View style={styles.starRow}>
      <View style={[styles.avatarBadge, { backgroundColor: user.avatar_color }]}>
        <Text style={styles.avatarText}>{user.short_name}</Text>
      </View>
      <Text style={styles.userName}>{user.name}</Text>
      <View style={styles.starsWrapper}>
        <View style={styles.starsContainer}>
          <Tooltip label="Bewertung entfernen">
            <TouchableOpacity
              onPress={() => onRate(user.id, 0)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={[styles.neverBtn, stars === 0 && styles.neverBtnActive]}>✕</Text>
            </TouchableOpacity>
          </Tooltip>
          {[1, 2, 3, 4, 5].map(n => (
            <Tooltip key={n} label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}>
              <TouchableOpacity
                onPress={() => onRate(user.id, n)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={[styles.star, n <= filledStars && filledStars > 0 && styles.starFilled]}>
                  {n <= filledStars && filledStars > 0 ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </Tooltip>
          ))}
        </View>
        {label !== null && (
          <Text style={[styles.ratingLabel, stars === 0 && styles.ratingLabelNever]}>
            {label}
          </Text>
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
  const { data: allIngredients = [] } = useIngredients();
  const deleteRecipe = useDeleteRecipe();
  const rateRecipe = useRateRecipe(recipeId);
  const updateIngredient = useUpdateIngredient();
  const updateRecipeIngredient = useUpdateRecipeIngredient(recipeId);
  const updateRecipe = useUpdateRecipe(recipeId);

  const [editingRecipeIngId, setEditingRecipeIngId] = useState<number | null>(null);
  const [editingIngId, setEditingIngId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSelectedIngId, setEditingSelectedIngId] = useState<number | null>(null);
  const [editingShowSuggestions, setEditingShowSuggestions] = useState(false);

  const [isEditingSourceUrl, setIsEditingSourceUrl] = useState(false);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const editingSuggestions = editingName.length >= 1
    ? allIngredients.filter(i => i.name.toLowerCase().includes(editingName.toLowerCase())).slice(0, 5)
    : [];

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

  function startEditIngredient(recipeIngId: number, ingId: number, currentName: string) {
    setEditingRecipeIngId(recipeIngId);
    setEditingIngId(ingId);
    setEditingName(currentName);
    setEditingSelectedIngId(null);
    setEditingShowSuggestions(false);
  }

  function cancelEditIngredient() {
    setEditingRecipeIngId(null);
    setEditingIngId(null);
    setEditingName('');
    setEditingSelectedIngId(null);
    setEditingShowSuggestions(false);
  }

  function confirmEditIngredient() {
    const trimmed = editingName.trim();
    if (!trimmed) {
      cancelEditIngredient();
      return;
    }

    // Check if name matches an existing ingredient (selected from dropdown or typed exactly)
    const matched = editingSelectedIngId !== null
      ? allIngredients.find(i => i.id === editingSelectedIngId)
      : allIngredients.find(i => i.name.toLowerCase() === trimmed.toLowerCase());

    if (matched && matched.id !== editingIngId) {
      // Replace the RecipeIngredient's reference to point to the existing ingredient
      updateRecipeIngredient.mutate(
        { recipeIngredientId: editingRecipeIngId!, ingredient_id: matched.id },
        {
          onSuccess: () => cancelEditIngredient(),
          onError: () => showAlert('Fehler', 'Zutat konnte nicht geändert werden.'),
        },
      );
    } else {
      // Rename the ingredient itself
      updateIngredient.mutate(
        { id: editingIngId!, name: trimmed },
        {
          onSuccess: () => cancelEditIngredient(),
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
  }

  function handleCopySourceUrl() {
    if (!recipe.source_url) return;
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(recipe.source_url).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      });
    } else {
      showAlert('Quell-URL', recipe.source_url);
    }
  }

  function handleEditSourceUrl() {
    showAlert(
      'Quell-URL ändern',
      'Möchtest du die Quell-URL dieses Rezepts bearbeiten?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Bearbeiten',
          onPress: () => {
            setEditSourceUrl(recipe!.source_url ?? '');
            setIsEditingSourceUrl(true);
          },
        },
      ],
    );
  }

  function confirmEditSourceUrl() {
    const trimmed = editSourceUrl.trim();
    updateRecipe.mutate(
      { source_url: trimmed || null },
      {
        onSuccess: () => setIsEditingSourceUrl(false),
        onError: () => showAlert('Fehler', 'Quell-URL konnte nicht gespeichert werden.'),
      },
    );
  }

  const getRating = (userId: number): number | null =>
    recipe.ratings.find(r => r.user_id === userId)?.stars ?? null;

  return (
    <>
      <Stack.Screen options={{ title: recipe.name }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        {/* Quelle */}
        {(recipe.source_url || isEditingSourceUrl) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quelle</Text>
            {isEditingSourceUrl ? (
              <View style={styles.sourceEditRow}>
                <TextInput
                  style={styles.sourceEditInput}
                  value={editSourceUrl}
                  onChangeText={setEditSourceUrl}
                  autoFocus
                  placeholder="https://..."
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onSubmitEditing={confirmEditSourceUrl}
                  returnKeyType="done"
                />
                {updateRecipe.isPending ? (
                  <ActivityIndicator size="small" color={GREEN} style={styles.sourceBtn} />
                ) : (
                  <>
                    <Tooltip label="Bestätigen">
                      <TouchableOpacity style={styles.sourceBtn} onPress={confirmEditSourceUrl}>
                        <Text style={styles.ingConfirmText}>✓</Text>
                      </TouchableOpacity>
                    </Tooltip>
                    <Tooltip label="Abbrechen">
                      <TouchableOpacity style={styles.sourceBtn} onPress={() => setIsEditingSourceUrl(false)}>
                        <Text style={styles.ingCancelText}>✕</Text>
                      </TouchableOpacity>
                    </Tooltip>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.sourceRow}>
                <Text selectable style={styles.sourceUrl} numberOfLines={2}>{recipe.source_url}</Text>
                <Tooltip label="URL kopieren">
                  <TouchableOpacity style={styles.sourceIconBtn} onPress={handleCopySourceUrl}>
                    <Text style={styles.sourceIconText}>{copyFeedback ? '✓' : '⎘'}</Text>
                  </TouchableOpacity>
                </Tooltip>
                <Tooltip label="URL bearbeiten">
                  <TouchableOpacity style={styles.sourceIconBtn} onPress={handleEditSourceUrl}>
                    <Text style={styles.sourceIconText}>✎</Text>
                  </TouchableOpacity>
                </Tooltip>
              </View>
            )}
          </View>
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
              const isEditing = editingRecipeIngId === ing.id;
              const isSaving = isEditing && (updateIngredient.isPending || updateRecipeIngredient.isPending);
              return (
                <View key={ing.id} style={styles.ingRow}>
                  {isEditing ? (
                    <View style={styles.ingEditRow}>
                      <View style={styles.ingEditInputWrapper}>
                        <TextInput
                          style={styles.ingEditInput}
                          value={editingName}
                          onChangeText={text => {
                            setEditingName(text);
                            setEditingSelectedIngId(null);
                            setEditingShowSuggestions(true);
                          }}
                          autoFocus
                          onSubmitEditing={confirmEditIngredient}
                          returnKeyType="done"
                        />
                        {editingShowSuggestions && editingSuggestions.length > 0 && (
                          <View style={styles.dropdown}>
                            {editingSuggestions.map(s => (
                              <TouchableOpacity
                                key={s.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setEditingName(s.name);
                                  setEditingSelectedIngId(s.id);
                                  setEditingShowSuggestions(false);
                                }}
                              >
                                <Text style={styles.dropdownText}>{s.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                      {isSaving ? (
                        <ActivityIndicator size="small" color={GREEN} style={styles.ingEditBtn} />
                      ) : (
                        <>
                          <Tooltip label="Bestätigen">
                            <TouchableOpacity
                              style={styles.ingEditBtn}
                              onPress={confirmEditIngredient}
                            >
                              <Text style={styles.ingConfirmText}>✓</Text>
                            </TouchableOpacity>
                          </Tooltip>
                          <Tooltip label="Abbrechen">
                            <TouchableOpacity
                              style={styles.ingEditBtn}
                              onPress={cancelEditIngredient}
                            >
                              <Text style={styles.ingCancelText}>✕</Text>
                            </TouchableOpacity>
                          </Tooltip>
                        </>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => startEditIngredient(ing.id, ing.ingredient.id, ing.ingredient.name)}>
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

const GREEN = Colors.green;

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
  starsWrapper: { flexDirection: 'column', alignItems: 'flex-end' },
  starsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 24, color: '#DDD' },
  starFilled: { color: '#FFC107' },
  neverBtn: { fontSize: 15, color: '#CCC', fontWeight: '700', marginRight: 2 },
  neverBtnActive: { color: '#C62828' },
  ratingLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  ratingLabelNever: { color: '#C62828', fontWeight: '600' },

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
  ingEditInputWrapper: { flex: 1, zIndex: 10 },
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  dropdownItem: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownText: { padding: 12, fontSize: 15, color: '#1A1A1A' },

  // Source URL
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceUrl: { flex: 1, fontSize: 14, color: '#1565C0', lineHeight: 20 },
  sourceIconBtn: { padding: 6 },
  sourceIconText: { fontSize: 18, color: '#555' },
  sourceEditRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sourceEditInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    borderBottomWidth: 1.5,
    borderBottomColor: GREEN,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  sourceBtn: { paddingHorizontal: 8, paddingVertical: 4 },

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
