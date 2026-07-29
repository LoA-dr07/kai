import React, { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { showAlert } from '../../../lib/alert';
import { Tooltip } from '../../../components/Tooltip';
import { useAiChat } from '../../../lib/hooks/useAiChat';
import { useConversations, useConversationMessages, useCreateConversation, useDeleteConversation } from '../../../lib/hooks/useConversations';
import { useMealPlans, useCreateMealPlan, useAddEntry, useDeleteEntry } from '../../../lib/hooks/useMealPlan';
import { useUsers } from '../../../lib/hooks/useUsers';
import { useGenerateShoppingList, useAddShoppingItem } from '../../../lib/hooks/useShoppingList';
import type { ChatMessage, RecipeSuggestion, MealType, PendingAction, Conversation } from '../../../lib/types';
import { DAYS_SHORT, MEAL_TYPES } from '../../../lib/constants';
import { Colors } from '../../../lib/theme';
import { getMondayOf, isoDate, getISOWeek } from '../../../lib/dateUtils';
import axios from 'axios';

const GREEN = Colors.cyanDark;
const GREEN_LIGHT = Colors.cyanSoft;
const BORDER = Colors.line;

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hallo! Ich bin dein KI-Assistent für die Mahlzeitenplanung. Ich kann Rezepte vorschlagen, Fragen zu Ernährung beantworten, Mahlzeiten planen und deine Einkaufsliste verwalten. Wie kann ich dir helfen?',
};

interface DisplayMessage {
  message: ChatMessage;
  suggestions?: RecipeSuggestion[];
  pendingActions?: PendingAction[];
  confirmedActions?: Set<number>;
}

interface SlotPickerState {
  suggestionIndex: number;
  dayIndex: number | null;
  mealType: MealType | null;
  added: boolean;
}

