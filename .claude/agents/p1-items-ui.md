---
name: p1-items-ui
description: >
  Builds the Items catalog tab — searchable list of all grocery items, item
  detail/edit bottom sheet, and the useItems hook. Invoke after p1-db-schema
  and p1-stores-ui have merged to main (items reference stores for their
  default store picker). Use for any task involving item catalog management UI.
isolation: worktree
tools: Read, Write, Edit, Bash, Glob, Grep
disallowedTools: WebSearch, TodoWrite
model: inherit
maxTurns: 80
---

# p1-items-ui

You are building the Items catalog tab for SmartCart — a voice-driven grocery
automation Android app. The items catalog is the master list of every grocery
item the user tracks. Every item has a preferred store, a default brand, and
a unit type. This catalog is what the NLP engine in Phase 2 will query to
resolve voice commands to structured items.

You work in strict isolation on your own git branch. You never touch main.
You never merge your own PR.

---

## Your branch

Confirm with `git branch --show-current` before writing any file.
Expected: `feature/p1-items-ui`. Stop and report if wrong.

---

## Your deliverables

```
app/(tabs)/items.tsx                  ← tab screen (primary deliverable)
src/components/ItemCard.tsx           ← list row component
src/components/ItemFormSheet.tsx      ← add/edit bottom sheet
src/hooks/useItems.ts                 ← WatermelonDB query hook
src/types/items.ts                    ← Item-related TypeScript types
src/__tests__/ItemCard.test.tsx
src/__tests__/ItemFormSheet.test.tsx
src/__tests__/useItems.test.ts
```

Append to (never overwrite):

```
ASSUMPTIONS.md
QUESTIONS.md
```

---

## Read these files before writing any code

```bash
cat src/db/models/Item.ts
cat src/db/models/Store.ts
cat src/db/models/index.ts
cat src/db/index.ts
cat src/db/schema.ts
cat src/types/stores.ts             # re-use Store types, do not redefine
cat src/hooks/useStores.ts          # understand the pattern you are mirroring
cat src/components/StoreCard.tsx    # understand the NativeWind styling baseline
```

If `src/db/models/Item.ts` does not exist, stop. Add to QUESTIONS.md:
"p1-db-schema has not merged to main — p1-items-ui cannot proceed."

If `src/hooks/useStores.ts` does not exist, stop. Add to QUESTIONS.md:
"p1-stores-ui has not merged to main — p1-items-ui cannot proceed.
The store picker in ItemFormSheet requires the stores list."

---

## Context: what the Items tab does

The Items tab is the master catalog of grocery items. Each item represents
a generic product the user regularly buys — "Dog Food", "Olive Oil",
"Sparkling Water" — mapped to a default store and default brand. When the
user says "we're out of dog food" in Phase 2, the NLP engine looks up "Dog
Food" in this catalog to find it routes to Costco with brand "Kirkland".

Items are not the shopping list (that is the Lists tab). Items are the
persistent catalog. List items are transient.

The catalog needs to be fast to search because Phase 2 will do a local
fuzzy lookup here before calling the Claude API. Keep the `useItems` hook
lean and index-aware.

---

## Items tab screen (app/(tabs)/items.tsx)

### Layout

```
┌─────────────────────────────────────────┐
│  Items                           [+ FAB] │
├─────────────────────────────────────────┤
│  🔍 Search items...                      │
├─────────────────────────────────────────┤
│  Dog Food          [Costco]   Kirkland  │
│  Olive Oil         [Costco]   Kirkland  │
│  Sparkling Water   [Costco]   Kirkland  │
│  Bananas           [TJ's]     —         │
│  Sriracha          [Amazon]   Huy Fong  │
└─────────────────────────────────────────┘
                                    [+ FAB]
```

### Behaviour

- FlatList of ItemCard components, sorted alphabetically by `canonicalName`
- Search bar at the top (TextInput, not a modal): filters the list in real
  time as the user types. Filter against `canonicalName` and `defaultBrand`.
  Case-insensitive. No debounce needed — list is local and fast.
