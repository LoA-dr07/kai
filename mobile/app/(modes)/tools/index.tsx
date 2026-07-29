import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MEAL_TYPES } from '../../../lib/constants';
import { useMealPlans } from '../../../lib/hooks/useMealPlan';
import { useOrientation } from '../../../lib/hooks/useOrientation';
import { useRecipes } from '../../../lib/hooks/useRecipes';
import { useShoppingList } from '../../../lib/hooks/useShoppingList';
import { useWeekNavigation } from '../../../lib/hooks/useWeekNavigation';
import { Colors, Radii, Spacing } from '../../../lib/theme';

export default function ToolsHomeScreen() {
  const router = useRouter();
  const { isTablet, isLandscape } = useOrientation();
  const { data: recipes } = useRecipes();
  const { data: shoppingList } = useShoppingList();
  const { weekStartIso, weekNum } = useWeekNavigation();
  const { data: plans } = useMealPlans();

  const openItems = shoppingList?.items.filter(i => !i.is_checked).length ?? 0;

  const currentPlan = plans.find(p => p.week_start_date === weekStartIso);
  const openSlotCount = useMemo(() => {
    const totalSlots = 7 * MEAL_TYPES.length;
    const filledSlots = new Set(
      (currentPlan?.entries ?? []).map(e => `${e.day_of_week}:${e.meal_type}`)
    ).size;
    return Math.max(totalSlots - filledSlots, 0);
  }, [currentPlan]);

  const numColumns = isTablet && isLandscape ? 3 : 2;
  const cardBasis = { flexBasis: `${100 / numColumns - 2}%` as `${number}%` };

  const cards: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void }[] = [
    { icon: 'restaurant-outline', label: 'Rezepte', hint: `${recipes.length} Gerichte verwalten`, onPress: () => router.push('/tools/recipes') },
    { icon: 'calendar-outline', label: 'Wochenplan', hint: `KW ${weekNum} · ${openSlotCount} Slots offen`, onPress: () => router.push('/tools/meal-plan') },
    { icon: 'cart-outline', label: 'Einkaufsliste', hint: `${openItems} Artikel offen`, onPress: () => router.push('/tools/shopping-list') },
    { icon: 'people-outline', label: 'Haushalt', hint: 'Mitglieder & Vorlieben', onPress: () => router.push('/tools/settings') },
    { icon: 'link-outline', label: 'Rezepte importieren', hint: 'Aus einer oder mehreren URLs', onPress: () => router.push('/recipe/bulk-import') },
  ];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Direkt ins Detail</Text>
      <Text style={styles.subtitle}>KAI bleibt erreichbar, während du selbst bearbeitest.</Text>
      <View style={styles.grid}>
        {cards.map(card => (
          <TouchableOpacity key={card.label} style={[styles.card, cardBasis]} onPress={card.onPress}>
            <View style={styles.cardIcon}>
              <Ionicons name={card.icon} size={20} color={Colors.cyanDark} />
            </View>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardHint}>{card.hint}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper, padding: Spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: Colors.ink, marginBottom: 4 },
  subtitle: { color: Colors.muted, marginBottom: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    flexGrow: 1,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
  },
  cardIcon: { width: 38, height: 38, borderRadius: Radii.md, backgroundColor: Colors.cyanSoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  cardLabel: { fontWeight: '700', fontSize: 15, color: Colors.ink },
  cardHint: { color: Colors.muted, fontSize: 12, marginTop: 3 },
});
