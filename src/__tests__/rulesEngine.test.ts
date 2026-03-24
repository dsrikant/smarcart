/**
 * rulesEngine.test.ts
 *
 * Pure logic tests — no real DB, no network.
 * All cases use the mockDatabase helper to inject in-memory data.
 */

import {
  evaluateRules,
  evaluateAllStores,
  clearDebounceCache,
  clearAllDebounceCaches,
} from '../services/rulesEngine';
import type { Database } from '@nozbe/watermelondb';
import { RuleType, ListItemStatus } from '../types/enums';

// ─── Mock database helper ──────────────────────────────────────────────────────

interface MockRule {
  id: string;
  storeId: string;
  ruleType: RuleType;
  isActive: boolean;
  triggerItemId?: string | null;
  minOrderValueCents?: number | null;
  minItemCount?: number | null;
  cronExpression?: string | null;
}

interface MockListItemInput {
  id?: string;
  itemId: string;
  storeId: string;
  quantity: number;
  estimatedPriceCents: number | null;
  status?: ListItemStatus;
  canonicalName?: string;
}

function mockDatabase(opts: {
  rules: MockRule[];
  listItems: MockListItemInput[];
  storeIds?: string[];
}): Database {
  const { rules, listItems } = opts;

  const itemsMap = new Map<string, { id: string; canonicalName: string; estimatedPriceCents: number | null }>();
  listItems.forEach((li, idx) => {
    itemsMap.set(li.itemId, {
      id: li.itemId,
      canonicalName: li.canonicalName ?? `Item-${li.itemId}`,
      estimatedPriceCents: li.estimatedPriceCents,
    });
  });

  const makeQuery = (collection: string, conditions: Array<{ field: string; value: unknown }>) => {
    return {
      fetch: async () => {
        if (collection === 'purchase_rules') {
          return rules
            .filter((r) =>
              conditions.every((c) => {
                if (c.field === 'store_id') return r.storeId === c.value;
                if (c.field === 'is_active') return r.isActive === c.value;
                return true;
              }),
            )
            .map((r) => ({ ...r, id: r.id }));
        }
        if (collection === 'list_items') {
          return listItems
            .filter((li) =>
              conditions.every((c) => {
                if (c.field === 'store_id') return li.storeId === c.value;
                if (c.field === 'status') return (li.status ?? ListItemStatus.Pending) === c.value;
                return true;
              }),
            )
            .map((li, idx) => ({
              id: li.id ?? `li-${idx}`,
              itemId: li.itemId,
              storeId: li.storeId,
              quantity: li.quantity,
              status: li.status ?? ListItemStatus.Pending,
            }));
        }
        return [];
      },
    };
  };

  // Parse Q.where conditions from WatermelonDB Q objects.
  // WatermelonDB Q.where('col', value) produces:
  //   { type: 'where', left: 'col', comparison: { operator: 'eq', right: { value } } }
  function extractConditions(args: unknown[]): Array<{ field: string; value: unknown }> {
    return args
      .filter(
        (a): a is {
          type: string;
          left: string;
          comparison: { right: { value: unknown } };
        } =>
          typeof a === 'object' &&
          a !== null &&
          (a as Record<string, unknown>)['type'] === 'where' &&
          typeof (a as Record<string, unknown>)['left'] === 'string',
      )
      .map((a) => ({
        field: a.left,
        value: a.comparison?.right?.value ?? null,
      }));
  }

  return {
    get: (tableName: string) => ({
      query: (...args: unknown[]) => {
        const conditions = extractConditions(args);
        return makeQuery(tableName, conditions);
      },
      find: async (id: string) => {
        if (tableName === 'items') {
          const item = itemsMap.get(id);
          if (!item) throw new Error(`Item not found: ${id}`);
          return item;
        }
        throw new Error(`find not implemented for table: ${tableName}`);
      },
    }),
  } as unknown as Database;
}

// ─── Test state management: clear debounce between tests ──────────────────────

beforeEach(() => {
  clearAllDebounceCaches();
});

// ─── trigger_item ─────────────────────────────────────────────────────────────

describe('evaluateRules — trigger_item', () => {
  it('fires immediately when the newly added item matches trigger_item_id', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleId).toBe('r1');
    expect(result.triggeredBy?.status).toBe('fired');
  });

  it('does not fire when a different item is added', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
      ],
      listItems: [
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-b' });
    expect(result.shouldPurchase).toBe(false);
    expect(result.triggeredBy).toBeNull();
  });

  it('does not fire when the trigger_item rule is inactive', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: false,
          triggerItemId: 'item-a',
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.shouldPurchase).toBe(false);
    const ev = result.allRules.find((r) => r.ruleId === 'r1');
    expect(ev?.status).toBe('inactive');
  });

  it('includes the triggeredByItemId in the result when fired', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.triggeredBy?.triggeredByItemId).toBe('item-a');
  });
});

