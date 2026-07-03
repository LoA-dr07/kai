import React, { useState, useRef } from 'react';
import { useOrientation } from '../../lib/hooks/useOrientation';
import { ErrorScreen } from '../../components/ErrorScreen';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import {
  useMealPlans,
  useCreateMealPlan,
  useAddEntry,
  useUpdateEntry,
  useDeleteEntry,
} from '../../lib/hooks/useMealPlan';
import { useRecipes, useTags } from '../../lib/hooks/useRecipes';
import { useUsers } from '../../lib/hooks/useUsers';
import AiSuggestionModal from '../../components/AiSuggestionModal';
import type { MealPlanEntry, MealType, User, AiMealPlanSuggestionEntry, Recipe } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';
import { RecipeSearchPanel } from '../../components/RecipeSearchPanel';
import { RecipeDetailModal } from '../../components/RecipeDetailModal';
import { DAYS_DE, MEAL_TYPES } from '../../lib/constants';
import { Colors } from '../../lib/theme';
import { getMondayOf, isoDate, getISOWeek } from '../../lib/dateUtils';

const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

const MEAL_TYPE_TAG_NAMES: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  snack: 'Snack',
  dinner: 'Abendessen',
  dessert: 'Dessert',
};

// --- UserChips ---
function UserChips({ users, selectedIds, onToggle }: { users: User[]; selectedIds: number[]; onToggle: (id: number) => void }) {
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
              style={[chipStyles.chip, selected && { backgroundColor: user.avatar_color, borderColor: user.avatar_color }]}
              onPress={() => onToggle(user.id)}
            >
              <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>{user.short_name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// --- AvatarBadges ---
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

// --- Main component ---
export default function MealPlanScreen() {
  const { width } = useWindowDimensions();
  const { isLandscape, height } = useOrientation();
  const isWide = width >= 768;
  const isDesktop = width >= 1024;
  const isUltraWide = width >= 2560;

  const CONTENT_PADDING = 12;
  const CARD_GAP = 10;
  const numDayCols = isUltraWide ? 7 : isDesktop ? 3 : isWide ? 2 : 1;
  const containerMaxWidth = isUltraWide ? 3200 : 1200;
  const containerWidth = Math.min(width, containerMaxWidth + CONTENT_PADDING * 2) - CONTENT_PADDING * 2;
  const dayCardWidth = isWide ? (containerWidth - CARD_GAP * (numDayCols - 1)) / numDayCols : undefined;

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  // Modal state
  const [selectedSlot, setSelectedSlot] = useState<{
    dayIndex: number; mealType: MealType; existingEntry?: MealPlanEntry; preselectedUserId?: number;
  } | null>(null);
  const [tab, setTab] = useState<'recipe' | 'freetext'>('recipe');
  const [freeText, setFreeText] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [initialTagIds, setInitialTagIds] = useState<number[]>([]);

  // Recipe detail modal (opened by tapping a plan entry that has a recipe)
  const [detailEntry, setDetailEntry] = useState<MealPlanEntry | null>(null);

  // Long-press bottom sheet
  const [bottomSheet, setBottomSheet] = useState<{ entry: MealPlanEntry; dayIndex: number; mealType: MealType } | null>(null);

  // Move/copy mode
  const [moveMode, setMoveMode] = useState<{ entry: MealPlanEntry; mode: 'move' | 'copy' } | null>(null);

  // Drag state (web only)
  const dragEntryRef = useRef<{ entry: MealPlanEntry; dayIndex: number; mealType: MealType } | null>(null);

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const { data: allPlans, isLoading, error } = useMealPlans();
  const { data: recipes } = useRecipes();
  const { data: users = [] } = useUsers();
  const { data: tags = [] } = useTags();
  const createPlan = useCreateMealPlan();
  const addEntry = useAddEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const currentPlan = allPlans?.find(p => p.week_start_date === weekStartIso);

  // Recently used recipes (last 5 unique used in current plan)
  const recentRecipes = React.useMemo<Recipe[]>(() => {
    if (!currentPlan || !recipes) return [];
    const seen = new Set<number>();
    const result: Recipe[] = [];
    const entries = [...(currentPlan.entries ?? [])].reverse();
    for (const entry of entries) {
      if (entry.recipe_id && !seen.has(entry.recipe_id)) {
        seen.add(entry.recipe_id);
        const recipe = recipes.find(r => r.id === entry.recipe_id);
        if (recipe) result.push(recipe);
      }
      if (result.length >= 5) break;
    }
    return result;
  }, [currentPlan, recipes]);

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d; });
    setMoveMode(null);
  };

  const getEntries = (dayIndex: number, mealType: MealType): MealPlanEntry[] =>
    currentPlan?.entries.filter(e => e.day_of_week === dayIndex && e.meal_type === mealType) ?? [];

  const getEntryForUser = (dayIndex: number, mealType: MealType, userId: number): MealPlanEntry | undefined =>
    getEntries(dayIndex, mealType).find(e => e.assigned_user_ids.includes(userId));

  const openModalNew = (dayIndex: number, mealType: MealType, preselectedUserId?: number) => {
    setSelectedSlot({ dayIndex, mealType, preselectedUserId });
    setTab('recipe');
    setFreeText('');
    setSelectedUserIds(preselectedUserId ? [preselectedUserId] : []);
    const tagNamesToMatch = [MEAL_TYPE_TAG_NAMES[mealType]];
    if (preselectedUserId) {
      const user = users.find(u => u.id === preselectedUserId);
      if (user) tagNamesToMatch.push(user.name);
    }
    setInitialTagIds(tags.filter(t => tagNamesToMatch.includes(t.name)).map(t => t.id));
    setPickerKey(k => k + 1);
    setModalVisible(true);
  };

  const openModalEdit = (dayIndex: number, mealType: MealType, entry: MealPlanEntry) => {
    setSelectedSlot({ dayIndex, mealType, existingEntry: entry });
    setTab(entry.custom_meal ? 'freetext' : 'recipe');
    setFreeText(entry.custom_meal ?? '');
    setSelectedUserIds(entry.assigned_user_ids ?? []);
    const tagNamesToMatch = [MEAL_TYPE_TAG_NAMES[mealType]];
    const firstAssignedUser = users.find(u => entry.assigned_user_ids?.includes(u.id));
    if (firstAssignedUser) tagNamesToMatch.push(firstAssignedUser.name);
    setInitialTagIds(tags.filter(t => tagNamesToMatch.includes(t.name)).map(t => t.id));
    setPickerKey(k => k + 1);
    setModalVisible(true);
  };

  const handleEntryPress = (dayIndex: number, mealType: MealType, entry: MealPlanEntry) => {
    if (entry.recipe_id != null) {
      setDetailEntry(entry);
    } else {
      openModalEdit(dayIndex, mealType, entry);
    }
  };

  const closeModal = () => { setModalVisible(false); setSelectedSlot(null); };
  const toggleUser = (id: number) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const ensurePlan = async (): Promise<number> => {
    if (currentPlan?.id) return currentPlan.id;
    const newPlan = await createPlan.mutateAsync({ name: `KW ${weekNum} ${year}`, week_start_date: weekStartIso });
    return newPlan.id;
  };

  const handleSave = async (recipeId: number | null, customMeal: string | null) => {
    if (!selectedSlot) return;
    const { dayIndex, mealType, existingEntry } = selectedSlot;
    try {
      if (existingEntry) {
        await updateEntry.mutateAsync({ planId: currentPlan!.id, entryId: existingEntry.id, recipe_id: recipeId, custom_meal: customMeal, assigned_user_ids: selectedUserIds });
      } else {
        const planId = await ensurePlan();
        await addEntry.mutateAsync({ planId, day_of_week: dayIndex, meal_type: mealType, recipe_id: recipeId, custom_meal: customMeal, assigned_user_ids: selectedUserIds });
      }
      closeModal();
    } catch (err: unknown) {
      const axErr = err as any;
      const status = axErr?.response?.status;
      const msg: string = axErr?.message ?? (err instanceof Error ? err.message : String(err));
      const code: string = axErr?.code ?? '';
      const detail = status ? `HTTP ${status}\n${msg}` : `${msg}${code ? ` (${code})` : ''}`;
      showAlert('Fehler', `Eintrag konnte nicht gespeichert werden.\n\n${detail}`);
    }
  };

  const handleDelete = (entry: MealPlanEntry) => {
    if (!currentPlan) return;
    showAlert('Mahlzeit entfernen', 'Diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => deleteEntry.mutate({ planId: currentPlan.id, entryId: entry.id }) },
    ]);
  };

  const handleToggleRepeat = async (entry: MealPlanEntry) => {
    if (!currentPlan) return;
    try {
      await updateEntry.mutateAsync({ planId: currentPlan.id, entryId: entry.id, repeat_weekly: !entry.repeat_weekly });
    } catch {
      showAlert('Fehler', 'Konnte nicht gespeichert werden.');
    }
    setBottomSheet(null);
  };

  const handleMoveOrCopy = (entry: MealPlanEntry, mode: 'move' | 'copy') => {
    setMoveMode({ entry, mode });
    setBottomSheet(null);
  };

  const handleDropOnSlot = async (targetDay: number, targetMealType: MealType, sourceEntry?: MealPlanEntry) => {
    const entry = sourceEntry ?? moveMode?.entry;
    const mode = moveMode?.mode ?? 'move';
    if (!entry || !currentPlan) { setMoveMode(null); return; }

    // Same slot → cancel
    if (entry.day_of_week === targetDay && entry.meal_type === targetMealType) { setMoveMode(null); return; }

    try {
      const planId = currentPlan.id;
      await addEntry.mutateAsync({ planId, day_of_week: targetDay, meal_type: targetMealType, recipe_id: entry.recipe_id, custom_meal: entry.custom_meal, assigned_user_ids: entry.assigned_user_ids });
      if (mode === 'move') {
        await deleteEntry.mutateAsync({ planId, entryId: entry.id });
      }
    } catch {
      showAlert('Fehler', 'Verschieben fehlgeschlagen.');
    }
    setMoveMode(null);
  };

  const handleApplyAiSuggestion = async (suggestedEntries: AiMealPlanSuggestionEntry[]) => {
    const planId = await ensurePlan();
    const occupiedSlots = new Set((currentPlan?.entries ?? []).map(e => `${e.day_of_week}:${e.meal_type}`));
    for (const entry of suggestedEntries) {
      if (occupiedSlots.has(`${entry.day_of_week}:${entry.meal_type}`)) continue;
      await addEntry.mutateAsync({ planId, day_of_week: entry.day_of_week, meal_type: entry.meal_type, recipe_id: entry.recipe_id, custom_meal: entry.custom_meal, assigned_user_ids: entry.assigned_user_ids });
    }
  };

  const selectedMealLabel = selectedSlot ? MEAL_TYPES.find(m => m.key === selectedSlot.mealType)?.label : '';
  const isEditing = !!selectedSlot?.existingEntry;
  const isMoveMode = !!moveMode;

  // Web drag-and-drop helpers
  const webDragProps = (entry: MealPlanEntry, dayIndex: number, mealType: MealType) => {
    if (Platform.OS !== 'web') return {};
    return {
      draggable: true,
      onDragStart: (e: any) => {
        dragEntryRef.current = { entry, dayIndex, mealType };
        e.dataTransfer?.setData('text/plain', String(entry.id));
      },
    };
  };

  const webDropProps = (targetDay: number, targetMealType: MealType) => {
    if (Platform.OS !== 'web') return {};
    return {
      onDragOver: (e: any) => e.preventDefault?.(),
      onDrop: (e: any) => {
        e.preventDefault?.();
        if (dragEntryRef.current) {
          handleDropOnSlot(targetDay, targetMealType, dragEntryRef.current.entry);
          dragEntryRef.current = null;
        }
      },
    };
  };

  return (
    <View style={styles.root}>
      {/* Week nav */}
      <View style={styles.weekNav}>
        <Tooltip label="Vorherige Woche" position="bottom">
          <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
        </Tooltip>
        <Text style={styles.weekLabel}>KW {weekNum}, {year}</Text>
        <View style={styles.weekNavRight}>
          {isMoveMode && (
            <TouchableOpacity onPress={() => setMoveMode(null)} style={styles.cancelMoveBtn}>
              <Text style={styles.cancelMoveBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          )}
          {weekStartIso !== isoDate(getMondayOf(new Date())) && (
            <TouchableOpacity onPress={() => { setWeekStart(getMondayOf(new Date())); setMoveMode(null); }} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Heute</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setAiModalVisible(true)} style={styles.aiBtn}>
            <Text style={styles.aiBtnText}>KI ✨</Text>
          </TouchableOpacity>
          <Tooltip label="Nächste Woche" position="bottom">
            <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </Tooltip>
        </View>
      </View>

      {isMoveMode && (
        <View style={styles.moveBanner}>
          <Text style={styles.moveBannerText}>
            {moveMode.mode === 'move' ? '↕ Ziel-Slot antippen zum Verschieben' : '⎘ Ziel-Slot antippen zum Kopieren'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={GREEN} size="large" />
      ) : error ? (
        <ErrorScreen message="Wochenplan konnte nicht geladen werden." />
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide, isUltraWide && { maxWidth: containerMaxWidth + CONTENT_PADDING * 2 }]}>
          <View style={isWide ? styles.dayGrid : undefined}>
            {DAYS_DE.map((dayName, dayIdx) => {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + dayIdx);
              const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

              return (
                <View key={dayIdx} style={[styles.dayCard, isWide && { width: dayCardWidth }]}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{isWide ? dayName : DAYS_SHORT[dayIdx]}</Text>
                    <Text style={styles.dayDate}>{dateStr}</Text>
                  </View>

                  {MEAL_TYPES.map(({ key, label, icon }) => {
                    const entries = getEntries(dayIdx, key);
                    const isDropTarget = isMoveMode;

                    return (
                      <View
                        key={key}
                        style={[styles.mealSection, isDropTarget && styles.mealSectionDropTarget]}
                        {...webDropProps(dayIdx, key)}
                      >
                        <TouchableOpacity
                          activeOpacity={isMoveMode ? 0.5 : 1}
                          onPress={isMoveMode ? () => handleDropOnSlot(dayIdx, key) : undefined}
                          style={isMoveMode ? styles.dropTargetOverlay : undefined}
                        >
                          <View style={styles.mealHeader}>
                            <Text style={styles.mealIcon}>{icon}</Text>
                            <Text style={styles.mealTypeLabel}>{label}</Text>
                          </View>

                          {/* Per-person rows */}
                          {users.length > 0 ? (
                            users.map(user => {
                              const entry = getEntryForUser(dayIdx, key, user.id);
                              if (entry) {
                                const mealLabel = entry.recipe?.name ?? entry.custom_meal ?? '';
                                return (
                                  <TouchableOpacity
                                    key={user.id}
                                    style={styles.personEntryRow}
                                    onPress={isMoveMode ? () => handleDropOnSlot(dayIdx, key) : () => handleEntryPress(dayIdx, key, entry)}
                                    onLongPress={isMoveMode ? undefined : () => setBottomSheet({ entry, dayIndex: dayIdx, mealType: key })}
                                    delayLongPress={400}
                                    activeOpacity={0.7}
                                    {...webDragProps(entry, dayIdx, key)}
                                  >
                                    <View style={[styles.personDot, { backgroundColor: user.avatar_color }]}>
                                      <Text style={styles.personDotText}>{user.short_name}</Text>
                                    </View>
                                    <View style={styles.entryContent}>
                                      <Text style={styles.entryName} numberOfLines={1}>
                                        {mealLabel}
                                        {entry.repeat_weekly ? '  🔁' : ''}
                                      </Text>
                                    </View>
                                    <Tooltip label="Eintrag löschen" position="left">
                                      <TouchableOpacity
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        onPress={e => { e.stopPropagation(); handleDelete(entry); }}
                                      >
                                        <Text style={styles.deleteBtn}>✕</Text>
                                      </TouchableOpacity>
                                    </Tooltip>
                                  </TouchableOpacity>
                                );
                              } else {
                                return (
                                  <TouchableOpacity
                                    key={user.id}
                                    style={styles.personEmptyRow}
                                    onPress={isMoveMode ? () => handleDropOnSlot(dayIdx, key) : () => openModalNew(dayIdx, key, user.id)}
                                    activeOpacity={0.6}
                                  >
                                    <View style={[styles.personDot, styles.personDotEmpty, { borderColor: user.avatar_color }]}>
                                      <Text style={[styles.personDotText, { color: user.avatar_color }]}>{user.short_name}</Text>
                                    </View>
                                    <Text style={styles.personEmptyText}>+</Text>
                                  </TouchableOpacity>
                                );
                              }
                            })
                          ) : (
                            /* Fallback if no users: show entries directly */
                            <>
                              {entries.map(entry => (
                                <TouchableOpacity
                                  key={entry.id}
                                  style={styles.entryRow}
                                  onPress={isMoveMode ? () => handleDropOnSlot(dayIdx, key) : () => handleEntryPress(dayIdx, key, entry)}
                                  onLongPress={isMoveMode ? undefined : () => setBottomSheet({ entry, dayIndex: dayIdx, mealType: key })}
                                  delayLongPress={400}
                                  activeOpacity={0.7}
                                  {...webDragProps(entry, dayIdx, key)}
                                >
                                  <View style={styles.entryContent}>
                                    <Text style={styles.entryName} numberOfLines={1}>
                                      {entry.recipe?.name ?? entry.custom_meal ?? ''}
                                      {entry.repeat_weekly ? '  🔁' : ''}
                                    </Text>
                                    <AvatarBadges entry={entry} users={users} />
                                  </View>
                                  <Tooltip label="Eintrag löschen" position="left">
                                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={e => { e.stopPropagation(); handleDelete(entry); }}>
                                      <Text style={styles.deleteBtn}>✕</Text>
                                    </TouchableOpacity>
                                  </Tooltip>
                                </TouchableOpacity>
                              ))}
                              <TouchableOpacity style={styles.addRow} onPress={() => openModalNew(dayIdx, key)} activeOpacity={0.6}>
                                <Text style={styles.addRowText}>+ Eintrag hinzufügen</Text>
                              </TouchableOpacity>
                            </>
                          )}
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

      {/* Recipe picker modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide, isLandscape && { maxHeight: height * 0.92 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedSlot ? `${DAYS_SHORT[selectedSlot.dayIndex]} – ${selectedMealLabel}` : 'Mahlzeit'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalClose}>Schließen</Text>
            </TouchableOpacity>
          </View>

          <UserChips users={users} selectedIds={selectedUserIds} onToggle={toggleUser} />

          {!isEditing && (
            <View style={styles.tabRow}>
              {(['recipe', 'freetext'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'recipe' ? 'Rezept' : 'Freitext'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tab === 'recipe' ? (
            <RecipeSearchPanel
              key={pickerKey}
              recipes={recipes ?? []}
              tags={tags}
              users={users}
              recentRecipes={recentRecipes}
              initialTagIds={initialTagIds}
              onSelect={id => handleSave(id, null)}
            />
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

      {/* Long-press bottom sheet */}
      <Modal visible={!!bottomSheet} animationType="slide" transparent onRequestClose={() => setBottomSheet(null)}>
        <TouchableOpacity style={bsStyles.overlay} activeOpacity={1} onPress={() => setBottomSheet(null)}>
          <View style={bsStyles.sheet}>
            <View style={bsStyles.handle} />
            {bottomSheet && (
              <>
                <Text style={bsStyles.entryTitle} numberOfLines={1}>
                  {bottomSheet.entry.recipe?.name ?? bottomSheet.entry.custom_meal ?? 'Eintrag'}
                </Text>
                <TouchableOpacity style={bsStyles.action} onPress={() => handleMoveOrCopy(bottomSheet.entry, 'move')}>
                  <Text style={bsStyles.actionIcon}>↕</Text>
                  <Text style={bsStyles.actionText}>Verschieben</Text>
                </TouchableOpacity>
                <TouchableOpacity style={bsStyles.action} onPress={() => handleMoveOrCopy(bottomSheet.entry, 'copy')}>
                  <Text style={bsStyles.actionIcon}>⎘</Text>
                  <Text style={bsStyles.actionText}>Kopieren</Text>
                </TouchableOpacity>
                <TouchableOpacity style={bsStyles.action} onPress={() => handleToggleRepeat(bottomSheet.entry)}>
                  <Text style={bsStyles.actionIcon}>🔁</Text>
                  <Text style={bsStyles.actionText}>
                    {bottomSheet.entry.repeat_weekly ? 'Wöchentlich wiederholen: An' : 'Wöchentlich wiederholen: Aus'}
                  </Text>
                  <View style={[bsStyles.toggleChip, bottomSheet.entry.repeat_weekly && bsStyles.toggleChipActive]}>
                    <Text style={[bsStyles.toggleChipText, bottomSheet.entry.repeat_weekly && bsStyles.toggleChipTextActive]}>
                      {bottomSheet.entry.repeat_weekly ? 'Ein' : 'Aus'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[bsStyles.action, bsStyles.actionDestructive]}
                  onPress={() => { handleDelete(bottomSheet.entry); setBottomSheet(null); }}
                >
                  <Text style={[bsStyles.actionIcon, bsStyles.actionIconDestructive]}>✕</Text>
                  <Text style={[bsStyles.actionText, bsStyles.actionTextDestructive]}>Löschen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* KI modal */}
      <AiSuggestionModal
        visible={aiModalVisible}
        weekStartIso={weekStartIso}
        users={users}
        recipes={recipes ?? []}
        onClose={() => setAiModalVisible(false)}
        onApply={handleApplyAiSuggestion}
      />

      {/* Rezeptdetail-Modal (Tap auf Eintrag mit Rezept) */}
      <RecipeDetailModal
        recipeId={detailEntry?.recipe_id ?? null}
        visible={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        onSwap={async (recipeId, customMeal) => {
          if (!currentPlan || !detailEntry) return;
          try {
            await updateEntry.mutateAsync({
              planId: currentPlan.id,
              entryId: detailEntry.id,
              recipe_id: recipeId,
              custom_meal: customMeal,
              assigned_user_ids: detailEntry.assigned_user_ids,
            });
            setDetailEntry(null);
          } catch {
            showAlert('Fehler', 'Eintrag konnte nicht ausgetauscht werden.');
          }
        }}
      />
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FA' },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  navBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  navArrow: { fontSize: 28, color: GREEN, lineHeight: 32 },
  weekLabel: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  weekNavRight: { flexDirection: 'row', alignItems: 'center' },
  cancelMoveBtn: { borderWidth: 1.5, borderColor: '#888', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  cancelMoveBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
  todayBtn: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  todayBtnText: { fontSize: 13, color: GREEN, fontWeight: '700' },
  aiBtn: { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginRight: 2 },
  aiBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  moveBanner: { backgroundColor: '#FFF9C4', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9A825' },
  moveBannerText: { fontSize: 13, color: '#795548', fontWeight: '600', textAlign: 'center' },

  scrollContent: { padding: 12, gap: 10 },
  scrollContentWide: { maxWidth: 1400, alignSelf: 'center', width: '100%' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  dayCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: GREEN_LIGHT, paddingHorizontal: 14, paddingVertical: 8 },
  dayName: { fontSize: 14, fontWeight: '700', color: GREEN },
  dayDate: { fontSize: 13, color: '#555' },

  mealSection: { borderTopWidth: 1, borderTopColor: BORDER, paddingBottom: 4 },
  mealSectionDropTarget: { backgroundColor: '#F1F8E9' },
  dropTargetOverlay: {},
  mealHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 6 },
  mealIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  mealTypeLabel: { fontSize: 13, fontWeight: '600', color: '#555' },

  personEntryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 8, marginBottom: 3, backgroundColor: GREEN_LIGHT, borderRadius: 8, gap: 8 },
  personEmptyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 8, marginBottom: 3, borderRadius: 8, gap: 8, opacity: 0.6 },
  personDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  personDotEmpty: { backgroundColor: 'transparent', borderWidth: 1.5 },
  personDotText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  personEmptyText: { fontSize: 14, color: '#AAA', fontWeight: '700' },

  entryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, marginHorizontal: 8, marginBottom: 4, backgroundColor: GREEN_LIGHT, borderRadius: 8, gap: 8 },
  entryContent: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  deleteBtn: { fontSize: 13, color: '#B71C1C', fontWeight: '700' },
  addRow: { paddingHorizontal: 12, paddingVertical: 7, marginHorizontal: 8, marginBottom: 4 },
  addRowText: { fontSize: 13, color: '#AAA' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalContainerWide: { maxWidth: 800, width: '100%', alignSelf: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  modalClose: { fontSize: 16, color: GREEN, fontWeight: '600' },

  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: GREEN, fontWeight: '700' },
  tabContent: { flex: 1, padding: 16 },
  freetextInput: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, backgroundColor: '#FAFAFA', marginBottom: 16 },
  saveBtn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#A5D6A7' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const chipStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#fff' },
  label: { fontSize: 13, color: '#555', marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
});

const badgeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: 3 },
  badge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, minWidth: 24, alignItems: 'center' },
  text: { fontSize: 10, color: '#fff', fontWeight: '700' },
});

const bsStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  entryTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 8 },
  action: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderTopWidth: 1, borderTopColor: BORDER },
  actionDestructive: {},
  actionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  actionIconDestructive: { color: '#B71C1C' },
  actionText: { fontSize: 16, color: '#1A1A1A', flex: 1 },
  actionTextDestructive: { color: '#B71C1C' },
  toggleChip: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  toggleChipActive: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  toggleChipText: { fontSize: 12, color: '#888', fontWeight: '700' },
  toggleChipTextActive: { color: GREEN },
});
