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
import type { Database } from '@nozbe/watermelondb';
import type ListItem from '@/db/models/ListItem';
import type Item from '@/db/models/Item';
import type PurchaseRule from '@/db/models/PurchaseRule';
import { ListItemStatus, RuleType } from '@/types/enums';
import type {
  EvaluateRulesInput,
  EvaluationResult,
  EvaluatedRule,
  RuleEvaluationStatus,
} from './rulesEngine.types';

// ─── Debounce state ────────────────────────────────────────────────────────────

const lastCallTime = new Map<string, number>();
const lastResult = new Map<string, EvaluationResult>();
const DEBOUNCE_MS = 500;

// ─── Dollar formatting helper ──────────────────────────────────────────────────

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Note builders ─────────────────────────────────────────────────────────────

function buildTriggerItemNote(
  status: RuleEvaluationStatus,
  itemName: string,
  triggerItemName: string,
): string {
  if (status === 'fired') {
    return `Item "${itemName}" is your trigger item for this store`;
  }
  if (status === 'inactive') {
    return 'Trigger item rule is inactive';
  }
  return `Waiting for trigger item "${triggerItemName}" to be added`;
}

function buildMinValueNote(
  status: RuleEvaluationStatus,
  currentCents: number,
  thresholdCents: number,
  hasIncompletePrice: boolean,
): string {
  if (status === 'fired') {
    return `Cart value ${formatDollars(currentCents)} meets the ${formatDollars(thresholdCents)} threshold`;
  }
  if (hasIncompletePrice) {
    return `Estimated ${formatDollars(currentCents)} — some items have no price data`;
  }
  const remaining = thresholdCents - currentCents;
  return `${formatDollars(remaining)} more needed to reach ${formatDollars(thresholdCents)} threshold`;
}

function buildItemCountNote(
  status: RuleEvaluationStatus,
  count: number,
  threshold: number,
): string {
  if (status === 'fired') {
    return `${count} items meets the ${threshold} item threshold`;
  }
  const remaining = threshold - count;
  return `${count} of ${threshold} items — need ${remaining} more`;
}

// ─── Primary evaluation function ───────────────────────────────────────────────

export async function evaluateRules(
  database: Database,
  input: EvaluateRulesInput,
): Promise<EvaluationResult> {
  const { storeId, newlyAddedItemId } = input;
  const now = Date.now();

  // Debounce: return cached result if within 500ms
  const prev = lastCallTime.get(storeId);
  if (prev !== undefined && now - prev < DEBOUNCE_MS) {
    const cached = lastResult.get(storeId);
    if (cached) {
      return { ...cached, wasDebounced: true };
    }
  }

  lastCallTime.set(storeId, now);

  const result = await _doEvaluate(database, storeId, newlyAddedItemId, now);
  lastResult.set(storeId, result);
  return result;
}

