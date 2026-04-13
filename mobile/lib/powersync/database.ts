// Loaded on Expo Web (browser) by Metro/webpack platform-specific resolution.
// Uses @powersync/web which runs SQLite via WebAssembly (wa-sqlite).
import { PowerSyncDatabase } from '@powersync/web';

import { AppBackendConnector } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'meal-planner.db' },
});

export const connector = new AppBackendConnector();
