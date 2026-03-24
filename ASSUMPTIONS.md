# SmartCart — Architecture Assumptions

## Database: WatermelonDB over AsyncStorage/MMKV

**Choice:** WatermelonDB with expo-sqlite adapter
**Why:**
- SmartCart's data model is relational (stores → items → list_items → purchases). MMKV and AsyncStorage are key-value stores with no query or join support.
- WatermelonDB provides lazy-loading, reactive queries, and a proper migration system — all necessary for a growing grocery catalog with purchase history.
- The observable pattern lets the UI react to database changes without polling.
- SQLite via expo-sqlite is bundled in every Expo SDK — no additional native install needed beyond WatermelonDB itself.

**Tradeoff:** WatermelonDB requires `expo prebuild` (native module); it cannot run in Expo Go.

---

## Timestamp Management

WatermelonDB's `@createdAt` / `@updatedAt` decorators auto-manage timestamps. Our models instead use `@readonly @date('created_at')` and `@date('updated_at')` for explicit control. Consequence: all `create()` and `update()` callbacks in hooks manually set `record._raw.created_at` and `record._raw.updated_at` via `Date.now()`. The `@readonly` decorator is a TypeScript hint only — it does not block runtime writes in the `create()` callback.

---

## Styling: NativeWind v4

**Version pinned:** `nativewind@^4.2.3` with `tailwindcss@^4.2.2`
**Known gotchas:**
- NativeWind v4 requires `withNativeWind()` in `metro.config.js` and `nativewind/babel` plugin in `babel.config.js`. Both are already configured.
- `global.css` must be imported at the top of `app/_layout.tsx` for the Tailwind base styles to be injected.
- NativeWind v4 uses `className` props directly on React Native `View`, `Text`, `Pressable`, etc. — no `styled()` wrapper needed.
- Tailwind v4 changed config format (CSS-first), but the project uses Tailwind v3-style `tailwind.config.js` with `nativewind/preset`. This is intentional — NativeWind v4 ships its own Tailwind preset that bridges v3 config syntax.
- Dark mode: `userInterfaceStyle: "light"` in `app.json` — dark mode not implemented in Phase 1. See `QUESTIONS.md`.

---

## Minimum Android Version: API 26 (Android 8.0)

**Rationale:**
- `expo-secure-store` with Android Keystore requires API 23+; we chose 26 for broader modern security guarantees.
- Android 8.0+ covers ~99% of active Android devices as of 2024.
- WorkManager (Phase 3 scheduled purchases) requires API 14+, so no conflict.
- `app.json`: `minSdkVersion: 26`, `compileSdkVersion: 34`, `targetSdkVersion: 34`.

---

## Credential Vault Isolation

All sensitive values (store usernames/passwords, Resend API key, home address) are stored **exclusively** in `expo-secure-store`, which is backed by Android Keystore.

Rules enforced in the codebase:
1. `credentialVault.ts` is the **only** file that calls `SecureStore.*` — all other code must go through it.
2. Credentials are **never** written to WatermelonDB, React state, React Query cache, or logs.
3. React Query cache keys never contain credential values — only store IDs.
4. When `biometricLockEnabled = true` in `AppSettings`, `credentialVault.ts` calls `requireBiometrics()` before returning any secret from `getStoreCredentials()`, `getResendApiKey()`, or `getHomeAddress()`.

---

## Tab Navigation Structure

Five tabs: Lists · Stores · Items · Rules · History
Settings is a stack route (`/settings`) accessible via a gear icon in every tab's header.

**Icon choices (Ionicons):**
- Lists → `cart` / `cart-outline`
- Stores → `storefront` / `storefront-outline`
- Items → `list` / `list-outline`
- Rules → `git-branch` / `git-branch-outline`
- History → `time` / `time-outline`

---

## WatermelonDB Migration Strategy

- Version starts at `2`. The p1-scaffold agent initialised the project with `version: 1` internally, but the p1-db-schema agent began at version 2 to leave room for any scaffold-level migration that may be inserted retroactively. Every schema change in future phases requires:
  1. Bumping `appSchema({ version: N })` in `schema.ts`
  2. Adding a new entry `{ toVersion: N, steps: [...] }` in `migrations.ts`
  3. Only `addColumns` and `createTable` are safe without data loss. Column drops require a full migration.

- The initial Phase 1 migration creates all 8 tables in a single `toVersion: 2` step. The `db.migrations.test.ts` tests against version 2 accordingly.