async function _doEvaluate(
  database: Database,
  storeId: string,
  newlyAddedItemId: string | null,
  evaluatedAt: number,
): Promise<EvaluationResult> {
  // Fetch all rules for this store (active and inactive)
  const allRulesRaw = await database
    .get<PurchaseRule>('purchase_rules')
    .query(Q.where('store_id', storeId))
    .fetch();

  // Fetch pending list items for this store
  const pendingListItems = await database
    .get<ListItem>('list_items')
    .query(
      Q.where('store_id', storeId),
      Q.where('status', ListItemStatus.Pending),
    )
    .fetch();

  // Fetch item details for each list item (for price estimation)
  let hasIncompletePrice = false;
  let estimatedCartValueCents = 0;
  const itemMap = new Map<string, Item>();

  await Promise.all(
    pendingListItems.map(async (li) => {
      try {
        const item = await database.get<Item>('items').find(li.itemId);
        itemMap.set(li.itemId, item);
        if (item.estimatedPriceCents == null) {
          hasIncompletePrice = true;
        } else {
          estimatedCartValueCents += item.estimatedPriceCents * li.quantity;
        }
      } catch {
        hasIncompletePrice = true;
      }
    }),
  );

  const pendingItemCount = pendingListItems.length;

  // Sort rules into priority buckets
  const triggerItemRules = allRulesRaw.filter(
    (r) => r.ruleType === RuleType.TriggerItem,
  );
  const minValueRules = allRulesRaw.filter(
    (r) => r.ruleType === RuleType.MinValue,
  );
  const itemCountRules = allRulesRaw.filter(
    (r) => r.ruleType === RuleType.ItemCount,
  );
  const scheduledRules = allRulesRaw.filter(
    (r) => r.ruleType === RuleType.Scheduled,
  );

  const evaluatedRules: EvaluatedRule[] = [];
  let firedRule: EvaluatedRule | null = null;
  let shouldPurchase = false;

  // ── Priority 1: trigger_item ──────────────────────────────────────────────

  for (const rule of triggerItemRules) {
    if (firedRule !== null) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'trigger_item',
        status: 'skipped',
        evaluationNote: 'Skipped — higher priority rule already fired',
      });
      continue;
    }

    if (!rule.isActive) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'trigger_item',
        status: 'inactive',
        evaluationNote: buildTriggerItemNote('inactive', '', ''),
      });
      continue;
    }

    const triggerItemId = rule.triggerItemId;
    const fired =
      newlyAddedItemId !== null && triggerItemId === newlyAddedItemId;

    if (fired) {
      const triggerItem = triggerItemId ? itemMap.get(triggerItemId) : undefined;
      const itemName = triggerItem?.canonicalName ?? triggerItemId ?? '';
      const ev: EvaluatedRule = {
        ruleId: rule.id,
        ruleType: 'trigger_item',
        status: 'fired',
        triggeredByItemId: newlyAddedItemId,
        evaluationNote: buildTriggerItemNote('fired', itemName, itemName),
      };
      evaluatedRules.push(ev);
      firedRule = ev;
      shouldPurchase = true;
    } else {
      // Look up trigger item name for the note
      let triggerItemName = triggerItemId ?? '';
      if (triggerItemId) {
        try {
          const ti = await database.get<Item>('items').find(triggerItemId);
          triggerItemName = ti.canonicalName;
        } catch {
          // item not found — use id
        }
      }
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'trigger_item',
        status: 'pending',
        evaluationNote: buildTriggerItemNote('pending', '', triggerItemName),
      });
    }
  }

  // ── Priority 2: min_value ─────────────────────────────────────────────────

  for (const rule of minValueRules) {
    if (firedRule !== null) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'min_value',
        status: 'skipped',
        currentValueCents: estimatedCartValueCents,
        thresholdValueCents: rule.minOrderValueCents ?? undefined,
        evaluationNote: 'Skipped — higher priority rule already fired',
      });
      continue;
    }

    if (!rule.isActive) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'min_value',
        status: 'inactive',
        currentValueCents: estimatedCartValueCents,
        thresholdValueCents: rule.minOrderValueCents ?? undefined,
        evaluationNote: 'Trigger item rule is inactive',
      });
      continue;
    }

    const threshold = rule.minOrderValueCents ?? 0;
    const fired = estimatedCartValueCents >= threshold;

    const status: RuleEvaluationStatus = fired ? 'fired' : 'pending';
    const note = buildMinValueNote(
      status,
      estimatedCartValueCents,
      threshold,
      hasIncompletePrice,
    );
    const ev: EvaluatedRule = {
      ruleId: rule.id,
      ruleType: 'min_value',
      status,
      currentValueCents: estimatedCartValueCents,
      thresholdValueCents: threshold,
      evaluationNote: note,
    };
    evaluatedRules.push(ev);
    if (fired) {
      firedRule = ev;
      shouldPurchase = true;
    }
  }

  // ── Priority 3: item_count ────────────────────────────────────────────────

  for (const rule of itemCountRules) {
    if (firedRule !== null) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'item_count',
        status: 'skipped',
        currentItemCount: pendingItemCount,
        thresholdItemCount: rule.minItemCount ?? undefined,
        evaluationNote: 'Skipped — higher priority rule already fired',
      });
      continue;
    }

    if (!rule.isActive) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: 'item_count',
        status: 'inactive',
        currentItemCount: pendingItemCount,
        thresholdItemCount: rule.minItemCount ?? undefined,
        evaluationNote: 'Trigger item rule is inactive',
      });
      continue;
    }

    const threshold = rule.minItemCount ?? 0;
    const fired = pendingItemCount >= threshold;
    const status: RuleEvaluationStatus = fired ? 'fired' : 'pending';
    const ev: EvaluatedRule = {
      ruleId: rule.id,
      ruleType: 'item_count',
      status,
      currentItemCount: pendingItemCount,
      thresholdItemCount: threshold,
      evaluationNote: buildItemCountNote(status, pendingItemCount, threshold),
    };
    evaluatedRules.push(ev);
    if (fired) {
      firedRule = ev;
      shouldPurchase = true;
    }
  }

  // ── Scheduled: acknowledge without evaluating ─────────────────────────────

  for (const rule of scheduledRules) {
    evaluatedRules.push({
      ruleId: rule.id,
      ruleType: 'scheduled',
      status: 'acknowledged',
      evaluationNote: 'Scheduled rules are evaluated by WorkManager',
    });
  }

  return {
    storeId,
    evaluatedAt,
    shouldPurchase,
    triggeredBy: firedRule,
    allRules: evaluatedRules,
    pendingItemCount,
    estimatedCartValueCents,
    hasIncompletePrice,
    wasDebounced: false,
  };
}

// ─── Evaluate all stores ───────────────────────────────────────────────────────

export async function evaluateAllStores(
  database: Database,
): Promise<Map<string, EvaluationResult>> {
  const allRules = await database
    .get<PurchaseRule>('purchase_rules')
    .query(Q.where('is_active', true))
    .fetch();

  const storeIds = [...new Set(allRules.map((r) => r.storeId))];

  const entries = await Promise.all(
    storeIds.map(async (storeId) => {
      const result = await evaluateRules(database, {
        storeId,
        newlyAddedItemId: null,
      });
      return [storeId, result] as const;
    }),
  );

  return new Map(entries);
}

// ─── Debounce cache management ────────────────────────────────────────────────

export function clearDebounceCache(storeId: string): void {
  lastCallTime.delete(storeId);
  lastResult.delete(storeId);
}

export function clearAllDebounceCaches(): void {
  lastCallTime.clear();
  lastResult.clear();
}
