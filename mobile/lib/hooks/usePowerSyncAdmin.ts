import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { confirmWithBiometrics } from '../biometricAuth';
import { showAlert } from '../alert';

const ADMIN_SECRET = process.env.EXPO_PUBLIC_POWERSYNC_ADMIN_SECRET ?? '';

async function callPowerSyncAdmin(action: 'stop' | 'start'): Promise<void> {
  const confirmed = await confirmWithBiometrics(
    action === 'stop' ? 'PowerSync stoppen bestätigen' : 'PowerSync starten bestätigen'
  );
  if (!confirmed) {
    throw new Error('Biometrische Bestätigung fehlgeschlagen oder abgebrochen.');
  }
  await api.post(
    `/admin/powersync/${action}`,
    {},
    { headers: { 'X-Admin-Secret': ADMIN_SECRET }, timeout: 310_000 }
  );
}

export function useStopPowerSync() {
  return useMutation({ mutationFn: () => callPowerSyncAdmin('stop') });
}

export function useStartPowerSync() {
  return useMutation({ mutationFn: () => callPowerSyncAdmin('start') });
}

/**
 * Called once on app launch (native only). Asks whether to redeploy PowerSync
 * (in case it was stopped) or continue in offline mode with the last synced
 * state, without ever triggering the biometric prompt / admin call.
 */
export function startPowerSyncOnLaunch(): void {
  showAlert(
    'PowerSync synchronisieren?',
    'Falls die Synchronisation pausiert war, kann der Neustart einige Minuten dauern. Im Offline-Modus arbeitest du mit dem zuletzt synchronisierten Stand weiter, ohne Biometrie-Abfrage.',
    [
      { text: 'Offline-Modus', style: 'cancel' },
      {
        text: 'Jetzt synchronisieren',
        onPress: () => {
          callPowerSyncAdmin('start').catch(error => {
            console.warn('PowerSync auto-start failed:', error?.message ?? error);
          });
        },
      },
    ]
  );
}
