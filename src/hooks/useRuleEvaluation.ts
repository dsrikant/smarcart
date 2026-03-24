import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import type ListItem from '@/db/models/ListItem';
import { ListItemStatus } from '@/types/enums';
import {
  evaluateRules,
  evaluateAllStores,
} from '@/services/rulesEngine';
import type { EvaluationResult } from '@/services/rulesEngine.types';

type UseRuleEvaluationResult = {
  evaluation: EvaluationResult | null;
  isLoading: boolean;
  error: Error | null;
  reEvaluate: () => Promise<void>;
};

/**
 * Reactive hook that re-evaluates purchase rules whenever the store's
 * pending list items change. Pass newlyAddedItemId: null for reactive
 * re-evaluations (general state refresh, not triggered by a specific add).
 */
export function useRuleEvaluation(storeId: string): UseRuleEvaluationResult {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const runEvaluation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await evaluateRules(database, {
        storeId,
        newlyAddedItemId: null,
      });
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    // Run immediately on mount / storeId change
    runEvaluation();

    // Subscribe to pending list items for this store; re-evaluate on change
    const subscription = database
      .get<ListItem>('list_items')
      .query(
        Q.where('store_id', storeId),
        Q.where('status', ListItemStatus.Pending),
      )
      .observe()
      .subscribe({
        next: () => {
          runEvaluation();
        },
        error: (err: Error) => {
          setError(err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [storeId, runEvaluation]);

  return {
    evaluation,
    isLoading,
    error,
    reEvaluate: runEvaluation,
  };
}

type UseAllRuleEvaluationsResult = {
  evaluations: Map<string, EvaluationResult>;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Evaluate all stores — for the Rules tab overview screen.
 */
export function useAllRuleEvaluations(): UseAllRuleEvaluationsResult {
  const [evaluations, setEvaluations] = useState<Map<string, EvaluationResult>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const runAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await evaluateAllStores(database);
      setEvaluations(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runAll();

    // Re-evaluate whenever any pending list item changes across all stores
    const subscription = database
      .get<ListItem>('list_items')
      .query(Q.where('status', ListItemStatus.Pending))
      .observe()
      .subscribe({
        next: () => {
          runAll();
        },
        error: (err: Error) => {
          setError(err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [runAll]);

  return { evaluations, isLoading, error };
}
