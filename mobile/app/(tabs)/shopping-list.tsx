import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
import { showAlert, showConfirm } from '../../lib/alert';
import {
  useShoppingList,
  useGenerateShoppingList,
  useAddShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearDoneItems,
  useDeleteShoppingList,
} from '../../lib/hooks/useShoppingList';
import { Colors } from '../../lib/theme';
import { getMondayOf, isoDate, getISOWeek } from '../../lib/dateUtils';
import type { ShoppingListItem } from '../../lib/types';
import axios from 'axios';

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

// --- Helpers ---

function formatQty(item: ShoppingListItem): string {
  if (!item.amount && !item.unit) return '';
  const amt = item.amount ? (Number.isInteger(item.amount) ? String(item.amount) : item.amount.toFixed(1)) : '';
  return [amt, item.unit].filter(Boolean).join(' ');
}

function formatDateLabel(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// --- DateInput: native HTML date picker on web, text input on native ---
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          borderWidth: 1,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 15,
          backgroundColor: '#FAFAFA',
          color: '#1A1A1A',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          fontFamily: 'inherit',
        } as React.CSSProperties}
      />
    );
  }
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder="JJJJ-MM-TT"
      keyboardType="numbers-and-punctuation"
      maxLength={10}
    />
  );
}

// --- Single list item row ---
function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const qty = formatQty(item);
  return (
    <View style={[rowStyles.row, item.is_checked && rowStyles.rowChecked]}>
      <TouchableOpacity onPress={onToggle} style={rowStyles.checkBtn} activeOpacity={0.7}>
        <View style={[rowStyles.checkbox, item.is_checked && rowStyles.checkboxChecked]}>
          {item.is_checked && <Text style={rowStyles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <View style={rowStyles.nameBlock}>
        <Text style={[rowStyles.name, item.is_checked && rowStyles.nameChecked]} numberOfLines={1}>
          {item.name}
          {item.custom_meal_ref ? '  📝' : ''}
        </Text>
        {qty ? <Text style={rowStyles.qty}>{qty}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={rowStyles.deleteBtn}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

type Preset = 'this_week' | 'next_week' | 'today' | 'tomorrow' | 'custom';

// --- Main screen ---
export default function ShoppingListScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isUltraWide = width >= 2560;

  const { data: list, isLoading, refetch } = useShoppingList();
  const generate = useGenerateShoppingList();
  const addItem = useAddShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearDone = useClearDoneItems();
  const deleteList = useDeleteShoppingList();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');

  // Date picker modal
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset>('this_week');

  // Conflict modal (shown after date is confirmed, if list already has items)
  const [conflictVisible, setConflictVisible] = useState(false);

  // Compute preset date ranges (stable references via useMemo-equivalent inline)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = isoDate(tomorrow);

  const thisMonday = getMondayOf(today);
  const thisMondayIso = isoDate(thisMonday);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisSunday.getDate() + 6);
  const thisSundayIso = isoDate(thisSunday);

  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextMondayIso = isoDate(nextMonday);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);
  const nextSundayIso = isoDate(nextSunday);

  const PRESETS: { id: Preset; label: string; from: string; to: string }[] = [
    { id: 'today',     label: 'Heute',         from: todayIso,      to: todayIso },
    { id: 'tomorrow',  label: 'Morgen',         from: tomorrowIso,   to: tomorrowIso },
    { id: 'this_week', label: 'Diese Woche',    from: thisMondayIso, to: thisSundayIso },
    { id: 'next_week', label: 'Nächste Woche',  from: nextMondayIso, to: nextSundayIso },
    { id: 'custom',    label: 'Benutzerdefiniert', from: thisMondayIso, to: thisSundayIso },
  ];

  const [dateFrom, setDateFrom] = useState(thisMondayIso);
  const [dateTo, setDateTo] = useState(thisSundayIso);

  const uncheckedItems = list?.items.filter(i => !i.is_checked) ?? [];
  const checkedItems = list?.items.filter(i => i.is_checked) ?? [];

  // --- Handlers ---

  const handlePresetSelect = (preset: (typeof PRESETS)[number]) => {
    setSelectedPreset(preset.id);
    if (preset.id !== 'custom') {
      setDateFrom(preset.from);
      setDateTo(preset.to);
    }
  };

  const handleDatePickerConfirm = () => {
    setDatePickerVisible(false);
    if (list && list.items.length > 0) {
      setConflictVisible(true);
    } else {
      handleGenerate(false);
    }
  };

  const handleGeneratePress = () => {
    setSelectedPreset('this_week');
    setDateFrom(thisMondayIso);
    setDateTo(thisSundayIso);
    setDatePickerVisible(true);
  };

  const handleGenerate = async (merge: boolean) => {
    setConflictVisible(false);
    try {
      await generate.mutateAsync({ date_from: dateFrom, date_to: dateTo, merge });
    } catch (err) {
      const detail = axios.isAxiosError(err) && err.response?.data?.detail
        ? String(err.response.data.detail)
        : 'Einkaufsliste konnte nicht erstellt werden.';
      showAlert('Fehler', detail);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await addItem.mutateAsync({
        name: newItemName.trim(),
        amount: newItemAmount ? parseFloat(newItemAmount) : null,
        unit: newItemUnit.trim() || null,
      });
      setNewItemName('');
      setNewItemAmount('');
      setNewItemUnit('');
      setAddModalVisible(false);
    } catch {
      showAlert('Fehler', 'Artikel konnte nicht hinzugefügt werden.');
    }
  };

  const handleToggle = (item: ShoppingListItem) => {
    toggleItem.mutate({ id: item.id, is_checked: !item.is_checked });
  };

  const handleDelete = (item: ShoppingListItem) => {
    deleteItem.mutate(item.id);
  };

  const handleClearDone = () => {
    showConfirm('Erledigt löschen', 'Alle abgehakten Artikel wirklich entfernen?', () => {
      clearDone.mutate();
    });
  };

  const handleDeleteList = () => {
    showConfirm('Liste löschen', 'Gesamte Einkaufsliste wirklich löschen?', () => {
      deleteList.mutate();
    });
  };

  // --- Date range label for header button ---
  const dateRangeLabel = (() => {
    if (dateFrom === dateTo) return formatDateLabel(dateFrom);
    return `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`;
  })();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={handleGeneratePress}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>↻ Aus Wochenplan</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Artikel</Text>
          </TouchableOpacity>
        </View>
        {list && (
          <TouchableOpacity onPress={handleDeleteList} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.deleteListBtn}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={GREEN} size="large" />
      ) : !list || list.items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Keine Einkaufsliste</Text>
          <Text style={styles.emptySubtitle}>
            Tippe auf „Aus Wochenplan", um automatisch eine Liste zu erstellen, oder füge Artikel manuell hinzu.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, isWide && styles.listContentWide, isUltraWide && styles.listContentUltraWide]}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          {/* Unchecked items */}
          <View style={isUltraWide ? styles.itemsGrid : undefined}>
            {uncheckedItems.map(item => (
              <View key={item.id} style={isUltraWide ? styles.itemGridCell : undefined}>
                <ItemRow item={item} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item)} />
              </View>
            ))}
          </View>

          {/* Done section */}
          {checkedItems.length > 0 && (
            <View style={styles.doneSection}>
              <View style={styles.doneSectionHeader}>
                <Text style={styles.doneSectionTitle}>Erledigt ({checkedItems.length})</Text>
                <TouchableOpacity onPress={handleClearDone}>
                  <Text style={styles.clearDoneBtn}>Alle löschen</Text>
                </TouchableOpacity>
              </View>
              <View style={isUltraWide ? styles.itemsGrid : undefined}>
                {checkedItems.map(item => (
                  <View key={item.id} style={isUltraWide ? styles.itemGridCell : undefined}>
                    <ItemRow item={item} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item)} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Date range picker modal ── */}
      <Modal
        visible={datePickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.pickerCard, isWide && styles.pickerCardWide]}>
            <Text style={styles.pickerTitle}>Zeitraum wählen</Text>

            {/* Preset chips */}
            <View style={styles.presetRow}>
              {PRESETS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.presetChip, selectedPreset === p.id && styles.presetChipActive]}
                  onPress={() => handlePresetSelect(p)}
                >
                  <Text style={[styles.presetChipText, selectedPreset === p.id && styles.presetChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom date inputs */}
            {selectedPreset === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={styles.customDateField}>
                  <Text style={styles.inputLabel}>Von</Text>
                  <DateInput value={dateFrom} onChange={setDateFrom} />
                </View>
                <View style={styles.customDateSep} />
                <View style={styles.customDateField}>
                  <Text style={styles.inputLabel}>Bis</Text>
                  <DateInput value={dateTo} onChange={setDateTo} />
                </View>
              </View>
            )}

            {/* Selected range summary */}
            {selectedPreset !== 'custom' && (
              <Text style={styles.rangeSummary}>{dateRangeLabel}</Text>
            )}

            {/* Actions */}
            <View style={styles.pickerBtns}>
              <TouchableOpacity style={styles.pickerBtnCancel} onPress={() => setDatePickerVisible(false)}>
                <Text style={styles.pickerBtnCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerBtnConfirm, generate.isPending && styles.pickerBtnConfirmDisabled]}
                onPress={handleDatePickerConfirm}
                disabled={generate.isPending}
              >
                {generate.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.pickerBtnConfirmText}>Generieren</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Conflict modal ── */}
      <Modal
        visible={conflictVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConflictVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.conflictCard}>
            <Text style={styles.conflictTitle}>Aktive Liste vorhanden</Text>
            <Text style={styles.conflictBody}>
              Es gibt bereits eine aktive Einkaufsliste. Möchtest du sie überschreiben oder die neuen Artikel hinzufügen?
            </Text>
            <View style={styles.conflictBtns}>
              <TouchableOpacity
                style={[styles.conflictBtn, styles.conflictBtnOutline]}
                onPress={() => handleGenerate(true)}
              >
                <Text style={styles.conflictBtnOutlineText}>Zusammenführen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.conflictBtn, styles.conflictBtnFill]}
                onPress={() => handleGenerate(false)}
              >
                <Text style={styles.conflictBtnFillText}>Überschreiben</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setConflictVisible(false)}>
              <Text style={styles.conflictCancel}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add item modal ── */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={[styles.modal, isWide && styles.modalWide]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Artikel hinzufügen</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalClose}>Schließen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Milch"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Menge</Text>
                <TextInput
                  style={styles.input}
                  placeholder="z.B. 500"
                  value={newItemAmount}
                  onChangeText={setNewItemAmount}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Einheit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="z.B. g, ml, Stk"
                  value={newItemUnit}
                  onChangeText={setNewItemUnit}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, !newItemName.trim() && styles.saveBtnDisabled]}
              onPress={handleAddItem}
              disabled={!newItemName.trim() || addItem.isPending}
            >
              {addItem.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Hinzufügen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', gap: 8 },
  generateBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  deleteListBtn: { fontSize: 20 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  listContent: { padding: 12 },
  listContentWide: { maxWidth: 680, alignSelf: 'center', width: '100%' },
  listContentUltraWide: { maxWidth: 1400 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  itemGridCell: { width: '49.5%' },

  doneSection: { marginTop: 16 },
  doneSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  doneSectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearDoneBtn: { fontSize: 13, color: '#B71C1C', fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // Date picker card
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    gap: 16,
  },
  pickerCardWide: { maxWidth: 480 },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  presetChipActive: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  presetChipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  presetChipTextActive: { color: GREEN },

  customDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 0 },
  customDateField: { flex: 1 },
  customDateSep: { width: 12 },

  rangeSummary: { fontSize: 13, color: '#666', textAlign: 'center', fontWeight: '500' },

  pickerBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pickerBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  pickerBtnCancelText: { fontSize: 14, color: '#555', fontWeight: '600' },
  pickerBtnConfirm: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: GREEN,
  },
  pickerBtnConfirmDisabled: { backgroundColor: '#A5D6A7' },
  pickerBtnConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Conflict card
  conflictCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  conflictTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  conflictBody: { fontSize: 14, color: '#555', lineHeight: 20 },
  conflictBtns: { flexDirection: 'row', gap: 10 },
  conflictBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  conflictBtnOutline: { borderWidth: 1.5, borderColor: GREEN },
  conflictBtnFill: { backgroundColor: GREEN },
  conflictBtnOutlineText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  conflictBtnFillText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  conflictCancel: { textAlign: 'center', color: '#888', fontSize: 14, fontWeight: '500' },

  // Add-item modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalWide: { maxWidth: 560, alignSelf: 'center', width: '100%' },
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
  modalBody: { padding: 16, gap: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  inputRow: { flexDirection: 'row' },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: '#A5D6A7' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  rowChecked: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  checkBtn: { padding: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  nameBlock: { flex: 1 },
  name: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  nameChecked: { color: '#AAA', textDecorationLine: 'line-through' },
  qty: { fontSize: 12, color: '#888', marginTop: 1 },
  deleteBtn: { fontSize: 13, color: '#B71C1C', fontWeight: '700' },
});
