import { Model } from '@nozbe/watermelondb';
import { field, relation, children, readonly, date } from '@nozbe/watermelondb/decorators';
import { UnitType } from '@/types/enums';
import Store from './Store';

export default class Item extends Model {
  static table = 'items';
  static associations = {
    stores: { type: 'belongs_to' as const, key: 'default_store_id' },
    list_items: { type: 'has_many' as const, foreignKey: 'item_id' },
    purchase_items: { type: 'has_many' as const, foreignKey: 'item_id' },
  };

  @field('canonical_name') canonicalName!: string;
  @field('default_store_id') defaultStoreId!: string;
  @field('default_brand') defaultBrand!: string | null;
  @field('unit_type') unitType!: UnitType;
  @field('reorder_qty') reorderQty!: number;
  @field('anchor_urls') anchorUrlsJson!: string; // raw JSON string
  @field('estimated_price_cents') estimatedPriceCents!: number | null;
  @field('notes') notes!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('stores', 'default_store_id') defaultStore!: Store;

  @children('list_items') listItems!: any;

  get anchorUrls(): Record<string, string> {
    try {
      return JSON.parse(this.anchorUrlsJson || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }
}
