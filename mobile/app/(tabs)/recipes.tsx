import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useImportRecipes, useRecipes } from '../../lib/hooks/useRecipes';
import type { Recipe, RecipeExportItem } from '../../lib/types';
import { api } from '../../lib/api';

export default function RecipesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 2 : 1;
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const importMutation = useImportRecipes();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const { created, skipped } = await importMutation.mutateAsync(data);
      Alert.alert('Import abgeschlossen', `${created} Rezept(e) importiert, ${skipped} übersprungen.`);
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
      const { created, skipped } = await importMutation.mutateAsync(data);
      alert(`Import abgeschlossen: ${created} Rezept(e) importiert, ${skipped} übersprungen.`);
    } catch (e) {
      alert(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/recipe/new')}>
          <Text style={styles.fabText}>+ Rezept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RecipeCard({ recipe, onPress, wide }: { recipe: Recipe; onPress: () => void; wide?: boolean }) {
  return (
    <TouchableOpacity style={[styles.card, wide && styles.cardWide]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.cardTitle}>{recipe.name}</Text>
      {recipe.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{recipe.description}</Text>
      ) : null}
      <View style={styles.cardMeta}>
        <Chip label={`${recipe.servings} Portionen`} />
        {recipe.prep_time_minutes ? <Chip label={`${recipe.prep_time_minutes} Min.`} /> : null}
        <Chip label={`${recipe.ingredients.length} Zutaten`} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#444', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888' },
  errorText: { fontSize: 16, color: '#D32F2F', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2E7D32' },
  retryBtnText: { color: '#2E7D32', fontSize: 15, fontWeight: '500' },
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
    borderColor: '#2E7D32',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardWide: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#666', marginBottom: 10, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, color: '#2E7D32', fontWeight: '500' },
  fab: {
    backgroundColor: '#2E7D32',
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
});