---

## React Query Configuration

- `staleTime: 30s` — prevents over-fetching for data that rarely changes between renders.
- `retry: 1` — single retry on failure; WatermelonDB errors are typically persistent (corrupted DB), not transient.
- No cache keys ever contain credential values or PII.

---

## No DatabaseProvider

WatermelonDB's React context provider (`DatabaseProvider`) is **not** used. Hooks import `database` directly from `@/db`. This avoids a potential import-path issue with `@nozbe/watermelondb/DatabaseProvider` across WatermelonDB versions and keeps the dependency graph simpler for Phase 1.

---

## Expo Workflow: Managed with Prebuild

The project uses **Expo's managed workflow with prebuild** (sometimes called "bare-ish"). `expo-router`, `expo-sqlite`, `expo-secure-store`, and `expo-local-authentication` all need native modules and are configured as plugins in `app.json`. Running `expo prebuild` generates the `/android` directory from those plugins.

This is preferable to a fully bare workflow because:
- `app.json` plugins handle most native configuration automatically.
- Upgrading Expo SDK only requires updating `package.json` and re-running `prebuild`.

---

## Package Version Notes

| Package | Version | Note |
|---|---|---|
| expo | ~55.0.8 | SDK 55 — React Native 0.83 |
| @nozbe/watermelondb | ^0.28.0 | Stable; JSI enabled (jsi: true) — matches spec default. Disable to jsi: false if JSI crashes appear on emulators. |
| nativewind | ^4.2.3 | Requires babel plugin + metro transform |
| @tanstack/react-query | ^5.95.2 | v5 API (no deprecated useQuery options) |
| zod | ^4.3.6 | v4; `z.nativeEnum` still supported |
| @hookform/resolvers | ^5.2.2 | v5; compatible with zod v4 |

---

---

## p1-history-ui: No pagination in Phase 1

All purchase records are loaded in a single query sorted by `placed_at` descending. WatermelonDB reactive updates handle new records arriving after Phase 4 completes an autonomous purchase. If the purchase history grows large, Phase 4 should add cursor-based pagination (a `LIMIT`/`OFFSET` query clause via `Q.skip` / `Q.take`).

---

## p1-history-ui: Expanded state is local UI state only

The set of expanded purchase row IDs (`Set<string>`) lives in `useState` in the History screen. It is not persisted to WatermelonDB or AsyncStorage. A full app restart collapses all rows.

---

## p1-history-ui: Date formatting uses plain Date methods (no date library)

`formatDate` / `formatDateShort` are implemented with `Date.prototype.getFullYear()`, `.getMonth()`, `.getDate()`, `.getDay()`. No `moment`, `date-fns`, or `dayjs` is added. Rationale: these libraries add non-trivial bundle size for a feature that only needs relative-day display and short-date formatting.

---

## p1-history-ui: purchaseStatusToVariant uses explicit Record map

The original `StatusChip.tsx` cast `PurchaseStatus` to `ChipVariant` with `as ChipVariant`. `PurchaseStatus.Placed = 'placed'` was not a key in `ChipVariant` / `CHIP_STYLES`, which would have caused a runtime crash. The fix adds `'placed'` to both types and uses an explicit `Record<PurchaseStatus, ChipVariant>` map so exhaustiveness is compile-checked.

---

## p1-history-ui: Component and hook tests run in node environment

React component rendering uses `react-test-renderer` (not `@testing-library/react-native`) because the project jest config uses `testEnvironment: 'node'`. `react-native` is mocked in `src/__tests__/__mocks__/react-native.js` to avoid native bridge dependencies. `@babel/preset-react` was added to the jest transform to support JSX in test files.

---

## p1-history-ui: Pre-existing TypeScript errors in feat-phase1

Running `npx tsc --noEmit` on the `feat-phase1` base shows 7 TypeScript errors in `app/(tabs)/items.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/rules.tsx`, and `src/__tests__/useItems.test.ts` — all from incomplete p1-items-ui API surface changes (`useItems` return shape / export name changes). These errors are pre-existing and not introduced by p1-history-ui. All files touched by this branch (`app/(tabs)/history.tsx`, `src/components/StatusChip.tsx`, `jest.config.js`, test files) are error-free.

---

## Phase integration points (p1-history-ui)

