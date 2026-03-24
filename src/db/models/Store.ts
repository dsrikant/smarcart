import { Model } from '@nozbe/watermelondb';
import { field, children, readonly, date } from '@nozbe/watermelondb/decorators';
import { AutomationType, DeliveryPreference } from '@/types/enums';

export default class Store extends Model {
  static table = 'stores';
  static associations = {
    list_items: { type: 'has_many' as const, foreignKey: 'store_id' },
    items: { type: 'has_many' as const, foreignKey: 'default_store_id' },
    purchases: { type: 'has_many' as const, foreignKey: 'store_id' },
    purchase_rules: { type: 'has_many' as const, foreignKey: 'store_id' },
  };

  @field('name') name!: string;
  @field('automation_type') automationType!: AutomationType;
  @field('instacart_retailer_slug') instacartRetailerSlug!: string | null;
  @field('is_active') isActive!: boolean;
  @field('delivery_preference') deliveryPreference!: DeliveryPreference;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('list_items') listItems!: any;
  @children('purchase_rules') purchaseRules!: any;
}
