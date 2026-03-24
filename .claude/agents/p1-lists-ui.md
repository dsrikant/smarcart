---
name: p1-lists-ui
description: >
  Builds the Lists tab — the main screen showing pending grocery items
  grouped by store, with manual add flow and swipe-to-delete. Invoke after
  p1-db-schema, p1-stores-ui, and p1-items-ui have merged to main. This is
  the screen users see most often.
isolation: worktree
tools: Read, Write, Edit, Bash, Glob, Grep
disallowedTools: WebSearch, TodoWrite
model: inherit
maxTurns: 80
---

# p1-lists-ui

You are building the Lists tab for SmartCart — the primary screen users
interact with daily. It shows all pending grocery items grouped by store,
lets users manually add items, and provides the status feedback when items
are being purchased.

In Phase 1 this screen is driven entirely by manual adds and DB state.
In Phase 2 the widget will feed items into the same `list_items` table
this screen reads from — so the data model must be right.

You work in strict isolation on your own git branch. You never touch main.
You never merge your own PR.

---

## Your branch

Confirm with `git branch --show-current` before writing any file.
Expected: `feature/p1-lists-ui`. Stop and report if wrong.

---

## Your deliverables

```
app/(tabs)/index.tsx                  ← Lists tab (primary deliverable)
src/components/StoreListSection.tsx   ← per-store section header + items
src/components/ListItemRow.tsx        ← individual pending item row
src/components/AddItemSheet.tsx       ← manual add sheet (item picker + qty)
src/hooks/useListItems.ts             ← WatermelonDB query hook
src/types/listItems.ts                ← ListItem-related types
src/__tests__/ListItemRow.test.tsx
src/__tests__/AddItemSheet.test.tsx
src/__tests__/useListItems.test.ts
```

Append to (never overwrite):

```
ASSUMPTIONS.md
QUESTIONS.md
```

---

## Read these files before writing any code

```bash
cat src/db/models/ListItem.ts
cat src/db/models/Item.ts
cat src/db/models/Store.ts
cat src/db/models/index.ts
cat src/db/index.ts
cat src/hooks/useItems.ts         # use useItemSearch for the item picker
cat src/hooks/useStores.ts        # use for store section ordering
cat src/types/items.ts
cat src/types/stores.ts
```

If `src/hooks/useItems.ts` or `src/hooks/useStores.ts` do not exist, stop.
Add to QUESTIONS.md which dependency is missing.

---

## Context: what the Lists tab does

The Lists tab is the shopping queue. It shows every `list_item` with status
`pending`, `purchasing`, or `failed` — grouped by their associated store.
Purchased items (`status === 'purchased'`) are not shown here; they appear
in the History tab.

This screen is what the user will glance at after speaking to the widget.
It needs to feel immediate and reactive — when an item is added (in Phase 2,
via voice), it should appear here without any manual refresh.

The manual add flow in Phase 1 is the fallback for when voice is not yet
available. It must be frictionless: pick an item from the catalog, set
quantity, done.

---

## Lists tab screen (app/(tabs)/index.tsx)

### Layout

```
┌─────────────────────────────────────────┐
│  Shopping Lists                  [+ FAB] │
├─────────────────────────────────────────┤
│  COSTCO                            (3)  │
│  ┌─────────────────────────────────┐   │
│  │ ● Dog Food        Kirkland  ×1  │   │
│  │ ● Coke            Kirkland  ×2  │   │
│  │ ● Paper Towels    Bounty    ×1  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  AMAZON                            (1)  │
│  ┌─────────────────────────────────┐   │
│  │ ● Sriracha        Huy Fong  ×1  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                                    [+ FAB]
```

### Behaviour

- Sections: one section per store that has at least one non-purchased
  list item. Section header shows store name (uppercase) and item count badge.
- Sections ordered: stores with `pending` items first (alphabetical),
  then stores with only `purchasing` or `failed` items (alphabetical).
- Within each section: items ordered by `added_at` descending (most recent
  at top).
- Show items with status `pending`, `purchasing`, and `failed`. Do not show
  `purchased`.
- Tapping an item row: opens an inline quantity editor (not a sheet — just
  an in-row stepper that appears: [−] 2 [+] with a checkmark to confirm).
  The quantity editor replaces the row content while active. Tapping anywhere
  outside it dismisses it without saving.
