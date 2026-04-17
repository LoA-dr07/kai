// Loaded on iOS and Android by Metro's platform-specific resolution.
// Uses @powersync/react-native which wraps react-native-quick-sqlite.
import { PowerSyncDatabase } from '@powersync/react-native';

import { AppBackendConnector } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'meal-planner.db' },
});

export const connector = new AppBackendConnector();
