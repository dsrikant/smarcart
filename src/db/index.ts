import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  Store,
  Item,
  ListItem,
  Purchase,
  PurchaseItem,
  VoiceLog,
  PurchaseRule,
  AppSettings,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'smartcart',
  jsi: false, // Disabled until WatermelonDB JSI verified on new arch
  onSetUpError: (error) => {
    console.error('[DB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Store,
    Item,
    ListItem,
    Purchase,
    PurchaseItem,
    VoiceLog,
    PurchaseRule,
    AppSettings,
  ],
});

/**
 * Seeds the AppSettings singleton row on first launch.
 * Safe to call multiple times — no-ops if row exists.
 */
export async function seedAppSettings(): Promise<void> {
  const settingsCollection = database.get<AppSettings>('app_settings');
  const count = await settingsCollection.query().count;
  if (count === 0) {
    await database.write(async () => {
      await settingsCollection.create((record) => {
        // @ts-expect-error — WatermelonDB allows setting id manually via _raw
        record._raw.id = 'singleton';
        record.homeAddressLine1 = null;
        record.homeAddressLine2 = null;
        record.homeCity = null;
        record.homeZip = null;
        record.confirmationEmail = null;
        record.biometricLockEnabled = false;
      });
    });
  }
}

// Re-export models and decorators for convenience
export {
  Store,
  Item,
  ListItem,
  Purchase,
  PurchaseItem,
  VoiceLog,
  PurchaseRule,
  AppSettings,
};
