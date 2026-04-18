import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Component, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PowerSyncContext } from '@powersync/react';
import { ScrollView, Text, View } from 'react-native';

import { db, connector } from '../lib/powersync/database';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#1a1a2e' }}>
          <Text style={{ color: '#f66', fontSize: 16, fontWeight: 'bold', marginTop: 60, marginBottom: 12 }}>
            App-Fehler (bitte Screenshot machen):
          </Text>
          <Text style={{ color: '#adf', fontSize: 12 }}>
            {String(this.state.error)}
          </Text>
          <Text style={{ color: '#adf', fontSize: 10, marginTop: 12 }}>
            {(this.state.error as any)?.stack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (!db) return;
    db.connect(connector).catch(console.error);
    return () => {
      db.disconnect().catch(console.error);
    };
  }, []);

  const screens = (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/new"
          options={{ title: 'Rezept erstellen', presentation: 'modal' }}
        />
        <Stack.Screen
          name="recipe/bulk-import"
          options={{ title: 'Rezepte importieren', presentation: 'modal' }}
        />
        <Stack.Screen
          name="recipe/import-preview"
          options={{ title: 'Vorschau', presentation: 'modal' }}
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
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        {db ? (
          <PowerSyncContext.Provider value={db}>
            {screens}
          </PowerSyncContext.Provider>
        ) : screens}
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
