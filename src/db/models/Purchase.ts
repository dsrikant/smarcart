import { Model } from '@nozbe/watermelondb';
import { field, relation, children, readonly, date } from '@nozbe/watermelondb/decorators';
import { PurchaseStatus } from '@/types/enums';
import Store from './Store';

export default class Purchase extends Model {
  static table = 'purchases';
  static associations = {
    stores: { type: 'belongs_to' as const, key: 'store_id' },
    purchase_items: { type: 'has_many' as const, foreignKey: 'purchase_id' },
  };

  @field('store_id') storeId!: string;
  @field('order_id') orderId!: string | null;
  @field('placed_at') placedAt!: number;
  @field('total_amount_cents') totalAmountCents!: number | null;
  @field('status') status!: PurchaseStatus;
  @field('items_json') itemsJson!: string;
  @readonly @date('created_at') createdAt!: Date;

  @relation('stores', 'store_id') store!: Store;
  @children('purchase_items') purchaseItems!: any;
}
