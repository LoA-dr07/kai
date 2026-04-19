import { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { showAlert } from '../../lib/alert';
import RecipeForm from '../../components/RecipeForm';
import { useCreateRecipe } from '../../lib/hooks/useRecipes';

class ScreenErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Fehler beim Laden</Text>
          <Text style={s.msg}>{(this.state.error as Error).message}</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })}>
            <Text style={s.btnText}>Neu laden</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#C62828', marginBottom: 10 },
  msg: { fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
});

function NewRecipeScreenContent() {
  const router = useRouter();
  const createRecipe = useCreateRecipe();

  return (
    <RecipeForm
      onSubmit={async data => {
        try {
          await createRecipe.mutateAsync(data);
          router.back();
        } catch {
          showAlert('Fehler', 'Rezept konnte nicht erstellt werden. Bitte prüfe die Verbindung.');
        }
      }}
      isSubmitting={createRecipe.isPending}
      submitLabel="Rezept erstellen"
    />
  );
}

export default function NewRecipeScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenErrorBoundary>
        <NewRecipeScreenContent />
      </ScreenErrorBoundary>
    </GestureHandlerRootView>
  );
}
