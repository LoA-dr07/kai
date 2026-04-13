import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PowerSyncContext } from '@powersync/react';

import { db, connector } from '../lib/powersync/database';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    // Connect PowerSync to the backend. The database starts syncing in the
    // background once connected; the app reads from local SQLite immediately.
    db.connect(connector).catch(console.error);
    return () => {
      db.disconnect().catch(console.error);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PowerSyncContext.Provider value={db}>
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
      </PowerSyncContext.Provider>
    </GestureHandlerRootView>
  );
}
