import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  relation,
  children,
  json,
} from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type Store from './Store';
import type PurchaseItem from './PurchaseItem';
import { PurchaseStatus } from '../../types/enums';

export { PurchaseStatus };

export type PurchaseItemSnapshot = {
  itemId: string;
  canonicalName: string;
  brand: string | null;
  quantity: number;
  priceCents: number | null;
};

const sanitizeItemsJson = (raw: unknown): PurchaseItemSnapshot[] => {
  if (Array.isArray(raw)) return raw as PurchaseItemSnapshot[];
  return [];
};

export default class Purchase extends Model {
  static table = 'purchases';
  static associations = {
    stores: { type: 'belongs_to' as const, key: 'store_id' },
    purchase_items: { type: 'has_many' as const, foreignKey: 'purchase_id' },
  };

  @field('store_id') storeId!: string;
  @field('order_id') orderId!: string | null;
  @date('placed_at') placedAt!: Date;
  @field('total_amount_cents') totalAmountCents!: number | null;
  @field('status') status!: PurchaseStatus;
  @json('items_json', sanitizeItemsJson) itemsJson!: PurchaseItemSnapshot[];
  @readonly @date('created_at') createdAt!: Date;

  @relation('stores', 'store_id') store!: Store;
  @children('purchase_items') purchaseItems!: Query<PurchaseItem>;
}