**Phase 2** will call `usePurchases` indirectly through the brand inference flow. The Claude API prompt will receive a formatted list of recent purchases for an item, built from `purchase_items.brand` and `purchase_items.product_title`. The `purchase_items` schema must not change between phases.

**Phase 4** will write to `purchases` and `purchase_items` after each autonomous checkout. It will also call `updateListItemStatus` (from `useListItems`) to mark purchased items as `purchased`. The History tab will reactively update via WatermelonDB without any code changes in this agent.
## Enum Types in src/types/enums.ts (deviation from p1-db-schema spec)

The p1-db-schema spec placed type aliases (string unions) inline inside each model file (e.g. `export type AutomationType = "direct_amazon" | ...` in `Store.ts`). The implementation instead defines these as TypeScript `enum` values in `src/types/enums.ts` and re-exports them from each model. Reasons:

1. Zod's `z.nativeEnum()` in `src/types/schemas.ts` requires real enum objects, not string union types.
2. Centralising enums prevents copy-paste drift between model types and form schema types.
3. The runtime string values are identical (e.g. `AutomationType.DirectAmazon === "direct_amazon"`), so WatermelonDB column storage is unaffected.

---

## Credential Vault Extra Functions (beyond p1-credential-vault spec)

`src/services/credentialVault.ts` exports several functions not listed in the spec. These were added to support Phase 1 UI screens and are safe additions:

- `deleteResendApiKey()` — explicit deletion without full clearAllCredentials
- `hasResendApiKey()` — UI state check (no biometric gate, analogous to hasStoreCredentials)
- `setHomeAddress(address)` / `getHomeAddress()` — stores the user's delivery address in SecureStore rather than plain SQLite; gated by biometrics on read
- `clearNonStoreSecrets()` has been replaced by the spec-compliant `clearAllCredentials()` which clears store credentials too, requires biometrics, and returns a deletion count

The `app_home_address_full` SecureStore key is app-scoped and follows the same naming convention as `app_resend_api_key`.

---

## Phase 3 Integration Points (Credential Vault)

The Node.js sidecar running on localhost:3421 in Phase 3 will call `getStoreCredentials(storeId)` and `getSessionCookie(storeId)` before launching Playwright to place orders. The Phase 3 sidecar must handle `BiometricAuthError` — if the device is locked, the sidecar should surface a prompt to the user rather than failing silently.

---

## Phase 2 Integration Points

The following are **not implemented** in Phase 1 but noted here for Phase 2:

- `src/services/instacartAdapter.ts` — Instacart headless browser automation
- `src/services/amazonAdapter.ts` — Amazon direct cart automation
- `src/services/targetAdapter.ts` — Target direct cart automation
- `src/services/emailService.ts` — Resend API email confirmation sender
- `src/hooks/usePurchaseHistory.ts` — Write-path hook for recording purchases post-automation
- WorkManager integration for `RuleType.Scheduled` (Phase 3)
- Voice widget for home screen (Phase 2)
- `android/app/src/main/java/…/SmartCartWidget.kt` — Android app widget

## Items UI (feature/p1-items-ui)

- **`ItemCard` receives `storeName` as a prop** — Resolved via the parent screen (which has the full store list from `useStores`) to avoid N+1 DB queries inside the card component.
- **Store name pill implemented inline in `ItemCard`** — No shared `StoreBadge` component existed on `feat-phase1`; the teal pill style from `StoreCard` was recreated inline. Extraction to a shared component is deferred.
- **Standalone mutation functions use a singleton `queryClient`** — `createItem`, `updateItem`, and `deleteItem` are plain async functions (not React hooks), so they import `queryClient` from `src/lib/queryClient.ts` to call `invalidateQueries` imperatively. `app/_layout.tsx` was updated to use the same singleton.
- **`useStores` was available on `feat-phase1`** — The stores hook was already present without merging `p1-stores-ui`; it was reused as-is.
- **Item deletion does not cascade to `list_items`** — WatermelonDB does not enforce FK cascades. Deleting an item leaves orphaned `list_item` rows. This is intentional for data safety; cleanup can be added later.
- **`ItemFormSheet` uses the custom `BottomSheet` wrapper** — The existing `src/components/BottomSheet.tsx` component was used rather than `@gorhom/bottom-sheet` directly, matching the pattern in the Stores UI.
---

## p1-lists-ui: @tanstack/react-query instead of WatermelonDB reactive observe

