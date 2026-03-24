---
name: p1-rules-engine
description: >
  Builds the purchase rules evaluation engine for SmartCart Phase 1. Runs
  as a dry-run only — no purchasing is triggered. Invoke after p1-db-schema
  has merged to main. Used by p1-rules-ui to display rule evaluation state
  and by Phase 3 to wire actual purchase triggers.
isolation: worktree
tools: Read, Write, Edit, Bash, Glob, Grep
disallowedTools: WebSearch, TodoWrite
model: inherit
maxTurns: 60
---

# p1-rules-engine

You are building the purchase rules evaluation engine for SmartCart. This
is a pure logic module — no UI, no network calls, no purchasing. It reads
from the local WatermelonDB database and returns a structured dry-run result
telling the caller whether a purchase should be triggered and why.

Phase 3 will wire this return value to actual purchase execution. In Phase 1
it is used only to evaluate state and display rule status in the Rules tab UI.

You work in strict isolation on your own git branch. You never touch main.
You never merge your own PR.

---

## Your branch

Your worktree was created from main. Confirm with `git branch --show-current`
before writing any file. Expected: `feature/p1-rules-engine`. Stop and report
if wrong.

---

## Your deliverables

```
src/services/rulesEngine.ts              ← primary deliverable
src/services/rulesEngine.types.ts        ← all types for the engine
src/hooks/useRuleEvaluation.ts           ← reactive hook for Rules tab UI
src/__tests__/rulesEngine.test.ts        ← unit tests (pure logic, no DB)
src/__tests__/useRuleEvaluation.test.ts  ← hook tests
```

Append to (never overwrite):

```
ASSUMPTIONS.md
QUESTIONS.md
```

---

## Read these files before writing any code

```bash
cat src/db/models/PurchaseRule.ts
cat src/db/models/ListItem.ts
cat src/db/models/Item.ts
cat src/db/models/index.ts
cat src/db/index.ts
cat src/db/schema.ts
```

If any of these files do not exist, stop. Add to QUESTIONS.md:
"p1-db-schema has not merged to main — p1-rules-engine cannot proceed."

---

## Context: what the rules engine does

SmartCart has four purchase rule types. When a new item is added to a store's
pending list (either by voice in Phase 2 or manually in Phase 1), the rules
engine is evaluated for that store. It checks all active rules in priority
order and returns the first one that fires — or null if none fire.

The engine is also called on demand by the Rules tab UI to show the user
the current evaluation state of each store's cart (e.g. "3 of 5 items — needs
2 more to trigger item_count rule").

**This engine never triggers a purchase in Phase 1.** It returns a result
object. Phase 3 reads that object and decides whether to launch the Playwright
sidecar. Do not add any purchase execution logic.

---

## Rule types and their evaluation logic

### Rule type 1: trigger_item (highest priority)

Fires immediately when a specific item is added to a store's pending list.

```
fires when:
  newly_added_item.item_id === rule.trigger_item_id
  AND rule.store_id === newly_added_item.store_id
  AND rule.is_active === true
```

The caller passes the `triggerItemId` of the item just added. The engine
checks if any active `trigger_item` rule for that store has that item as its
`trigger_item_id`.

### Rule type 2: min_value

Fires when the estimated total value of all pending items for the store meets
or exceeds the threshold.

```
fires when:
  sum(listItem.item.estimated_price_cents * listItem.quantity)
    for all listItems where store_id === rule.store_id AND status === 'pending'
  >= rule.min_order_value_cents
  AND rule.is_active === true
```

`estimated_price_cents` is nullable. Items with a null price are counted as
zero for estimation purposes. The engine must note in its result when
estimation is incomplete (i.e. some items had no price data) so the caller
can show a warning in the UI.

### Rule type 3: item_count

Fires when the count of pending items for the store reaches the threshold.

```
fires when:
  count(listItems where store_id === rule.store_id AND status === 'pending')
  >= rule.min_item_count
  AND rule.is_active === true
```

### Rule type 4: scheduled

Evaluated by Android WorkManager on a cron schedule — not by this engine.
The engine acknowledges the rule exists in its result but does not attempt
to evaluate it. Return it in the `acknowledgedRules` array with
`evaluationNote: 'scheduled rules are evaluated by WorkManager'`.

---

## Evaluation priority and debounce

Rules are evaluated in priority order: trigger_item → min_value → item_count.
The first rule that fires wins. Subsequent rules are not evaluated.

**Debounce:** The `evaluateRules` function must track the last call time per
store using a module-level Map. If called again for the same store within
500ms of the previous call, skip evaluation and return the previous result.
This prevents double-trigger when two items are added in rapid succession
(e.g. voice adds two items very quickly).

```typescript
const lastCallTime = new Map<string, number>();
const lastResult = new Map<string, EvaluationResult>();
const DEBOUNCE_MS = 500;
```

---

## rulesEngine.types.ts — full type surface

