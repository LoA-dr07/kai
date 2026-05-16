import { useStatus } from '@powersync/react';
import { StyleSheet, Text, View } from 'react-native';

export function SyncStatusBanner() {
  const status = useStatus();

  if (status.connected) return null;

  const lastSync = status.lastSyncedAt
    ? status.lastSyncedAt.toLocaleString('de-DE', { timeStyle: 'short', dateStyle: 'short' })
    : null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {lastSync
          ? `Keine Sync-Verbindung · Zuletzt: ${lastSync}`
          : 'Keine Verbindung zur Synchronisation'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#E65100',
    paddingVertical: 5,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
