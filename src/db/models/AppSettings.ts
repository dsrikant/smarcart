import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class AppSettings extends Model {
  static table = 'app_settings';

  // Always use id = 'singleton'
  @field('home_address_line1') homeAddressLine1!: string | null;
  @field('home_address_line2') homeAddressLine2!: string | null;
  @field('home_city') homeCity!: string | null;
  @field('home_zip') homeZip!: string | null;
  @field('confirmation_email') confirmationEmail!: string | null;
  @field('biometric_lock_enabled') biometricLockEnabled!: boolean;
  @date('updated_at') updatedAt!: Date;
}
