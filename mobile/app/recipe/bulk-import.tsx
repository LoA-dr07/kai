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
import { useBulkImportFromUrl, useCreateTag, useTags } from '../../lib/hooks/useRecipes';
import { useUsers } from '../../lib/hooks/useUsers';
import type { BulkUrlImportResult } from '../../lib/types';
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

export default function BulkImportScreen() {
  const router = useRouter();
  const { data: tags = [] } = useTags();
  const { data: users = [] } = useUsers();
  const bulkImport = useBulkImportFromUrl();
  const createTag = useCreateTag();

  // URL field state
  const [urls, setUrls] = useState<string[]>(['']);
  const [invalidIndices, setInvalidIndices] = useState<Set<number>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);

  // Tag state
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newTagText, setNewTagText] = useState('');

  // Rating state: user_id → stars (0 = not set / cleared)
  const [ratings, setRatings] = useState<Record<number, number>>({});

  // Results state
  const [results, setResults] = useState<BulkUrlImportResult | null>(null);

  // Tag groups
  const mealTypeTags = tags.filter(t => t.is_predefined && t.category === 'meal_type');
  const familyTags = tags.filter(t => t.is_predefined && t.category === 'family');
  const customTags = tags.filter(t => !t.is_predefined);

  function handleUrlChange(text: string, index: number) {
    const next = [...urls];
    next[index] = text;
    // Append new empty field when the last field gets content
    if (text !== '' && index === next.length - 1) {
      next.push('');
    }
    setUrls(next);
    // Re-validate already-marked invalid fields
    if (invalidIndices.has(index)) {
      const newInvalid = new Set(invalidIndices);
      if (text.trim() === '' || isValidUrl(text.trim())) {
        newInvalid.delete(index);
      }
      setInvalidIndices(newInvalid);
    }
    if (importError) setImportError(null);
  }

  function toggleTag(id: number) {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleAddTag() {
    const name = newTagText.trim();
    if (!name) return;
    const tag = await createTag.mutateAsync(name);
    setSelectedTagIds(prev => [...prev, tag.id]);
    setNewTagText('');
  }

  function handleRate(userId: number, stars: number) {
    setRatings(prev => ({ ...prev, [userId]: stars }));
  }

  async function handleImport() {
    setImportError(null);

    const filled = urls.map((u, i) => ({ url: u.trim(), index: i })).filter(x => x.url !== '');

    if (filled.length === 0) {
      setImportError('Bitte mindestens eine URL eingeben.');
      return;
    }

    const invalid = filled.filter(x => !isValidUrl(x.url));
    if (invalid.length > 0) {
      const newInvalid = new Set<number>(invalid.map(x => x.index));
      setInvalidIndices(newInvalid);
      setImportError(
        `${invalid.length} Feld${invalid.length > 1 ? 'er enthalten' : ' enthält'} keine gültige URL. Bitte korrigieren und erneut versuchen.`
      );
      return;
    }

    const ratingPayload = Object.entries(ratings)
      .map(([uid, stars]) => ({ user_id: Number(uid), stars }))
      .filter(r => r.stars > 0);

    const result = await bulkImport.mutateAsync({
      urls: filled.map(x => x.url),
      tag_ids: selectedTagIds,
      ratings: ratingPayload,
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

  // After import: show results view
  if (results) {
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

            {results.failed.length > 0 && (
              <View style={styles.failedSection}>
                <Text style={styles.failedTitle}>
                  {results.failed.length} URL{results.failed.length !== 1 ? 's' : ''} konnten nicht geladen werden:
                </Text>
                {results.failed.map((f, i) => (
                  <View key={i} style={styles.failedItem}>
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

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setResults(null);
              setUrls(['']);
              setInvalidIndices(new Set());
              setImportError(null);
            }}
          >
            <Text style={styles.secondaryBtnText}>Weiteren Import starten</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Rezepte aus URLs importieren' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* URL fields */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>URLs eingeben</Text>
          <Text style={styles.hint}>
            Sobald du eine URL eingibst, erscheint automatisch ein weiteres Feld.
          </Text>

          {urls.map((url, index) => {
            const isInvalid = invalidIndices.has(index);
            const isEmpty = url.trim() === '';
            const isLastEmpty = index === urls.length - 1 && isEmpty;
            return (
              <View key={index} style={styles.urlFieldWrapper}>
                <View style={styles.urlFieldRow}>
                  <TextInput
                    style={[styles.urlInput, isInvalid && styles.urlInputInvalid]}
                    placeholder={
                      isLastEmpty
                        ? 'Weitere URL hinzufügen…'
                        : 'https://www.chefkoch.de/rezepte/…'
                    }
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
                        onPress={() => {
                          const next = urls.filter((_, i) => i !== index);
                          // Always keep at least one field
                          if (next.length === 0 || next[next.length - 1].trim() !== '') {
                            next.push('');
                          }
                          setUrls(next);
                          const newInvalid = new Set(invalidIndices);
                          newInvalid.delete(index);
                          // Re-index invalid indices above the removed one
                          const reindexed = new Set<number>();
                          newInvalid.forEach(i => reindexed.add(i > index ? i - 1 : i));
                          setInvalidIndices(reindexed);
                        }}
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

          {importError && (
            <Text style={styles.importError}>{importError}</Text>
          )}
        </View>

        {/* Tags */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <Text style={styles.hint}>Optional – werden auf alle importierten Rezepte angewendet.</Text>

          {mealTypeTags.length > 0 && (
            <>
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
            </>
          )}

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

          <Text style={styles.newTagLabel}>Neuen Tag erstellen</Text>
          <View style={styles.newTagRow}>
            <TextInput
              style={[styles.urlInput, { flex: 1 }]}
              value={newTagText}
              onChangeText={setNewTagText}
              placeholder="z.B. Vegetarisch, Schnell, …"
              returnKeyType="done"
              onSubmitEditing={handleAddTag}
            />
            <TouchableOpacity
              style={[styles.addTagBtn, !newTagText.trim() && styles.addTagBtnDisabled]}
              onPress={handleAddTag}
              disabled={!newTagText.trim() || createTag.isPending}
            >
              {createTag.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.addTagBtnText}>+</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Ratings */}
        {users.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bewertungen</Text>
            <Text style={styles.hint}>Optional – werden auf alle importierten Rezepte angewendet.</Text>

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
                          onPress={() => handleRate(user.id, 0)}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                          <Text style={[styles.neverBtn, stars === 0 && styles.neverBtnActive]}>✕</Text>
                        </TouchableOpacity>
                      </Tooltip>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Tooltip key={n} label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}>
                          <TouchableOpacity
                            onPress={() => handleRate(user.id, n)}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <Text style={[styles.star, n <= stars && stars > 0 && styles.starFilled]}>
                              {n <= stars && stars > 0 ? '★' : '☆'}
                            </Text>
                          </TouchableOpacity>
                        </Tooltip>
                      ))}
                    </View>
                    {label !== null && (
                      <Text style={styles.ratingLabel}>{label}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Import button */}
        <TouchableOpacity
          style={[styles.primaryBtn, bulkImport.isPending && styles.primaryBtnDisabled]}
          onPress={handleImport}
          disabled={bulkImport.isPending}
        >
          {bulkImport.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.primaryBtnText, { marginLeft: 10 }]}>Rezepte werden geladen…</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Importieren</Text>
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

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12 },

  // URL fields
  urlFieldWrapper: { marginBottom: 8 },
  urlFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
    color: '#1A1A1A',
  },
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
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  newTagLabel: { fontSize: 13, fontWeight: '500', color: '#555', marginTop: 14, marginBottom: 6 },
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  userName: { fontSize: 15, color: '#1A1A1A', flex: 1 },
  starsWrapper: { flexDirection: 'column', alignItems: 'flex-end' },
  starsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 24, color: '#DDD' },
  starFilled: { color: '#FFC107' },
  neverBtn: { fontSize: 15, color: '#CCC', fontWeight: '700', marginRight: 2 },
  neverBtnActive: { color: '#C62828' },
  ratingLabel: { fontSize: 11, color: '#888', marginTop: 2 },

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
    marginBottom: 16,
    backgroundColor: Colors.greenLight,
    borderRadius: 10,
    padding: 14,
  },
  successText: { fontSize: 16, fontWeight: '600', color: Colors.greenDark, flex: 1 },
  allFailedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
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
  failedUrl: { fontSize: 13, color: '#555', marginBottom: 4 },
  failedError: { fontSize: 12, color: RED },
});
