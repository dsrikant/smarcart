import { Model } from '@nozbe/watermelondb';
import { field, relation, date } from '@nozbe/watermelondb/decorators';
import { ListItemStatus } from '@/types/enums';
import Item from './Item';
import Store from './Store';

export default class ListItem extends Model {
  static table = 'list_items';
  static associations = {
    items: { type: 'belongs_to' as const, key: 'item_id' },
    stores: { type: 'belongs_to' as const, key: 'store_id' },
  };

  @field('item_id') itemId!: string;
  @field('store_id') storeId!: string;
  @field('status') status!: ListItemStatus;
  @field('quantity') quantity!: number;
  @field('added_at') addedAt!: number;
  @field('voice_transcript') voiceTranscript!: string | null;
  @field('confidence_score') confidenceScore!: number | null;
  @date('updated_at') updatedAt!: Date;

  @relation('items', 'item_id') item!: Item;
  @relation('stores', 'store_id') store!: Store;
}
