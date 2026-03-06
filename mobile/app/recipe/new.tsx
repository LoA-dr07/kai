import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import RecipeForm from '../../components/RecipeForm';
import { useCreateRecipe } from '../../lib/hooks/useRecipes';

export default function NewRecipeScreen() {
  const router = useRouter();
  const createRecipe = useCreateRecipe();

  return (
    <RecipeForm
      onSubmit={async data => {
        try {
          await createRecipe.mutateAsync(data);
          router.back();
        } catch {
          Alert.alert('Fehler', 'Rezept konnte nicht erstellt werden. Bitte prüfe die Verbindung.');
        }
      }}
      isSubmitting={createRecipe.isPending}
      submitLabel="Rezept erstellen"
    />
  );
}
