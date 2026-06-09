import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useOrientation } from '../../lib/hooks/useOrientation';

export default function TabsLayout() {
  const { isLandscape, isTablet } = useOrientation();
  // On tablets in landscape: compact icon-only side tab bar.
  const isSideBar = isTablet && isLandscape;
  const tabBarPosition = isSideBar ? 'left' : 'bottom';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#888',
        tabBarActiveBackgroundColor: '#E8F5E9',
        tabBarIndicatorStyle: { backgroundColor: '#2E7D32', width: 3 },
        tabBarShowLabel: !isSideBar,
        tabBarStyle: isSideBar ? { width: 64 } : undefined,
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarPosition,
      }}
    >
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Rezepte',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meal-plan"
        options={{
          title: 'Wochenplan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: 'Einkaufsliste',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'KI-Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