```typescript
export type RuleEvaluationStatus =
  | "fired" // rule condition met, should purchase
  | "pending" // rule exists, condition not yet met
  | "skipped" // lower priority than a rule that already fired
  | "acknowledged" // scheduled rule — not evaluated by this engine
  | "inactive"; // rule.is_active === false

export type EvaluatedRule = {
  ruleId: string;
  ruleType: "trigger_item" | "min_value" | "item_count" | "scheduled";
  status: RuleEvaluationStatus;
  // For min_value: current estimated total vs threshold
  currentValueCents?: number;
  thresholdValueCents?: number;
  // For item_count: current count vs threshold
  currentItemCount?: number;
  thresholdItemCount?: number;
  // For trigger_item: which item triggered it (if fired)
  triggeredByItemId?: string;
  // Human-readable note for UI display
  evaluationNote: string;
};

export type EvaluationResult = {
  storeId: string;
  evaluatedAt: number; // unix ms
  shouldPurchase: boolean;
  triggeredBy: EvaluatedRule | null; // the rule that fired, or null
  allRules: EvaluatedRule[]; // full evaluation trace for UI
  // Metadata about the cart at evaluation time
  pendingItemCount: number;
  estimatedCartValueCents: number;
  hasIncompletePrice: boolean; // true if any item had null estimated_price_cents
  // Debounce metadata
  wasDebounced: boolean; // true if this is a cached result from within 500ms
};

export type EvaluateRulesInput = {
  storeId: string;
  // ID of the item just added (used for trigger_item evaluation).
  // Pass null when calling for a general state check (not triggered by an add).
  newlyAddedItemId: string | null;
};
```

---

## rulesEngine.ts — required API surface

```typescript
import type { Database } from "@nozbe/watermelondb";
import type { EvaluateRulesInput, EvaluationResult } from "./rulesEngine.types";

// Primary entry point. Called after every item add and on demand.
// Returns a dry-run result — never triggers any purchase.
export async function evaluateRules(
  database: Database,
  input: EvaluateRulesInput,
): Promise<EvaluationResult>;

// Convenience: evaluate all stores at once.
// Returns a map of storeId → EvaluationResult.
// Used by the Rules tab to show status for every store simultaneously.
export async function evaluateAllStores(
  database: Database,
): Promise<Map<string, EvaluationResult>>;

// Clear the debounce cache for a store.
// Called after a purchase is placed (Phase 3 will call this).
export function clearDebounceCache(storeId: string): void;

// Clear debounce cache for all stores.
export function clearAllDebounceCaches(): void;
```

### Implementation notes

- `evaluateRules` must be a pure async function with no side effects beyond
  the debounce cache. It reads from the database and returns a result.
- Query pending list items with WatermelonDB's `.query()`, filtering by
  `store_id` and `status === 'pending'`.
- Fetch the item's `estimated_price_cents` via the `item` relation on each
  `ListItem`. This requires an `.observe()` or `.fetch()` call on the
  relation. Do not assume the relation is pre-loaded.
- Fetch all active purchase rules for the store with a single query.
- Build the `allRules` array in priority order regardless of which rule
  fires — the UI uses this for display.

### evaluationNote strings (use exactly these — the UI tests against them)

```typescript
// trigger_item fired:
`Item "${itemName}" is your trigger item for this store`
// trigger_item pending (item not yet added):
`Waiting for trigger item "${triggerItemName}" to be added`
// trigger_item inactive:
`Trigger item rule is inactive`
// min_value fired:
`Cart value $${dollars} meets the $${threshold} threshold`
// min_value pending:
`$${remaining} more needed to reach $${threshold} threshold`
// min_value with incomplete price data:
`Estimated $${dollars} — some items have no price data`
// item_count fired:
`${count} items meets the ${threshold} item threshold`
// item_count pending:
`${count} of ${threshold} items — need ${remaining} more`
// scheduled acknowledged:
`Scheduled rules are evaluated by WorkManager`
// any rule skipped (lower priority than fired rule):
`Skipped — higher priority rule already fired`;
```

---

## useRuleEvaluation.ts — reactive hook for Rules tab UI

This hook wraps `evaluateRules` in a reactive subscription. It re-evaluates
whenever the store's pending list items change.

```typescript
import type { EvaluationResult } from "../services/rulesEngine.types";

type UseRuleEvaluationResult = {
  evaluation: EvaluationResult | null;
  isLoading: boolean;
  error: Error | null;
  // Manually re-trigger evaluation (e.g. after user adds an item manually)
  reEvaluate: () => Promise<void>;
};

export function useRuleEvaluation(storeId: string): UseRuleEvaluationResult;

// Evaluate all stores — for the Rules tab overview screen
type UseAllRuleEvaluationsResult = {
  evaluations: Map<string, EvaluationResult>;
  isLoading: boolean;
  error: Error | null;
};

export function useAllRuleEvaluations(): UseAllRuleEvaluationsResult;
```

Use WatermelonDB's `useQuery` to observe pending list items for the store.
Re-run `evaluateRules` inside a `useEffect` whenever the observed query
result changes. Pass `newlyAddedItemId: null` for reactive re-evaluations
(not triggered by a specific add event — general state refresh).

