import { Model } from '@nozbe/watermelondb';
import { field, relation, readonly, date } from '@nozbe/watermelondb/decorators';
import Item from './Item';

export default class VoiceLog extends Model {
  static table = 'voice_logs';
  static associations = {
    items: { type: 'belongs_to' as const, key: 'item_id' },
  };

  @field('transcript') transcript!: string;
  @field('parsed_json') parsedJson!: string | null;
  @field('item_id') itemId!: string | null;
  @field('was_corrected') wasCorrected!: boolean;
  @readonly @date('created_at') createdAt!: Date;

  @relation('items', 'item_id') item!: Item | null;
}
