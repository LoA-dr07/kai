import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2E7D32',
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="recipes" options={{ title: 'Rezepte' }} />
      <Tabs.Screen name="meal-plan" options={{ title: 'Wochenplan' }} />
    </Tabs>
  );
}
