import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { confirmWithBiometrics } from '../biometricAuth';

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

/**
 * Called once on app launch (native only) to redeploy PowerSync after it was
 * stopped. Fire-and-forget: on failure the existing SyncStatusBanner already
 * shows "keine Verbindung", so no extra error UI is needed here.
 */
export function startPowerSyncOnLaunch(): void {
  callPowerSyncAdmin('start').catch(error => {
    console.warn('PowerSync auto-start failed:', error?.message ?? error);
  });
}
