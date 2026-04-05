import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tooltip } from '../../components/Tooltip';
import {
  useBulkImportFromUrl,
  useBulkPreviewFromUrl,
  useCreateTag,
  useTags,
} from '../../lib/hooks/useRecipes';
import { useUsers } from '../../lib/hooks/useUsers';
import type { BulkUrlImportResult, RecipeUrlPreview, Tag, User } from '../../lib/types';
import { Colors } from '../../lib/theme';

const GREEN = Colors.green;
const BORDER = Colors.border;
const RED = '#D32F2F';

const RATING_LABELS: Record<number, string> = {
  0: 'Nie',
  1: 'Selten',
  2: 'Gelegentlich',
  3: 'Gerne',
  4: 'Häufig',
  5: 'Sehr häufig',
};

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'input' | 'configure' | 'results';

interface RecipeConfig {
  url: string;
  preview: RecipeUrlPreview;
  tagIds: number[];
  ratings: Record<number, number>; // user_id → stars (0 = not set)
}

interface PreviewFailure {
  url: string;
  error: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagSection({
  allTags,
  selectedIds,
  onToggle,
  onAddTag,
}: {
  allTags: Tag[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onAddTag: (name: string) => Promise<number>;
}) {
  const [newTagText, setNewTagText] = useState('');
  const [adding, setAdding] = useState(false);

  const mealTypeTags = allTags.filter(t => t.is_predefined && t.category === 'meal_type');
  const familyTags = allTags.filter(t => t.is_predefined && t.category === 'family');
  const customTags = allTags.filter(t => !t.is_predefined);

  async function handleAdd() {
    const name = newTagText.trim();
    if (!name) return;
    setAdding(true);
    try {
      const id = await onAddTag(name);
      onToggle(id);
      setNewTagText('');
    } finally {
      setAdding(false);
    }
  }

  function ChipRow({ tags, chipStyle, textStyle, selectedStyle }: {
    tags: Tag[];
    chipStyle?: object;
    textStyle?: object;
    selectedStyle?: object;
  }) {
    return (
      <View style={styles.tagRow}>
        {tags.map(tag => {
          const sel = selectedIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagChip, chipStyle, sel && (selectedStyle ?? styles.tagChipSelected)]}
              onPress={() => onToggle(tag.id)}
            >
              <Text style={[styles.tagChipText, textStyle, sel && styles.tagChipTextSelected]}>
                {tag.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      {mealTypeTags.length > 0 && (
        <>
          <Text style={styles.tagGroupLabel}>Mahlzeiten-Typ</Text>
          <ChipRow tags={mealTypeTags} />
        </>
      )}
      {familyTags.length > 0 && (
        <>
          <Text style={[styles.tagGroupLabel, { marginTop: 10 }]}>Familienmitglieder</Text>
          <ChipRow
            tags={familyTags}
            chipStyle={styles.tagChipFamily}
            textStyle={styles.tagChipFamilyText}
            selectedStyle={styles.tagChipFamilySelected}
          />
        </>
      )}
      {customTags.length > 0 && (
        <>
          <Text style={[styles.tagGroupLabel, { marginTop: 10 }]}>Eigene Tags</Text>
          <ChipRow
            tags={customTags}
            chipStyle={styles.tagChipCustom}
            selectedStyle={styles.tagChipCustomSelected}
          />
        </>
      )}
      <Text style={styles.newTagLabel}>Neuen Tag erstellen</Text>
      <View style={styles.newTagRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={newTagText}
          onChangeText={setNewTagText}
          placeholder="z.B. Vegetarisch, Schnell, …"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          style={[styles.addTagBtn, !newTagText.trim() && styles.addTagBtnDisabled]}
          onPress={handleAdd}
          disabled={!newTagText.trim() || adding}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.addTagBtnText}>+</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RatingSection({
  users,
  ratings,
  onRate,
}: {
  users: User[];
  ratings: Record<number, number>;
  onRate: (userId: number, stars: number) => void;
}) {
  return (
    <View>
      {users.map(user => {
        const stars = ratings[user.id] ?? 0;
        const label = stars > 0 ? RATING_LABELS[stars] : null;
        return (
          <View key={user.id} style={styles.starRow}>
            <View style={[styles.avatarBadge, { backgroundColor: user.avatar_color }]}>
              <Text style={styles.avatarText}>{user.short_name}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.starsWrapper}>
              <View style={styles.starsContainer}>
                <Tooltip label="Bewertung entfernen">
                  <TouchableOpacity
                    onPress={() => onRate(user.id, 0)}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={[styles.neverBtn, stars === 0 && styles.neverBtnActive]}>✕</Text>
                  </TouchableOpacity>
                </Tooltip>
                {[1, 2, 3, 4, 5].map(n => (
                  <Tooltip key={n} label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}>
                    <TouchableOpacity
                      onPress={() => onRate(user.id, n)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Text style={[styles.star, n <= stars && stars > 0 && styles.starFilled]}>
                        {n <= stars && stars > 0 ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  </Tooltip>
                ))}
              </View>
              {label !== null && <Text style={styles.ratingLabel}>{label}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BulkImportScreen() {
  const router = useRouter();
  const { data: allTags = [] } = useTags();
  const { data: users = [] } = useUsers();
  const bulkPreview = useBulkPreviewFromUrl();
  const bulkImport = useBulkImportFromUrl();
  const createTag = useCreateTag();

  // Step 1: URL input
  const [urls, setUrls] = useState<string[]>(['']);
  const [invalidIndices, setInvalidIndices] = useState<Set<number>>(new Set());
  const [inputError, setInputError] = useState<string | null>(null);

  // Step 2: per-recipe configuration
  const [configs, setConfigs] = useState<RecipeConfig[]>([]);
  const [previewErrors, setPreviewErrors] = useState<PreviewFailure[]>([]);

  // Step 3: results
  const [results, setResults] = useState<BulkUrlImportResult | null>(null);

  const step: Step = results ? 'results' : configs.length > 0 ? 'configure' : 'input';

  // ── URL input handlers ────────────────────────────────────────────────────

  function handleUrlChange(text: string, index: number) {
    const next = [...urls];
    next[index] = text;
    if (text !== '' && index === next.length - 1) next.push('');
    setUrls(next);
    if (invalidIndices.has(index)) {
      const s = new Set(invalidIndices);
      if (text.trim() === '' || isValidUrl(text.trim())) s.delete(index);
      setInvalidIndices(s);
    }
    if (inputError) setInputError(null);
  }

  function removeUrl(index: number) {
    const next = urls.filter((_, i) => i !== index);
    if (next.length === 0 || next[next.length - 1].trim() !== '') next.push('');
    setUrls(next);
    const s = new Set<number>();
    invalidIndices.forEach(i => { if (i !== index) s.add(i > index ? i - 1 : i); });
    setInvalidIndices(s);
  }

  async function handleLoadPreviews() {
    setInputError(null);
    const filled = urls
      .map((u, i) => ({ url: u.trim(), index: i }))
      .filter(x => x.url !== '');

    if (filled.length === 0) {
      setInputError('Bitte mindestens eine URL eingeben.');
      return;
    }
    const invalid = filled.filter(x => !isValidUrl(x.url));
    if (invalid.length > 0) {
      setInvalidIndices(new Set(invalid.map(x => x.index)));
      setInputError(
        `${invalid.length} Feld${invalid.length > 1 ? 'er enthalten' : ' enthält'} keine gültige URL.`
      );
      return;
    }

    const result = await bulkPreview.mutateAsync({
      items: filled.map(x => ({ url: x.url })),
    });

    const newConfigs: RecipeConfig[] = [];
    const newErrors: PreviewFailure[] = [];
    for (const r of result.results) {
      if (r.preview) {
        newConfigs.push({ url: r.url, preview: r.preview, tagIds: [], ratings: {} });
      } else {
        newErrors.push({ url: r.url, error: r.error ?? 'Unbekannter Fehler' });
      }
    }

    setPreviewErrors(newErrors);
    if (newConfigs.length === 0) {
      setInputError('Kein Rezept konnte geladen werden. Bitte URLs prüfen.');
      return;
    }
    setConfigs(newConfigs);
  }

  // ── Config update helpers ─────────────────────────────────────────────────

  function toggleConfigTag(index: number, tagId: number) {
    setConfigs(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const newIds = c.tagIds.includes(tagId)
        ? c.tagIds.filter(id => id !== tagId)
        : [...c.tagIds, tagId];
      return { ...c, tagIds: newIds };
    }));
  }

  function setConfigRating(index: number, userId: number, stars: number) {
    setConfigs(prev => prev.map((c, i) =>
      i === index ? { ...c, ratings: { ...c.ratings, [userId]: stars } } : c
    ));
  }

  async function handleAddTagForConfig(index: number, name: string): Promise<number> {
    const tag = await createTag.mutateAsync(name);
    return tag.id;
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    const result = await bulkImport.mutateAsync({
      items: configs.map(c => ({
        url: c.url,
        tag_ids: c.tagIds,
        ratings: Object.entries(c.ratings)
          .map(([uid, stars]) => ({ user_id: Number(uid), stars }))
          .filter(r => r.stars > 0),
      })),
    });
    setResults(result);
  }

  function handleNavigateToRecipes() {
    if (!results || results.created_ids.length === 0) return;
    router.replace({
      pathname: '/(tabs)/recipes',
      params: { filter_ids: results.created_ids.join(',') },
    });
  }

  function reset() {
    setUrls(['']);
    setInvalidIndices(new Set());
    setInputError(null);
    setConfigs([]);
    setPreviewErrors([]);
    setResults(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Results
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'results' && results) {
    const totalFailed = results.failed.length + previewErrors.length;
    return (
      <>
        <Stack.Screen options={{ title: 'Import-Ergebnis' }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {results.created_ids.length > 0 ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={32} color={GREEN} />
                <Text style={styles.successText}>
                  {results.created_ids.length} Rezept{results.created_ids.length !== 1 ? 'e' : ''} erfolgreich importiert
                </Text>
              </View>
            ) : (
              <View style={styles.allFailedBox}>
                <Ionicons name="close-circle" size={32} color={RED} />
                <Text style={styles.allFailedText}>Kein Rezept konnte importiert werden.</Text>
              </View>
            )}

            {totalFailed > 0 && (
              <View style={styles.failedSection}>
                <Text style={styles.failedTitle}>
                  {totalFailed} URL{totalFailed !== 1 ? 's' : ''} konnten nicht geladen werden:
                </Text>
                {previewErrors.map((f, i) => (
                  <View key={`pre_${i}`} style={styles.failedItem}>
                    <Text style={styles.failedUrl} numberOfLines={1}>{f.url}</Text>
                    <Text style={styles.failedError}>{f.error}</Text>
                  </View>
                ))}
                {results.failed.map((f, i) => (
                  <View key={`imp_${i}`} style={styles.failedItem}>
                    <Text style={styles.failedUrl} numberOfLines={1}>{f.url}</Text>
                    <Text style={styles.failedError}>{f.error}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {results.created_ids.length > 0 && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNavigateToRecipes}>
              <Text style={styles.primaryBtnText}>Zur Rezeptübersicht</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
            <Text style={styles.secondaryBtnText}>Weiteren Import starten</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Configure (per-recipe tags + ratings)
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'configure') {
    return (
      <>
        <Stack.Screen
          options={{
            title: `${configs.length} Rezept${configs.length !== 1 ? 'e' : ''} konfigurieren`,
            headerLeft: () => (
              <TouchableOpacity onPress={reset} style={{ paddingHorizontal: 4 }}>
                <Ionicons name="arrow-back" size={24} color={GREEN} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview errors from step 1 */}
          {previewErrors.length > 0 && (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.errorCardTitle}>
                {previewErrors.length} URL{previewErrors.length !== 1 ? 's' : ''} konnten nicht geladen werden:
              </Text>
              {previewErrors.map((f, i) => (
                <View key={i} style={styles.failedItem}>
                  <Text style={styles.failedUrl} numberOfLines={1}>{f.url}</Text>
                  <Text style={styles.failedError}>{f.error}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Per-recipe config cards */}
          {configs.map((config, index) => (
            <View key={config.url} style={styles.card}>
              {/* Recipe header */}
              <View style={styles.recipeCardHeader}>
                <View style={styles.recipeIndexBadge}>
                  <Text style={styles.recipeIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.recipeCardTitleBlock}>
                  <Text style={styles.recipeCardTitle} numberOfLines={2}>
                    {config.preview.name}
                  </Text>
                  <Text style={styles.recipeCardUrl} numberOfLines={1}>
                    {config.url}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Tags */}
              <Text style={styles.sectionSubtitle}>Tags</Text>
              <TagSection
                allTags={allTags}
                selectedIds={config.tagIds}
                onToggle={tagId => toggleConfigTag(index, tagId)}
                onAddTag={name => handleAddTagForConfig(index, name)}
              />

              {/* Ratings */}
              {users.length > 0 && (
                <>
                  <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>Bewertungen</Text>
                  <RatingSection
                    users={users}
                    ratings={config.ratings}
                    onRate={(userId, stars) => setConfigRating(index, userId, stars)}
                  />
                </>
              )}
            </View>
          ))}

          {/* Import button */}
          <TouchableOpacity
            style={[styles.primaryBtn, bulkImport.isPending && styles.primaryBtnDisabled]}
            onPress={handleImport}
            disabled={bulkImport.isPending}
          >
            {bulkImport.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" />
                <Text style={[styles.primaryBtnText, { marginLeft: 10 }]}>
                  Rezepte werden importiert…
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>
                {configs.length} Rezept{configs.length !== 1 ? 'e' : ''} importieren
              </Text>
            )}
          </TouchableOpacity>

          {bulkImport.isError && (
            <Text style={styles.importError}>
              {(bulkImport.error as Error)?.message ?? 'Unbekannter Fehler'}
            </Text>
          )}
        </ScrollView>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: URL input (step 1)
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: 'Rezepte aus URLs importieren' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>URLs eingeben</Text>
          <Text style={styles.hint}>
            Sobald du eine URL eingibst, erscheint automatisch ein weiteres Feld.
            Im nächsten Schritt kannst du Tags und Bewertungen für jedes Rezept individuell vergeben.
          </Text>

          {urls.map((url, index) => {
            const isInvalid = invalidIndices.has(index);
            const isEmpty = url.trim() === '';
            const isLastEmpty = index === urls.length - 1 && isEmpty;
            return (
              <View key={index} style={styles.urlFieldWrapper}>
                <View style={styles.urlFieldRow}>
                  <TextInput
                    style={[styles.input, styles.urlInput, isInvalid && styles.urlInputInvalid]}
                    placeholder={isLastEmpty ? 'Weitere URL hinzufügen…' : 'https://www.chefkoch.de/rezepte/…'}
                    placeholderTextColor={isLastEmpty ? '#BBB' : '#AAA'}
                    value={url}
                    onChangeText={text => handleUrlChange(text, index)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  {!isEmpty && (
                    <Tooltip label="URL entfernen" position="left">
                      <TouchableOpacity
                        style={styles.urlRemoveBtn}
                        onPress={() => removeUrl(index)}
                      >
                        <Ionicons name="close-circle" size={20} color="#AAA" />
                      </TouchableOpacity>
                    </Tooltip>
                  )}
                </View>
                {isInvalid && (
                  <Text style={styles.urlFieldError}>Keine gültige URL</Text>
                )}
              </View>
            );
          })}

          {inputError && <Text style={styles.importError}>{inputError}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, bulkPreview.isPending && styles.primaryBtnDisabled]}
          onPress={handleLoadPreviews}
          disabled={bulkPreview.isPending}
        >
          {bulkPreview.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.primaryBtnText, { marginLeft: 10 }]}>
                Rezepte werden geladen…
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Vorschau laden</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
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
  errorCard: {
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  errorCardTitle: { fontSize: 14, fontWeight: '600', color: RED, marginBottom: 10 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  sectionSubtitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12 },

  // Recipe config card header
  recipeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  recipeIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  recipeIndexText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recipeCardTitleBlock: { flex: 1 },
  recipeCardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  recipeCardUrl: { fontSize: 12, color: '#999' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 14 },

  // URL fields
  urlFieldWrapper: { marginBottom: 8 },
  urlFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
    color: '#1A1A1A',
  },
  urlInput: { flex: 1 },
  urlInputInvalid: { borderColor: RED, backgroundColor: '#FFF5F5' },
  urlRemoveBtn: { padding: 4 },
  urlFieldError: { fontSize: 12, color: RED, marginTop: 3, marginLeft: 2 },
  importError: {
    fontSize: 13,
    color: RED,
    marginTop: 8,
    backgroundColor: '#FFF5F5',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },

  // Tags
  tagGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
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
  newTagLabel: { fontSize: 12, fontWeight: '500', color: '#666', marginTop: 10, marginBottom: 5 },
  newTagRow: { flexDirection: 'row', gap: 10 },
  addTagBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagBtnDisabled: { backgroundColor: '#A5D6A7' },
  addTagBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 26 },

  // Star ratings
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  userName: { fontSize: 14, color: '#1A1A1A', flex: 1 },
  starsWrapper: { flexDirection: 'column', alignItems: 'flex-end' },
  starsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 22, color: '#DDD' },
  starFilled: { color: '#FFC107' },
  neverBtn: { fontSize: 14, color: '#CCC', fontWeight: '700', marginRight: 2 },
  neverBtnActive: { color: '#C62828' },
  ratingLabel: { fontSize: 10, color: '#888', marginTop: 2 },

  // Buttons
  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnDisabled: { backgroundColor: '#A5D6A7' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { color: GREEN, fontSize: 15, fontWeight: '600' },

  // Results
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: Colors.greenLight,
    borderRadius: 10,
    padding: 14,
  },
  successText: { fontSize: 16, fontWeight: '600', color: Colors.greenDark, flex: 1 },
  allFailedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 14,
  },
  allFailedText: { fontSize: 16, fontWeight: '600', color: RED, flex: 1 },
  failedSection: { marginTop: 4 },
  failedTitle: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 10 },
  failedItem: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: RED,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  failedUrl: { fontSize: 12, color: '#555', marginBottom: 3 },
  failedError: { fontSize: 12, color: RED },
});
