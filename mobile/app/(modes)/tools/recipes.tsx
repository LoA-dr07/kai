import { Ionicons } from '@expo/vector-icons';
import { ErrorScreen } from '../../../components/ErrorScreen';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useOrientation } from '../../../lib/hooks/useOrientation';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../lib/alert';
import { api } from '../../../lib/api';
import { useImportRecipes, useRecipes, useTags } from '../../../lib/hooks/useRecipes';
import type { Recipe, RecipeExportItem } from '../../../lib/types';
import { Tooltip } from '../../../components/Tooltip';
import { Colors } from '../../../lib/theme';
import { AddToMealPlanModal } from '../../../components/AddToMealPlanModal';

const RATING_LABELS: Record<number, string> = {
  0: 'Nie',
  1: 'Selten',
  2: 'Gelegentlich',
  3: 'Gerne',
  4: 'Häufig',
  5: 'Sehr häufig',
};

export default function RecipesScreen() {
  const router = useRouter();
  const { filter_ids } = useLocalSearchParams<{ filter_ids?: string }>();
  const { width, isLandscape, isUltraWide } = useOrientation();
  const numColumns = isUltraWide ? 6 : width >= 1400 ? 4 : width >= 1024 ? 3 : width >= 768 ? 2 : 1;
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const importMutation = useImportRecipes();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addModalRecipe, setAddModalRecipe] = useState<{ id: number; name: string } | null>(null);

  // Filter state: set from navigation params, dismissed by user
  const [activeFilterIds, setActiveFilterIds] = useState<Set<number> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const { data: tags = [] } = useTags();

  useEffect(() => {
    if (filter_ids) {
      const ids = filter_ids.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) setActiveFilterIds(new Set(ids));
    }
  }, [filter_ids]);

  const toggleTagFilter = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const displayedRecipes = useMemo(() => {
    let result = recipes ?? [];
    if (activeFilterIds) {
      result = result.filter(r => activeFilterIds.has(r.id));
    }
    if (selectedTagIds.length > 0) {
      result = result.filter(r => {
        const recipeTagIds = r.tags.map(t => t.id);
        return selectedTagIds.every(tid => recipeTagIds.includes(tid));
      });
    }
    return result;
  }, [recipes, activeFilterIds, selectedTagIds]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await api.get<RecipeExportItem[]>('/recipes/export');
      const json = JSON.stringify(response.data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rezepte.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          showAlert('Nicht unterstützt', 'Teilen wird auf diesem Gerät nicht unterstützt.');
          return;
        }
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
          showAlert('Fehler', 'Kein Cache-Verzeichnis verfügbar.');
          return;
        }
        const path = cacheDir + 'rezepte.json';
        await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Rezepte exportieren' });
      }
    } catch (e) {
      showAlert('Export fehlgeschlagen', e instanceof Error ? e.message : String(e));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport() {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const data: RecipeExportItem[] = JSON.parse(content);
      if (!Array.isArray(data)) throw new Error('Ungültiges Format – erwartet wird ein JSON-Array.');
      const { created, skipped, created_ids } = await importMutation.mutateAsync(data);
      if (created === 1) {
        router.push(`/recipe/${created_ids[0]}`);
      } else {
        showAlert('Import abgeschlossen', `${created} Rezept(e) importiert, ${skipped} übersprungen.`);
      }
    } catch (e) {
      showAlert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleWebFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data: RecipeExportItem[] = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Ungültiges Format – erwartet wird ein JSON-Array.');
      const { created, skipped, created_ids } = await importMutation.mutateAsync(data);
      if (created === 1) {
        router.push(`/recipe/${created_ids[0]}`);
      } else {
        showAlert('Import abgeschlossen', `${created} Rezept(e) importiert, ${skipped} übersprungen.`);
      }
    } catch (e) {
      showAlert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (isLoading) {
    return <ActivityIndicator style={styles.center} size="large" color={Colors.cyanDark} />;
  }

  if (error) {
    return <ErrorScreen message="Rezepte konnten nicht geladen werden." onRetry={refetch} />;
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleWebFileSelected}
        />
      )}

      {activeFilterIds && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            {activeFilterIds.size} neue{activeFilterIds.size === 1 ? 's Rezept' : ' Rezepte'} · Filter aktiv
          </Text>
          <Tooltip label="Filter aufheben">
            <TouchableOpacity
              onPress={() => {
                setActiveFilterIds(null);
                router.setParams({ filter_ids: undefined });
              }}
              accessibilityLabel="Filter aufheben"
            >
              <Ionicons name="close-circle" size={20} color={Colors.cyanDark} />
            </TouchableOpacity>
          </Tooltip>
        </View>
      )}

      {tags.length > 0 && (
        <View style={styles.tagFilterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilterScroll}
          >
            {selectedTagIds.length > 0 && (
              <TouchableOpacity
                style={[styles.tagFilterChip, styles.tagFilterChipClear]}
                onPress={() => setSelectedTagIds([])}
              >
                <Text style={styles.tagFilterChipClearText}>Alle</Text>
              </TouchableOpacity>
            )}
            {tags.map(tag => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tagFilterChip, selected && styles.tagFilterChipSelected]}
                  onPress={() => toggleTagFilter(tag.id)}
                >
                  <Text style={[styles.tagFilterChipText, selected && styles.tagFilterChipTextSelected]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        key={numColumns}
        data={displayedRecipes}
        keyExtractor={item => String(item.id)}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.list, numColumns > 1 && styles.listWide, isUltraWide && styles.listUltraWide, isLandscape && styles.listLandscape]}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, isLandscape && styles.emptyContainerLandscape]}>
            {selectedTagIds.length > 0 || activeFilterIds ? (
              <>
                <Text style={styles.emptyTitle}>Keine Rezepte gefunden</Text>
                <Text style={styles.emptySubtitle}>Keine Rezepte entsprechen den gewählten Filtern.</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
                <Text style={styles.emptySubtitle}>Tippe auf "+ Rezept", um loszulegen.</Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push(`/recipe/${item.id}`)}
            onAddToMealPlan={() => setAddModalRecipe({ id: item.id, name: item.name })}
          />
        )}
      />

      {/* Action buttons */}
      <View style={styles.fabGroup}>
        <Tooltip label="Rezepte aus URLs importieren">
          <TouchableOpacity
            style={styles.fabSecondary}
            onPress={() => router.push('/recipe/bulk-import')}
            accessibilityLabel="Rezepte aus URLs importieren"
          >
            <Ionicons name="link-outline" size={22} color={Colors.cyanDark} />
          </TouchableOpacity>
        </Tooltip>
        <Tooltip label="Rezepte importieren (JSON)">
          <TouchableOpacity
            style={styles.fabSecondary}
            onPress={handleImport}
            disabled={isImporting}
            accessibilityLabel="Rezepte importieren"
          >
            {isImporting
              ? <ActivityIndicator size="small" color={Colors.cyanDark} />
              : <Ionicons name="download-outline" size={22} color={Colors.cyanDark} />}
          </TouchableOpacity>
        </Tooltip>
        <Tooltip label="Rezepte exportieren (JSON)">
          <TouchableOpacity
            style={styles.fabSecondary}
            onPress={handleExport}
            disabled={isExporting}
            accessibilityLabel="Rezepte exportieren"
          >
            {isExporting
              ? <ActivityIndicator size="small" color={Colors.cyanDark} />
              : <Ionicons name="share-outline" size={22} color={Colors.cyanDark} />}
          </TouchableOpacity>
        </Tooltip>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/recipe/new')}>
          <Text style={styles.fabText}>+ Rezept</Text>
        </TouchableOpacity>
      </View>

      {addModalRecipe && (
        <AddToMealPlanModal
          recipeId={addModalRecipe.id}
          recipeName={addModalRecipe.name}
          visible={true}
          onClose={() => setAddModalRecipe(null)}
        />
      )}
    </View>
  );
}