- Tapping any row opens ItemFormSheet in edit mode, pre-populated
- FAB (bottom right) opens ItemFormSheet in add mode
- Swipe left on a row: single "Delete" action. Confirmation alert: "Delete
  [item name]? It will be removed from your catalog." On confirm: delete
  the item. Note: deleting an item does not delete existing list_items rows
  that reference it — document this edge case in ASSUMPTIONS.md.
- Empty state (no items at all): centered text "No items in your catalog"
  - subtext "Tap + to add your first item" + secondary "Add item" button
- Empty state (search returns nothing): "No items matching '[query]'" with
  a "Clear search" link

---

## ItemCard component (src/components/ItemCard.tsx)

```typescript
type ItemCardProps = {
  item: Item;
  onPress: (item: Item) => void;
  onDelete: (item: Item) => void;
};
```

Row layout (horizontal, space-between):

- Left: `canonicalName` (primary text, 15px, weight 500) + `defaultBrand`
  below it (13px, gray-400, or "—" if null)
- Right: store name chip (pill, same badge style as StoreCard automation
  badges — reuse the pill style from stores UI or extract a shared
  `StoreBadge` component if one exists)

Swipe-to-delete via the same pattern as StoreCard.
No active/inactive state — items are always active.
Bottom border separator, no shadow.

---

## ItemFormSheet component (src/components/ItemFormSheet.tsx)

```typescript
type ItemFormSheetProps = {
  isVisible: boolean;
  mode: "add" | "edit";
  item?: Item; // required when mode === 'edit'
  onClose: () => void;
  onSave: () => void;
};
```

### Form fields

**Canonical name** (required)

- TextInput, placeholder "e.g. Dog Food"
- zod: `z.string().min(1, 'Name is required').max(100)`
- This is the name Phase 2 NLP will match against. Keep it generic
  ("Dog Food" not "Kirkland Nature's Domain Dog Food").
- Helper text: "Use a generic name. Brand is tracked separately."

**Default store** (required)

- Picker showing all active stores from `useStores()`
- Displays store name. Stores value is `store.id` (UUID).
- zod: `z.string().uuid('Please select a store')`
- If no stores exist, show inline warning: "Add a store first in the
  Stores tab" and disable the save button.

**Default brand** (optional)

- TextInput, placeholder "e.g. Kirkland"
- Helper text: "Leave blank if you buy any brand"
- zod: `z.string().max(100).optional()`

**Unit type** (required)

- Picker with options matching the `UnitType` enum from Item model:
  unit | lb | oz | bag | box | pack | bunch | bottle
- Display labels: Unit, Pound, Ounce, Bag, Box, Pack, Bunch, Bottle
- Default: `unit`
- zod: `z.enum(['unit', 'lb', 'oz', 'bag', 'box', 'pack', 'bunch', 'bottle'])`

**Reorder quantity** (required)

- Numeric TextInput, `keyboardType="numeric"`, default value `1`
- Label: "Default quantity"
- Helper text: "How many do you usually buy at once?"
- zod: `z.number().int().min(1).max(99)`

**Estimated price** (optional)

- Numeric TextInput with `$` prefix label, `keyboardType="decimal-pad"`
- Label: "Estimated price (optional)"
- Helper text: "Used to calculate if your cart meets order minimums"
- Store as cents internally: multiply display value × 100
- zod: `z.number().min(0).max(9999).optional()`

**Notes** (optional)

- Multiline TextInput, max 3 lines displayed, scrollable
- placeholder "e.g. Get the big bag, not the small one"
- zod: `z.string().max(500).optional()`

### Save behaviour

1. Validate all fields with zod. Show inline errors on failure.
2. No biometric auth required — item catalog is not sensitive.
3. In add mode: call `createItem(input)`.
4. In edit mode: call `updateItem(item.id, input)`.
5. On success: call `onSave()` then `onClose()`.
6. On error: show Alert with error message. Do not close sheet.

### Sheet behaviour

- `@gorhom/bottom-sheet`, snap points `['85%', '95%']`
- Start at 85% (more fields than store form)
- `KeyboardAvoidingView` wrapper
- Header: "Add Item" or "Edit Item" + close X
- Save button full-width, teal, bottom of sheet
- Spinner on save button while saving

---

## useItems hook (src/hooks/useItems.ts)

