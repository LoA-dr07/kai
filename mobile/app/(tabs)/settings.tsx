import React, { useState, useEffect } from 'react';
import { ErrorScreen } from '../../components/ErrorScreen';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useHousehold, useUpdateHouseholdSettings } from '../../lib/hooks/useHousehold';
import {
  useUsers,
  useUpdateUserPreferences,
  useUpdateUser,
  useDeleteUser,
  useCreateUser,
} from '../../lib/hooks/useUsers';
import { useStartPowerSync, useStopPowerSync } from '../../lib/hooks/usePowerSyncAdmin';
import { showAlert, showConfirm } from '../../lib/alert';
import type { HouseholdSettings, UserPreferences, User } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';
import { Colors } from '../../lib/theme';

const GREEN = Colors.green;
const LIGHT_GREEN = Colors.greenLight;
const BORDER = Colors.border;
const BG = Colors.bg;
const RED = Colors.red;

const AVATAR_COLORS = [
  '#1565C0',
  '#6A1B9A',
  '#E65100',
  '#2E7D32',
  '#C62828',
  '#00838F',
  '#4E342E',
  '#37474F',
];

const AVATAR_COLOR_NAMES: Record<string, string> = {
  '#1565C0': 'Blau',
  '#6A1B9A': 'Lila',
  '#E65100': 'Orange',
  '#2E7D32': 'Grün',
  '#C62828': 'Rot',
  '#00838F': 'Türkis',
  '#4E342E': 'Braun',
  '#37474F': 'Anthrazit',
};

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
  notes: '',
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
  selected = [],
  onChange,
}: {
  options: { key: string; label: string }[];
  selected?: string[];
  onChange: (keys: string[]) => void;
}) {
  const safeSelected = selected ?? [];
  const toggle = (key: string) => {
    if (safeSelected.includes(key)) {
      onChange(safeSelected.filter(k => k !== key));
    } else {
      onChange([...safeSelected, key]);
    }
  };
  return (
    <View style={styles.chipWrap}>
      {options.map(opt => {
        const active = safeSelected.includes(opt.key);
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
  // Guard against null/undefined from API
  const safeValues = Array.isArray(values) ? values : [];

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !safeValues.includes(trimmed)) {
      onChange([...safeValues, trimmed]);
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
          blurOnSubmit={false}
          returnKeyType="done"
        />
        <Tooltip label="Zutat hinzufügen">
          <TouchableOpacity style={styles.tagAddBtn} onPress={add}>
            <Text style={styles.tagAddBtnText}>+</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>
      <View style={styles.chipWrap}>
        {safeValues.map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.chip, styles.chipActive]}
            onPress={() => onChange(safeValues.filter(x => x !== v))}
          >
            <Text style={styles.chipTextActive}>{v} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <View style={styles.colorRow}>
      {AVATAR_COLORS.map(c => (
        <Tooltip key={c} label={AVATAR_COLOR_NAMES[c] ?? 'Farbe'}>
          <TouchableOpacity
            style={[styles.colorDot, { backgroundColor: c }, value === c && styles.colorDotActive]}
            onPress={() => onChange(c)}
          />
        </Tooltip>
      ))}
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

      <FieldLabel label="Notizen für die KI" />
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={form.notes ?? ''}
        onChangeText={v => set('notes', v)}
        placeholder="z. B. Wir kochen unter der Woche max. 30 Minuten, haben 2 kleine Kinder …"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
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

function MemberPreferencesForm({
  user,
  onDeleted,
}: {
  user: User;
  onDeleted: (userId: number) => void;
}) {
  const [form, setForm] = useState<UserPreferences>(
    user.preferences ?? DEFAULT_USER_PREFERENCES
  );
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editShortName, setEditShortName] = useState(user.short_name);
  const [editColor, setEditColor] = useState(user.avatar_color);

  const { mutate: savePrefs, isPending: savingPrefs } = useUpdateUserPreferences(user.id);
  const { mutate: updateUser, isPending: savingUser } = useUpdateUser(user.id);
  const { mutate: deleteUser, isPending: deleting } = useDeleteUser();

  useEffect(() => {
    setForm(user.preferences ?? DEFAULT_USER_PREFERENCES);
    setEditName(user.name);
    setEditShortName(user.short_name);
    setEditColor(user.avatar_color);
  }, [user]);

  const set = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const savePreferences = () => {
    savePrefs(form, {
      onSuccess: () => showAlert('Gespeichert', `Präferenzen für ${user.name} gespeichert.`),
      onError: () => showAlert('Fehler', 'Präferenzen konnten nicht gespeichert werden.'),
    });
  };

  const saveUserEdit = () => {
    const trimmedName = editName.trim();
    const trimmedShort = editShortName.trim();
    if (!trimmedName || !trimmedShort) {
      showAlert('Fehler', 'Name und Kürzel dürfen nicht leer sein.');
      return;
    }
    updateUser(
      { name: trimmedName, short_name: trimmedShort, avatar_color: editColor },
      {
        onSuccess: () => setEditMode(false),
        onError: () => showAlert('Fehler', 'Name konnte nicht gespeichert werden.'),
      }
    );
  };

  const handleDelete = () => {
    showConfirm(
      'Mitglied löschen',
      `${user.name} wirklich löschen? Alle zugehörigen Rezept-Tags werden ebenfalls entfernt.`,
      () => {
        deleteUser(user.id, {
          onSuccess: () => onDeleted(user.id),
          onError: () => showAlert('Fehler', 'Mitglied konnte nicht gelöscht werden.'),
        });
      }
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.memberHeader}>
        <View style={[styles.avatar, { backgroundColor: editMode ? editColor : user.avatar_color }]}>
          <Text style={styles.avatarText}>{editMode ? editShortName.toUpperCase().slice(0, 4) || '?' : user.short_name}</Text>
        </View>
        {editMode ? (
          <View style={styles.memberEditFields}>
            <TextInput
              style={[styles.input, styles.memberNameInput]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              maxLength={100}
            />
            <TextInput
              style={[styles.input, styles.memberShortInput]}
              value={editShortName}
              onChangeText={setEditShortName}
              placeholder="Kürzel"
              maxLength={4}
              autoCapitalize="characters"
            />
          </View>
        ) : (
          <Text style={styles.memberName}>{user.name}</Text>
        )}
        <View style={styles.memberActions}>
          {editMode ? (
            <>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnGreen]}
                onPress={saveUserEdit}
                disabled={savingUser}
              >
                {savingUser ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.iconBtnText}>✓</Text>
                )}
              </TouchableOpacity>
              <Tooltip label="Abbrechen" position="left">
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnGray]}
                  onPress={() => {
                    setEditMode(false);
                    setEditName(user.name);
                    setEditShortName(user.short_name);
                    setEditColor(user.avatar_color);
                  }}
                >
                  <Text style={styles.iconBtnText}>✕</Text>
                </TouchableOpacity>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip label="Name bearbeiten" position="left">
                <TouchableOpacity style={[styles.iconBtn, styles.iconBtnGray]} onPress={() => setEditMode(true)}>
                  <Text style={styles.iconBtnText}>✎</Text>
                </TouchableOpacity>
              </Tooltip>
              <Tooltip label="Mitglied löschen" position="left">
                <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={handleDelete} disabled={deleting}>
                  {deleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.iconBtnText}>🗑</Text>
                  )}
                </TouchableOpacity>
              </Tooltip>
            </>
          )}
        </View>
      </View>

      {/* Color picker in edit mode */}
      {editMode && (
        <View style={styles.colorPickerSection}>
          <FieldLabel label="Farbe" />
          <ColorPicker value={editColor} onChange={setEditColor} />
        </View>
      )}

      {/* Preferences */}
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

      <TouchableOpacity style={[styles.saveBtn, savingPrefs && styles.saveBtnDisabled]} onPress={savePreferences} disabled={savingPrefs}>
        {savingPrefs ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Präferenzen speichern</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Member Form ──────────────────────────────────────────────────────────

function AddMemberForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const { mutate: createUser, isPending } = useCreateUser();

  const handleNameChange = (value: string) => {
    setName(value);
    if (value.trim()) {
      setShortName(value.trim().slice(0, 2).toUpperCase());
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedShort = shortName.trim();
    if (!trimmedName || !trimmedShort) {
      showAlert('Fehler', 'Name und Kürzel dürfen nicht leer sein.');
      return;
    }
    createUser(
      { name: trimmedName, short_name: trimmedShort, avatar_color: color },
      {
        onSuccess: () => onClose(),
        onError: () => showAlert('Fehler', 'Mitglied konnte nicht hinzugefügt werden.'),
      }
    );
  };

  return (
    <View style={[styles.card, styles.addMemberCard]}>
      <SectionTitle title="Mitglied hinzufügen" />

      <View style={styles.memberHeader}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{shortName.slice(0, 4) || '?'}</Text>
        </View>
        <View style={styles.memberEditFields}>
          <TextInput
            style={[styles.input, styles.memberNameInput]}
            value={name}
            onChangeText={handleNameChange}
            placeholder="Name"
            maxLength={100}
            autoFocus
          />
          <TextInput
            style={[styles.input, styles.memberShortInput]}
            value={shortName}
            onChangeText={setShortName}
            placeholder="Kürzel"
            maxLength={4}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <FieldLabel label="Farbe" />
      <ColorPicker value={color} onChange={setColor} />

      <View style={styles.addMemberBtns}>
        <TouchableOpacity style={[styles.saveBtn, styles.saveBtnFlex, isPending && styles.saveBtnDisabled]} onPress={handleSave} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Hinzufügen</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, styles.saveBtnFlex, styles.cancelBtn]} onPress={onClose}>
          <Text style={styles.saveBtnText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── PowerSync Start/Stop ─────────────────────────────────────────────────────

function PowerSyncControlCard() {
  const { mutate: startPowerSync, isPending: isStarting } = useStartPowerSync();
  const { mutate: stopPowerSync, isPending: isStopping } = useStopPowerSync();

  const handleStart = () => {
    startPowerSync(undefined, {
      onSuccess: () =>
        showAlert(
          'PowerSync gestartet',
          'Der Neustart wurde angestoßen. Bis die Synchronisation aktiv ist, kann es noch etwas dauern.'
        ),
      onError: () =>
        showAlert('Fehler', 'PowerSync konnte nicht gestartet werden. Bitte Backend-Logs prüfen.'),
    });
  };

  const handleStop = () => {
    showConfirm(
      'PowerSync stoppen',
      'Die Synchronisation wird pausiert, um Datenbank-Nutzungszeit zu sparen. Beim nächsten App-Start wirst du gefragt, ob sie wieder gestartet werden soll (Biometrie-Bestätigung nötig).',
      () => {
        stopPowerSync(undefined, {
          onSuccess: () => showAlert('PowerSync gestoppt', 'Die Synchronisation ist pausiert.'),
          onError: () =>
            showAlert('Fehler', 'PowerSync konnte nicht gestoppt werden. Bitte Backend-Logs prüfen.'),
        });
      }
    );
  };

  return (
    <View style={[styles.card, { marginTop: 8 }]}>
      <Text style={[styles.sectionTitle, { fontSize: 14 }]}>PowerSync</Text>
      <Text style={styles.fieldLabel}>
        Startet oder stoppt die Synchronisation. Stoppen lässt die Datenbank schlafen legen; nach
        „Starten" verschwindet die Banner oben im Bildschirm, sobald die Verbindung tatsächlich steht.
      </Text>
      <View style={styles.powerSyncBtnRow}>
        <TouchableOpacity
          style={[styles.saveBtn, styles.saveBtnFlex, styles.startBtn, isStarting && styles.saveBtnDisabled]}
          onPress={handleStart}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>PowerSync starten</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, styles.saveBtnFlex, styles.stopBtn, isStopping && styles.saveBtnDisabled]}
          onPress={handleStop}
          disabled={isStopping}
        >
          {isStopping ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>PowerSync stoppen</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isUltraWide = width >= 2560;
  const { data: household, isLoading: loadingHousehold, error: errorHousehold } = useHousehold();
  const { data: users, isLoading: loadingUsers, error: errorUsers } = useUsers();
  const [showAddForm, setShowAddForm] = useState(false);

  if (loadingHousehold || loadingUsers) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (errorHousehold || errorUsers) {
    return (
      <View style={styles.center}>
        <ErrorScreen message="Einstellungen konnten nicht geladen werden." />
      </View>
    );
  }

  const settings: HouseholdSettings = household?.settings ?? DEFAULT_HOUSEHOLD_SETTINGS;

  const membersList = (
    <>
      <View style={styles.membersHeadingRow}>
        <Text style={styles.membersHeading}>Haushaltsmitglieder</Text>
        <Tooltip label="Mitglied hinzufügen" position="left">
          <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowAddForm(true)}>
            <Text style={styles.addMemberBtnText}>+</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>
      {(users ?? []).map(user => (
        <MemberPreferencesForm
          key={user.id}
          user={user}
          onDeleted={() => {}}
        />
      ))}
      {showAddForm && <AddMemberForm onClose={() => setShowAddForm(false)} />}
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isWide && styles.contentWide, isUltraWide && styles.contentUltraWide]}
      keyboardShouldPersistTaps="handled"
    >
      {isWide ? (
        <View style={styles.wideLayout}>
          <View style={styles.wideCol}>
            <HouseholdSettingsForm initialSettings={settings} />
          </View>
          <View style={styles.wideCol}>
            {membersList}
          </View>
        </View>
      ) : (
        <>
          <HouseholdSettingsForm initialSettings={settings} />
          {membersList}
        </>
      )}
      <View style={[styles.card, { marginTop: 8 }]}>
        <Text style={[styles.sectionTitle, { fontSize: 14 }]}>Verbindung</Text>
        {(() => {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
          const isHttps = apiUrl.startsWith('https://');
          const isEmpty = !apiUrl;
          return (
            <>
              <Text style={styles.fieldLabel}>API-URL (im Build eingebaut)</Text>
              <Text selectable style={[diagStyles.url, (!isHttps || isEmpty) && diagStyles.urlError]}>
                {isEmpty ? '← nicht gesetzt! Fallback: http://localhost:8000' : apiUrl}
                {!isEmpty && !isHttps ? '  ← kein https:// !' : ''}
              </Text>
            </>
          );
        })()}
        <Text style={styles.fieldLabel}>PowerSync-URL (im Build eingebaut)</Text>
        <Text selectable style={diagStyles.url}>
          {process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '← nicht gesetzt!'}
        </Text>
      </View>
      {Platform.OS !== 'web' && <PowerSyncControlCard />}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const diagStyles = StyleSheet.create({
  url: { fontSize: 12, color: '#444', fontFamily: 'monospace', marginTop: 4 },
  urlError: { color: '#C62828', fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  contentWide: { maxWidth: 960, alignSelf: 'center', width: '100%' },
  contentUltraWide: { maxWidth: 1600 },
  wideLayout: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
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

  membersHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  membersHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  addMemberBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberBtnText: { color: '#fff', fontSize: 22, lineHeight: 26 },

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
    paddingHorizontal: 10,
    height: 44,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  notesInput: {
    height: undefined,
    minHeight: 88,
    paddingVertical: 10,
  },

  // Tag input
  tagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'stretch' },
  tagInputField: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  tagAddBtn: {
    width: 44,
    height: 44,
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
  saveBtnFlex: { flex: 1 },
  cancelBtn: { backgroundColor: '#9E9E9E', marginLeft: 8 },
  powerSyncBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  startBtn: { backgroundColor: GREEN, marginTop: 0 },
  stopBtn: { backgroundColor: '#E65100', marginTop: 0 },

  // Member header
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  memberName: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1 },
  memberEditFields: { flex: 1, flexDirection: 'row', gap: 8 },
  memberNameInput: { flex: 1, marginTop: 0 },
  memberShortInput: { width: 70, marginTop: 0 },
  memberActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },

  // Icon buttons
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnGreen: { backgroundColor: GREEN },
  iconBtnGray: { backgroundColor: '#9E9E9E' },
  iconBtnRed: { backgroundColor: RED },
  iconBtnText: { color: '#fff', fontSize: 16 },

  // Color picker
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: { borderColor: '#333', transform: [{ scale: 1.2 }] },
  colorPickerSection: { marginBottom: 4 },

  // Add member
  addMemberCard: { borderWidth: 2, borderColor: GREEN },
  addMemberBtns: { flexDirection: 'row', marginTop: 20 },
});
