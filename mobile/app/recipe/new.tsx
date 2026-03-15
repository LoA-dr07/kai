import { useRouter } from 'expo-router';
import { showAlert } from '../../lib/alert';
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
          showAlert('Fehler', 'Rezept konnte nicht erstellt werden. Bitte prüfe die Verbindung.');
        }
      }}
      isSubmitting={createRecipe.isPending}
      submitLabel="Rezept erstellen"
    />
  );
}
