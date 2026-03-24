import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import PurchaseRule from '@/db/models/PurchaseRule';
import Store from '@/db/models/Store';
import Item from '@/db/models/Item';
import { RuleType } from '@/types/enums';

export const RULES_QUERY_KEY = 'purchaseRules';

export interface RuleWithRelations {
  rule: PurchaseRule;
  store: Store | null;
  triggerItem: Item | null;
}

export function usePurchaseRules() {
  return useQuery({
    queryKey: [RULES_QUERY_KEY],
    queryFn: async () => {
      const rules = await database.get<PurchaseRule>('purchase_rules').query().fetch();
      const results: RuleWithRelations[] = await Promise.all(
        rules.map(async (r) => {
          let store: Store | null = null;
          let triggerItem: Item | null = null;
          try {
            store = await database.get<Store>('stores').find(r.storeId);
          } catch {
            // store deleted
          }
          if (r.triggerItemId) {
            try {
              triggerItem = await database.get<Item>('items').find(r.triggerItemId);
            } catch {
              // item deleted
            }
          }
          return { rule: r, store, triggerItem };
        })
      );
      return results;
    },
  });
}

export function useRulesForStore(storeId: string) {
  return useQuery({
    queryKey: [RULES_QUERY_KEY, 'byStore', storeId],
    queryFn: () =>
      database
        .get<PurchaseRule>('purchase_rules')
        .query(Q.where('store_id', storeId))
        .fetch(),
    enabled: !!storeId,
  });
}

export interface CreateRulePayload {
  storeId: string;
  ruleType: RuleType;
  triggerItemId: string | null;
  minOrderValueCents: number | null;
  minItemCount: number | null;
  cronExpression: string | null;
  isActive: boolean;
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload): Promise<PurchaseRule> => {
      let created!: PurchaseRule;
      await database.write(async () => {
        created = await database.get<PurchaseRule>('purchase_rules').create((record) => {
          record.storeId = payload.storeId;
          record.ruleType = payload.ruleType;
          record.triggerItemId = payload.triggerItemId;
          record.minOrderValueCents = payload.minOrderValueCents;
          record.minItemCount = payload.minItemCount;
          record.cronExpression = payload.cronExpression;
          record.isActive = payload.isActive;
          record.lastRunAt = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.created_at = Date.now();
        });
      });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
  });
}

export interface UpdateRulePayload {
  id: string;
  storeId: string;
  ruleType: RuleType;
  triggerItemId: string | null;
  minOrderValueCents: number | null;
  minItemCount: number | null;
  cronExpression: string | null;
  isActive: boolean;
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateRulePayload): Promise<void> => {
      const rule = await database.get<PurchaseRule>('purchase_rules').find(payload.id);
      await database.write(async () => {
        await rule.update((record) => {
          record.storeId = payload.storeId;
          record.ruleType = payload.ruleType;
          record.triggerItemId = payload.triggerItemId;
          record.minOrderValueCents = payload.minOrderValueCents;
          record.minItemCount = payload.minItemCount;
          record.cronExpression = payload.cronExpression;
          record.isActive = payload.isActive;
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      const rule = await database.get<PurchaseRule>('purchase_rules').find(ruleId);
      await database.write(async () => {
        await rule.destroyPermanently();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
  });
}

export function useToggleRuleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }): Promise<void> => {
      const rule = await database.get<PurchaseRule>('purchase_rules').find(id);
      await database.write(async () => {
        await rule.update((record) => {
          record.isActive = isActive;
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
  });
}
