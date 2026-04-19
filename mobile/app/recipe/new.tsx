import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// DIAGNOSTIC: Minimal screen – no hooks, no RecipeForm, no PowerSync.
// If this crashes → crash is in navigation/native layer, not in screen content.
// If this works → add back complexity step by step to find crash source.
export default function NewRecipeScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.center}>
        <Text style={s.text}>✓ Screen geladen (Diagnose-Version)</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 16, color: '#2E7D32' },
});
