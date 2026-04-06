import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { getMondayOf, getISOWeek, isoDate } from '../lib/dateUtils';
import { useAddEntry, useCreateMealPlan, useMealPlans } from '../lib/hooks/useMealPlan';
import { useUsers } from '../lib/hooks/useUsers';
import { DAYS_DE, MEAL_TYPES } from '../lib/constants';
import { Colors } from '../lib/theme';
import { Tooltip } from './Tooltip';
import type { MealType } from '../lib/types';

interface AddToMealPlanModalProps {
  recipeId: number;
  recipeName: string;
  visible: boolean;
  onClose: () => void;
}

function todayDayIndex(): number {
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat → convert to 0=Mon … 6=Sun
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

const DAYS_SHORT = DAYS_DE.map(d => d.slice(0, 2));

export function AddToMealPlanModal({ recipeId, recipeName, visible, onClose }: AddToMealPlanModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayDayIndex);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('dinner');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: allPlans } = useMealPlans();
  const { data: users = [] } = useUsers();
  const createPlan = useCreateMealPlan();
  const addEntry = useAddEntry();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setWeekStart(getMondayOf(new Date()));
      setSelectedDayIndex(todayDayIndex());
      setSelectedMealType('dinner');
      setSelectedUserIds([]);
    }
  }, [visible]);

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let planId = allPlans?.find(p => p.week_start_date === weekStartIso)?.id;
      if (!planId) {
        const newPlan = await createPlan.mutateAsync({
          name: `KW ${weekNum} ${year}`,
          week_start_date: weekStartIso,
        });
        planId = newPlan.id;
      }
      await addEntry.mutateAsync({
        planId,
        day_of_week: selectedDayIndex,
        meal_type: selectedMealType,
        recipe_id: recipeId,
        assigned_user_ids: selectedUserIds,
      });
      onClose();
    } catch {
      showAlert('Fehler', 'Rezept konnte nicht zum Essensplan hinzugefügt werden.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Zum Essensplan hinzufügen</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerClose}>Schließen</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Recipe name */}
          <View style={styles.recipeNameSection}>
            <Text style={styles.recipeNameLabel} numberOfLines={2}>{recipeName}</Text>
          </View>

          {/* Week navigation */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Woche</Text>
            <View style={styles.weekNavRow}>
              <Tooltip label="Vorherige Woche" position="right">
                <TouchableOpacity style={styles.weekNavBtn} onPress={() => navigateWeek(-1)}>
                  <Text style={styles.weekNavArrow}>‹</Text>
                </TouchableOpacity>
              </Tooltip>
              <Text style={styles.weekLabel}>KW {weekNum}, {year}</Text>
              <Tooltip label="Nächste Woche" position="left">
                <TouchableOpacity style={styles.weekNavBtn} onPress={() => navigateWeek(1)}>
                  <Text style={styles.weekNavArrow}>›</Text>
                </TouchableOpacity>
              </Tooltip>
            </View>
          </View>

          {/* Day chips */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tag</Text>
            <View style={styles.chipRow}>
              {DAYS_SHORT.map((dayName, index) => {
                const selected = selectedDayIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedDayIndex(index)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Meal type chips */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Mahlzeit</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map(({ key, label, icon }) => {
                const selected = selectedMealType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedMealType(key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {icon} {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* User assignment chips */}
          {users.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Für wen?</Text>
              <View style={styles.chipRow}>
                {users.map(user => {
                  const selected = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.chip,
                        selected && { backgroundColor: user.avatar_color, borderColor: user.avatar_color },
                      ]}
                      onPress={() => toggleUser(user.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {user.short_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Zum Essensplan hinzufügen</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerWide: { maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerClose: { fontSize: 16, color: GREEN, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  recipeNameSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  recipeNameLabel: { fontSize: 17, fontWeight: '600', color: GREEN },

  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavArrow: { fontSize: 22, color: GREEN, fontWeight: '600', lineHeight: 26 },
  weekLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#A5D6A7' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
