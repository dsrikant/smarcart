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
