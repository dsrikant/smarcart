import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  relation,
  json,
} from '@nozbe/watermelondb/decorators';
import type Item from './Item';

export type ParsedIntent = {
  itemName: string;
  quantity: number;
  storeId: string;
  brand: string | null;
  confidence: number;
  isNewItem: boolean;
  urgency: 'normal' | 'urgent';
};

const sanitizeParsedJson = (raw: unknown): ParsedIntent | null => {
  if (typeof raw === 'object' && raw !== null) return raw as ParsedIntent;
  return null;
};

export default class VoiceLog extends Model {
  static table = 'voice_logs';
  static associations = {
    items: { type: 'belongs_to' as const, key: 'item_id' },
  };

  @field('transcript') transcript!: string;
  @json('parsed_json', sanitizeParsedJson) parsedJson!: ParsedIntent | null;
  @field('item_id') itemId!: string | null;
  @field('was_corrected') wasCorrected!: boolean;
  @readonly @date('created_at') createdAt!: Date;

  @relation('items', 'item_id') item!: Item | null;
}
