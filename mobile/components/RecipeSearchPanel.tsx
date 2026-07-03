import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import type { Recipe, Tag, User } from '../lib/types';
import { Colors } from '../lib/theme';

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

interface RecipeSearchPanelProps {
  recipes: Recipe[];
  tags: Tag[];
  users: User[];
  recentRecipes: Recipe[];
  initialTagIds?: number[];
  onSelect: (recipeId: number) => void;
}

export function RecipeSearchPanel({ recipes, tags, users, recentRecipes, initialTagIds = [], onSelect }: RecipeSearchPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [filterExpanded, setFilterExpanded] = useState(initialTagIds.length > 0);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialTagIds);
  const [minRatings, setMinRatings] = useState<Record<number, number>>({});

  const toggleTagFilter = (tagId: number) =>
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  const setMinRating = (userId: number, stars: number) =>
    setMinRatings(prev => ({ ...prev, [userId]: (prev[userId] ?? 0) === stars ? 0 : stars }));
  const activeFilterCount = selectedTagIds.length + Object.values(minRatings).filter(v => v > 0).length;

  const filteredRecipes = recipes.filter(r => {
    if (searchText && !r.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (selectedTagIds.length > 0) {
      const recipeTagIds = r.tags.map(t => t.id);
      if (!selectedTagIds.every(tid => recipeTagIds.includes(tid))) return false;
    }
    for (const [userIdStr, minStars] of Object.entries(minRatings)) {
      if (minStars > 0) {
        const rating = r.ratings.find(rt => rt.user_id === Number(userIdStr));
        if (!rating || rating.stars < minStars) return false;
      }
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, styles.searchInputFlex]}
          placeholder="Rezept suchen …"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterExpanded(prev => !prev)}
        >
          <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
            {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {filterExpanded && (
        <View style={styles.panel}>
          {tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {tags.map(tag => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <TouchableOpacity key={tag.id} style={[styles.tagChip, selected && styles.tagChipSelected]} onPress={() => toggleTagFilter(tag.id)}>
                        <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>{tag.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
          {users.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Mindest-Bewertung</Text>
              {users.map(user => {
                const minStar = minRatings[user.id] ?? 0;
                return (
                  <View key={user.id} style={styles.ratingRow}>
                    <View style={[styles.userBadge, { backgroundColor: user.avatar_color }]}>
                      <Text style={styles.userBadgeText}>{user.short_name}</Text>
                    </View>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity key={star} onPress={() => setMinRating(user.id, star)} hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}>
                          <Text style={[styles.star, star <= minStar && styles.starActive]}>{star <= minStar ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {minStar > 0 && (
                      <TouchableOpacity onPress={() => setMinRatings(prev => ({ ...prev, [user.id]: 0 }))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={styles.clearBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <FlatList
        data={filteredRecipes}
        keyExtractor={item => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          recentRecipes.length > 0 && !searchText && selectedTagIds.length === 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.recentLabel}>Zuletzt verwendet</Text>
              {recentRecipes.map(recipe => (
                <TouchableOpacity key={recipe.id} style={styles.recentRow} onPress={() => onSelect(recipe.id)}>
                  <Text style={styles.recentName}>{recipe.name}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.recentDivider} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.recipeRow} onPress={() => onSelect(item.id)}>
            <Text style={styles.recipeName}>{item.name}</Text>
            {item.description ? <Text style={styles.recipeDesc} numberOfLines={1}>{item.description}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {recipes.length === 0 ? 'Noch keine Rezepte vorhanden.' : 'Keine Treffer für deine Suche.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  searchInput: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12, backgroundColor: '#FAFAFA' },
  recipeRow: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  recipeName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  recipeDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#AAA', marginTop: 32, fontSize: 14 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchInputFlex: { flex: 1, marginBottom: 0 },
  filterBtn: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFAFA' },
  filterBtnActive: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  filterBtnText: { fontSize: 14, color: '#888', fontWeight: '600' },
  filterBtnTextActive: { color: GREEN },
  panel: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#FAFAFA', marginBottom: 12, overflow: 'hidden' },
  section: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 6 },
  tagChip: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  tagChipSelected: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  tagChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  tagChipTextSelected: { color: GREEN, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  userBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 32, alignItems: 'center' },
  userBadgeText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 22, color: '#CCC' },
  starActive: { color: '#F9A825' },
  clearBtn: { fontSize: 14, color: '#B71C1C', fontWeight: '700', marginLeft: 4 },

  recentSection: { marginBottom: 4 },
  recentLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4, paddingVertical: 8 },
  recentRow: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  recentName: { fontSize: 15, color: GREEN, fontWeight: '500' },
  recentDivider: { height: 8 },
});
