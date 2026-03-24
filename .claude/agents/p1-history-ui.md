---
name: p1-history-ui
description: >
  Builds the History tab — a read-only log of all past purchases, expandable
  to show line items, with status chips and total amounts. Invoke after
  p1-db-schema has merged to main. Does not depend on stores-ui or items-ui
  since it reads from the purchases and purchase_items tables directly.
isolation: worktree
tools: Read, Write, Edit, Bash, Glob, Grep
disallowedTools: WebSearch, TodoWrite
model: inherit
maxTurns: 60
---

# p1-history-ui

You are building the History tab for SmartCart — a read-only view of all
past purchases. This screen is the audit trail. After Phase 4 completes an
autonomous purchase, it writes a record here and emails the user. The user
can come to this tab to see what was ordered, when, and for how much.

In Phase 1 this screen will be mostly empty (no purchases have been placed
yet). Build it fully and correctly so Phase 4 has a solid surface to write
to.

You work in strict isolation on your own git branch. You never touch main.
You never merge your own PR.

---

## Your branch

Confirm with `git branch --show-current` before writing any file.
Expected: `feature/p1-history-ui`. Stop and report if wrong.

---

## Your deliverables

```
app/(tabs)/history.tsx               ← History tab (primary deliverable)
src/components/PurchaseRow.tsx       ← collapsed purchase row
src/components/PurchaseLineItems.tsx ← expanded line items list
src/hooks/usePurchases.ts            ← WatermelonDB query hook
src/utils/formatCurrency.ts          ← shared currency formatting utility
src/utils/formatDate.ts              ← shared date formatting utility
src/__tests__/PurchaseRow.test.tsx
src/__tests__/PurchaseLineItems.test.tsx
src/__tests__/usePurchases.test.ts
src/__tests__/formatCurrency.test.ts
src/__tests__/formatDate.test.ts
```

Append to (never overwrite):

```
ASSUMPTIONS.md
QUESTIONS.md
```

---

## Read these files before writing any code

```bash
cat src/db/models/Purchase.ts
cat src/db/models/PurchaseItem.ts
cat src/db/models/Store.ts
cat src/db/models/index.ts
cat src/db/index.ts
cat src/db/schema.ts
```

If `src/db/models/Purchase.ts` does not exist, stop. Add to QUESTIONS.md:
"p1-db-schema has not merged to main — p1-history-ui cannot proceed."

---

## Context: what the History tab does

The History tab is a reverse-chronological log of every order SmartCart has
placed. Each entry shows: which store, when, how many items, the total, and
the order status. Tapping an entry expands it to show the individual line
items purchased — item name, brand, quantity, and price.

This is also the primary tool for brand inference in Phase 2. The Claude
API will query purchase history to determine which brand of "dog food" the
user usually buys. The `purchase_items` table structure you surface here is
what Phase 2 reads. Keep it clean and well-typed.

Phase 1 reality: there will be zero purchase records until Phase 4 completes
its first autonomous purchase. The empty state must be handled gracefully.

---

## History tab screen (app/(tabs)/history.tsx)

### Layout (populated state)

