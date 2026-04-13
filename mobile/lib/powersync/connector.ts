import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';
import { api } from '../api';

/**
 * Connects the PowerSync client to the PowerSync Cloud service.
 *
 * fetchCredentials: calls our FastAPI backend to get a signed JWT.
 * uploadData: not used – all writes go directly to FastAPI, which writes to
 *             Neon PostgreSQL, and PowerSync syncs the changes back to clients.
 *
 * Required env var (mobile/.env):
 *   EXPO_PUBLIC_POWERSYNC_URL=https://<instance>.powersync.journeyapps.com
 */
export class AppBackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const res = await api.get<{ token: string }>('/auth/powersync-token');
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token: res.data.token,
    };
  }

  async uploadData(_database: AbstractPowerSyncDatabase): Promise<void> {
    // Intentionally empty: mutations are handled directly via FastAPI API calls.
    // PowerSync syncs the resulting DB changes back automatically.
  }
}