export default function AiChatScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isUltraWide = width >= 2560;
  const router = useRouter();
  const { prompt: initialPrompt, conversationId: initialConversationId } = useLocalSearchParams<{ prompt?: string; conversationId?: string }>();
  const consumedInitialParams = useRef(false);

  const [activeConvId, setActiveConvId] = useState<number | null>(
    initialConversationId ? Number(initialConversationId) : null
  );
  const [loadingConv, setLoadingConv] = useState(!!initialConversationId);

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([{ message: WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [slotPickers, setSlotPickers] = useState<Record<string, SlotPickerState>>({});
  const [confirmedActions, setConfirmedActions] = useState<Record<string, Set<number>>>({});
  const [weekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const handleSendRef = useRef<() => void>(() => {});

  // Keep ref current after every render (no stale closure in the keyboard effect)
  useEffect(() => { handleSendRef.current = handleSend; });

  // Ctrl+Enter on web — no focus tracking needed; handleSend guards against empty input
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Arrived from KAI-Modus home with a pre-filled prompt (e.g. a quick task) — send it once.
  useEffect(() => {
    if (consumedInitialParams.current || !initialPrompt) return;
    consumedInitialParams.current = true;
    setInput(initialPrompt);
    setTimeout(() => handleSendRef.current(), 0);
  }, [initialPrompt]);

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const chatMutation = useAiChat();
  const { data: conversations = [], refetch: refetchConversations } = useConversations();
  const { data: convMessages, isLoading: convMessagesLoading } = useConversationMessages(activeConvId);

  useEffect(() => {
    if (!loadingConv || convMessagesLoading) return;
    if (convMessages && convMessages.length > 0) {
      setDisplayMessages([
        { message: WELCOME_MESSAGE },
        ...convMessages.map(m => ({ message: { role: m.role, content: m.content } })),
      ]);
    } else {
      setDisplayMessages([{ message: WELCOME_MESSAGE }]);
    }
    setLoadingConv(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [convMessages, convMessagesLoading, loadingConv]);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const { data: allPlans } = useMealPlans();
  const { data: users = [] } = useUsers();
  const createPlan = useCreateMealPlan();
  const addEntry = useAddEntry();
  const deleteEntryMut = useDeleteEntry();
  const generateList = useGenerateShoppingList();
  const addShoppingItem = useAddShoppingItem();

  const currentPlan = allPlans?.find(p => p.week_start_date === weekStartIso);

  const buildHistory = (): ChatMessage[] => displayMessages.slice(1).map(dm => dm.message);

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
        conversation_id: activeConvId,
      });

      // Update active conversation id
      if (result.conversation_id && !activeConvId) {
        setActiveConvId(result.conversation_id);
        refetchConversations();
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.reply };
      const msgKey = String(Date.now());
      setDisplayMessages(prev => [
        ...prev,
        { message: assistantMsg, suggestions: result.recipe_suggestions, pendingActions: result.pending_actions, confirmedActions: new Set() },
      ]);
      setConfirmedActions(prev => ({ ...prev, [msgKey]: new Set() }));

      // Auto-speak reply if TTS is available (mobile only)
      if (Platform.OS !== 'web' && result.reply) {
        speakText(result.reply);
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const detail = axios.isAxiosError(err) && err.response?.data?.detail
        ? String(err.response.data.detail)
        : 'KI-Antwort konnte nicht geladen werden.';
      showAlert('Fehler', detail);
      setDisplayMessages(prev => prev.slice(0, -1));
      setInput(text);
    }
  };

  const speakText = async (text: string) => {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Speech = require('expo-speech');
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) await Speech.stop();
      setIsSpeaking(true);
      Speech.speak(text, {
        language: 'de-DE',
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Speech = require('expo-speech');
      Speech.stop();
    } catch { /* ignore */ }
    setIsSpeaking(false);
  };

  // Recipe suggestion slot picker helpers
  const pickerKey = (msgIndex: number, sugIndex: number) => `${msgIndex}-${sugIndex}`;

  const toggleDayPicker = (msgIndex: number, sugIndex: number) => {
    const key = pickerKey(msgIndex, sugIndex);
    setSlotPickers(prev => {
      if (prev[key]) { const { [key]: _, ...rest } = prev; return rest; }
      return { ...prev, [key]: { suggestionIndex: sugIndex, dayIndex: null, mealType: null, added: false } };
    });
  };

  const selectDay = (key: string, dayIndex: number) => setSlotPickers(prev => ({ ...prev, [key]: { ...prev[key], dayIndex, added: false } }));
  const selectMealType = (key: string, mt: MealType) => setSlotPickers(prev => ({ ...prev, [key]: { ...prev[key], mealType: mt, added: false } }));

  const handleAddToMealPlan = async (key: string, suggestion: RecipeSuggestion, dayIndex: number, mealType: MealType) => {
    try {
      let planId = currentPlan?.id;
      if (!planId) {
        const newPlan = await createPlan.mutateAsync({ name: `KW ${weekNum} ${year}`, week_start_date: weekStartIso });
        planId = newPlan.id;
      }
      await addEntry.mutateAsync({
        planId, day_of_week: dayIndex, meal_type: mealType,
        recipe_id: suggestion.recipe_id ?? null,
        custom_meal: suggestion.recipe_id ? null : suggestion.recipe_name,
        assigned_user_ids: users.map(u => u.id),
      });
      setSlotPickers(prev => ({ ...prev, [key]: { ...prev[key], added: true } }));
    } catch {
      showAlert('Fehler', 'Eintrag konnte nicht zum Wochenplan hinzugefügt werden.');
    }
  };

  // Resolve or create a meal plan for the given week_start_date.
  // Returns the plan id. Kept outside executeAction so "Alle bestätigen"
  // can reuse the same plan across multiple sequential adds.
  const resolveOrCreatePlan = async (targetWeekStart: string): Promise<number> => {
    const existing = allPlans?.find(p => p.week_start_date === targetWeekStart);
    if (existing) return existing.id;
    const targetDate = new Date(targetWeekStart);
    const targetWeekNum = getISOWeek(targetDate);
    const targetYear = targetDate.getFullYear();
    const newPlan = await createPlan.mutateAsync({
      name: `KW ${targetWeekNum} ${targetYear}`,
      week_start_date: targetWeekStart,
    });
    return newPlan.id;
  };

  // Pending action execution
  const executeAction = async (
    msgIndex: number,
    actionIndex: number,
    action: PendingAction,
    overridePlanId?: number,
  ) => {
    try {
      switch (action.type) {
        case 'add_meal_plan_entry': {
          const d = action.data;
          const targetWeekStart = (d.week_start_date as string | undefined) || weekStartIso;
          const planId = overridePlanId ?? await resolveOrCreatePlan(targetWeekStart);
          // Normalize meal_type: AI sometimes sends German names instead of English enum values
          const MEAL_TYPE_NORM: Record<string, MealType> = {
            frühstück: 'breakfast', breakfast: 'breakfast',
            mittagessen: 'lunch', lunch: 'lunch',
            snack: 'snack',
            abendessen: 'dinner', dinner: 'dinner',
            dessert: 'dessert',
          };
          const rawMealType = String(d.meal_type ?? '').toLowerCase();
          const mealType: MealType = MEAL_TYPE_NORM[rawMealType] ?? d.meal_type as MealType;
          await addEntry.mutateAsync({
            planId,
            day_of_week: Number(d.day_of_week),
            meal_type: mealType,
            recipe_id: d.recipe_id as number | null ?? null,
            custom_meal: d.custom_meal as string | null ?? null,
            assigned_user_ids: (d.assigned_user_ids as number[]) ?? users.map(u => u.id),
          });
          break;
        }
        case 'delete_meal_plan_entry': {
          if (currentPlan) {
            await deleteEntryMut.mutateAsync({ planId: currentPlan.id, entryId: Number(action.data.entry_id) });
          }
          break;
        }
        case 'generate_shopping_list': {
          await generateList.mutateAsync({
            date_from: action.data.date_from as string,
            date_to: action.data.date_to as string,
            merge: false,
          });
          break;
        }
        case 'add_shopping_item': {
          await addShoppingItem.mutateAsync({
            name: action.data.name as string,
            amount: action.data.amount as number | null ?? null,
            unit: action.data.unit as string | null ?? null,
          });
          break;
        }
        default:
          showAlert('Info', `Aktion "${action.type}" muss manuell ausgeführt werden.`);
          return;
      }
      // Mark action as confirmed
      setDisplayMessages(prev => prev.map((dm, i) => {
        if (i !== msgIndex) return dm;
        const newConfirmed = new Set(dm.confirmedActions ?? []);
        newConfirmed.add(actionIndex);
        return { ...dm, confirmedActions: newConfirmed };
      }));
    } catch (err) {
      const detail = axios.isAxiosError(err) && err.response?.data?.detail
        ? String(err.response.data.detail)
        : err instanceof Error ? err.message : 'Aktion konnte nicht ausgeführt werden.';
      showAlert('Fehler', detail);
    }
  };

  // Conversation management
  const handleNewConversation = () => {
    setActiveConvId(null);
    setLoadingConv(false);
    setDisplayMessages([{ message: WELCOME_MESSAGE }]);
    setInput('');
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setLoadingConv(true);
    setDisplayMessages([{ message: WELCOME_MESSAGE }]);
    setInput('');
  };

  const handleDeleteConversation = (convId: number) => {
    showAlert('Konversation löschen', 'Diese Konversation wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: () => {
          deleteConversation.mutate(convId, {
            onSuccess: () => {
              if (activeConvId === convId) handleNewConversation();
              refetchConversations();
            },
          });
        },
      },
    ]);
  };

  const convListContent = (
    <>
      <TouchableOpacity style={styles.newConvRow} onPress={handleNewConversation}>
        <Text style={styles.newConvRowText}>+ Neue Konversation</Text>
      </TouchableOpacity>
      <ScrollView>
        {conversations.length === 0 ? (
          <Text style={styles.convEmpty}>Keine gespeicherten Konversationen</Text>
        ) : (
          conversations.map(conv => (
            <View key={conv.id} style={[styles.convRow, activeConvId === conv.id && styles.convRowActive]}>
              <TouchableOpacity style={styles.convRowContent} onPress={() => handleSelectConversation(conv)}>
                <Text style={[styles.convTitle, activeConvId === conv.id && styles.convTitleActive]} numberOfLines={2}>
                  {conv.title ?? 'Unbenannte Konversation'}
                </Text>
                <Text style={styles.convMeta}>{conv.message_count} Nachrichten · {new Date(conv.updated_at).toLocaleDateString('de-DE')}</Text>
              </TouchableOpacity>
              <Tooltip label="Konversation löschen" position="left">
                <TouchableOpacity onPress={() => handleDeleteConversation(conv.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.convDelete}>🗑</Text>
                </TouchableOpacity>
              </Tooltip>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={isUltraWide ? styles.ultraWideContainer : styles.outerContainer}>
        {/* Permanent sidebar on ultra-wide screens */}
        {isUltraWide && (
          <View style={styles.convSidebar}>
            <View style={styles.convSidebarHeader}>
              <Text style={styles.convModalTitle}>Verlauf</Text>
            </View>
            {convListContent}
          </View>
        )}

      <View style={[styles.inner, !isUltraWide && isWide && styles.innerWide]}>
        {/* Conversation header */}
        <View style={styles.convHeader}>
          <TouchableOpacity style={styles.convListBtn} onPress={() => router.push('/kai')}>
            <Text style={styles.convListBtnText}>‹ KAI</Text>
          </TouchableOpacity>
          <Text style={styles.weekBannerText}>KW {weekNum}, {year}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!isUltraWide && (
              <TouchableOpacity style={styles.convListBtn} onPress={() => router.push('/kai/history')}>
                <Text style={styles.convListBtnText}>☰ Verlauf</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.newConvBtn} onPress={handleNewConversation}>
              <Text style={styles.newConvBtnText}>+ Neu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat messages */}
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
                <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{dm.message.content}</Text>
                  </View>
                  {!isUser && Platform.OS !== 'web' && (
                    <Tooltip label={isSpeaking ? 'Vorlesen stoppen' : 'Vorlesen'} position="left">
                      <TouchableOpacity
                        style={styles.speakBtn}
                        onPress={() => isSpeaking ? stopSpeaking() : speakText(dm.message.content)}
                      >
                        <Text style={styles.speakBtnText}>{isSpeaking ? '⏹' : '🔊'}</Text>
                      </TouchableOpacity>
                    </Tooltip>
                  )}
                </View>

                {/* Recipe suggestions */}
                {dm.suggestions && dm.suggestions.length > 0 && (
                  <View style={styles.suggestionsBlock}>
                    {dm.suggestions.map((suggestion, sugIndex) => {
                      const key = pickerKey(msgIndex, sugIndex);
                      const picker = slotPickers[key];
                      const canAdd = picker && picker.dayIndex !== null && picker.mealType !== null;
                      return (
                        <View key={sugIndex} style={styles.suggestionCard}>
                          <Text style={styles.suggestionName} numberOfLines={1}>🍽 {suggestion.recipe_name}{suggestion.is_new_recipe ? '  ✨' : ''}</Text>
                          <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                          {!picker?.added ? (
                            <TouchableOpacity style={styles.addToPlanBtn} onPress={() => toggleDayPicker(msgIndex, sugIndex)}>
                              <Text style={styles.addToPlanBtnText}>{picker ? '▲ Abbrechen' : '+ Zum Wochenplan'}</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.addedConfirmText}>✓ Hinzugefügt</Text>
                          )}
                          {picker && !picker.added && (
                            <View style={styles.pickerBlock}>
                              <Text style={styles.pickerLabel}>Tag</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.pickerChipRow}>
                                  {DAYS_SHORT.map((day, di) => (
                                    <TouchableOpacity key={di} style={[styles.pickerChip, picker.dayIndex === di && styles.pickerChipSelected]} onPress={() => selectDay(key, di)}>
                                      <Text style={[styles.pickerChipText, picker.dayIndex === di && styles.pickerChipTextSelected]}>{day}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </ScrollView>
                              <Text style={[styles.pickerLabel, { marginTop: 8 }]}>Mahlzeit</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.pickerChipRow}>
                                  {MEAL_TYPES.map(({ key: mt, label, icon }) => (
                                    <TouchableOpacity key={mt} style={[styles.pickerChip, picker.mealType === mt && styles.pickerChipSelected]} onPress={() => selectMealType(key, mt)}>
                                      <Text style={[styles.pickerChipText, picker.mealType === mt && styles.pickerChipTextSelected]}>{icon} {label}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </ScrollView>
                              <TouchableOpacity
                                style={[styles.confirmAddBtn, !canAdd && styles.confirmAddBtnDisabled]}
                                disabled={!canAdd}
                                onPress={() => canAdd && handleAddToMealPlan(key, suggestion, picker.dayIndex!, picker.mealType!)}
                              >
                                <Text style={styles.confirmAddBtnText}>
                                  {picker.dayIndex !== null && picker.mealType
                                    ? `${DAYS_SHORT[picker.dayIndex]} – ${MEAL_TYPES.find(m => m.key === picker.mealType)?.label} eintragen`
                                    : 'Tag und Mahlzeit auswählen'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Pending actions */}
                {dm.pendingActions && dm.pendingActions.length > 0 && (
                  <View style={styles.actionsBlock}>
                    <View style={styles.actionsTitleRow}>
                      <Text style={styles.actionsTitle}>Vorgeschlagene Aktionen</Text>
                      {dm.pendingActions.length > 1 &&
                        dm.pendingActions.some((_, i) => !dm.confirmedActions?.has(i)) && (
                        <TouchableOpacity
                          style={styles.confirmAllBtn}
                          onPress={async () => {
                            try {
                              const planIdCache: Record<string, number> = {};
                              let count = 0;
                              for (let i = 0; i < dm.pendingActions!.length; i++) {
                                if (dm.confirmedActions?.has(i)) continue;
                                const a = dm.pendingActions![i];
                                let overridePlanId: number | undefined;
                                if (a.type === 'add_meal_plan_entry') {
                                  const ws = (a.data.week_start_date as string | undefined) || weekStartIso;
                                  if (!planIdCache[ws]) {
                                    planIdCache[ws] = await resolveOrCreatePlan(ws);
                                  }
                                  overridePlanId = planIdCache[ws];
                                }
                                await executeAction(msgIndex, i, a, overridePlanId);
                                count++;
                              }
                              if (count > 0) {
                                const weeks = Object.keys(planIdCache);
                                const weekHint = weeks.length > 0
                                  ? `\n\nBitte im Wochenplan zur richtigen Woche navigieren (${weeks.map(w => {
                                      const d = new Date(w);
                                      return `KW ${getISOWeek(d)} ${d.getFullYear()}`;
                                    }).join(', ')}).`
                                  : '';
                                showAlert('Fertig', `${count} Aktion${count !== 1 ? 'en' : ''} ausgeführt.${weekHint}`);
                              }
                            } catch (err) {
                              const detail = axios.isAxiosError(err) && err.response?.data?.detail
                                ? String(err.response.data.detail)
                                : err instanceof Error ? err.message : 'Fehler beim Ausführen der Aktionen.';
                              showAlert('Fehler', detail);
                            }
                          }}
                        >
                          <Text style={styles.confirmAllBtnText}>
                            ✓ Alle bestätigen ({dm.pendingActions.filter((_, i) => !dm.confirmedActions?.has(i)).length})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {dm.pendingActions.map((action, actionIndex) => {
                      const confirmed = dm.confirmedActions?.has(actionIndex);
                      return (
                        <View key={actionIndex} style={[styles.actionCard, confirmed && styles.actionCardConfirmed]}>
                          <Text style={styles.actionDescription}>{action.description}</Text>
                          {confirmed ? (
                            <Text style={styles.actionConfirmedText}>✓ Ausgeführt</Text>
                          ) : (
                            <TouchableOpacity
                              style={styles.actionConfirmBtn}
                              onPress={() => executeAction(msgIndex, actionIndex, action)}
                            >
                              <Text style={styles.actionConfirmBtnText}>Bestätigen</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {chatMutation.isPending && (
            <View style={styles.bubbleWrapper}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleLoading]}>
                <ActivityIndicator size="small" color={GREEN} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
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
            {Platform.OS === 'web' && <Text style={styles.sendBtnHint}>Strg+↵</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
  outerContainer: { flex: 1 },
  ultraWideContainer: { flex: 1, flexDirection: 'row' },
  convSidebar: { width: 300, borderRightWidth: 1, borderRightColor: BORDER, backgroundColor: '#fff', flexShrink: 0 },
  convSidebarHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  inner: { flex: 1 },
  innerWide: { maxWidth: 800, alignSelf: 'center', width: '100%' },

  convHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  convListBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  convListBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },
  weekBannerText: { fontSize: 12, color: GREEN, fontWeight: '600' },
  newConvBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  newConvBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },

  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 4 },

  bubbleWrapper: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 6 },
  bubbleWrapperUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAssistant: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  bubbleUser: { backgroundColor: GREEN },
  bubbleLoading: { paddingVertical: 14, paddingHorizontal: 20 },
  bubbleText: { fontSize: 15, color: Colors.ink, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  speakBtn: { padding: 4 },
  speakBtnText: { fontSize: 18 },

  suggestionsBlock: { gap: 8, marginBottom: 8, marginLeft: 8 },
  suggestionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, maxWidth: '90%' },
  suggestionName: { fontSize: 15, fontWeight: '700', color: Colors.ink, marginBottom: 4 },
  suggestionReason: { fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 18 },
  addToPlanBtn: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'flex-start' },
  addToPlanBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },
  addedConfirmText: { fontSize: 13, color: GREEN, fontWeight: '600', paddingVertical: 7 },
  pickerBlock: { marginTop: 10, padding: 10, backgroundColor: Colors.paper, borderRadius: 8, gap: 4 },
  pickerLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 },
  pickerChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
  pickerChip: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  pickerChipSelected: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  pickerChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  pickerChipTextSelected: { color: GREEN, fontWeight: '700' },
  confirmAddBtn: { marginTop: 10, backgroundColor: GREEN, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  confirmAddBtnDisabled: { backgroundColor: '#A5D6A7' },
  confirmAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  actionsBlock: { marginLeft: 8, marginBottom: 8, gap: 6, maxWidth: '90%' },
  actionsTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  actionsTitle: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 },
  confirmAllBtn: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  confirmAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, gap: 8 },
  actionCardConfirmed: { backgroundColor: Colors.cyanSoft, borderColor: GREEN },
  actionDescription: { fontSize: 14, color: Colors.ink, lineHeight: 20 },
  actionConfirmBtn: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionConfirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionConfirmedText: { fontSize: 13, color: GREEN, fontWeight: '600' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: BORDER },
  inputField: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#FAFAFA', maxHeight: 120 },
  sendBtn: { backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#A5D6A7' },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sendBtnHint: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500', marginTop: 1 },

  convModal: { flex: 1, backgroundColor: '#fff', maxHeight: '90%' },
  convModalWide: { maxWidth: 480, alignSelf: 'center', width: '100%' },
  convModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  convModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.ink },
  convModalClose: { fontSize: 16, color: GREEN, fontWeight: '600' },
  newConvRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  newConvRowText: { fontSize: 15, color: GREEN, fontWeight: '600' },
  convEmpty: { textAlign: 'center', color: '#AAA', marginTop: 32, fontSize: 14 },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  convRowActive: { backgroundColor: GREEN_LIGHT },
  convRowContent: { flex: 1 },
  convTitle: { fontSize: 15, fontWeight: '600', color: Colors.ink },
  convTitleActive: { color: GREEN },
  convMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  convDelete: { fontSize: 18, paddingLeft: 12 },
});
