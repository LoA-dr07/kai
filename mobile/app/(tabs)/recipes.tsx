import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useImportRecipes, useRecipes } from '../../lib/hooks/useRecipes';
import type { Recipe, RecipeExportItem } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';
import { Colors } from '../../lib/theme';

const RATING_LABELS: Record<number, string> = {
  0: 'Nie',
  1: 'Selten',
  2: 'Gelegentlich',
  3: 'Gerne',
  4: 'Häufig',
  5: 'Sehr häufig',
};
import { api } from '../../lib/api';

export default function RecipesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1400 ? 4 : width >= 1024 ? 3 : width >= 768 ? 2 : 1;
  const isWide = width >= 768;
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const importMutation = useImportRecipes();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // URL-Import State
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

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
          Alert.alert('Nicht unterstützt', 'Teilen wird auf diesem Gerät nicht unterstützt.');
          return;
        }
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
          Alert.alert('Fehler', 'Kein Cache-Verzeichnis verfügbar.');
          return;
        }
        const path = cacheDir + 'rezepte.json';
        await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Rezepte exportieren' });
      }
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', e instanceof Error ? e.message : String(e));
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
        Alert.alert('Import abgeschlossen', `${created} Rezept(e) importiert, ${skipped} übersprungen.`);
      }
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
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
        alert(`Import abgeschlossen: ${created} Rezept(e) importiert, ${skipped} übersprungen.`);
      }
    } catch (e) {
      alert(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openUrlModal() {
    setUrlInput('');
    setUrlError(null);
    setUrlModalVisible(true);
  }

  async function handleUrlFetch() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const response = await api.post('/recipes/import/url', { url: trimmed });
      setUrlModalVisible(false);
      router.push({
        pathname: '/recipe/import-preview',
        params: { data: JSON.stringify(response.data) },
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? (e instanceof Error ? e.message : String(e));
      setUrlError(String(detail));
    } finally {
      setUrlLoading(false);
    }
  }

  if (isLoading) {
    return <ActivityIndicator style={styles.center} size="large" color="#2E7D32" />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Fehler beim Laden der Rezepte.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
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
      <FlatList
        key={numColumns}
        data={recipes}
        keyExtractor={item => String(item.id)}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.list, numColumns > 1 && styles.listWide]}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
            <Text style={styles.emptySubtitle}>Tippe auf "+ Rezept", um loszulegen.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
        )}
      />

      {/* Action buttons */}
      <View style={styles.fabGroup}>
        <Tooltip label="Rezept aus URL importieren">
          <TouchableOpacity
            style={styles.fabSecondary}
            onPress={openUrlModal}
            accessibilityLabel="Rezept aus URL importieren"
          >
            <Ionicons name="link-outline" size={22} color="#2E7D32" />
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
              ? <ActivityIndicator size="small" color="#2E7D32" />
              : <Ionicons name="download-outline" size={22} color="#2E7D32" />}
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
              ? <ActivityIndicator size="small" color="#2E7D32" />
              : <Ionicons name="share-outline" size={22} color="#2E7D32" />}
          </TouchableOpacity>
        </Tooltip>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/recipe/new')}>
          <Text style={styles.fabText}>+ Rezept</Text>
        </TouchableOpacity>
      </View>

      {/* URL-Import Modal */}
      <Modal
        visible={urlModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rezept aus URL importieren</Text>
            <TouchableOpacity onPress={() => setUrlModalVisible(false)}>
              <Text style={styles.modalClose}>Schließen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.urlLabel}>Rezept-URL eingeben:</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://www.chefkoch.de/rezepte/…"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleUrlFetch}
              />
              <TouchableOpacity
                style={[styles.fetchBtn, (!urlInput.trim() || urlLoading) && styles.fetchBtnDisabled]}
                onPress={handleUrlFetch}
                disabled={!urlInput.trim() || urlLoading}
              >
                {urlLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.fetchBtnText}>Laden</Text>}
              </TouchableOpacity>
            </View>

            {urlError && (
              <Text style={styles.urlError}>{urlError}</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const avgRating =
    recipe.ratings.length > 0
      ? recipe.ratings.reduce((s, r) => s + r.stars, 0) / recipe.ratings.length
      : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
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
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const GREEN = Colors.green;
const BORDER = Colors.border;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 120 },
  listWide: { maxWidth: 1600, alignSelf: 'center', width: '100%' },
  columnWrapper: { gap: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#444', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888' },
  errorText: { fontSize: 16, color: '#D32F2F', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: GREEN },
  retryBtnText: { color: GREEN, fontSize: 15, fontWeight: '500' },
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
    borderColor: GREEN,
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
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#666', marginBottom: 10, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, color: GREEN, fontWeight: '500' },
  fab: {
    backgroundColor: GREEN,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  cardTag: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  cardTagCustom: { backgroundColor: '#EDE7F6', borderColor: '#5C6BC0' },
  cardTagText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },
  cardTagTextCustom: { color: '#5C6BC0' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalContainerWide: { maxWidth: 680, width: '100%', alignSelf: 'center' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  modalClose: { fontSize: 16, color: GREEN, fontWeight: '600' },
  modalBody: { padding: 16 },
  urlLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  urlRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  fetchBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  fetchBtnDisabled: { backgroundColor: '#A5D6A7' },
  fetchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  urlError: { color: '#D32F2F', fontSize: 13, marginBottom: 12 },
});
