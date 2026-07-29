import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.night },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Werkzeuge',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Werkzeuge' }} />
      <Stack.Screen name="recipes" options={{ title: 'Rezepte' }} />
      <Stack.Screen name="meal-plan" options={{ title: 'Wochenplan' }} />
      <Stack.Screen name="shopping-list" options={{ title: 'Einkaufsliste' }} />
      <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
    </Stack>
  );
}
