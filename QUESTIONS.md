# SmartCart — Open Questions

Answers to these questions will affect implementation decisions. Items marked **[BLOCKING]** should be resolved before the relevant code is written; others can be deferred.

---

## Identity & Distribution

**Q1. Bundle ID / App ID**
The current bundle ID is `com.smartcart.app` (set in `app.json`). Is this correct, or should it follow a personal/org namespace like `com.yourname.smartcart`?

**Q2. EAS Build vs local Android build**
Do you want to use EAS cloud builds (`eas build`) for APK/AAB generation, or do you prefer local Gradle builds (`./gradlew assembleDebug`)? EAS is simpler to set up but requires an Expo account and build minutes. Local builds require a full Android Studio installation.

---

## UI / UX

**Q3. Dark mode strategy**
`app.json` currently sets `userInterfaceStyle: "light"` (light mode only). Options:
- **System** — follow Android system dark/light setting automatically
- **Manual toggle** — add a toggle in Settings
- **Light only** — keep as-is for Phase 1

Which do you prefer? This affects NativeWind config (`darkMode: 'media'` or `'class'`).

**Q4. App display name**
The app is named "SmartCart" in `app.json`. Is this the final name shown on the Android home screen and launcher?

---

## Database & Data Model

**Q5. `anchor_urls` column usage**
The `items.anchor_urls` column stores a JSON map of `{ store_id: product_url }`. Is there a planned UI for managing these URLs per store, or will they be set only by the automation layer in Phase 2 when a product is found?

**Q6. `voice_transcript` on `list_items`**
The Phase 1 UI allows only manual item entry (no voice). Should the `voice_transcript` field be displayed anywhere in the List view (e.g., as a tooltip or sub-label), or is it reserved for Phase 2 display?

---

## Credentials & Security

**Q7. Credential migration**
If a user changes a store's credentials in the Stores screen (edits the store), the old credentials in SecureStore are overwritten. Is this the intended behavior, or should old credentials be preserved as a fallback?

**Q8. Biometric gate scope**
Currently, biometric auth is only required when **reading** credentials (e.g., before Phase 2 automation starts a purchase). Should it also gate the Settings screen itself, or only credential reads?

---

## Purchase Rules

**Q9. `trigger_item` rule — exact match or fuzzy?**
The `trigger_item` rule fires when `newlyAddedItemId === rule.triggerItemId`. This is an exact ID match. Should there be any fuzzy/canonical matching (e.g., "Dog Food 30lb" triggers the "Dog Food" rule), or is exact catalog item match sufficient?

**Q10. Multiple rules firing simultaneously**
If both a `trigger_item` rule and a `min_value` rule are active for the same store, and both conditions are met, `evaluateRules` returns only the highest-priority one (`trigger_item`). Is this correct, or should all matching rules be returned and the developer decide which to act on?

---

## Phase Boundaries

**Q11. Detox E2E scaffold**
The spec says "Detox E2E scaffold only in Phase 1." Should Phase 1 include:
- `detox` and `@types/detox` in `devDependencies`
- An `e2e/` directory with a sample test file
- Detox config in `package.json`

Or just document Detox setup in `SETUP.md` for Phase 2?

**Q12. `expo-file-system` for export**
The Settings screen's "Export all data" feature uses `expo-file-system` to write a JSON file before sharing. This package is not in `package.json` yet. Should it be added as a dependency, or should the export functionality be deferred to Phase 2?

---

## Store Automation

**Q13. Instacart retailer slug source**
Where does the user find their retailer slug? Should the Stores form include a help link or list of known slugs (e.g., `costco`, `trader-joes`, `whole-foods`)? Or is this expected to be filled in by a developer-facing config?

**Q14. Target Direct automation scope**
"Direct Target" automation is one of the three types. Does this mean Target.com directly, or Target via Instacart? If Target.com directly, does Phase 2 use Playwright/browser automation similar to Amazon, or Target's API?

---

---

## Rules Engine (p1-rules-engine)

**Q15. evaluationNote for inactive min_value / item_count rules**
The spec provides an `evaluationNote` string only for inactive `trigger_item`
rules (`"Trigger item rule is inactive"`). There is no specified string for
inactive `min_value` or `item_count` rules. The current implementation reuses
`"Trigger item rule is inactive"` as a placeholder. Should each rule type have
its own inactive note (e.g. `"Min value rule is inactive"`,
`"Item count rule is inactive"`)?

**Q16. trigger_item pending note when triggerItemId is null**
A `trigger_item` rule with `triggerItemId = null` is technically invalid but
possible in the DB (field is optional). The engine currently uses an empty
string for the item name in the "Waiting for trigger item…" note. Should rules
with null `triggerItemId` be treated as inactive/invalid instead of pending?

**Q17. evaluateAllStores — only active rules or all rules?**
`evaluateAllStores` currently discovers stores by querying rules with
`is_active = true`. Stores that only have inactive rules are excluded from the
result map. Should the Rules tab show inactive-only stores too (requiring a
query for all rules regardless of `is_active`)?

*Last updated: 2026-03-24*
