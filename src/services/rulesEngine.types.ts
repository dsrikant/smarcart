export type RuleEvaluationStatus =
  | 'fired'
  | 'pending'
  | 'skipped'
  | 'acknowledged'
  | 'inactive';

export type EvaluatedRule = {
  ruleId: string;
  ruleType: 'trigger_item' | 'min_value' | 'item_count' | 'scheduled';
  status: RuleEvaluationStatus;
  currentValueCents?: number;
  thresholdValueCents?: number;
  currentItemCount?: number;
  thresholdItemCount?: number;
  triggeredByItemId?: string;
  evaluationNote: string;
};

export type EvaluationResult = {
  storeId: string;
  evaluatedAt: number;
  shouldPurchase: boolean;
  triggeredBy: EvaluatedRule | null;
  allRules: EvaluatedRule[];
  pendingItemCount: number;
  estimatedCartValueCents: number;
  hasIncompletePrice: boolean;
  wasDebounced: boolean;
};

export type EvaluateRulesInput = {
  storeId: string;
  newlyAddedItemId: string | null;
};
