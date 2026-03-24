import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  relation,
  json,
} from '@nozbe/watermelondb/decorators';
import type Store from './Store';
import { UnitType } from '../../types/enums';

export { UnitType };

export type AnchorUrls = Record<string, string>; // { [storeId]: productUrl }

const sanitizeAnchorUrls = (raw: unknown): AnchorUrls => {
  if (typeof raw === 'object' && raw !== null) return raw as AnchorUrls;
  return {};
};

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
  @json('anchor_urls', sanitizeAnchorUrls) anchorUrls!: AnchorUrls;
  @field('estimated_price_cents') estimatedPriceCents!: number | null;
  @field('notes') notes!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('stores', 'default_store_id') defaultStore!: Store;
}