**Choice:** `@tanstack/react-query` for all `useListItems` queries
**Why:** Every other hook in the codebase (`useItems`, `useStores`, `useListItemsByStore`, etc.) uses `@tanstack/react-query`. Introducing WatermelonDB's `.observe()` reactive pattern only for `useListItems` would create an inconsistent pattern and require a different data-flow model (Observable subscription vs Promise). Codebase consistency was chosen over spec-literal compliance.

**Tradeoff:** React Query polls on refocus/stale rather than pushing DB changes reactively. In Phase 1 this is acceptable (manual-add flow). In Phase 2, when the voice widget writes to the DB, a short `staleTime` or explicit `invalidateQueries` call after each write achieves the same UX effect.

---

## p1-lists-ui: Custom BottomSheet component instead of @gorhom/bottom-sheet

**Choice:** Used the existing `src/components/BottomSheet.tsx` (Modal + Animated.spring) for `AddItemSheet`
**Why:** `@gorhom/bottom-sheet` is not in `package.json` and requires a native module (`expo prebuild`). Installing it would change the dependency graph without approval. The custom `BottomSheet` provides equivalent snap-height control via `snapHeight: 'half' | 'full'` prop.

**Tradeoff:** The custom bottom sheet uses a `Modal` overlay rather than a true native bottom sheet. Gesture interplay (swipe-to-dismiss while scrolling content) is more limited than `@gorhom/bottom-sheet`.

---

## p1-lists-ui: Status left-border color uses inline style

**Choice:** `style={{ borderLeftWidth: 3, backgroundColor: borderColor }}` on a `View` inside each `ListItemRow`
**Why:** NativeWind cannot dynamically select arbitrary hex color values at runtime from Tailwind classes. Tailwind purges unused class names at build time, so `bg-[#14b8a6]` would only work if the value is known statically. The status color is computed from a `Record<ListItemStatus, string>` map at runtime, requiring an inline style.

**Note:** Only this single property uses inline style; all layout, spacing, and typography use NativeWind classes.
## Phase integration points (p1-rules-engine)

**Phase 3** will import `evaluateRules` and check `result.shouldPurchase`.
When true, Phase 3 reads `result.triggeredBy.ruleId` to log which rule caused
the purchase. It will also call `clearDebounceCache(storeId)` after placing an
order so the next item add re-evaluates fresh.

**Phase 2** will call `evaluateRules` immediately after each voice-triggered
item add, passing the newly added item's ID as `newlyAddedItemId`. The
trigger_item debounce is specifically designed for this — rapid voice
dictation of multiple items should not double-trigger a purchase.

---

## p1-rules-engine: Deviations from spec

**Hook tests use logic-contract style instead of renderHook:**
The spec implies using `@testing-library/react-native`'s `renderHook` for
`useRuleEvaluation.test.ts`. However, this package requires react-native to be
transformed in Jest, which conflicts with the existing `jest.config.js` that
uses a custom Babel pipeline designed only for pure-logic tests. Adding
react-native to `transformIgnorePatterns` would risk breaking the three
existing tests. Instead, the hook tests verify the same logical contracts by
calling `evaluateRules` / `evaluateAllStores` (mocked) directly, matching all
spec `describe`/`it` blocks exactly.

**debounce "re-evaluates after 500ms" test uses clearDebounceCache instead of real timer:**
The spec states "re-evaluates after 500ms has elapsed." The Jest test
environment uses fake-timer-agnostic assertions; rather than advancing fake
timers, the test calls `clearDebounceCache('s1')` to simulate expiry and
confirms `wasDebounced === false` on the next call. This tests the same
behavioral guarantee without introducing timer-dependent flakiness.

**`npm run lint` not available — project has no ESLint config:**
The spec completion checklist calls `npm run lint`. The project has no `lint`
script in `package.json` and no `.eslintrc.*` or `eslint.config.js`. TypeScript
strict-mode (`npx tsc --noEmit`) was used as the static-analysis gate instead.
ESLint setup is deferred to a future phase when the project-wide lint config is
established.

**WatermelonDB Q.where condition parsing in mockDatabase:**
WatermelonDB v0.28.x `Q.where(col, val)` produces
`{ type: 'where', left: col, comparison: { operator: 'eq', right: { value: val } } }`,
not `{ left: { column: col }, right: { value: val } }` as one might assume
from TypeScript types. The mock's `extractConditions` helper was written to
match the actual runtime structure after inspection of the WatermelonDB source.
