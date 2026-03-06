import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRecipes } from '../../lib/hooks/useRecipes';
import type { Recipe } from '../../lib/types';

export default function RecipesScreen() {
  const router = useRouter();
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();

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
      <FlatList
        data={recipes}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
            <Text style={styles.emptySubtitle}>Tippe auf "+ Rezept", um loszulegen.</Text>
          </View>
        }
        renderItem={({ item }) => <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/recipe/new')}>
        <Text style={styles.fabText}>+ Rezept</Text>
      </TouchableOpacity>
    </View>
  );
}

function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
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
  list: { padding: 16, paddingBottom: 96 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#444', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888' },
  errorText: { fontSize: 16, color: '#D32F2F', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2E7D32' },
  retryBtnText: { color: '#2E7D32', fontSize: 15, fontWeight: '500' },
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
    position: 'absolute',
    bottom: 24,
    right: 24,
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