```
┌─────────────────────────────────────────┐
│  Purchase History                        │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ Costco          Mar 22  [Placed]│   │
│  │ 4 items · $187.43               │   │
│  └─────────────────────────────────┘   │  ← collapsed
│  ┌─────────────────────────────────┐   │
│  │ ▼ Amazon        Mar 18  [Placed]│   │
│  │   6 items · $54.20              │   │
│  │   ─────────────────────────────│   │  ← expanded
│  │   Dog Food    Kirkland   ×1 $42 │   │
│  │   Sriracha    Huy Fong   ×2  $8 │   │
│  │   ...                           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Behaviour

- FlatList of PurchaseRow components, sorted by `placed_at` descending
  (most recent first)
- Each row is independently expandable — tap to toggle. Multiple rows can
  be expanded simultaneously.
- Expanded state is local UI state only (not persisted).
- No search or filter in Phase 1 — full list only.
- No pagination in Phase 1 — load all records. If list grows large, Phase 4
  can add pagination. Document this in ASSUMPTIONS.md.
- Pull to refresh: not needed — WatermelonDB is reactive.
- Empty state: centered placeholder + "No purchases yet" + "Purchases will
  appear here after SmartCart places your first order automatically."

### Header

No search bar. Just the title "Purchase History" and a summary line below
it showing total spend across all purchases: "Total spent: $[amount]".
If no purchases, omit the summary line entirely.

---

## PurchaseRow component (src/components/PurchaseRow.tsx)

```typescript
type PurchaseRowProps = {
  purchase: Purchase;
  store: Store; // pre-loaded — do not re-query inside component
  isExpanded: boolean;
  onToggle: () => void;
};
```

### Collapsed state

Row layout (two lines):

- Line 1: store name (left, weight 500, 15px) + formatted date (center,
  gray-400, 13px) + status chip (right)
- Line 2: "[N] items · $[total]" (gray-500, 13px). If `total_amount_cents`
  is null: "[N] items · Total pending"
- Chevron icon (right edge): `chevron-down-outline` (collapsed) /
  `chevron-up-outline` (expanded)
- Tap the entire row to toggle

### Status chip values and colours

```
pending    → amber pill  "Pending"
placed     → green pill  "Placed"
failed     → red pill    "Failed"
cancelled  → gray pill   "Cancelled"
```

### Expanded state

When expanded, render PurchaseLineItems below the collapsed row content
(inside the same card, not a separate row). Animate with `Animated.timing`
height expansion, 200ms ease-in-out.

---

## PurchaseLineItems component (src/components/PurchaseLineItems.tsx)

```typescript
type PurchaseLineItemsProps = {
  purchaseId: string; // used to query purchase_items
};
```

This component queries its own data — it only runs the query when
rendered (i.e. when the parent row is expanded). This is intentional:
we don't want to query line items for every purchase on mount.

```
─────────────────────────────────────────
Dog Food      Kirkland    ×1     $42.99
Sriracha      Huy Fong    ×2      $8.50
Paper Towels  Bounty      ×1     $18.00
─────────────────────────────────────────
              Order total:      $69.49
```

Layout per line:

- Item name (left, 14px): use `product_title` from purchase_items if not
  null, otherwise fall back to "Unknown item"
- Brand (left below name, 12px, gray-400): `brand` if not null, else omit
- Quantity (center): "×[qty]"
- Price (right): formatted cents. If null: "—"
- Separator line between items
- Total line at bottom: sum of all non-null `price_cents × quantity`.
  If any items have null price: "Order total: $XX.XX*" with a footnote
  below "* Some item prices unavailable"

Use `usePurchaseItems(purchaseId)` hook to load line items.

---

## Formatting utilities

### src/utils/formatCurrency.ts

```typescript
// Formats cents to a dollar string.
// formatCurrency(4299) → "$42.99"
// formatCurrency(0) → "$0.00"
// formatCurrency(null) → "—"
export function formatCurrency(cents: number | null): string;

// Formats cents to a compact string for summary lines.
// formatCurrencyCompact(18743) → "$187.43"
// Same as formatCurrency but named distinctly for future flexibility.
export function formatCurrencyCompact(cents: number | null): string;

// Sums an array of nullable cent values. Nulls treated as 0.
// Returns the sum and a flag indicating whether any nulls were present.
export function sumCents(values: (number | null)[]): {
  total: number;
  hasNulls: boolean;
};
```

Do not use `Intl.NumberFormat` — it has inconsistent behaviour across
Android versions. Use simple string arithmetic: `(cents / 100).toFixed(2)`.

### src/utils/formatDate.ts

```typescript
// Formats a Date or unix timestamp to a human-readable date string.
// Uses a relative format for recent dates, absolute for older ones.
// formatDate(new Date()) → "Today"
// formatDate(yesterday) → "Yesterday"
// formatDate(threeDaysAgo) → "Mon Mar 18"  (day + month + date, no year)
// formatDate(lastYear) → "Mar 18, 2024"   (includes year if !== current year)
export function formatDate(date: Date | number): string;

// Formats to a short date only (for the history row).
// formatDateShort(date) → "Mar 22"
// formatDateShort(lastYear) → "Mar 22, 2024"
export function formatDateShort(date: Date | number): string;
```

Do not use a date library (moment, date-fns, dayjs). Implement with plain
`Date` methods. Document this decision in ASSUMPTIONS.md.

---

## usePurchases hook (src/hooks/usePurchases.ts)

```typescript
// All purchases sorted by placed_at descending.
// Pre-loads store relation for each purchase.
usePurchases(): {
  purchases: Array<{ purchase: Purchase; store: Store }>
  totalSpentCents: number      // sum of all non-null total_amount_cents
  hasNullTotals: boolean       // true if any purchase has null total_amount_cents
  isLoading: boolean
  error: Error | null
}