- Swipe left on a row: "Remove" action (red). Confirmation alert:
  "Remove [item name] from your list?" On confirm: delete the list_item row.
  Do not delete the item from the catalog.
- FAB: opens AddItemSheet.
- Status indicators on rows:
  - `pending`: teal left-border accent, normal text
  - `purchasing`: amber left-border, "Ordering…" sub-label, row is
    non-interactive (no swipe, no tap-to-edit)
  - `failed`: red left-border, "Failed — tap to retry" sub-label (retry
    logic is Phase 3; in Phase 1 tapping failed shows an Alert:
    "Automatic purchase failed. Open the store app to complete this order.")
- Empty state (no list items at all): centered illustration placeholder +
  "Your lists are empty" + "Tap the mic widget on your home screen to add
  items" (Phase 1: "or use the + button below")
- **Pull to refresh**: not needed — WatermelonDB queries are reactive and
  auto-update.

### SectionList vs FlatList

Use React Native's `SectionList` component. Group the data into sections
by store in the hook (see `useListItems`). Do not compute sections in the
component — keep the component lean.

---

## StoreListSection component (src/components/StoreListSection.tsx)

This is the section header rendered by SectionList's `renderSectionHeader`.

```typescript
type StoreListSectionProps = {
  store: Store;
  itemCount: number;
};
```

- Store name: uppercase, 12px, `tracking-widest`, `text-gray-500`,
  `font-medium`
- Item count badge: small pill, right-aligned, teal background, white text
- Bottom border under the header

---

## ListItemRow component (src/components/ListItemRow.tsx)

```typescript
type ListItemRowProps = {
  listItem: ListItem;
  item: Item; // pre-loaded — do not re-query inside component
  onRemove: (listItem: ListItem) => void;
  onQuantityChange: (listItem: ListItem, newQty: number) => void;
};
```

Row content (when not in quantity-edit mode):

- Left: status accent border (teal/amber/red, 3px, full row height)
- Center: item canonical name (15px, weight 500) + brand below (13px, gray-400)
  - status sub-label for purchasing/failed states
- Right: "×[quantity]" (14px, gray-500)

Quantity edit mode (triggered by tap):

- Replace right side with `[−] [qty] [+] [✓]`
- `−` button disabled when qty === 1
- `+` button disabled when qty === 99
- `✓` button calls `onQuantityChange` and exits edit mode
- `Animated.timing` for the transition (slide in from right, 150ms)

Do not pre-load the `item` relation inside this component. The parent
(StoreListSection/SectionList) passes the pre-loaded item as a prop to
avoid N+1 queries.

---

## AddItemSheet component (src/components/AddItemSheet.tsx)

This is the manual add flow. Minimal friction — two fields only.

```typescript
type AddItemSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onAdd: () => void;
};
```

### Fields

**Item** (required)

- Search input at the top of the sheet: `useItemSearch(query)` filters the
  catalog list below as the user types.
- Scrollable list of matching items below the search input. Each row shows
  `canonicalName` + `defaultBrand` + default store badge.
- Tapping a row selects it (highlights it, no new screen).
- If no items match: "No items found — add it in the Items tab" with a
  button that closes this sheet and navigates to the Items tab.
- zod: selected item is required before save

**Quantity** (required)

- Numeric stepper: `[−] [qty] [+]`, default 1, min 1, max 99
- Shown below the item list, always visible (not hidden until item selected)

### Sheet behaviour

- `@gorhom/bottom-sheet`, snap point `['60%']` — this is intentionally
  compact; it is not a full-screen form.
- Header: "Add to list" + close X
- "Add" button at bottom, teal, full-width
- "Add" button disabled until an item is selected
- On add: call `createListItem({ itemId, storeId: item.defaultStoreId, quantity })`
  then `onAdd()` then `onClose()`
- On success: the Lists tab will reactively update via WatermelonDB — no
  manual refresh needed

---

## useListItems hook (src/hooks/useListItems.ts)

```typescript
// All non-purchased list items, grouped into sections for SectionList.
// Reactive — updates when DB changes.
useListItems(): {
  sections: ListItemSection[]    // see type below
  totalCount: number             // total pending items across all stores
  isLoading: boolean
  error: Error | null
}

// All list items for a specific store (all statuses).
// Used by rules engine hook for per-store evaluation.
useStoreListItems(storeId: string): {
  listItems: ListItem[]
  pendingCount: number
  isLoading: boolean
}

// Mutations
createListItem(input: CreateListItemInput): Promise<void>
updateListItemQuantity(id: string, quantity: number): Promise<void>
deleteListItem(id: string): Promise<void>
updateListItemStatus(id: string, status: ListItemStatus): Promise<void>
```

