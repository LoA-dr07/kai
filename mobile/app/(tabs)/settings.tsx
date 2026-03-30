import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useHousehold, useUpdateHouseholdSettings } from '../../lib/hooks/useHousehold';
import { useUsers, useUpdateUserPreferences } from '../../lib/hooks/useUsers';
import { showAlert } from '../../lib/alert';
import type { HouseholdSettings, UserPreferences, User } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';

const GREEN = '#2E7D32';
const LIGHT_GREEN = '#E8F5E9';
const BORDER = '#E0E0E0';
const BG = '#F8F9FA';

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  cooking_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  hot_meal_time: 'dinner',
  cold_meal_days: [],
  leftovers_frequency: 'sometimes',
  shared_meals_importance: 3,
  weekly_budget: null,
  preferred_cuisines: [],
  cooking_skill_level: 'medium',
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  dietary_restrictions: [],
  allergies: [],
  disliked_ingredients: [],
  liked_cuisines: [],
  spice_tolerance: 'medium',
  portion_size: 'normal',
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { key: 'monday', label: 'Mo' },
  { key: 'tuesday', label: 'Di' },
  { key: 'wednesday', label: 'Mi' },
  { key: 'thursday', label: 'Do' },
  { key: 'friday', label: 'Fr' },
  { key: 'saturday', label: 'Sa' },
  { key: 'sunday', label: 'So' },
];

const CUISINES = [
  { key: 'german', label: 'Deutsch' },
  { key: 'italian', label: 'Italienisch' },
  { key: 'asian', label: 'Asiatisch' },
  { key: 'mexican', label: 'Mexikanisch' },
  { key: 'mediterranean', label: 'Mediterran' },
  { key: 'american', label: 'Amerikanisch' },
  { key: 'indian', label: 'Indisch' },
  { key: 'french', label: 'Französisch' },
];

const DIETARY_RESTRICTIONS = [
  { key: 'vegetarian', label: 'Vegetarisch' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'pescatarian', label: 'Pescetarisch' },
  { key: 'gluten_free', label: 'Glutenfrei' },
  { key: 'lactose_free', label: 'Laktosefrei' },
  { key: 'low_carb', label: 'Low Carb' },
  { key: 'halal', label: 'Halal' },
  { key: 'kosher', label: 'Koscher' },
];

const ALLERGIES = [
  { key: 'peanuts', label: 'Erdnüsse' },
  { key: 'tree_nuts', label: 'Baumnüsse' },
  { key: 'dairy', label: 'Milch' },
  { key: 'eggs', label: 'Eier' },
  { key: 'wheat', label: 'Weizen' },
  { key: 'shellfish', label: 'Schalentiere' },
  { key: 'fish', label: 'Fisch' },
  { key: 'soy', label: 'Soja' },
  { key: 'sesame', label: 'Sesam' },
];