// ─── min_value ────────────────────────────────────────────────────────────────

describe('evaluateRules — min_value', () => {
  it('fires when estimated cart value meets the threshold', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 2000,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 2, estimatedPriceCents: 1000 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleType).toBe('min_value');
  });

  it('does not fire when cart value is below threshold', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 5000,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 1000 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(false);
  });

  it('sets hasIncompletePrice true when any item has null estimated_price_cents', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 1000,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.hasIncompletePrice).toBe(true);
  });

  it('treats null estimated_price_cents as zero for sum calculation', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 1000,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.estimatedCartValueCents).toBe(0);
    expect(result.shouldPurchase).toBe(false);
  });

  it('includes correct currentValueCents and thresholdValueCents in result', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 3000,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 2, estimatedPriceCents: 750 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const ev = result.allRules.find((r) => r.ruleId === 'r1');
    expect(ev?.currentValueCents).toBe(1500);
    expect(ev?.thresholdValueCents).toBe(3000);
  });
});

// ─── item_count ───────────────────────────────────────────────────────────────

describe('evaluateRules — item_count', () => {
  it('fires when pending item count meets the threshold', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 3,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null },
        { itemId: 'item-c', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleType).toBe('item_count');
  });

  it('does not fire when count is below threshold', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 5,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(false);
  });

  it('only counts items with status === pending (not purchasing/purchased/failed)', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 2,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null, status: ListItemStatus.Pending },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null, status: ListItemStatus.Purchased },
        { itemId: 'item-c', storeId: 's1', quantity: 1, estimatedPriceCents: null, status: ListItemStatus.Failed },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    // Only item-a is pending, so count is 1 — below threshold of 2
    expect(result.pendingItemCount).toBe(1);
    expect(result.shouldPurchase).toBe(false);
  });

  it('includes correct currentItemCount and thresholdItemCount in result', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 5,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
        { itemId: 'item-b', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const ev = result.allRules.find((r) => r.ruleId === 'r1');
    expect(ev?.currentItemCount).toBe(2);
    expect(ev?.thresholdItemCount).toBe(5);
  });
});

// ─── priority ─────────────────────────────────────────────────────────────────

describe('evaluateRules — priority', () => {
  it('trigger_item fires and skips min_value and item_count evaluation', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 100,
        },
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 1,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleId).toBe('r-trigger');

    const valueEv = result.allRules.find((r) => r.ruleId === 'r-value');
    const countEv = result.allRules.find((r) => r.ruleId === 'r-count');
    expect(valueEv?.status).toBe('skipped');
    expect(countEv?.status).toBe('skipped');
  });

  it('min_value fires and skips item_count when trigger_item does not fire', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-z',
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 500,
        },
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 1,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleId).toBe('r-value');

    const countEv = result.allRules.find((r) => r.ruleId === 'r-count');
    expect(countEv?.status).toBe('skipped');
  });

  it('item_count is last resort when trigger_item and min_value do not fire', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-z',
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 99999,
        },
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 1,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 100 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(true);
    expect(result.triggeredBy?.ruleId).toBe('r-count');
  });

  it('returns shouldPurchase false when no rules fire', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 100,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: null },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(false);
  });

  it('returns triggeredBy null when no rules fire', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 99999,
        },
      ],
      listItems: [],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.triggeredBy).toBeNull();
  });
});

// ─── scheduled rules ──────────────────────────────────────────────────────────

describe('evaluateRules — scheduled rules', () => {
  it('acknowledges scheduled rules without evaluating them', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-sched',
          storeId: 's1',
          ruleType: RuleType.Scheduled,
          isActive: true,
          cronExpression: '0 9 * * 1',
        },
      ],
      listItems: [],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const ev = result.allRules.find((r) => r.ruleId === 'r-sched');
    expect(ev?.status).toBe('acknowledged');
    expect(ev?.evaluationNote).toBe('Scheduled rules are evaluated by WorkManager');
  });

  it('scheduled rules never set shouldPurchase true', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-sched',
          storeId: 's1',
          ruleType: RuleType.Scheduled,
          isActive: true,
          cronExpression: '0 9 * * 1',
        },
      ],
      listItems: [],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.shouldPurchase).toBe(false);
  });
});

// ─── debounce ─────────────────────────────────────────────────────────────────