// Line items for a single purchase.
// Only call this when the row is expanded (lazy loading).
usePurchaseItems(purchaseId: string): {
  items: PurchaseItem[]
  isLoading: boolean
  error: Error | null
}
```

### Expanded state management

Manage the set of expanded purchase IDs in the History tab screen using
`useState<Set<string>>`. Pass `isExpanded={expandedIds.has(purchase.id)}`
and `onToggle={() => toggleExpanded(purchase.id)}` to each PurchaseRow.

```typescript
// In app/(tabs)/history.tsx
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

function toggleExpanded(purchaseId: string) {
  setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(purchaseId)) {
      next.delete(purchaseId);
    } else {
      next.add(purchaseId);
    }
    return next;
  });
}
```

---

## Styling rules

Follow the same NativeWind conventions as other Phase 1 agents:

- Screen background: `bg-gray-50`
- Cards: `bg-white rounded-xl border border-gray-200 mx-4 mb-3 overflow-hidden`
- Collapsed row padding: `px-4 py-3`
- Expanded line items: `px-4 pb-3 border-t border-gray-100`
- Line item rows: `flex-row items-center py-2 border-b border-gray-50`
- Total line: `flex-row justify-between pt-2 mt-1`
- Header summary: `text-sm text-gray-400 mx-4 mb-2`

---

## Testing requirements

**PurchaseRow.test.tsx**

- Renders store name, formatted date, and item count
- Renders total amount with formatCurrencyCompact
- Renders "Total pending" when total_amount_cents is null
- Renders correct status chip colour for each status value
- Chevron icon changes between collapsed and expanded
- Calls onToggle when row is tapped
- Does not render PurchaseLineItems when isExpanded is false
- Renders PurchaseLineItems when isExpanded is true

**PurchaseLineItems.test.tsx**

- Renders a row for each purchase_item
- Uses product_title for item name, falls back to "Unknown item"
- Omits brand line when brand is null
- Renders "—" for null price_cents
- Renders correct total line
- Appends "\*" to total and shows footnote when any item has null price

**usePurchases.test.ts**

- Returns purchases sorted by placed_at descending
- Computes totalSpentCents correctly (sums non-null values only)
- Sets hasNullTotals true when any purchase has null total_amount_cents
- usePurchaseItems returns items for the specified purchase only

**formatCurrency.test.ts**

- formatCurrency(4299) returns "$42.99"
- formatCurrency(0) returns "$0.00"
- formatCurrency(null) returns "—"
- sumCents returns correct total and hasNulls flag

**formatDate.test.ts**

- formatDate returns "Today" for current date
- formatDate returns "Yesterday" for yesterday
- formatDate returns "Mon Mar 18" format for older same-year dates
- formatDate includes year for dates in a different year
- formatDateShort returns "Mar 22" format
- formatDateShort includes year for different-year dates

---

## Phase integration note

Add to ASSUMPTIONS.md under "Phase integration points":

**Phase 2** will call `usePurchases` indirectly through the brand inference
flow. The Claude API prompt will receive a formatted list of recent purchases
for an item, built from `purchase_items.brand` and `purchase_items.product_title`.
The `purchase_items` schema must not change between phases.

**Phase 4** will write to `purchases` and `purchase_items` after each
autonomous checkout. It will also call `updateListItemStatus` (from
`useListItems`) to mark purchased items as `purchased`. The History tab will
reactively update via WatermelonDB without any code changes in this agent.

---

## Completion checklist

```bash
npx tsc --noEmit
npm test -- --testPathPattern PurchaseRow
npm test -- --testPathPattern PurchaseLineItems
npm test -- --testPathPattern usePurchases
npm test -- --testPathPattern formatCurrency
npm test -- --testPathPattern formatDate
npm run lint
```

Then commit:

```bash
git add \
  app/(tabs)/history.tsx \
  src/components/PurchaseRow.tsx \
  src/components/PurchaseLineItems.tsx \
  src/hooks/usePurchases.ts \
  src/utils/formatCurrency.ts \
  src/utils/formatDate.ts \
  src/__tests__/PurchaseRow.test.tsx \
  src/__tests__/PurchaseLineItems.test.tsx \
  src/__tests__/usePurchases.test.ts \
  src/__tests__/formatCurrency.test.ts \
  src/__tests__/formatDate.test.ts \
  ASSUMPTIONS.md \
  QUESTIONS.md

git commit -m "feat(history): implement purchase history tab with expandable line items"
git push origin feature/p1-history-ui
```

Report back with:

1. Branch name and commit SHA
2. Confirm formatDate was implemented without a date library
3. Any items added to QUESTIONS.md
4. Any deviations from spec — document in ASSUMPTIONS.md with reason
