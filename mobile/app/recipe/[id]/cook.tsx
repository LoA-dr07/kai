import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useRecipe } from '../../../lib/hooks/useRecipes';
import type { RecipeIngredient } from '../../../lib/types';
import { Colors } from '../../../lib/theme';

// -------------------------------------------------------------------
// Kochansicht – Zutaten links | Zubereitung rechts (bei Querformat)
// -------------------------------------------------------------------

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { width, height } = useWindowDimensions();
  // Split-Layout wenn breit (Web / Tablet) oder Querformat (Mobile rotiert)
  const isSplit = width >= height || width >= 600;

  const [activeTab, setActiveTab] = useState<'ingredients' | 'description'>('ingredients');

  const { data: recipe, isLoading, error } = useRecipe(recipeId);

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

  const ingredientsPanel = (
    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
      <Text style={styles.panelTitle}>Zutaten</Text>
      {recipe.servings > 1 && (
        <Text style={styles.servingsHint}>für {recipe.servings} Portionen</Text>
      )}
      {recipe.ingredients.length === 0 ? (
        <Text style={styles.emptyHint}>Keine Zutaten eingetragen.</Text>
      ) : (
        recipe.ingredients.map((ing: RecipeIngredient) => (
          <View key={ing.id} style={styles.ingRow}>
            <Text style={styles.ingName}>{ing.ingredient.name}</Text>
            <Text style={styles.ingAmount}>
              {ing.amount} {ing.unit}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  const descriptionPanel = (
    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
      <Text style={styles.panelTitle}>Zubereitung</Text>
      {recipe.prep_time_minutes ? (
        <Text style={styles.prepHint}>⏱ {recipe.prep_time_minutes} Min.</Text>
      ) : null}
      {recipe.description ? (
        <Text style={styles.descriptionText}>{recipe.description}</Text>
      ) : (
        <Text style={styles.emptyHint}>Keine Zubereitung eingetragen.</Text>
      )}
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: recipe.name,
          headerStyle: { backgroundColor: '#1B5E20' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      <View style={styles.root}>
        {isSplit ? (
          // ── Split-Layout ──────────────────────────────────────────
          <View style={styles.splitWrapper}>
            <View style={styles.splitContainer}>
              <View style={[styles.panel, styles.panelLeft]}>
                {ingredientsPanel}
              </View>
              <View style={styles.divider} />
              <View style={[styles.panel, styles.panelRight]}>
                {descriptionPanel}
              </View>
            </View>
          </View>
        ) : (
          // ── Tab-Layout (Portrait / schmal) ────────────────────────
          <View style={styles.tabContainer}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'ingredients' && styles.tabActive]}
                onPress={() => setActiveTab('ingredients')}
              >
                <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                  Zutaten
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'description' && styles.tabActive]}
                onPress={() => setActiveTab('description')}
              >
                <Text style={[styles.tabText, activeTab === 'description' && styles.tabTextActive]}>
                  Zubereitung
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'ingredients' ? ingredientsPanel : descriptionPanel}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------

const GREEN = Colors.green;
const GREEN_DARK = Colors.greenDark;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#D32F2F' },

  // ── Split ───────────────────────────────────────────────────────
  splitWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1400,
    width: '100%',
  },
  panel: { flex: 1 },
  panelLeft: {
    flex: 2,
    backgroundColor: '#fff',
  },
  panelRight: {
    flex: 3,
    backgroundColor: '#F8F9FA',
  },
  divider: {
    width: 1,
    backgroundColor: BORDER,
  },

  // ── Tab (Portrait) ───────────────────────────────────────────────
  tabContainer: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: GREEN,
  },
  tabText: { fontSize: 15, fontWeight: '500', color: '#888' },
  tabTextActive: { color: GREEN, fontWeight: '700' },
  tabContent: { flex: 1 },

  // ── Panel-Inhalt ─────────────────────────────────────────────────
  panelScroll: { flex: 1 },
  panelContent: { padding: 20, paddingBottom: 48 },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GREEN_DARK,
    marginBottom: 4,
  },
  servingsHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  prepHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: '#AAA',
    fontStyle: 'italic',
    marginTop: 12,
  },

  // ── Zutaten ──────────────────────────────────────────────────────
  ingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  ingName: { fontSize: 16, color: '#1A1A1A', flex: 1 },
  ingAmount: {
    fontSize: 15,
    color: GREEN,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ── Beschreibung ─────────────────────────────────────────────────
  descriptionText: {
    fontSize: 16,
    color: '#2A2A2A',
    lineHeight: 28,
  },
});
