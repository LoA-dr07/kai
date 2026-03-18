import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/new"
          options={{ title: 'Rezept erstellen', presentation: 'modal' }}
        />
        <Stack.Screen
          name="recipe/[id]/index"
          options={{ title: 'Rezept' }}
        />
        <Stack.Screen
          name="recipe/[id]/edit"
          options={{ title: 'Rezept bearbeiten', presentation: 'modal' }}
        />
        <Stack.Screen
          name="recipe/[id]/cook"
          options={{ title: 'Kochen' }}
        />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
