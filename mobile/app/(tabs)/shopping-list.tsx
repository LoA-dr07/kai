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

const GREEN = Colors.green;
const GREEN_LIGHT = Colors.greenLight;
const BORDER = Colors.border;

// --- Format quantity ---
function formatQty(item: ShoppingListItem): string {
  if (!item.amount && !item.unit) return '';
  const amt = item.amount ? (Number.isInteger(item.amount) ? String(item.amount) : item.amount.toFixed(1)) : '';
  return [amt, item.unit].filter(Boolean).join(' ');
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
  const [generateModalVisible, setGenerateModalVisible] = useState(false);

  const thisMonday = getMondayOf(new Date());
  const thisMondayIso = isoDate(thisMonday);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisSunday.getDate() + 6);
  const thisSundayIso = isoDate(thisSunday);
  const weekNum = getISOWeek(thisMonday);

  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);

  const [dateFrom, setDateFrom] = useState(thisMondayIso);
  const [dateTo, setDateTo] = useState(thisSundayIso);

  const uncheckedItems = list?.items.filter(i => !i.is_checked) ?? [];
  const checkedItems = list?.items.filter(i => i.is_checked) ?? [];

  const handleGenerate = async (merge: boolean) => {
    try {
      await generate.mutateAsync({ date_from: dateFrom, date_to: dateTo, merge });
      setGenerateModalVisible(false);
    } catch {
      showAlert('Fehler', 'Einkaufsliste konnte nicht erstellt werden.');
    }
  };

  const handleGeneratePress = () => {
    if (list && list.items.length > 0) {
      setGenerateModalVisible(true);
    } else {
      handleGenerate(false);
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
                <ItemRow
                  item={item}
                  onToggle={() => handleToggle(item)}
                  onDelete={() => handleDelete(item)}
                />
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
                    <ItemRow
                      item={item}
                      onToggle={() => handleToggle(item)}
                      onDelete={() => handleDelete(item)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add item modal */}
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

      {/* Generate modal – conflict resolution */}
      <Modal
        visible={generateModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setGenerateModalVisible(false)}
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
            <TouchableOpacity onPress={() => setGenerateModalVisible(false)}>
              <Text style={styles.conflictCancel}>Abbrechen</Text>
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
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

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
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
