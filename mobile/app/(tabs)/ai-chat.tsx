import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import { useAiChat } from '../../lib/hooks/useAiChat';
import { useMealPlans, useCreateMealPlan, useAddEntry } from '../../lib/hooks/useMealPlan';
import { useUsers } from '../../lib/hooks/useUsers';
import type { ChatMessage, RecipeSuggestion, MealType } from '../../lib/types';
import { DAYS_DE, MEAL_TYPES } from '../../lib/constants';
import { Colors } from '../../lib/theme';
import { getMondayOf, isoDate, getISOWeek } from '../../lib/dateUtils';

// --- Konstanten ---

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hallo! Ich bin dein KI-Assistent für die Mahlzeitenplanung. Ich kann dir Rezeptvorschläge machen, Fragen zu Ernährung beantworten oder dir helfen, deinen Wochenplan zu gestalten. Wie kann ich dir helfen?',
};

// --- Hilfstyp für Nachrichten mit optionalen Vorschlägen ---

interface DisplayMessage {
  message: ChatMessage;
  suggestions?: RecipeSuggestion[];
}

// --- Inline-Picker-State für "Zum Wochenplan" ---

interface SlotPickerState {
  suggestionIndex: number;
  dayIndex: number | null;
  mealType: MealType | null;
  added: boolean;
}

// --- Hauptkomponente ---

