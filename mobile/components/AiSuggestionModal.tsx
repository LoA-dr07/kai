import React, { useState } from 'react';
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
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useAiMealPlanSuggestion } from '../lib/hooks/useAiMealPlanSuggestion';
import type { User, Recipe, AiMealPlanSuggestionEntry, MealType } from '../lib/types';
import { DAYS_DE, MEAL_TYPES } from '../lib/constants';
import { Colors } from '../lib/theme';
import axios from 'axios';

// --- Konstanten ---

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'dessert'];

// --- Props ---

interface AiSuggestionModalProps {
  visible: boolean;
  weekStartIso: string;
  users: User[];
  recipes: Recipe[];
  onClose: () => void;
  onApply: (entries: AiMealPlanSuggestionEntry[]) => Promise<void>;
}

type Phase = 'input' | 'loading' | 'preview' | 'applying';

// --- Komponente ---

export default function AiSuggestionModal({
  visible,
  weekStartIso,
  users,
  recipes,
  onClose,
  onApply,
}: AiSuggestionModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [phase, setPhase] = useState<Phase>('input');
  const [requestingUserId, setRequestingUserId] = useState<number>(users[0]?.id ?? 0);
  const [specialWishes, setSpecialWishes] = useState('');
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>(ALL_MEAL_TYPES);
  const [entries, setEntries] = useState<AiMealPlanSuggestionEntry[]>([]);

  const aiMutation = useAiMealPlanSuggestion();

  const resetState = () => {
    setPhase('input');
    setSpecialWishes('');
    setSelectedMealTypes(ALL_MEAL_TYPES);
    setEntries([]);
  };

  const handleClose = () => {
    if (phase === 'loading' || phase === 'applying') return;
    resetState();
    onClose();
  };

  const toggleMealType = (mt: MealType) => {
    setSelectedMealTypes(prev => {
      if (prev.includes(mt)) {
        // Keep at least one selected
        if (prev.length <= 1) return prev;
        return prev.filter(m => m !== mt);
      }
      return [...prev, mt];
    });
  };

  const handleGenerate = async () => {
    setPhase('loading');
    try {
      const result = await aiMutation.mutateAsync({
        week_start_date: weekStartIso,
        requesting_user_id: requestingUserId,
        special_wishes: specialWishes.trim(),
        meal_types: selectedMealTypes,
      });
      setEntries(result.entries);
      setPhase('preview');
    } catch (err) {
      setPhase('input');
      const detail =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'KI-Plan konnte nicht erstellt werden. Bitte versuche es erneut.';
      showAlert('Fehler', detail);
    }
  };

  const handleRemoveEntry = (entryIndex: number) => {
    setEntries(prev => prev.filter((_, i) => i !== entryIndex));
  };

  const handleApply = async () => {
    setPhase('applying');
    try {
      await onApply(entries);
      resetState();
      onClose();
    } catch {
      setPhase('preview');
      showAlert('Fehler', 'Plan konnte nicht übernommen werden.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>KI-Wochenplan</Text>
          {phase !== 'loading' && phase !== 'applying' && (
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.headerClose}>Schließen</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phase: Eingabe */}
        {phase === 'input' && (
          <ScrollView contentContainerStyle={styles.inputContent}>
            {/* Nutzerauswahl */}
            <Text style={styles.sectionLabel}>Wer fragt?</Text>
            <View style={styles.chipRow}>
              {users.map(user => {
                const selected = user.id === requestingUserId;
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.chip,
                      selected && { backgroundColor: user.avatar_color, borderColor: user.avatar_color },
                    ]}
                    onPress={() => setRequestingUserId(user.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {user.short_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Mahlzeitstypen */}
            <Text style={styles.sectionLabel}>Zu planende Mahlzeiten</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map(({ key, label, icon }) => {
                const selected = selectedMealTypes.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleMealType(key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {icon} {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Freitext */}
            <Text style={styles.sectionLabel}>Besondere Wünsche für diese Woche</Text>
            <TextInput
              style={styles.wishesInput}
              placeholder="z.B. Viel Pasta, keine Suppen, günstig kochen …"
              value={specialWishes}
              onChangeText={setSpecialWishes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
              <Text style={styles.generateBtnText}>KI-Plan generieren ✨</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Phase: Laden */}
        {phase === 'loading' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>KI erstellt deinen Wochenplan …</Text>
            <Text style={styles.loadingHint}>Das kann bis zu 30 Sekunden dauern.</Text>
          </View>
        )}

        {/* Phase: Vorschau */}
        {(phase === 'preview' || phase === 'applying') && (
          <View style={styles.previewWrapper}>
            <ScrollView contentContainerStyle={styles.previewContent}>
              {DAYS_DE.map((dayName, dayIdx) => {
                const dayEntries = entries
                  .map((e, i) => ({ entry: e, index: i }))
                  .filter(({ entry }) => entry.day_of_week === dayIdx);
                if (dayEntries.length === 0) return null;
                return (
                  <View key={dayIdx} style={styles.dayBlock}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    {MEAL_TYPES.map(({ key, label, icon }) => {
                      const slotEntries = dayEntries.filter(({ entry }) => entry.meal_type === key);
                      if (slotEntries.length === 0) return null;
                      return (
                        <View key={key}>
                          {slotEntries.map(({ entry, index }) => {
                            const mealName = entry.recipe_name ?? entry.custom_meal ?? '';
                            const assignedUsers = users.filter(u =>
                              entry.assigned_user_ids.includes(u.id)
                            );
                            return (
                              <View key={index} style={styles.mealRow}>
                                <Text style={styles.mealIcon}>{icon}</Text>
                                <View style={styles.mealInfo}>
                                  <Text style={styles.mealName} numberOfLines={1}>{mealName}</Text>
                                  {assignedUsers.length > 0 && assignedUsers.length < users.length && (
                                    <View style={styles.assignedBadges}>
                                      {assignedUsers.map(u => (
                                        <View
                                          key={u.id}
                                          style={[styles.userBadge, { backgroundColor: u.avatar_color }]}
                                        >
                                          <Text style={styles.userBadgeText}>{u.short_name}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                  {entry.reason ? (
                                    <Text style={styles.mealReason} numberOfLines={2}>{entry.reason}</Text>
                                  ) : null}
                                </View>
                                <TouchableOpacity
                                  style={styles.removeBtn}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  onPress={() => handleRemoveEntry(index)}
                                >
                                  <Text style={styles.removeBtnText}>✕</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer-Buttons */}
            <View style={styles.previewFooter}>
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => setPhase('input')}
                disabled={phase === 'applying'}
              >
                <Text style={styles.discardBtnText}>Verwerfen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyBtn, phase === 'applying' && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={phase === 'applying'}
              >
                {phase === 'applying' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyBtnText}>Plan übernehmen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// --- Styles ---

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

  // Input phase
  inputContent: { padding: 16, gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  wishesInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  generateBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Loading phase
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  loadingText: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' },
  loadingHint: { fontSize: 13, color: '#888', textAlign: 'center' },

  // Preview phase
  previewWrapper: { flex: 1 },
  previewContent: { padding: 16, gap: 4 },
  dayBlock: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 8,
  },
  mealIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  assignedBadges: { flexDirection: 'row', gap: 4, marginTop: 3 },
  userBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  userBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  mealReason: { fontSize: 12, color: '#888', marginTop: 2 },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 13, color: '#B71C1C', fontWeight: '700' },

  previewFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#fff',
  },
  discardBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  discardBtnText: { fontSize: 15, fontWeight: '600', color: '#555' },
  applyBtn: {
    flex: 2,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: '#A5D6A7' },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