// ─── Reusable sub-components ─────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.toggleBtn, value === opt.key && styles.toggleBtnActive]}
          onPress={() => onChange(opt.key)}
        >
          <Text style={[styles.toggleBtnText, value === opt.key && styles.toggleBtnTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CheckboxGrid({
  options,
  selected,
  onChange,
}: {
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };
  return (
    <View style={styles.chipWrap}>
      {options.map(opt => {
        const active = selected.includes(opt.key);
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(opt.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ImportanceScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View>
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.scaleBtn, value === n && styles.scaleBtnActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.scaleBtnText, value === n && styles.scaleBtnTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>Jeder isst selbst</Text>
        <Text style={styles.scaleLabel}>Immer gemeinsam</Text>
      </View>
    </View>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  return (
    <View>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInputField}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Tooltip label="Tag hinzufügen">
          <TouchableOpacity style={styles.tagAddBtn} onPress={add}>
            <Text style={styles.tagAddBtnText}>+</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>
      <View style={styles.chipWrap}>
        {values.map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.chip, styles.chipActive]}
            onPress={() => onChange(values.filter(x => x !== v))}
          >
            <Text style={styles.chipTextActive}>{v} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Household Settings Form ─────────────────────────────────────────────────

function HouseholdSettingsForm({ initialSettings }: { initialSettings: HouseholdSettings }) {
  const [form, setForm] = useState<HouseholdSettings>(initialSettings);
  const { mutate, isPending } = useUpdateHouseholdSettings();

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings]);

  const set = <K extends keyof HouseholdSettings>(key: K, value: HouseholdSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const save = () => {
    mutate(form, {
      onSuccess: () => showAlert('Gespeichert', 'Haushaltseinstellungen wurden gespeichert.'),
      onError: () => showAlert('Fehler', 'Einstellungen konnten nicht gespeichert werden.'),
    });
  };

  return (
    <View style={styles.card}>
      <SectionTitle title="Haushalt" />

      <FieldLabel label="Kochtage" />
      <CheckboxGrid options={WEEKDAYS} selected={form.cooking_days} onChange={v => set('cooking_days', v)} />

      <FieldLabel label="Warme Mahlzeit" />
      <ToggleGroup
        options={[
          { key: 'lunch', label: 'Mittags' },
          { key: 'dinner', label: 'Abends' },
          { key: 'both', label: 'Beides' },
        ]}
        value={form.hot_meal_time}
        onChange={v => set('hot_meal_time', v)}
      />

      <FieldLabel label="Tage mit kalten Mahlzeiten" />
      <CheckboxGrid options={WEEKDAYS} selected={form.cold_meal_days} onChange={v => set('cold_meal_days', v)} />

      <FieldLabel label="Reste / zweite Portionen" />
      <ToggleGroup
        options={[
          { key: 'never', label: 'Nie' },
          { key: 'sometimes', label: 'Manchmal' },
          { key: 'often', label: 'Oft' },
        ]}
        value={form.leftovers_frequency}
        onChange={v => set('leftovers_frequency', v)}
      />

      <FieldLabel label="Gemeinsames Essen (wie wichtig?)" />
      <ImportanceScale value={form.shared_meals_importance} onChange={v => set('shared_meals_importance', v)} />

      <FieldLabel label="Kochkenntnisse" />
      <ToggleGroup
        options={[
          { key: 'beginner', label: 'Anfänger' },
          { key: 'medium', label: 'Mittel' },
          { key: 'advanced', label: 'Fortgeschritten' },
        ]}
        value={form.cooking_skill_level}
        onChange={v => set('cooking_skill_level', v)}
      />

      <FieldLabel label="Bevorzugte Küchen" />
      <CheckboxGrid options={CUISINES} selected={form.preferred_cuisines} onChange={v => set('preferred_cuisines', v)} />

      <FieldLabel label="Wochenbudget (€, optional)" />
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={form.weekly_budget != null ? String(form.weekly_budget) : ''}
        onChangeText={v => set('weekly_budget', v ? parseFloat(v) : null)}
        placeholder="z. B. 120"
      />

      <TouchableOpacity style={[styles.saveBtn, isPending && styles.saveBtnDisabled]} onPress={save} disabled={isPending}>
        {isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Speichern</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Member Preferences Form ─────────────────────────────────────────────────

function MemberPreferencesForm({ user }: { user: User }) {
  const [form, setForm] = useState<UserPreferences>(
    user.preferences ?? DEFAULT_USER_PREFERENCES
  );
  const { mutate, isPending } = useUpdateUserPreferences(user.id);

  useEffect(() => {
    setForm(user.preferences ?? DEFAULT_USER_PREFERENCES);
  }, [user]);

  const set = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const save = () => {
    mutate(form, {
      onSuccess: () => showAlert('Gespeichert', `Präferenzen für ${user.name} gespeichert.`),
      onError: () => showAlert('Fehler', 'Präferenzen konnten nicht gespeichert werden.'),
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.memberHeader}>
        <View style={[styles.avatar, { backgroundColor: user.avatar_color }]}>
          <Text style={styles.avatarText}>{user.short_name}</Text>
        </View>
        <Text style={styles.memberName}>{user.name}</Text>
      </View>

      <FieldLabel label="Ernährungsweise" />
      <CheckboxGrid
        options={DIETARY_RESTRICTIONS}
        selected={form.dietary_restrictions}
        onChange={v => set('dietary_restrictions', v)}
      />

      <FieldLabel label="Allergien" />
      <CheckboxGrid options={ALLERGIES} selected={form.allergies} onChange={v => set('allergies', v)} />

      <FieldLabel label="Ungemochte Zutaten" />
      <TagInput
        values={form.disliked_ingredients}
        onChange={v => set('disliked_ingredients', v)}
        placeholder="Zutat eingeben, dann Enter"
      />

      <FieldLabel label="Bevorzugte Küchen" />
      <CheckboxGrid options={CUISINES} selected={form.liked_cuisines} onChange={v => set('liked_cuisines', v)} />

      <FieldLabel label="Schärfeverträglichkeit" />
      <ToggleGroup
        options={[
          { key: 'mild', label: 'Mild' },
          { key: 'medium', label: 'Mittel' },
          { key: 'spicy', label: 'Scharf' },
        ]}
        value={form.spice_tolerance}
        onChange={v => set('spice_tolerance', v)}
      />

      <FieldLabel label="Portionsgröße" />
      <ToggleGroup
        options={[
          { key: 'small', label: 'Klein' },
          { key: 'normal', label: 'Normal' },
          { key: 'large', label: 'Groß' },
        ]}
        value={form.portion_size}
        onChange={v => set('portion_size', v)}
      />

      <TouchableOpacity style={[styles.saveBtn, isPending && styles.saveBtnDisabled]} onPress={save} disabled={isPending}>
        {isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Speichern</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { data: household, isLoading: loadingHousehold } = useHousehold();
  const { data: users, isLoading: loadingUsers } = useUsers();

  if (loadingHousehold || loadingUsers) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const settings: HouseholdSettings = household?.settings ?? DEFAULT_HOUSEHOLD_SETTINGS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
    >
      {isWide ? (
        <View style={styles.wideLayout}>
          <View style={styles.wideCol}>
            <HouseholdSettingsForm initialSettings={settings} />
          </View>
          <View style={styles.wideCol}>
            <Text style={styles.membersHeading}>Haushaltsmitglieder</Text>
            {(users ?? []).map(user => (
              <MemberPreferencesForm key={user.id} user={user} />
            ))}
          </View>
        </View>
      ) : (
        <>
          <HouseholdSettingsForm initialSettings={settings} />
          <Text style={styles.membersHeading}>Haushaltsmitglieder</Text>
          {(users ?? []).map(user => (
            <MemberPreferencesForm key={user.id} user={user} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  contentWide: { maxWidth: 960, alignSelf: 'center', width: '100%' },
  wideLayout: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  wideCol: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GREEN,
    marginBottom: 16,
  },

  membersHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 14,
    marginBottom: 6,
  },

  // Toggle group
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  toggleBtnText: { fontSize: 13, color: '#555' },
  toggleBtnTextActive: { color: '#fff', fontWeight: '600' },

  // Chip grid
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Importance scale
  scaleRow: { flexDirection: 'row', gap: 8 },
  scaleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scaleBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  scaleBtnText: { fontSize: 15, color: '#555' },
  scaleBtnTextActive: { color: '#fff', fontWeight: '700' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  scaleLabel: { fontSize: 11, color: '#999' },

  // Text input
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },

  // Tag input
  tagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tagInputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  tagAddBtn: {
    width: 42,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: { color: '#fff', fontSize: 22, lineHeight: 26 },

  // Save button
  saveBtn: {
    marginTop: 20,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Member header
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  memberName: { fontSize: 17, fontWeight: '700', color: '#333' },
});
