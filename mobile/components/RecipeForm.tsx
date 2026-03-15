import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useIngredients, useCreateIngredient } from '../lib/hooks/useRecipes';
import type { RecipeCreatePayload } from '../lib/types';

export interface FormIngredient {
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
  onSubmit,
  isSubmitting,
  submitLabel,
}: RecipeFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [servings, setServings] = useState(String(initialServings));
  const [prepTime, setPrepTime] = useState(initialPrepTime ? String(initialPrepTime) : '');
  const [formIngredients, setFormIngredients] = useState<FormIngredient[]>(initialIngredients);

  const [newIngName, setNewIngName] = useState('');
  const [newIngAmount, setNewIngAmount] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('');
  const [selectedIngId, setSelectedIngId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: ingredients } = useIngredients();
  const createIngredient = useCreateIngredient();

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
    };

    await onSubmit(payload);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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

      {/* Zutaten */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Zutaten</Text>

        {formIngredients.length === 0 ? (
          <Text style={styles.noIngredients}>Noch keine Zutaten hinzugefügt.</Text>
        ) : (
          formIngredients.map((ing, index) => (
            <View key={index} style={styles.ingRow}>
              <Text style={styles.ingName}>{ing.ingredient_name}</Text>
              <Text style={styles.ingAmount}>
                {ing.amount} {ing.unit}
              </Text>
              <TouchableOpacity onPress={() => removeIngredient(index)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.addIngSection}>
          <Text style={styles.addIngLabel}>Zutat hinzufügen</Text>

          {/* Name mit Autovervollständigung */}
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
    borderColor: '#DDD',
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
  noIngredients: { fontSize: 14, color: '#999', fontStyle: 'italic', marginBottom: 12 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
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
    borderColor: '#DDD',
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
    borderColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addIngBtnText: { color: '#2E7D32', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#2E7D32',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
