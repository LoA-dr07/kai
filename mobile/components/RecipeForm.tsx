import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { showAlert } from '../lib/alert';
import { useIngredients, useCreateIngredient, useTags, useCreateTag } from '../lib/hooks/useRecipes';
import type { RecipeCreatePayload, Tag } from '../lib/types';

export interface FormIngredient {
  key: string;
  ingredient_id: number;
  ingredient_name: string;
  amount: string;
  unit: string;
}

interface RecipeFormProps {
  initialName?: string;
  initialDescription?: string;
  initialServings?: number;
  initialPrepTime?: number | null;
  initialIngredients?: FormIngredient[];
  initialTagIds?: number[];
  onSubmit: (data: RecipeCreatePayload) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
}

export default function RecipeForm({
  initialName = '',
  initialDescription = '',
  initialServings = 2,
  initialPrepTime = null,
  initialIngredients = [],
  initialTagIds = [],
  onSubmit,
  isSubmitting,
  submitLabel,
}: RecipeFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [servings, setServings] = useState(String(initialServings));
  const [prepTime, setPrepTime] = useState(initialPrepTime ? String(initialPrepTime) : '');
  const [formIngredients, setFormIngredients] = useState<FormIngredient[]>(initialIngredients);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialTagIds);
  const [newCustomTag, setNewCustomTag] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [newIngName, setNewIngName] = useState('');
  const [newIngAmount, setNewIngAmount] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('');
  const [selectedIngId, setSelectedIngId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: ingredients } = useIngredients();
  const createIngredient = useCreateIngredient();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();

  const suggestions =
    newIngName.length >= 1
      ? (ingredients ?? [])
          .filter(i => i.name.toLowerCase().includes(newIngName.toLowerCase()))
          .slice(0, 5)
      : [];

  function selectSuggestion(id: number, ingName: string) {
    setNewIngName(ingName);
    setSelectedIngId(id);
    setShowSuggestions(false);
  }

  function toggleTag(id: number) {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleAddCustomTag() {
    const trimmed = newCustomTag.trim();
    if (!trimmed) return;
    try {
      const tag = await createTag.mutateAsync(trimmed);
      setSelectedTagIds(prev => prev.includes(tag.id) ? prev : [...prev, tag.id]);
      setNewCustomTag('');
    } catch {
      showAlert('Fehler', 'Tag konnte nicht erstellt werden.');
    }
  }

  async function handleAddIngredient() {
    if (!newIngName.trim()) {
      showAlert('Fehlende Angabe', 'Bitte Zutatname eingeben.');
      return;
    }
    const amount = parseFloat(newIngAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      showAlert('Fehlende Angabe', 'Bitte eine gültige Menge eingeben.');
      return;
    }
    if (!newIngUnit.trim()) {
      showAlert('Fehlende Angabe', 'Bitte Einheit eingeben (z.B. g, ml, Stück).');
      return;
    }

    let ingId = selectedIngId;

    if (!ingId) {
      const exact = (ingredients ?? []).find(
        i => i.name.toLowerCase() === newIngName.trim().toLowerCase(),
      );
      if (exact) {
        ingId = exact.id;
      } else {
        try {
          const created = await createIngredient.mutateAsync(newIngName.trim());
          ingId = created.id;
        } catch {
          showAlert('Fehler', 'Zutat konnte nicht erstellt werden.');
          return;
        }
      }
    }

    setFormIngredients(prev => [
      ...prev,
      {
        key: `${ingId}_${Date.now()}`,
        ingredient_id: ingId!,
        ingredient_name: newIngName.trim(),
        amount: newIngAmount,
        unit: newIngUnit.trim(),
      },
    ]);
    setNewIngName('');
    setNewIngAmount('');
    setNewIngUnit('');
    setSelectedIngId(null);
    setShowSuggestions(false);
  }

  function removeIngredient(index: number) {
    setFormIngredients(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      showAlert('Fehlende Angabe', 'Bitte Rezeptname eingeben.');
      return;
    }
    const servingsNum = parseInt(servings, 10);
    if (isNaN(servingsNum) || servingsNum < 1) {
      showAlert('Fehlende Angabe', 'Bitte eine gültige Portionsanzahl eingeben.');
      return;
    }

    const payload: RecipeCreatePayload = {
      name: name.trim(),
      description: description.trim() || null,
      servings: servingsNum,
      prep_time_minutes: prepTime ? parseInt(prepTime, 10) : null,
      ingredients: formIngredients.map(ing => ({
        ingredient_id: ing.ingredient_id,
        amount: parseFloat(ing.amount.replace(',', '.')),
        unit: ing.unit,
      })),
      tag_ids: selectedTagIds,
    };

    await onSubmit(payload);
  }

  const renderIngredient = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<FormIngredient>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator activeScale={1.03}>
          <View style={[styles.ingRow, isActive && styles.ingRowActive]}>
            <TouchableOpacity onLongPress={drag} style={styles.dragHandle} hitSlop={8}>
              <Text style={styles.dragHandleText}>⠿</Text>
            </TouchableOpacity>
            <Text style={styles.ingName}>{item.ingredient_name}</Text>
            <Text style={styles.ingAmount}>
              {item.amount} {item.unit}
            </Text>
            <TouchableOpacity onPress={() => removeIngredient(index)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    },
    [],
  );

  const mealTypeTags = tags.filter(t => t.is_predefined && t.category === 'meal_type');
  const familyTags = tags.filter(t => t.is_predefined && t.category === 'family');
  const customTags = tags.filter(t => !t.is_predefined);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!isDragging}
    >
      {/* Basis-Infos */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rezept-Infos</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="z.B. Spaghetti Bolognese"
          maxLength={255}
        />

        <Text style={styles.label}>Beschreibung</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Kurze Beschreibung des Rezepts..."
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Portionen *</Text>
            <TextInput
              style={styles.input}
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
          <View style={styles.gap} />
          <View style={styles.flex1}>
            <Text style={styles.label}>Zubereitung (Min.)</Text>
            <TextInput
              style={styles.input}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
              placeholder="optional"
              maxLength={4}
            />
          </View>
        </View>
      </View>

      {/* Tags */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tags</Text>

        <Text style={styles.tagGroupLabel}>Mahlzeiten-Typ</Text>
        <View style={styles.tagRow}>
          {mealTypeTags.map(tag => {
            const selected = selectedTagIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                  {tag.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {familyTags.length > 0 && (
          <>
            <Text style={[styles.tagGroupLabel, { marginTop: 12 }]}>Familienmitglieder</Text>
            <View style={styles.tagRow}>
              {familyTags.map(tag => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.tagChip, styles.tagChipFamily, selected && styles.tagChipFamilySelected]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={[styles.tagChipText, styles.tagChipFamilyText, selected && styles.tagChipTextSelected]}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {customTags.length > 0 && (
          <>
            <Text style={[styles.tagGroupLabel, { marginTop: 12 }]}>Eigene Tags</Text>
            <View style={styles.tagRow}>
              {customTags.map(tag => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.tagChip, styles.tagChipCustom, selected && styles.tagChipCustomSelected]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={[styles.label, { marginTop: 12 }]}>Neuen Tag erstellen</Text>
        <View style={styles.customTagRow}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={newCustomTag}
            onChangeText={setNewCustomTag}
            placeholder="z.B. Vegetarisch, Schnell, …"
            returnKeyType="done"
            onSubmitEditing={handleAddCustomTag}
          />
          <TouchableOpacity
            style={[styles.addTagBtn, !newCustomTag.trim() && styles.addTagBtnDisabled]}
            onPress={handleAddCustomTag}
            disabled={!newCustomTag.trim() || createTag.isPending}
          >
            {createTag.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.addTagBtnText}>+</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Zutaten */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Zutaten</Text>

        {formIngredients.length === 0 ? (
          <Text style={styles.noIngredients}>Noch keine Zutaten hinzugefügt.</Text>
        ) : (
          <DraggableFlatList
            data={formIngredients}
            keyExtractor={item => item.key}
            renderItem={renderIngredient}
            onDragBegin={() => setIsDragging(true)}
            onDragEnd={({ data }) => { setFormIngredients(data); setIsDragging(false); }}
            scrollEnabled={false}
            activationDistance={5}
          />
        )}

        <View style={styles.addIngSection}>
          <Text style={styles.addIngLabel}>Zutat hinzufügen</Text>

          <View style={styles.suggestionsWrapper}>
            <TextInput
              style={styles.input}
              value={newIngName}
              onChangeText={text => {
                setNewIngName(text);
                setSelectedIngId(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Zutatname"
            />
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.dropdown}>
                {suggestions.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.dropdownItem}
                    onPress={() => selectSuggestion(s.id, s.name)}
                  >
                    <Text style={styles.dropdownText}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.row, styles.mt8]}>
            <View style={styles.flex1}>
              <TextInput
                style={styles.input}
                value={newIngAmount}
                onChangeText={setNewIngAmount}
                placeholder="Menge"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.gap} />
            <View style={styles.flex1}>
              <TextInput
                style={styles.input}
                value={newIngUnit}
                onChangeText={setNewIngUnit}
                placeholder="Einheit (g, ml, …)"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.addIngBtn}
            onPress={handleAddIngredient}
            disabled={createIngredient.isPending}
          >
            {createIngredient.isPending ? (
              <ActivityIndicator color="#2E7D32" />
            ) : (
              <Text style={styles.addIngBtnText}>+ Zutat hinzufügen</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Absenden */}
      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const GREEN = '#2E7D32';
const BORDER = '#DDD';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 48, maxWidth: 700, alignSelf: 'center', width: '100%' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    color: '#1A1A1A',
  },
  textArea: { height: 80 },
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  gap: { width: 12 },
  mt8: { marginTop: 8 },

  // Tags
  tagGroupLabel: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  tagChipSelected: { backgroundColor: GREEN },
  tagChipFamily: { borderColor: '#E65100' },
  tagChipFamilySelected: { backgroundColor: '#E65100', borderColor: '#E65100' },
  tagChipFamilyText: { color: '#E65100' },
  tagChipCustom: { borderColor: '#5C6BC0' },
  tagChipCustomSelected: { backgroundColor: '#5C6BC0', borderColor: '#5C6BC0' },
  tagChipText: { fontSize: 13, fontWeight: '600', color: GREEN },
  tagChipTextSelected: { color: '#fff' },
  customTagRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addTagBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagBtnDisabled: { backgroundColor: '#A5D6A7' },
  addTagBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 26 },

  // Ingredients
  noIngredients: { fontSize: 14, color: '#999', fontStyle: 'italic', marginBottom: 12 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  ingRowActive: {
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  dragHandle: { paddingHorizontal: 8, paddingVertical: 6 },
  dragHandleText: { fontSize: 18, color: '#BDBDBD' },
  ingName: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  ingAmount: { fontSize: 15, color: '#555', marginRight: 10 },
  removeBtn: { padding: 6 },
  removeBtnText: { color: '#D32F2F', fontSize: 16, fontWeight: '700' },
  addIngSection: { marginTop: 16 },
  addIngLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  suggestionsWrapper: { zIndex: 10 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 10,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownText: { fontSize: 15, color: '#1A1A1A' },
  addIngBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addIngBtnText: { color: GREEN, fontSize: 15, fontWeight: '600' },

  // Submit
  submitBtn: {
    backgroundColor: GREEN,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