export default function AiChatScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([
    { message: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [slotPickers, setSlotPickers] = useState<Record<string, SlotPickerState>>({});
  const [weekStart] = useState<Date>(() => getMondayOf(new Date()));
  const scrollRef = useRef<ScrollView>(null);

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const chatMutation = useAiChat();
  const { data: allPlans } = useMealPlans();
  const { data: users = [] } = useUsers();
  const createPlan = useCreateMealPlan();
  const addEntry = useAddEntry();

  const currentPlan = allPlans?.find(p => p.week_start_date === weekStartIso);

  // Build the flat chat history (excluding the static welcome message)
  const buildHistory = (): ChatMessage[] =>
    displayMessages.slice(1).map(dm => dm.message);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const history = buildHistory();

    setDisplayMessages(prev => [...prev, { message: userMsg }]);
    setInput('');

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await chatMutation.mutateAsync({
        messages: [...history, userMsg],
        week_start_date: weekStartIso,
      });

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.reply };
      setDisplayMessages(prev => [
        ...prev,
        { message: assistantMsg, suggestions: result.recipe_suggestions },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      showAlert('Fehler', 'KI-Antwort konnte nicht geladen werden. Bitte versuche es erneut.');
      // Remove the pending user message on error
      setDisplayMessages(prev => prev.slice(0, -1));
      setInput(text);
    }
  };

  const pickerKey = (msgIndex: number, sugIndex: number) => `${msgIndex}-${sugIndex}`;

  const toggleDayPicker = (msgIndex: number, sugIndex: number, suggestion: RecipeSuggestion) => {
    const key = pickerKey(msgIndex, sugIndex);
    setSlotPickers(prev => {
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: { suggestionIndex: sugIndex, dayIndex: null, mealType: null, added: false },
      };
    });
  };

  const selectDay = (key: string, dayIndex: number) => {
    setSlotPickers(prev => ({
      ...prev,
      [key]: { ...prev[key], dayIndex, added: false },
    }));
  };

  const selectMealType = (key: string, mt: MealType) => {
    setSlotPickers(prev => ({
      ...prev,
      [key]: { ...prev[key], mealType: mt, added: false },
    }));
  };

  const handleAddToMealPlan = async (
    key: string,
    suggestion: RecipeSuggestion,
    dayIndex: number,
    mealType: MealType,
  ) => {
    try {
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
        recipe_id: suggestion.recipe_id ?? null,
        custom_meal: suggestion.recipe_id ? null : suggestion.recipe_name,
        assigned_user_ids: users.map(u => u.id),
      });

      setSlotPickers(prev => ({
        ...prev,
        [key]: { ...prev[key], added: true },
      }));
    } catch {
      showAlert('Fehler', 'Eintrag konnte nicht zum Wochenplan hinzugefügt werden.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.inner, isWide && styles.innerWide]}>
        {/* Wocheninfo */}
        <View style={styles.weekBanner}>
          <Text style={styles.weekBannerText}>
            Aktuelle Woche: KW {weekNum}, {year}
          </Text>
        </View>

        {/* Chat-Verlauf */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {displayMessages.map((dm, msgIndex) => {
            const isUser = dm.message.role === 'user';
            return (
              <View key={msgIndex}>
                {/* Nachrichtenblase */}
                <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                      {dm.message.content}
                    </Text>
                  </View>
                </View>

                {/* Rezeptvorschläge */}
                {dm.suggestions && dm.suggestions.length > 0 && (
                  <View style={styles.suggestionsBlock}>
                    {dm.suggestions.map((suggestion, sugIndex) => {
                      const key = pickerKey(msgIndex, sugIndex);
                      const picker = slotPickers[key];
                      const canAdd = picker && picker.dayIndex !== null && picker.mealType !== null;
                      const isAdding = addEntry.isPending;

                      return (
                        <View key={sugIndex} style={styles.suggestionCard}>
                          <View style={styles.suggestionHeader}>
                            <Text style={styles.suggestionName} numberOfLines={1}>
                              🍽 {suggestion.recipe_name}
                              {suggestion.is_new_recipe ? '  ✨' : ''}
                            </Text>
                          </View>
                          <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

                          {/* Zum Wochenplan Button */}
                          {!picker?.added ? (
                            <TouchableOpacity
                              style={styles.addToPlanBtn}
                              onPress={() => toggleDayPicker(msgIndex, sugIndex, suggestion)}
                            >
                              <Text style={styles.addToPlanBtnText}>
                                {picker ? '▲ Eintragen abbrechen' : '+ Zum Wochenplan hinzufügen'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.addedConfirm}>
                              <Text style={styles.addedConfirmText}>✓ Zum Wochenplan hinzugefügt</Text>
                            </View>
                          )}

                          {/* Inline-Picker */}
                          {picker && !picker.added && (
                            <View style={styles.pickerBlock}>
                              {/* Tagauswahl */}
                              <Text style={styles.pickerLabel}>Tag</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.pickerChipRow}>
                                  {DAYS_SHORT.map((day, di) => (
                                    <TouchableOpacity
                                      key={di}
                                      style={[
                                        styles.pickerChip,
                                        picker.dayIndex === di && styles.pickerChipSelected,
                                      ]}
                                      onPress={() => selectDay(key, di)}
                                    >
                                      <Text
                                        style={[
                                          styles.pickerChipText,
                                          picker.dayIndex === di && styles.pickerChipTextSelected,
                                        ]}
                                      >
                                        {day}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </ScrollView>

                              {/* Mahlzeitstyp-Auswahl */}
                              <Text style={[styles.pickerLabel, { marginTop: 8 }]}>Mahlzeit</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.pickerChipRow}>
                                  {MEAL_TYPES.map(({ key: mt, label, icon }) => (
                                    <TouchableOpacity
                                      key={mt}
                                      style={[
                                        styles.pickerChip,
                                        picker.mealType === mt && styles.pickerChipSelected,
                                      ]}
                                      onPress={() => selectMealType(key, mt)}
                                    >
                                      <Text
                                        style={[
                                          styles.pickerChipText,
                                          picker.mealType === mt && styles.pickerChipTextSelected,
                                        ]}
                                      >
                                        {icon} {label}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </ScrollView>

                              {/* Hinzufügen-Button */}
                              <TouchableOpacity
                                style={[styles.confirmAddBtn, !canAdd && styles.confirmAddBtnDisabled]}
                                disabled={!canAdd || isAdding}
                                onPress={() =>
                                  canAdd &&
                                  handleAddToMealPlan(
                                    key,
                                    suggestion,
                                    picker.dayIndex!,
                                    picker.mealType!,
                                  )
                                }
                              >
                                {isAdding ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Text style={styles.confirmAddBtnText}>
                                    {picker.dayIndex !== null && picker.mealType
                                      ? `${DAYS_SHORT[picker.dayIndex]} – ${MEAL_TYPES.find(m => m.key === picker.mealType)?.label} eintragen`
                                      : 'Tag und Mahlzeit auswählen'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {/* Lade-Indikator */}
          {chatMutation.isPending && (
            <View style={styles.bubbleWrapper}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleLoading]}>
                <ActivityIndicator size="small" color={GREEN} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Eingabezeile */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Nachricht eingeben …"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || chatMutation.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Text style={styles.sendBtnText}>Senden</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1 },
  innerWide: { maxWidth: 800, alignSelf: 'center', width: '100%' },

  weekBanner: {
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  weekBannerText: { fontSize: 12, color: GREEN, fontWeight: '600' },

  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 4 },

  bubbleWrapper: { flexDirection: 'row', marginBottom: 8 },
  bubbleWrapperUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAssistant: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  bubbleUser: { backgroundColor: GREEN },
  bubbleLoading: { paddingVertical: 14, paddingHorizontal: 20 },
  bubbleText: { fontSize: 15, color: '#1A1A1A', lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },

  suggestionsBlock: { gap: 8, marginBottom: 8, marginLeft: 8 },
  suggestionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    maxWidth: '90%',
  },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  suggestionName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  suggestionReason: { fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 18 },

  addToPlanBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  addToPlanBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },
  addedConfirm: {
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  addedConfirmText: { fontSize: 13, color: GREEN, fontWeight: '600' },

  pickerBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: Colors.bg,
    borderRadius: 8,
    gap: 4,
  },
  pickerLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 },
  pickerChipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  pickerChip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  pickerChipSelected: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  pickerChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  pickerChipTextSelected: { color: GREEN, fontWeight: '700' },

  confirmAddBtn: {
    marginTop: 10,
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmAddBtnDisabled: { backgroundColor: '#A5D6A7' },
  confirmAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: '#A5D6A7' },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
