import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type Purchase from './Purchase';
import type Item from './Item';

export default class PurchaseItem extends Model {
  static table = 'purchase_items';
  static associations = {
    purchases: { type: 'belongs_to' as const, key: 'purchase_id' },
    items: { type: 'belongs_to' as const, key: 'item_id' },
  };

  @field('purchase_id') purchaseId!: string;
  @field('item_id') itemId!: string;
  @field('brand') brand!: string | null;
  @field('product_title') productTitle!: string | null;
  @field('product_url') productUrl!: string | null;
  @field('price_cents') priceCents!: number | null;
  @field('quantity') quantity!: number;

  @relation('purchases', 'purchase_id') purchase!: Purchase;
  @relation('items', 'item_id') item!: Item;
}
