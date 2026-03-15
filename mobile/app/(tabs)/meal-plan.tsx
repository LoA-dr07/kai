import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import {
  useMealPlans,
  useCreateMealPlan,
  useAddEntry,
  useUpdateEntry,
  useDeleteEntry,
} from '../../lib/hooks/useMealPlan';
import { useRecipes } from '../../lib/hooks/useRecipes';
import { useUsers } from '../../lib/hooks/useUsers';
import type { MealPlanEntry, MealType, User } from '../../lib/types';

// --- Datums-Hilfsfunktionen ---

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// --- Konstanten ---

const DAYS_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Frühstück', icon: '🍳' },
  { key: 'lunch', label: 'Mittagessen', icon: '🥗' },
  { key: 'dinner', label: 'Abendessen', icon: '🍽' },
];

// --- UserChips im Modal ---

function UserChips({
  users,
  selectedIds,
  onToggle,
}: {
  users: User[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  if (users.length === 0) return null;
  return (
    <View style={chipStyles.container}>
      <Text style={chipStyles.label}>Für wen?</Text>
      <View style={chipStyles.row}>
        {users.map(user => {
          const selected = selectedIds.includes(user.id);
          return (
            <TouchableOpacity
              key={user.id}
              style={[
                chipStyles.chip,
                selected && { backgroundColor: user.avatar_color, borderColor: user.avatar_color },
              ]}
              onPress={() => onToggle(user.id)}
            >
              <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>
                {user.short_name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// --- AvatarBadges: farbige Kürzel neben einem Eintrag ---

function AvatarBadges({ entry, users }: { entry: MealPlanEntry; users: User[] }) {
  if (!entry.assigned_user_ids?.length) return null;
  const assigned = users.filter(u => entry.assigned_user_ids.includes(u.id));
  return (
    <View style={badgeStyles.row}>
      {assigned.map(u => (
        <View key={u.id} style={[badgeStyles.badge, { backgroundColor: u.avatar_color }]}>
          <Text style={badgeStyles.text}>{u.short_name}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Hauptkomponente ---

export default function MealPlanScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    dayIndex: number;
    mealType: MealType;
    existingEntry?: MealPlanEntry;
  } | null>(null);
  const [tab, setTab] = useState<'recipe' | 'freetext'>('recipe');
  const [searchText, setSearchText] = useState('');
  const [freeText, setFreeText] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const { data: allPlans, isLoading } = useMealPlans();
  const { data: recipes } = useRecipes();
  const { data: users = [] } = useUsers();
  const createPlan = useCreateMealPlan();
  const addEntry = useAddEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const currentPlan = allPlans?.find(p => p.week_start_date === weekStartIso);

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const getEntries = (dayIndex: number, mealType: MealType): MealPlanEntry[] =>
    currentPlan?.entries.filter(e => e.day_of_week === dayIndex && e.meal_type === mealType) ?? [];

  const openModalNew = (dayIndex: number, mealType: MealType) => {
    setSelectedSlot({ dayIndex, mealType });
    setTab('recipe');
    setFreeText('');
    setSearchText('');
    setSelectedUserIds([]);
    setModalVisible(true);
  };

  const openModalEdit = (dayIndex: number, mealType: MealType, entry: MealPlanEntry) => {
    setSelectedSlot({ dayIndex, mealType, existingEntry: entry });
    if (entry.custom_meal) {
      setTab('freetext');
      setFreeText(entry.custom_meal);
    } else {
      setTab('recipe');
      setFreeText('');
    }
    setSearchText('');
    setSelectedUserIds(entry.assigned_user_ids ?? []);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSlot(null);
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (recipeId: number | null, customMeal: string | null) => {
    if (!selectedSlot) return;
    const { dayIndex, mealType, existingEntry } = selectedSlot;

    try {
      if (existingEntry) {
        await updateEntry.mutateAsync({
          planId: currentPlan!.id,
          entryId: existingEntry.id,
          recipe_id: recipeId,
          custom_meal: customMeal,
          assigned_user_ids: selectedUserIds,
        });
      } else {
        let planId = currentPlan?.id;
        if (!planId) {
          const newPlan = await createPlan.mutateAsync({
            name: `KW ${weekNum} ${year}`,
            week_start_date: weekStartIso,
          });
          planId = newPlan.id;
        }
        await addEntry.mutateAsync({
          planId,
          day_of_week: dayIndex,
          meal_type: mealType,
          recipe_id: recipeId,
          custom_meal: customMeal,
          assigned_user_ids: selectedUserIds,
        });
      }
      closeModal();
    } catch {
      showAlert('Fehler', 'Eintrag konnte nicht gespeichert werden.');
    }
  };

  const handleDelete = (entry: MealPlanEntry) => {
    if (!currentPlan) return;
    showAlert('Mahlzeit entfernen', 'Diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: () => deleteEntry.mutate({ planId: currentPlan.id, entryId: entry.id }),
      },
    ]);
  };

  const filteredRecipes =
    recipes?.filter(r => r.name.toLowerCase().includes(searchText.toLowerCase())) ?? [];

  const selectedMealLabel = selectedSlot
    ? MEAL_TYPES.find(m => m.key === selectedSlot.mealType)?.label
    : '';

  const isEditing = !!selectedSlot?.existingEntry;

  return (
    <View style={styles.root}>
      {/* Wochennavigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>KW {weekNum}, {year}</Text>
        <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2E7D32" size="large" />
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}>
          <View style={isWide ? styles.dayGrid : undefined}>
          {DAYS_DE.map((dayName, dayIdx) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + dayIdx);
            const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

            return (
              <View key={dayIdx} style={[styles.dayCard, isWide && styles.dayCardWide]}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{dayName}</Text>
                  <Text style={styles.dayDate}>{dateStr}</Text>
                </View>

                {MEAL_TYPES.map(({ key, label, icon }) => {
                  const entries = getEntries(dayIdx, key);

                  return (
                    <View key={key} style={styles.mealSection}>
                      {/* Mahlzeit-Kopfzeile */}
                      <View style={styles.mealHeader}>
                        <Text style={styles.mealIcon}>{icon}</Text>
                        <Text style={styles.mealTypeLabel}>{label}</Text>
                      </View>

                      {/* Bestehende Einträge */}
                      {entries.map(entry => {
                        const mealLabel = entry.recipe?.name ?? entry.custom_meal ?? '';
                        return (
                          <TouchableOpacity
                            key={entry.id}
                            style={styles.entryRow}
                            onPress={() => openModalEdit(dayIdx, key, entry)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.entryContent}>
                              <Text style={styles.entryName} numberOfLines={1}>
                                {mealLabel}
                              </Text>
                              <AvatarBadges entry={entry} users={users} />
                            </View>
                            <TouchableOpacity
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={e => {
                                e.stopPropagation();
                                handleDelete(entry);
                              }}
                            >
                              <Text style={styles.deleteBtn}>✕</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Eintrag hinzufügen */}
                      <TouchableOpacity
                        style={styles.addRow}
                        onPress={() => openModalNew(dayIdx, key)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.addRowText}>+ Eintrag hinzufügen</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}
          </View>
        </ScrollView>
      )}

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedSlot
                ? `${DAYS_SHORT[selectedSlot.dayIndex]} – ${selectedMealLabel}`
                : 'Mahlzeit'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalClose}>Schließen</Text>
            </TouchableOpacity>
          </View>

          {/* Nutzerauswahl */}
          <UserChips users={users} selectedIds={selectedUserIds} onToggle={toggleUser} />

          {/* Tabs – nur bei neuem Eintrag; beim Bearbeiten bleibt der Typ fix */}
          {!isEditing && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'recipe' && styles.tabActive]}
                onPress={() => setTab('recipe')}
              >
                <Text style={[styles.tabText, tab === 'recipe' && styles.tabTextActive]}>
                  Rezept
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'freetext' && styles.tabActive]}
                onPress={() => setTab('freetext')}
              >
                <Text style={[styles.tabText, tab === 'freetext' && styles.tabTextActive]}>
                  Freitext
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Rezept-Tab */}
          {tab === 'recipe' ? (
            <View style={styles.tabContent}>
              <TextInput
                style={styles.searchInput}
                placeholder="Rezept suchen …"
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              <FlatList
                data={filteredRecipes}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recipeRow}
                    onPress={() => handleSave(item.id, null)}
                  >
                    <Text style={styles.recipeName}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.recipeDesc} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {recipes?.length === 0
                      ? 'Noch keine Rezepte vorhanden.'
                      : 'Keine Treffer für deine Suche.'}
                  </Text>
                }
              />
            </View>
          ) : (
            <View style={styles.tabContent}>
              <TextInput
                style={styles.freetextInput}
                placeholder="z.B. Brötchen, Reste, Auswärts essen …"
                value={freeText}
                onChangeText={setFreeText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => freeText.trim() && handleSave(null, freeText.trim())}
              />
              <TouchableOpacity
                style={[styles.saveBtn, !freeText.trim() && styles.saveBtnDisabled]}
                onPress={() => freeText.trim() && handleSave(null, freeText.trim())}
                disabled={!freeText.trim()}
              >
                <Text style={styles.saveBtnText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// --- Styles ---

const GREEN = '#2E7D32';
const GREEN_LIGHT = '#E8F5E9';
const BORDER = '#E0E0E0';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FA' },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  navBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  navArrow: { fontSize: 28, color: GREEN, lineHeight: 32 },
  weekLabel: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

  scrollContent: { padding: 12, gap: 10 },
  scrollContentWide: { maxWidth: 1200, alignSelf: 'center', width: '100%' },

  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  dayCardWide: { width: 'calc(50% - 5px)' as any },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dayName: { fontSize: 15, fontWeight: '700', color: GREEN },
  dayDate: { fontSize: 13, color: '#555' },

  mealSection: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingBottom: 4,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  mealIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  mealTypeLabel: { fontSize: 13, fontWeight: '600', color: '#555' },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 8,
    marginBottom: 4,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8,
    gap: 8,
  },
  entryContent: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  deleteBtn: { fontSize: 13, color: '#B71C1C', fontWeight: '700' },

  addRow: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  addRowText: { fontSize: 13, color: '#AAA' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
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

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: GREEN, fontWeight: '700' },
  tabContent: { flex: 1, padding: 16 },

  searchInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  recipeRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  recipeName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  recipeDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#AAA', marginTop: 32, fontSize: 14 },

  freetextInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
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

const chipStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#fff',
  },
  label: { fontSize: 13, color: '#555', marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
});

const badgeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: 3 },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  text: { fontSize: 10, color: '#fff', fontWeight: '700' },
});
