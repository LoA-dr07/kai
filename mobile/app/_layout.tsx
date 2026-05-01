import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Component, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PowerSyncContext } from '@powersync/react';

import { db, connector } from '../lib/powersync/database';
import { ErrorScreen } from '../components/ErrorScreen';
import { Colors } from '../lib/theme';

// ─── Global unhandled-error overlay ─────────────────────────────────────────

function GlobalErrorOverlay({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View style={overlayStyles.backdrop} pointerEvents="box-none">
      <View style={overlayStyles.box}>
        <Text style={overlayStyles.title}>Unbehandelter Fehler</Text>
        <Text style={overlayStyles.msg} selectable>{message}</Text>
        <TouchableOpacity style={overlayStyles.btn} onPress={onDismiss}>
          <Text style={overlayStyles.btnText}>Schließen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 24,
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.red, marginBottom: 10 },
  msg: { fontSize: 13, color: '#444', lineHeight: 18, marginBottom: 20 },
  btn: { backgroundColor: Colors.green, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── React render-error boundary ────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <ErrorScreen
            message={(this.state.error as Error).message}
            onRetry={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    // Catch unhandled JS errors (native) and promise rejections (web+native)
    const prevHandler =
      typeof global.ErrorUtils !== 'undefined'
        ? global.ErrorUtils.getGlobalHandler()
        : null;

    if (typeof global.ErrorUtils !== 'undefined') {
      global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        setGlobalError(`${isFatal ? '[Fatal] ' : ''}${error?.message ?? String(error)}`);
        if (!isFatal && prevHandler) prevHandler(error, isFatal);
      });
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onRejection = (e: PromiseRejectionEvent) => {
        const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
        setGlobalError(msg);
      };
      window.addEventListener('unhandledrejection', onRejection);
      return () => {
        window.removeEventListener('unhandledrejection', onRejection);
        if (typeof global.ErrorUtils !== 'undefined' && prevHandler) {
          global.ErrorUtils.setGlobalHandler(prevHandler);
        }
      };
    }

    return () => {
      if (typeof global.ErrorUtils !== 'undefined' && prevHandler) {
        global.ErrorUtils.setGlobalHandler(prevHandler);
      }
    };
  }, []);

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
      {globalError && (
        <GlobalErrorOverlay
          message={globalError}
          onDismiss={() => setGlobalError(null)}
        />
      )}
    </GestureHandlerRootView>
  );
}
