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

- Version starts at `1`. Every schema change in future phases requires:
  1. Bumping `appSchema({ version: N })` in `schema.ts`
  2. Adding a new entry `{ toVersion: N, steps: [...] }` in `migrations.ts`
  3. Only `addColumns` and `createTable` are safe without data loss. Column drops require a full migration.

- The Phase 1 migration creates all 8 tables in a single `toVersion: 1` step.

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
| @nozbe/watermelondb | ^0.28.0 | Stable; JSI disabled (jsi: false) until New Arch validated |
| nativewind | ^4.2.3 | Requires babel plugin + metro transform |
| @tanstack/react-query | ^5.95.2 | v5 API (no deprecated useQuery options) |
| zod | ^4.3.6 | v4; `z.nativeEnum` still supported |
| @hookform/resolvers | ^5.2.2 | v5; compatible with zod v4 |

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

---

## p1-lists-ui: AddItemSheet uses useItemSearch (not useItems)

**Choice:** `AddItemSheet.tsx` imports `useItemSearch(query)` from `@/hooks/useItems` (built by p1-items-ui)
**Why:** The p1-items-ui agent rewrote `useItems.ts` to separate `useItems()` (no-arg, full list) from `useItemSearch(query)` (memoized in-memory filter). The lists-ui branch was rebased onto p1-items-ui and updated to use `useItemSearch`.

---

## p1-lists-ui: React Query instead of WatermelonDB observe

**Deviation from spec:** The spec recommends using WatermelonDB's reactive `.observe()` queries for the `useListItems` hook. Instead, `@tanstack/react-query` is used, matching every other data hook in the codebase (`useItems`, `useStores`, `usePurchases`, etc.).

**Reason:** Using WatermelonDB observe while every other hook uses react-query would introduce two different data-fetching patterns, inconsistent cache invalidation, and increased cognitive overhead. Reactive observe would require `useEffect` with subscription management alongside react-query's cache — introducing subtle bugs.

**Impact:** After mutations (`createListItem`, `deleteListItem`, etc.), callers must invoke `queryClient.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] })` to refresh the list. The `index.tsx` does this in the `onAdd`, `handleRemove`, and `handleQuantityChange` callbacks.

---

## p1-lists-ui: Custom BottomSheet instead of @gorhom/bottom-sheet

**Deviation from spec:** The spec references `@gorhom/bottom-sheet` for `AddItemSheet`. The existing shared `BottomSheet.tsx` component is used instead.

**Reason:** `@gorhom/bottom-sheet` is not in `package.json`, not used by any other tab, and requires native install (`expo prebuild`). The existing `BottomSheet.tsx` provides equivalent functionality (snap height, close on backdrop tap, keyboard avoid, spring animation) without any new dependencies.

**Impact:** `AddItemSheet` uses `snapHeight="half"` on the existing `BottomSheet`, which maps to `maxHeight: '75%'` — comparable to `['60%']` snap point in the spec.

---

## p1-lists-ui: Status left-border color via inline style

The status accent border on `ListItemRow` uses `style={{ width: 3, backgroundColor: borderColor }}` on a `View` component (inline style). NativeWind cannot apply dynamic color values (computed from a `Record<ListItemStatus, string>` map at runtime) via Tailwind class names, since unused classes are purged at build time. This is the only inline style in the component; all other styling uses NativeWind classes.

---

## p1-lists-ui: createListItem et al. are standalone async functions

The spec lists `createListItem`, `updateListItemQuantity`, `deleteListItem`, and `updateListItemStatus` as module-level exports (not hooks). They interact with WatermelonDB directly and do NOT automatically invalidate react-query caches. Callers (components) are responsible for calling `queryClient.invalidateQueries(...)` after mutations.