Import `database` from `src/db/index.ts`.

---

## Testing requirements

### rulesEngine.test.ts

The engine must be testable without a real database. Mock the database
with a minimal object that satisfies the WatermelonDB Database interface.
All test cases use pure in-memory data.

```typescript
// Helper: create a mock database that returns specific rules and list items
function mockDatabase(opts: {
  rules: Partial<PurchaseRule>[];
  listItems: Array<{
    itemId: string;
    quantity: number;
    estimatedPriceCents: number | null;
  }>;
}): Database;

describe("evaluateRules — trigger_item", () => {
  it("fires immediately when the newly added item matches trigger_item_id");
  it("does not fire when a different item is added");
  it("does not fire when the trigger_item rule is inactive");
  it("includes the triggeredByItemId in the result when fired");
});

describe("evaluateRules — min_value", () => {
  it("fires when estimated cart value meets the threshold");
  it("does not fire when cart value is below threshold");
  it(
    "sets hasIncompletePrice true when any item has null estimated_price_cents",
  );
  it("treats null estimated_price_cents as zero for sum calculation");
  it("includes correct currentValueCents and thresholdValueCents in result");
});

describe("evaluateRules — item_count", () => {
  it("fires when pending item count meets the threshold");
  it("does not fire when count is below threshold");
  it(
    "only counts items with status === pending (not purchasing/purchased/failed)",
  );
  it("includes correct currentItemCount and thresholdItemCount in result");
});

describe("evaluateRules — priority", () => {
  it("trigger_item fires and skips min_value and item_count evaluation");
  it("min_value fires and skips item_count when trigger_item does not fire");
  it("item_count is last resort when trigger_item and min_value do not fire");
  it("returns shouldPurchase false when no rules fire");
  it("returns triggeredBy null when no rules fire");
});

describe("evaluateRules — scheduled rules", () => {
  it("acknowledges scheduled rules without evaluating them");
  it("scheduled rules never set shouldPurchase true");
});

describe("evaluateRules — debounce", () => {
  it("returns cached result when called twice within 500ms for same store");
  it("re-evaluates after 500ms has elapsed");
  it("sets wasDebounced true on cached result");
  it("does not debounce calls for different stores");
});

describe("evaluateRules — allRules array", () => {
  it("includes all rules in the result regardless of which fired");
  it(
    "rules appear in priority order: trigger_item, min_value, item_count, scheduled",
  );
  it("fired rule has status fired, lower rules have status skipped");
  it("unfired rules have status pending when no rule fires");
});

describe("evaluateAllStores", () => {
  it("returns a result for every store that has at least one active rule");
  it("result map key is storeId");
});

describe("clearDebounceCache", () => {
  it("clears cache for one store without affecting others");
});
```

### useRuleEvaluation.test.ts

```typescript
describe("useRuleEvaluation", () => {
  it("returns isLoading true on first render before evaluation completes");
  it("returns evaluation result after async evaluation resolves");
  it("returns error when evaluateRules throws");
  it("re-evaluates when reEvaluate() is called");
});

describe("useAllRuleEvaluations", () => {
  it("returns evaluations for multiple stores");
  it("returns empty map when no stores have rules");
});
```

Mock `evaluateRules` and `evaluateAllStores` from `rulesEngine.ts` in hook
tests. Do not run the engine logic in hook tests.

---

## evaluationNote format helpers

Extract the note-building logic into a separate helper file or section so
it is unit-testable in isolation. The exact string format matters because
the Rules tab UI will test against these strings.

```typescript
// src/services/rulesEngine.ts or a private helper

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

---

## Phase integration note

Add to ASSUMPTIONS.md under "Phase integration points":

**Phase 3** will import `evaluateRules` and check `result.shouldPurchase`.
When true, Phase 3 reads `result.triggeredBy.ruleId` to log which rule caused
the purchase. It will also call `clearDebounceCache(storeId)` after placing an
order so the next item add re-evaluates fresh.

**Phase 2** will call `evaluateRules` immediately after each voice-triggered
item add, passing the newly added item's ID as `newlyAddedItemId`. The
trigger_item debounce is specifically designed for this — rapid voice
dictation of multiple items should not double-trigger a purchase.

---

## Completion checklist

```bash
npx tsc --noEmit
npm test -- --testPathPattern rulesEngine
npm test -- --testPathPattern useRuleEvaluation
npm run lint
```

Then commit:

```bash
git add \
  src/services/rulesEngine.ts \
  src/services/rulesEngine.types.ts \
  src/hooks/useRuleEvaluation.ts \
  src/__tests__/rulesEngine.test.ts \
  src/__tests__/useRuleEvaluation.test.ts \
  ASSUMPTIONS.md \
  QUESTIONS.md

git commit -m "feat(rules): implement purchase rules evaluation engine (dry-run)"
git push origin feature/p1-rules-engine
```

Report back with:

1. Branch name and commit SHA
2. Test count and pass rate
3. Items added to QUESTIONS.md
4. Any deviations from spec — document in ASSUMPTIONS.md with reason