function RecipeCard({
  recipe,
  onPress,
  onAddToMealPlan,
}: {
  recipe: Recipe;
  onPress: () => void;
  onAddToMealPlan: () => void;
}) {
  const avgRating =
    recipe.ratings.length > 0
      ? recipe.ratings.reduce((s, r) => s + r.stars, 0) / recipe.ratings.length
      : null;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.cardTouchable}>
        <Text style={styles.cardTitle}>{recipe.name}</Text>
        {recipe.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{recipe.description}</Text>
        ) : null}
        {recipe.tags.length > 0 && (
          <View style={styles.cardTagRow}>
            {recipe.tags.map(tag => (
              <View key={tag.id} style={[styles.cardTag, !tag.is_predefined && styles.cardTagCustom]}>
                <Text style={[styles.cardTagText, !tag.is_predefined && styles.cardTagTextCustom]}>
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.cardMeta}>
          <Chip label={`${recipe.servings} Portionen`} />
          {recipe.prep_time_minutes ? <Chip label={`${recipe.prep_time_minutes} Min.`} /> : null}
          <Chip label={`${recipe.ingredients.length} Zutaten`} />
          {avgRating !== null && (
            <Chip label={`${'★'.repeat(Math.round(avgRating))} ${avgRating.toFixed(1)} · ${RATING_LABELS[Math.round(avgRating)]}`} />
          )}
        </View>
      </TouchableOpacity>
      <Tooltip label="Zum Essensplan hinzufügen" position="left">
        <TouchableOpacity
          style={styles.cardMealPlanBtn}
          onPress={onAddToMealPlan}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.cyanDark} />
        </TouchableOpacity>
      </Tooltip>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 120 },
  listWide: { maxWidth: 1600, alignSelf: 'center', width: '100%' },
  listUltraWide: { maxWidth: 2600 },
  listLandscape: { paddingBottom: 72 },
  columnWrapper: { gap: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyContainerLandscape: { marginTop: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888' },
  fabGroup: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.cyanDark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTouchable: { flex: 1 },
  cardMealPlanBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cyanSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink, marginBottom: 6, paddingRight: 38 },
  cardDesc: { fontSize: 14, color: '#666', marginBottom: 10, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.cyanSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, color: Colors.cyanDark, fontWeight: '500' },
  fab: {
    backgroundColor: Colors.cyan,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  fabText: { color: Colors.night, fontSize: 16, fontWeight: '700' },
  cardTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  cardTag: {
    backgroundColor: Colors.cyanSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.cyanDark,
  },
  cardTagCustom: { backgroundColor: '#EDE7F6', borderColor: '#5C6BC0' },
  cardTagText: { fontSize: 11, fontWeight: '600', color: Colors.cyanDark },
  cardTagTextCustom: { color: '#5C6BC0' },

  // Tag filter bar
  tagFilterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingVertical: 8,
  },
  tagFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagFilterChip: {
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  tagFilterChipSelected: {
    borderColor: Colors.night,
    backgroundColor: Colors.night,
  },
  tagFilterChipClear: {
    borderColor: Colors.line,
    backgroundColor: '#F0F0F0',
  },
  tagFilterChipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  tagFilterChipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  tagFilterChipClearText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },

  // Filter banner
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cyanSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  filterBannerText: { fontSize: 14, fontWeight: '600', color: Colors.cyanDark, flex: 1 },
});
