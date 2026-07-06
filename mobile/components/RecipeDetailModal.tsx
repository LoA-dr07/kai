import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRecipe, useRecipes, useTags } from '../lib/hooks/useRecipes';
import { useUsers } from '../lib/hooks/useUsers';
import { BaseModal } from './BaseModal';
import { RecipeDetailContent } from './RecipeDetailContent';
import { RecipeSearchPanel } from './RecipeSearchPanel';
import { Tooltip } from './Tooltip';
import { Colors } from '../lib/theme';

const GREEN = Colors.green;
const BORDER = Colors.border;

interface RecipeDetailModalProps {
  recipeId: number | null;
  visible: boolean;
  onClose: () => void;
  onSwap?: (recipeId: number | null, customMeal: string | null) => void;
}

export function RecipeDetailModal({ recipeId, visible, onClose, onSwap }: RecipeDetailModalProps) {
  const [mode, setMode] = useState<'detail' | 'search'>('detail');
  const [swapTab, setSwapTab] = useState<'recipe' | 'freetext'>('recipe');
  const [freeText, setFreeText] = useState('');
  const router = useRouter();

  const { data: recipe } = useRecipe(recipeId ?? -1);
  const { data: recipes } = useRecipes();
  const { data: users = [] } = useUsers();
  const { data: tags = [] } = useTags();

  useEffect(() => {
    if (visible) setMode('detail');
  }, [visible, recipeId]);

  const openSwap = () => {
    setSwapTab('recipe');
    setFreeText('');
    setMode('search');
  };

  if (recipeId == null) return null;

  const headerLeft = mode === 'search' ? (
    <TouchableOpacity onPress={() => setMode('detail')}>
      <Text style={styles.headerBack}>‹ Zurück</Text>
    </TouchableOpacity>
  ) : (
    <Text style={styles.headerTitle} numberOfLines={1}>{recipe?.name ?? 'Rezept'}</Text>
  );

  const headerRight = mode === 'detail' && onSwap && (
    <Tooltip label="Rezept austauschen" position="left">
      <TouchableOpacity style={styles.headerIconBtn} onPress={openSwap}>
        <Text style={styles.headerIconText}>⇄</Text>
      </TouchableOpacity>
    </Tooltip>
  );

  return (
    <BaseModal visible={visible} onClose={onClose} headerLeft={headerLeft} headerRight={headerRight}>
      <View style={styles.container}>
        {mode === 'detail' ? (
          <RecipeDetailContent
            recipeId={recipeId}
            onNavigate={path => { onClose(); router.push(path); }}
            onDeleted={onClose}
          />
        ) : (
          <>
            <Text style={styles.searchModeTitle}>Rezept austauschen</Text>
            <View style={styles.tabRow}>
              {(['recipe', 'freetext'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.tabBtn, swapTab === t && styles.tabActive]} onPress={() => setSwapTab(t)}>
                  <Text style={[styles.tabText, swapTab === t && styles.tabTextActive]}>{t === 'recipe' ? 'Rezept' : 'Freitext'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {swapTab === 'recipe' ? (
              <RecipeSearchPanel
                recipes={recipes ?? []}
                tags={tags}
                users={users}
                recentRecipes={[]}
                onSelect={newRecipeId => onSwap?.(newRecipeId, null)}
              />
            ) : (
              <View style={styles.freetextContainer}>
                <TextInput
                  style={styles.freetextInput}
                  placeholder="z.B. Brötchen, Reste, Auswärts essen …"
                  value={freeText}
                  onChangeText={setFreeText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => freeText.trim() && onSwap?.(null, freeText.trim())}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, !freeText.trim() && styles.saveBtnDisabled]}
                  onPress={() => freeText.trim() && onSwap?.(null, freeText.trim())}
                  disabled={!freeText.trim()}
                >
                  <Text style={styles.saveBtnText}>Speichern</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerBack: { fontSize: 16, color: GREEN, fontWeight: '600' },
  headerIconBtn: { padding: 4 },
  headerIconText: { fontSize: 20, color: GREEN },
  searchModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, marginTop: 8 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: GREEN, fontWeight: '700' },
  freetextContainer: { flex: 1, padding: 16 },
  freetextInput: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, backgroundColor: '#FAFAFA', marginBottom: 16 },
  saveBtn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#A5D6A7' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
