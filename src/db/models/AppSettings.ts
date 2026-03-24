import { Model, Database } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

const SINGLETON_ID = 'singleton';

export default class AppSettings extends Model {
  static table = 'app_settings';

  @field('home_address_line1') homeAddressLine1!: string | null;
  @field('home_address_line2') homeAddressLine2!: string | null;
  @field('home_city') homeCity!: string | null;
  @field('home_zip') homeZip!: string | null;
  @field('confirmation_email') confirmationEmail!: string | null;
  @date('updated_at') updatedAt!: Date;
}

/**
 * Always returns the singleton AppSettings row, creating it if absent.
 * Call this from the Settings screen instead of querying the collection directly.
 */
export async function getOrCreateAppSettings(
  database: Database,
): Promise<AppSettings> {
  const collection = database.get<AppSettings>('app_settings');
  try {
    return await collection.find(SINGLETON_ID);
  } catch {
    return await database.write(async () => {
      return await collection.create((record) => {
        // @ts-ignore — WatermelonDB allows overriding id on create via _raw
        record._raw.id = SINGLETON_ID;
      });
    });
  }
}
