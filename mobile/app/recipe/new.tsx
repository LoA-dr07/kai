import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { showAlert } from '../../lib/alert';
import RecipeForm from '../../components/RecipeForm';
import { useCreateRecipe } from '../../lib/hooks/useRecipes';
import { ScreenErrorBoundary } from '../../components/ScreenErrorBoundary';

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