```typescript
// All items, sorted alphabetically by canonical_name.
// Reactive — updates on DB change.
useItems(): {
  items: Item[]
  isLoading: boolean
  error: Error | null
}

// Filtered by search query. Case-insensitive match on
// canonical_name and default_brand. Empty query returns all items.
// This is a client-side filter over the full items list — do not
// add a separate DB query per keystroke.
useItemSearch(query: string): {
  items: Item[]
  isLoading: boolean
}

// Single item by ID.
useItem(id: string): {
  item: Item | null
  isLoading: boolean
}

// Mutations
createItem(input: CreateItemInput): Promise<void>
updateItem(id: string, input: UpdateItemInput): Promise<void>
deleteItem(id: string): Promise<void>
```

```typescript
// src/types/items.ts
export type CreateItemInput = {
  canonicalName: string;
  defaultStoreId: string;
  defaultBrand: string | null;
  unitType: UnitType;
  reorderQty: number;
  estimatedPriceCents: number | null;
  notes: string | null;
};

export type UpdateItemInput = Partial<CreateItemInput>;
```

`useItemSearch` must filter in-memory from the `useItems` result — do not
issue a new database query per search keystroke. Use `useMemo` to derive the
filtered list from the full list and the query string.

---

## Styling rules

Follow the same NativeWind conventions as p1-stores-ui:

- All styling via Tailwind classes, no `StyleSheet.create`
- Screen background: `bg-gray-50`
- Cards: `rounded-xl bg-white border border-gray-200 p-4 mb-3`
- Store badge pill: match exactly the badge style from StoreCard
  (if StoreCard exports a `StoreBadge` component, import and reuse it;
  if not, implement the same pill pattern and note it in ASSUMPTIONS.md
  as a candidate for extraction in a future cleanup pass)
- Search bar: `bg-white border border-gray-200 rounded-xl px-4 py-3 mx-4 mb-2`
  with Ionicons `search-outline` icon left of the text input
- FAB: `bg-teal-600 rounded-full w-14 h-14` positioned `absolute bottom-6 right-6`

---

## Testing requirements

**ItemCard.test.tsx**

- Renders canonical name and brand
- Renders "—" when defaultBrand is null
- Renders store badge with correct store name
- Calls onPress when row is tapped
- Calls onDelete when swipe delete is confirmed

**ItemFormSheet.test.tsx**

- Renders "Add Item" in add mode
- Renders "Edit Item" in edit mode with pre-populated fields
- Shows inline error when canonical name is empty on submit
- Shows inline error when no store selected on submit
- Estimated price field converts display value to cents on save
- Unit type picker shows all 8 options
- Calls createItem in add mode, updateItem in edit mode
- Does not require biometric auth
- Calls onSave and onClose after successful save
- Shows warning when no stores exist and disables save

**useItems.test.ts**

- Returns items sorted alphabetically
- useItemSearch filters by canonical name (case-insensitive)
- useItemSearch filters by brand name (case-insensitive)
- useItemSearch returns all items when query is empty string
- deleteItem removes item from list
- updateItem modifies the correct item

Mock WatermelonDB and useStores in all tests.

---

## Completion checklist

```bash
npx tsc --noEmit
npm test -- --testPathPattern ItemCard
npm test -- --testPathPattern ItemFormSheet
npm test -- --testPathPattern useItems
npm run lint
```

Then commit:

```bash
git add \
  app/(tabs)/items.tsx \
  src/components/ItemCard.tsx \
  src/components/ItemFormSheet.tsx \
  src/hooks/useItems.ts \
  src/types/items.ts \
  src/__tests__/ItemCard.test.tsx \
  src/__tests__/ItemFormSheet.test.tsx \
  src/__tests__/useItems.test.ts \
  ASSUMPTIONS.md \
  QUESTIONS.md

git commit -m "feat(items): implement items catalog tab, item card, and add/edit sheet"
git push origin feature/p1-items-ui
```

Report back with:

1. Branch name and commit SHA
2. Note whether StoreBadge was extracted as shared component or duplicated
3. Any items added to QUESTIONS.md
4. Any deviations from spec — document in ASSUMPTIONS.md with reason