```typescript
// src/types/listItems.ts

export type ListItemSection = {
  store: Store;
  data: Array<{ listItem: ListItem; item: Item }>;
};

export type CreateListItemInput = {
  itemId: string;
  storeId: string;
  quantity: number;
  voiceTranscript?: string; // populated by Phase 2 voice flow
  confidenceScore?: number; // populated by Phase 2 NLP flow
};
```

### Query strategy

`useListItems` must:

1. Query all list_items where status IN ('pending', 'purchasing', 'failed')
   using WatermelonDB's `.query(Q.where('status', Q.notEq('purchased')))`
2. For each list_item, fetch the associated `item` and `store` via relations
3. Group into sections by store_id
4. Sort sections: pending-item stores first, then others (alphabetical within
   each tier)
5. Sort rows within each section by `added_at` descending

Fetch item and store relations eagerly — do not trigger relation fetches
inside `ListItemRow` (N+1 problem). Pass pre-fetched data as props.

---

## Styling rules

Follow the same NativeWind conventions as other Phase 1 agents:

- Screen background: `bg-gray-50`
- Section header: `bg-gray-50 px-4 py-2`
- Row cards: `bg-white border-b border-gray-100`
- Status left-border: use inline `style={{ borderLeftWidth: 3 }}` with
  color from status (cannot do dynamic border color in NativeWind without
  arbitrary values — use inline style here only, note it in ASSUMPTIONS.md)
- Purchasing rows: `opacity-60`
- Failed rows: normal opacity, red border
- FAB: `bg-teal-600 rounded-full w-14 h-14 absolute bottom-6 right-6`
- Quantity stepper buttons: `w-8 h-8 rounded-full border border-gray-200
items-center justify-center`

---

## Testing requirements

**ListItemRow.test.tsx**

- Renders item name and brand
- Renders "×[quantity]" count
- Shows "Ordering…" sub-label for purchasing status
- Shows "Failed — tap to retry" for failed status
- Tapping a pending row enters quantity-edit mode
- Quantity edit: − button disabled at qty 1
- Quantity edit: ✓ button calls onQuantityChange with new value
- Purchasing rows are non-interactive (no tap handler fires)
- Calls onRemove when swipe delete confirmed

**AddItemSheet.test.tsx**

- Renders item search input
- useItemSearch called with current query string
- Item list renders search results
- Tapping an item selects it and enables Add button
- Add button disabled when no item selected
- Quantity stepper starts at 1
- Stepper − disabled at quantity 1
- Stepper + increases quantity
- Calls createListItem with correct itemId, storeId, and quantity on add
- Shows "No items found" when search returns empty

**useListItems.test.ts**

- Returns sections grouped by store
- Sections contain only non-purchased list items
- Pending stores appear before non-pending stores in section order
- Rows within section are sorted by added_at descending
- createListItem adds an item to the correct store section
- deleteListItem removes the item from sections
- updateListItemQuantity updates the quantity
- When all items for a store are removed, that store's section disappears

Mock WatermelonDB, useItems, and useStores in all tests.

---

## Completion checklist

```bash
npx tsc --noEmit
npm test -- --testPathPattern ListItemRow
npm test -- --testPathPattern AddItemSheet
npm test -- --testPathPattern useListItems
npm run lint
```

Then commit:

```bash
git add \
  app/(tabs)/index.tsx \
  src/components/StoreListSection.tsx \
  src/components/ListItemRow.tsx \
  src/components/AddItemSheet.tsx \
  src/hooks/useListItems.ts \
  src/types/listItems.ts \
  src/__tests__/ListItemRow.test.tsx \
  src/__tests__/AddItemSheet.test.tsx \
  src/__tests__/useListItems.test.ts \
  ASSUMPTIONS.md \
  QUESTIONS.md

git commit -m "feat(lists): implement shopping lists tab with manual add flow"
git push origin feature/p1-lists-ui
```

Report back with:

1. Branch name and commit SHA
2. Note whether the status left-border colour was handled via inline style
   or another approach (document in ASSUMPTIONS.md either way)
3. Any items added to QUESTIONS.md
4. Any deviations from spec — document in ASSUMPTIONS.md with reason
