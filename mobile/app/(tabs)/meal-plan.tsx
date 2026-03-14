import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMealPlans, useCreateMealPlan, useAddEntry, useUpdateEntry, useDeleteEntry } from '../../lib/hooks/useMealPlans';
import { useUsers } from '../../lib/hooks/useUsers';
import type { MealPlan, MealPlanEntry, MealType, User } from '../../lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
};
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${monday.getDate()}.${monday.getMonth() + 1}. – ${sunday.getDate()}.${sunday.getMonth() + 1}.${sunday.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// UserChip
// ---------------------------------------------------------------------------

interface UserChipProps {
  user: User;
  selected: boolean;
  onPress: () => void;
}

function UserChip({ user, selected, onPress }: UserChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected
          ? { backgroundColor: user.avatar_color, borderColor: user.avatar_color }
          : { backgroundColor: '#F0F0F0', borderColor: '#CCC' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected ? { color: '#FFF' } : { color: '#555' }]}>
        {user.abbreviation}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// AssignedUserDots – tiny dots shown in the meal slot
// ---------------------------------------------------------------------------

function AssignedUserDots({ users }: { users: User[] }) {
  if (users.length === 0) return null;
  return (
    <View style={styles.dotsRow}>
      {users.map(u => (
        <View key={u.id} style={[styles.dot, { backgroundColor: u.avatar_color }]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SlotModal – edit a single meal slot
// ---------------------------------------------------------------------------

interface SlotModalProps {
  visible: boolean;
  planId: number;
  dayOfWeek: number;
  mealType: MealType;
  existingEntry: MealPlanEntry | null;
  allUsers: User[];
  onClose: () => void;
}

function SlotModal({ visible, planId, dayOfWeek, mealType, existingEntry, allUsers, onClose }: SlotModalProps) {
  const [customMeal, setCustomMeal] = useState(existingEntry?.custom_meal ?? '');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(existingEntry?.assigned_users.map(u => u.id) ?? [])
  );

  const addEntry = useAddEntry(planId);
  const updateEntry = useUpdateEntry(planId);
  const deleteEntry = useDeleteEntry(planId);

  // Reset state when modal opens for a different entry
  React.useEffect(() => {
    if (visible) {
      setCustomMeal(existingEntry?.custom_meal ?? '');
      setSelectedUserIds(new Set(existingEntry?.assigned_users.map(u => u.id) ?? []));
    }
  }, [visible, existingEntry]);

  const toggleUser = useCallback((userId: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const meal = customMeal.trim();
    if (!meal) {
      Alert.alert('Hinweis', 'Bitte eine Mahlzeit eingeben.');
      return;
    }
    const user_ids = Array.from(selectedUserIds);
    try {
      if (existingEntry) {
        await updateEntry.mutateAsync({
          entryId: existingEntry.id,
          payload: { custom_meal: meal, user_ids },
        });
      } else {
        await addEntry.mutateAsync({
          day_of_week: dayOfWeek,
          meal_type: mealType,
          custom_meal: meal,
          user_ids,
        });
      }
      onClose();
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen.');
    }
  }, [customMeal, selectedUserIds, existingEntry, dayOfWeek, mealType, addEntry, updateEntry, onClose]);

  const handleDelete = useCallback(async () => {
    if (!existingEntry) return;
    try {
      await deleteEntry.mutateAsync(existingEntry.id);
      onClose();
    } catch {
      Alert.alert('Fehler', 'Löschen fehlgeschlagen.');
    }
  }, [existingEntry, deleteEntry, onClose]);

  const isBusy = addEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>
            {DAY_NAMES[dayOfWeek]} · {MEAL_LABELS[mealType]}
          </Text>

          <Text style={styles.fieldLabel}>Mahlzeit</Text>
          <TextInput
            style={styles.textInput}
            value={customMeal}
            onChangeText={setCustomMeal}
            placeholder="z. B. Spaghetti Bolognese"
            placeholderTextColor="#AAA"
            returnKeyType="done"
          />

          {allUsers.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Mitglieder</Text>
              <View style={styles.chipsRow}>
                {allUsers.map(u => (
                  <UserChip
                    key={u.id}
                    user={u}
                    selected={selectedUserIds.has(u.id)}
                    onPress={() => toggleUser(u.id)}
                  />
                ))}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            {existingEntry && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={isBusy}>
                <Text style={styles.deleteBtnText}>Löschen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isBusy}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MealSlot
// ---------------------------------------------------------------------------

interface MealSlotProps {
  entry: MealPlanEntry | null;
  onPress: () => void;
}

function MealSlot({ entry, onPress }: MealSlotProps) {
  return (
    <TouchableOpacity style={[styles.slot, entry ? styles.slotFilled : styles.slotEmpty]} onPress={onPress} activeOpacity={0.7}>
      {entry ? (
        <>
          <Text style={styles.slotMealText} numberOfLines={2}>
            {entry.custom_meal ?? entry.recipe?.name ?? '–'}
          </Text>
          <AssignedUserDots users={entry.assigned_users} />
        </>
      ) : (
        <Text style={styles.slotAddText}>+</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// WeekView
// ---------------------------------------------------------------------------

interface WeekViewProps {
  plan: MealPlan;
  allUsers: User[];
}

function WeekView({ plan, allUsers }: WeekViewProps) {
  const [editingSlot, setEditingSlot] = useState<{ day: number; mealType: MealType } | null>(null);

  const entryMap = new Map<string, MealPlanEntry>();
  for (const entry of plan.entries) {
    entryMap.set(`${entry.day_of_week}-${entry.meal_type}`, entry);
  }

  const activeEntry = editingSlot
    ? entryMap.get(`${editingSlot.day}-${editingSlot.mealType}`) ?? null
    : null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.weekGrid}>
        {Array.from({ length: 7 }, (_, dayIdx) => (
          <View key={dayIdx} style={styles.dayRow}>
            <Text style={styles.dayLabel}>{DAY_NAMES[dayIdx]}</Text>
            <View style={styles.slotsRow}>
              {MEAL_TYPES.map(mealType => (
                <View key={mealType} style={styles.slotWrapper}>
                  <Text style={styles.mealTypeLabel}>{MEAL_LABELS[mealType]}</Text>
                  <MealSlot
                    entry={entryMap.get(`${dayIdx}-${mealType}`) ?? null}
                    onPress={() => setEditingSlot({ day: dayIdx, mealType })}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {editingSlot && (
        <SlotModal
          visible
          planId={plan.id}
          dayOfWeek={editingSlot.day}
          mealType={editingSlot.mealType}
          existingEntry={activeEntry}
          allUsers={allUsers}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MealPlanScreen
// ---------------------------------------------------------------------------

export default function MealPlanScreen() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const { data: allPlans, isLoading: plansLoading } = useMealPlans();
  const { data: users = [] } = useUsers();
  const createPlan = useCreateMealPlan();

  const weekStart = toISO(currentMonday);
  const activePlan = allPlans?.find(p => p.week_start_date === weekStart) ?? null;
  const { data: fullPlan, isLoading: planLoading } = useMealPlans();

  // Find the full plan with entries
  const planWithEntries = allPlans?.find(p => p.week_start_date === weekStart) ?? null;

  const handleCreatePlan = useCallback(async () => {
    try {
      await createPlan.mutateAsync({
        name: `KW ${formatWeekLabel(currentMonday)}`,
        week_start_date: weekStart,
      });
    } catch {
      Alert.alert('Fehler', 'Plan konnte nicht erstellt werden.');
    }
  }, [createPlan, currentMonday, weekStart]);

  const isLoading = plansLoading;

  return (
    <View style={styles.container}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentMonday(d => addDays(d, -7))}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekLabel(currentMonday)}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentMonday(d => addDays(d, 7))}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#2E7D32" size="large" />
        </View>
      ) : planWithEntries ? (
        <WeekView plan={planWithEntries} allUsers={users} />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Kein Plan für diese Woche.</Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreatePlan}
            disabled={createPlan.isPending}
          >
            {createPlan.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.createBtnText}>Plan anlegen</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },

  // Week navigation
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  weekLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 22, color: '#2E7D32', fontWeight: '700' },

  // Week grid
  weekGrid: { padding: 12, gap: 8 },
  dayRow: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginBottom: 6 },
  slotsRow: { flexDirection: 'row', gap: 6 },
  slotWrapper: { flex: 1, alignItems: 'stretch' },
  mealTypeLabel: { fontSize: 10, color: '#888', marginBottom: 3, textAlign: 'center' },

  // Slots
  slot: {
    minHeight: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  slotEmpty: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  slotFilled: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
  slotMealText: { fontSize: 12, color: '#1A1A1A', textAlign: 'center', fontWeight: '500' },
  slotAddText: { fontSize: 20, color: '#CCC' },

  // User dots in slot
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Empty / create
  emptyText: { fontSize: 15, color: '#888' },
  createBtn: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  createBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 16,
  },

  // User chips
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  chip: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  // Modal actions
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelBtnText: { color: '#555', fontWeight: '600' },
  saveBtn: { backgroundColor: '#2E7D32', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '700' },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#EF9A9A',
    marginRight: 'auto',
  },
  deleteBtnText: { color: '#C62828', fontWeight: '600' },
});
