import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type Store from './Store';
import type Item from './Item';
import { RuleType } from '../../types/enums';

export { RuleType };

export default class PurchaseRule extends Model {
  static table = 'purchase_rules';
  static associations = {
    stores: { type: 'belongs_to' as const, key: 'store_id' },
    items: { type: 'belongs_to' as const, key: 'trigger_item_id' },
  };

  @field('store_id') storeId!: string;
  @field('rule_type') ruleType!: RuleType;
  @field('trigger_item_id') triggerItemId!: string | null;
  @field('min_order_value_cents') minOrderValueCents!: number | null;
  @field('min_item_count') minItemCount!: number | null;
  @field('cron_expression') cronExpression!: string | null;
  @field('is_active') isActive!: boolean;
  @field('last_run_at') lastRunAt!: number | null;
  @readonly @date('created_at') createdAt!: Date;

  @relation('stores', 'store_id') store!: Store;
  @relation('items', 'trigger_item_id') triggerItem!: Item | null;
}