describe('evaluateRules — debounce', () => {
  it('returns cached result when called twice within 500ms for same store', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 10,
        },
      ],
      listItems: [],
    });

    const first = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(first.wasDebounced).toBe(false);

    const second = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(second.wasDebounced).toBe(true);
  });

  it('re-evaluates after 500ms has elapsed', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 10,
        },
      ],
      listItems: [],
    });

    const first = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(first.wasDebounced).toBe(false);

    // Manually expire the debounce by clearing the cache
    clearDebounceCache('s1');

    const third = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(third.wasDebounced).toBe(false);
  });

  it('sets wasDebounced true on cached result', async () => {
    const db = mockDatabase({
      rules: [],
      listItems: [],
    });

    await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const cached = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(cached.wasDebounced).toBe(true);
  });

  it('does not debounce calls for different stores', async () => {
    const db = mockDatabase({
      rules: [],
      listItems: [],
    });

    await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const s2 = await evaluateRules(db, { storeId: 's2', newlyAddedItemId: null });
    expect(s2.wasDebounced).toBe(false);
  });
});

// ─── allRules array ───────────────────────────────────────────────────────────

describe('evaluateRules — allRules array', () => {
  it('includes all rules in the result regardless of which fired', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 100,
        },
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 1,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 200 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    expect(result.allRules).toHaveLength(3);
    const ids = result.allRules.map((r) => r.ruleId);
    expect(ids).toContain('r-trigger');
    expect(ids).toContain('r-value');
    expect(ids).toContain('r-count');
  });

  it('rules appear in priority order: trigger_item, min_value, item_count, scheduled', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 10,
        },
        {
          id: 'r-sched',
          storeId: 's1',
          ruleType: RuleType.Scheduled,
          isActive: true,
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 99999,
        },
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-z',
        },
      ],
      listItems: [],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const types = result.allRules.map((r) => r.ruleType);
    expect(types.indexOf('trigger_item')).toBeLessThan(types.indexOf('min_value'));
    expect(types.indexOf('min_value')).toBeLessThan(types.indexOf('item_count'));
    expect(types.indexOf('item_count')).toBeLessThan(types.indexOf('scheduled'));
  });

  it('fired rule has status fired, lower rules have status skipped', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-trigger',
          storeId: 's1',
          ruleType: RuleType.TriggerItem,
          isActive: true,
          triggerItemId: 'item-a',
        },
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 100,
        },
      ],
      listItems: [
        { itemId: 'item-a', storeId: 's1', quantity: 1, estimatedPriceCents: 500 },
      ],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: 'item-a' });
    const triggerEv = result.allRules.find((r) => r.ruleId === 'r-trigger');
    const valueEv = result.allRules.find((r) => r.ruleId === 'r-value');
    expect(triggerEv?.status).toBe('fired');
    expect(valueEv?.status).toBe('skipped');
  });

  it('unfired rules have status pending when no rule fires', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r-value',
          storeId: 's1',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 99999,
        },
        {
          id: 'r-count',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 100,
        },
      ],
      listItems: [],
    });

    const result = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    expect(result.allRules.every((r) => r.status === 'pending')).toBe(true);
  });
});

// ─── evaluateAllStores ────────────────────────────────────────────────────────

describe('evaluateAllStores', () => {
  it('returns a result for every store that has at least one active rule', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 's1',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 5,
        },
        {
          id: 'r2',
          storeId: 's2',
          ruleType: RuleType.MinValue,
          isActive: true,
          minOrderValueCents: 1000,
        },
      ],
      listItems: [],
    });

    const results = await evaluateAllStores(db);
    expect(results.size).toBe(2);
    expect(results.has('s1')).toBe(true);
    expect(results.has('s2')).toBe(true);
  });

  it('result map key is storeId', async () => {
    const db = mockDatabase({
      rules: [
        {
          id: 'r1',
          storeId: 'store-abc',
          ruleType: RuleType.ItemCount,
          isActive: true,
          minItemCount: 1,
        },
      ],
      listItems: [],
    });

    const results = await evaluateAllStores(db);
    const result = results.get('store-abc');
    expect(result?.storeId).toBe('store-abc');
  });
});

// ─── clearDebounceCache ───────────────────────────────────────────────────────

describe('clearDebounceCache', () => {
  it('clears cache for one store without affecting others', async () => {
    const db = mockDatabase({ rules: [], listItems: [] });

    // Prime cache for both stores
    await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    await evaluateRules(db, { storeId: 's2', newlyAddedItemId: null });

    // Confirm both are cached
    const s1cached = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const s2cached = await evaluateRules(db, { storeId: 's2', newlyAddedItemId: null });
    expect(s1cached.wasDebounced).toBe(true);
    expect(s2cached.wasDebounced).toBe(true);

    // Clear only s1
    clearDebounceCache('s1');

    const s1fresh = await evaluateRules(db, { storeId: 's1', newlyAddedItemId: null });
    const s2stillCached = await evaluateRules(db, { storeId: 's2', newlyAddedItemId: null });
    expect(s1fresh.wasDebounced).toBe(false);
    expect(s2stillCached.wasDebounced).toBe(true);
  });
});
