import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Tooltip } from '../../../components/Tooltip';
import { MEAL_TYPES } from '../../../lib/constants';
import { useHousehold } from '../../../lib/hooks/useHousehold';
import { useMealPlans } from '../../../lib/hooks/useMealPlan';
import { useShoppingList } from '../../../lib/hooks/useShoppingList';
import { useWeekNavigation } from '../../../lib/hooks/useWeekNavigation';
import { Colors, Radii, Spacing } from '../../../lib/theme';

const QUICK_TASKS = [
  { icon: 'restaurant-outline' as const, label: 'Abendessen planen', hint: 'Mit No-Gos und Favoriten', prompt: 'Plane drei familienfreundliche Abendessen für diese Woche.' },
  { icon: 'cart-outline' as const, label: 'Einkauf vorbereiten', hint: 'Aus dem aktuellen Wochenplan', prompt: 'Erstelle die Einkaufsliste aus unserem aktuellen Wochenplan.' },
  { icon: 'swap-horizontal-outline' as const, label: 'Gericht austauschen', hint: 'Passend für alle im Haushalt', prompt: 'Finde eine Alternative für das heutige Gericht.' },
];

function greetingForHour(hour: number) {
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function KaiHomeScreen() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const { data: household } = useHousehold();
  const { weekStartIso, weekNum } = useWeekNavigation();
  const { data: plans } = useMealPlans();
  const { data: shoppingList } = useShoppingList();

  const currentPlan = plans.find(p => p.week_start_date === weekStartIso);
  const openSlotCount = useMemo(() => {
    const totalSlots = 7 * MEAL_TYPES.length;
    const filledSlots = new Set(
      (currentPlan?.entries ?? []).map(e => `${e.day_of_week}:${e.meal_type}`)
    ).size;
    return Math.max(totalSlots - filledSlots, 0);
  }, [currentPlan]);

  const openItems = shoppingList?.items.filter(i => !i.is_checked).length ?? 0;
  const doneItems = shoppingList?.items.filter(i => i.is_checked).length ?? 0;

  const goToChat = (initialPrompt: string) => {
    if (!initialPrompt.trim()) return;
    router.push({ pathname: '/kai/chat', params: { prompt: initialPrompt } });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{greetingForHour(new Date().getHours())}</Text>
          <Text style={styles.title}>{household?.name ?? 'euer Haushalt'}</Text>
        </View>
        <Tooltip label="Verlauf öffnen" position="left">
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/kai/history')}
            accessibilityLabel="Verlauf öffnen"
          >
            <Ionicons name="time-outline" size={20} color={Colors.night} />
          </TouchableOpacity>
        </Tooltip>
      </View>

      <Text style={styles.headline}>Was können wir heute leichter machen?</Text>

      <View style={styles.focusRow}>
        <TouchableOpacity
          style={styles.focusCard}
          onPress={() => goToChat(`Plane die ${openSlotCount} offenen Mahlzeiten in KW ${weekNum}.`)}
        >
          <Text style={styles.focusLabel}>Aktueller Fokus</Text>
          <Text style={styles.focusValue}>KW {weekNum} planen</Text>
          <Text style={styles.focusHint}>{openSlotCount} Slots sind noch offen →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.focusCard, styles.focusCardAlt]}
          onPress={() => goToChat('Erstelle die Einkaufsliste aus unserem aktuellen Wochenplan.')}
        >
          <Text style={[styles.focusLabel, styles.focusLabelAlt]}>Einkauf</Text>
          <Text style={[styles.focusValue, styles.focusValueAlt]}>{openItems} offen</Text>
          <Text style={[styles.focusHint, styles.focusHintAlt]}>{doneItems} erledigt</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Sag KAI, was erledigt werden soll …"
          placeholderTextColor={Colors.muted}
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />
        <View style={styles.composerActions}>
          <TouchableOpacity style={styles.ghostAction} disabled accessibilityLabel="Spracheingabe (nicht verfügbar)">
            <Text style={styles.ghostActionText}>✦ KAI fragen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={() => goToChat(prompt)}>
            <Text style={styles.sendBtnText}>KAI fragen ↑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.subhead}>
        <Text style={styles.subheadTitle}>Typische Aufgaben</Text>
        <Text style={styles.subheadHint}>Du bestätigst jeden Schritt</Text>
      </View>

      <View style={styles.taskStack}>
        {QUICK_TASKS.map(task => (
          <TouchableOpacity key={task.label} style={styles.quickTask} onPress={() => goToChat(task.prompt)}>
            <View style={styles.quickTaskIcon}>
              <Ionicons name={task.icon} size={18} color={Colors.cyanDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTaskLabel}>{task.label}</Text>
              <Text style={styles.quickTaskHint}>{task.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  eyebrow: { color: Colors.cyanDark, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.ink, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 26, fontWeight: '700', color: Colors.ink, lineHeight: 30, marginBottom: Spacing.lg },

  focusRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  focusCard: { flex: 1.25, borderRadius: Radii.xl, padding: Spacing.md, minHeight: 100, backgroundColor: Colors.night },
  focusCardAlt: { flex: 0.75, backgroundColor: Colors.cyan },
  focusLabel: { color: '#8ee9f2', fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },
  focusLabelAlt: { color: Colors.night, opacity: 0.7 },
  focusValue: { color: '#fff', fontWeight: '700', fontSize: 17, marginTop: 14, marginBottom: 3 },
  focusValueAlt: { color: Colors.night },
  focusHint: { color: '#c2d5e0', fontSize: 12 },
  focusHintAlt: { color: Colors.night, opacity: 0.7 },

  composer: { borderWidth: 2, borderColor: '#b9c5f5', backgroundColor: Colors.surface, borderRadius: Radii.xl, padding: Spacing.md, marginBottom: Spacing.lg },
  composerInput: { minHeight: 60, color: Colors.ink, fontSize: 15 },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  ghostAction: { backgroundColor: Colors.cyanSoft, borderRadius: Radii.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  ghostActionText: { color: Colors.cyanDark, fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: Colors.night, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  subhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.sm },
  subheadTitle: { fontWeight: '700', fontSize: 15, color: Colors.ink },
  subheadHint: { color: Colors.muted, fontSize: 12 },

  taskStack: { gap: Spacing.sm },
  quickTask: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md },
  quickTaskIcon: { width: 34, height: 34, borderRadius: Radii.md, backgroundColor: Colors.cyanSoft, alignItems: 'center', justifyContent: 'center' },
  quickTaskLabel: { fontWeight: '700', color: Colors.ink },
  quickTaskHint: { color: Colors.muted, fontSize: 12, marginTop: 1 },
});
