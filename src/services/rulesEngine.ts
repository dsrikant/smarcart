/**
 * rulesEngine.ts
 *
 * Phase 1: Dry-run rule evaluator.
 * Returns whether a purchase should be triggered and why.
 * NO side effects, NO network calls, NO actual purchasing.
 *
 * Phase 3 will wire the result of evaluateRules() to the automation layer.
 */

import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import ListItem from '@/db/models/ListItem';
import PurchaseRule from '@/db/models/PurchaseRule';
import { ListItemStatus, RuleType } from '@/types/enums';

export interface RuleEvalResult {
  shouldPurchase: boolean;
  triggeredBy: PurchaseRule | null;
  estimatedTotal: number; // cents
}

// ─── Debounce state ────────────────────────────────────────────────────────────

const pendingEvals = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Evaluates active purchase rules for a given store.
 * Debounced: if called twice within 500ms for the same storeId,
 * only the second call is processed.
 *
 * @param storeId - The store to evaluate rules for
 * @param newlyAddedItemId - Optional: item just added (for trigger_item rule)
 */
export function evaluateRules(
  storeId: string,
  newlyAddedItemId?: string
): Promise<RuleEvalResult> {
  return new Promise((resolve, reject) => {
    const existing = pendingEvals.get(storeId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      pendingEvals.delete(storeId);
      _doEvaluate(storeId, newlyAddedItemId).then(resolve).catch(reject);
    }, 500);

    pendingEvals.set(storeId, timer);
  });
}

async function _doEvaluate(
  storeId: string,
  newlyAddedItemId?: string
): Promise<RuleEvalResult> {
  const rulesCollection = database.get<PurchaseRule>('purchase_rules');
  const listItemsCollection = database.get<ListItem>('list_items');

  // Fetch all active rules for this store
  const activeRules = await rulesCollection
    .query(
      Q.where('store_id', storeId),
      Q.where('is_active', true)
    )
    .fetch();

  // Fetch all pending list items for this store
  const pendingItems = await listItemsCollection
    .query(
      Q.where('store_id', storeId),
      Q.where('status', ListItemStatus.Pending)
    )
    .fetch();

  // Estimate total from items (items must be fetched with estimated_price_cents)
  const itemsCollection = database.get<any>('items');
  let estimatedTotal = 0;
  for (const listItem of pendingItems) {
    try {
      const item = await itemsCollection.find(listItem.itemId);
      if (item.estimatedPriceCents != null) {
        estimatedTotal += item.estimatedPriceCents * listItem.quantity;
      }
    } catch {
      // Item may not exist yet (edge case) — skip
    }
  }

  // Priority 1: trigger_item
  if (newlyAddedItemId) {
    const triggerRule = activeRules.find(
      (r) =>
        r.ruleType === RuleType.TriggerItem &&
        r.triggerItemId === newlyAddedItemId
    );
    if (triggerRule) {
      return { shouldPurchase: true, triggeredBy: triggerRule, estimatedTotal };
    }
  }

  // Priority 2: min_value
  const minValueRule = activeRules.find(
    (r) =>
      r.ruleType === RuleType.MinValue &&
      r.minOrderValueCents !== null &&
      estimatedTotal >= r.minOrderValueCents
  );
  if (minValueRule) {
    return { shouldPurchase: true, triggeredBy: minValueRule, estimatedTotal };
  }

  // Priority 3: item_count
  const itemCountRule = activeRules.find(
    (r) =>
      r.ruleType === RuleType.ItemCount &&
      r.minItemCount !== null &&
      pendingItems.length >= r.minItemCount
  );
  if (itemCountRule) {
    return { shouldPurchase: true, triggeredBy: itemCountRule, estimatedTotal };
  }

  // Priority 4: scheduled — WorkManager integration pending (Phase 3)
  const hasScheduledRule = activeRules.some(
    (r) => r.ruleType === RuleType.Scheduled
  );
  if (hasScheduledRule) {
    console.log(
      '[RulesEngine] Scheduled rule detected. WorkManager integration pending (Phase 3).'
    );
  }

  return { shouldPurchase: false, triggeredBy: null, estimatedTotal };
}
