import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useOrientation } from '../../../lib/hooks/useOrientation';
import { ErrorScreen } from '../../../components/ErrorScreen';
import { ScreenErrorBoundary } from '../../../components/ScreenErrorBoundary';
import { useRecipe } from '../../../lib/hooks/useRecipes';
import type { RecipeIngredient } from '../../../lib/types';
import { Colors } from '../../../lib/theme';

// -------------------------------------------------------------------
// Kochansicht – Zutaten links | Zubereitung rechts (bei Querformat)
// -------------------------------------------------------------------

/** Splits a "1. ... 2. ..." formatted description into individual steps. */
function parseSteps(text: string): string[] {
  const matches = [...text.matchAll(/(?:^|\n)\s*\d+\.\s*/g)];
  if (matches.length < 2) return [];
  const steps: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const step = text.slice(start, end).trim();
    if (step) steps.push(step);
  }
  return steps;
}

function CookScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const { width, height } = useOrientation();
  // Split-Layout wenn breit (Web / Tablet) oder Querformat (Mobile rotiert)
  const isSplit = width >= height || width >= 600;

  const [activeTab, setActiveTab] = useState<'ingredients' | 'description'>('ingredients');
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const { data: recipe, isLoading, error } = useRecipe(recipeId);

  if (isLoading) {
    return <ActivityIndicator style={styles.center} size="large" color={Colors.cyanDark} />;
  }

  if (error || !recipe) {
    return <ErrorScreen message="Rezept nicht gefunden." />;
  }

  const toggleIngredient = (ingId: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  const steps = recipe.description ? parseSteps(recipe.description) : [];

  const ingredientsPanel = (
    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
      <Text style={styles.panelTitle}>Zutaten</Text>
      {recipe.servings > 1 && (
        <Text style={styles.servingsHint}>für {recipe.servings} Portionen</Text>
      )}
      {recipe.ingredients.length === 0 ? (
        <Text style={styles.emptyHint}>Keine Zutaten eingetragen.</Text>
      ) : (
        recipe.ingredients.map((ing: RecipeIngredient) => {
          const checked = checkedIngredients.has(ing.id);
          return (
            <TouchableOpacity key={ing.id} style={styles.ingRow} onPress={() => toggleIngredient(ing.id)} activeOpacity={0.6}>
              <View style={[styles.ingCheck, checked && styles.ingCheckDone]}>
                {checked && <Text style={styles.ingCheckMark}>✓</Text>}
              </View>
              <Text style={[styles.ingName, checked && styles.ingNameDone]}>{ing.ingredient.name}</Text>
              <Text style={[styles.ingAmount, checked && styles.ingNameDone]}>
                {ing.amount} {ing.unit}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  const descriptionPanel = (
    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
      <Text style={styles.panelTitle}>Zubereitung</Text>
      {recipe.prep_time_minutes ? (
        <Text style={styles.prepHint}>⏱ {recipe.prep_time_minutes} Min.</Text>
      ) : null}
      {steps.length > 0 ? (
        steps.map((step, i) => (
          <View key={i} style={[styles.stepRow, i === 0 && styles.stepRowFirst]}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))
      ) : recipe.description ? (
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
          headerStyle: { backgroundColor: Colors.night },
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

export default function CookScreen() {
  return (
    <ScreenErrorBoundary>
      <CookScreenContent />
    </ScreenErrorBoundary>
  );
}

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------

const GREEN = Colors.cyanDark;
const GREEN_DARK = Colors.cyanDark;
const BORDER = Colors.line;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
    backgroundColor: Colors.paper,
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
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  ingCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingCheckDone: { backgroundColor: GREEN, borderColor: GREEN },
  ingCheckMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ingName: { fontSize: 16, color: Colors.ink, flex: 1 },
  ingAmount: {
    fontSize: 15,
    color: GREEN,
    fontWeight: '600',
    textAlign: 'right',
  },
  ingNameDone: { color: '#AAA', textDecorationLine: 'line-through' },

  // ── Beschreibung ─────────────────────────────────────────────────
  descriptionText: {
    fontSize: 16,
    color: '#2A2A2A',
    lineHeight: 28,
  },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  stepRowFirst: { borderTopWidth: 0 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: { color: Colors.night, fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 16, color: '#2A2A2A', lineHeight: 24 },
});
