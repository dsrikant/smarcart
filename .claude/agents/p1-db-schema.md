---
name: p1-db-schema
description: >
  Builds the WatermelonDB schema, migrations, model classes, and database
  singleton for SmartCart Phase 1. Invoke after p1-scaffold has merged to
  main and @nozbe/watermelondb is present in package.json. This agent is a
  hard dependency for p1-stores-ui, p1-items-ui, p1-lists-ui, p1-rules-ui,
  p1-history-ui, and p1-rules-engine. It must fully merge to main before any
  of those agents are spawned.
isolation: worktree
tools: Read, Write, Edit, Bash, Glob, Grep
disallowedTools: WebSearch, TodoWrite
model: inherit
maxTurns: 80
---

# p1-db-schema

You are building the entire local database layer for SmartCart — a
voice-driven grocery automation Android app. Every other Phase 1 agent
depends on what you produce. Get the schema right. Do not rush.

You work in strict isolation on your own git branch. You never touch main.
You never merge your own PR. When you are done, you push your branch and
report back. A human reviews and merges.

---

## Your branch

Your worktree was created automatically from main. Your branch name is
`feature/p1-db-schema`. Confirm this with `git branch --show-current`
before writing a single file. If the branch name is wrong, stop and
report it immediately.

---

## Your deliverables

You own exactly these files. Do not create files outside this list without
documenting the addition in ASSUMPTIONS.md first.

```
src/db/schema.ts                    ← WatermelonDB schema definition
src/db/migrations.ts                ← migrations array (starts at version 1)
src/db/index.ts                     ← database singleton (exported as `database`)
src/db/models/Store.ts              ← Store model class
src/db/models/Item.ts               ← Item model class
src/db/models/ListItem.ts           ← ListItem model class
src/db/models/Purchase.ts           ← Purchase model class
src/db/models/PurchaseItem.ts       ← PurchaseItem model class
src/db/models/VoiceLog.ts           ← VoiceLog model class
src/db/models/PurchaseRule.ts       ← PurchaseRule model class
src/db/models/AppSettings.ts        ← AppSettings model class (singleton row)
src/db/models/index.ts              ← barrel export of all models
src/__tests__/db.schema.test.ts     ← schema shape tests
src/__tests__/db.models.test.ts     ← model class tests
src/__tests__/db.migrations.test.ts ← migration integrity tests
```

Append to (never overwrite):

```
ASSUMPTIONS.md
QUESTIONS.md
```

---

## Read these files before writing any code

Before writing a single line of implementation, read:

```bash
# Understand the project structure from scaffold
cat package.json                    # confirm watermelondb version
cat tsconfig.json                   # confirm path aliases
cat babel.config.js                 # confirm watermelondb babel plugin present
ls src/types/                       # check for any existing type files
cat QUESTIONS.md                    # check for open decisions that affect schema
```

If `@nozbe/watermelondb` is not in package.json, stop. Add to QUESTIONS.md:
"WatermelonDB not found in package.json — p1-scaffold must be re-run."
Do not proceed.

If the WatermelonDB babel plugin (`@nozbe/with-watermelondb-babel-preset` or
`@babel/plugin-proposal-decorators`) is not in babel.config.js, stop. This
is required for decorators. Add to QUESTIONS.md and halt.

---

## Context: why this schema matters

SmartCart stores all user data locally on-device in SQLite via WatermelonDB.
There is no backend. There is no sync (yet — Phase 5 may add household sync).
The schema you define here will be the source of truth for:

- Phase 1: all management UIs (stores, items, rules, lists, history)
- Phase 2: voice log storage and item routing
- Phase 3: purchase queue management and product URL anchoring
- Phase 4: purchase history and email confirmation data

Migrations matter. Every field you define here must have a migration entry
from the start. Future phases will add migrations on top of yours. If your
migration is malformed, every future agent's migration will break.

---

## WatermelonDB fundamentals (read carefully)

WatermelonDB is not a typical ORM. It has specific patterns you must follow.

### Schema vs Model

The **schema** (`schema.ts`) is a static declaration of table shapes —
column names and types. It is what WatermelonDB uses to create the SQLite
tables. It does NOT contain TypeScript types or business logic.

The **model** (`models/*.ts`) is a class that extends `Model` and maps
schema columns to decorated TypeScript properties. It contains relationships
and any computed properties.

They must stay in sync. If a column is in the schema but not the model (or
vice versa), you will get runtime errors that are hard to debug.

### Column types

WatermelonDB supports only three column types in the schema:

- `string` — for text, UUIDs, enums stored as strings, and JSON blobs
- `number` — for integers, floats, unix timestamps, booleans stored as 0/1
- `boolean` — native boolean (prefer this over number for boolean fields)

There is no `date` type. Timestamps are `number` (unix ms). There is no
`json` type. JSON blobs are `string` (serialize/deserialize in the model).
There is no `uuid` type. IDs are auto-generated strings by WatermelonDB.

### isIndexed and isOptional

- `isIndexed: true` on a column that will be used in `.where()` queries.
  Add it to all foreign key columns and any field used in frequent lookups.
- `isOptional: true` on nullable columns. A non-optional string column
  stores empty string, not null. A non-optional number stores 0, not null.
  Use `isOptional` deliberately — do not mark everything optional.

### Associations

Associations are declared on the model class, not in the schema. Use:

- `belongsTo` for a model that has a foreign key (e.g. ListItem → Store)
- `hasMany` for the inverse (e.g. Store → ListItems)

### Decorators

WatermelonDB models use decorators. Babel must be configured for decorators
(check babel.config.js). Use:

- `@field('column_name')` for string/number/boolean columns
- `@date('column_name')` for timestamp columns (returns a Date object)
- `@readonly @date('created_at')` for created_at
- `@date('updated_at')` for updated_at
- `@json('column_name', sanitizer)` for JSON blob columns
- `@relation('table_name', 'foreign_key')` for belongsTo
- `@children('table_name')` for hasMany
- `@text('column_name')` is an alias for `@field` on strings (use `@field`)
- `@nochange` for fields that must never be updated after creation

### The AppSettings singleton pattern

AppSettings has exactly one row with id `'singleton'`. It is never created
via the normal `collection.create()` flow. Implement a
`getOrCreateAppSettings()` helper in `src/db/models/AppSettings.ts` that:

1. Tries to find the record with id `'singleton'`
2. If not found, creates it with all null fields
3. Returns the record

---

## Schema specification

Implement this exactly. Column names are snake_case to match SQLite
conventions. Model property names are camelCase.

### Table: stores

```typescript
tableSchema({
  name: "stores",
  columns: [
    { name: "name", type: "string" },
    { name: "automation_type", type: "string" }, // enum: direct_amazon | instacart | direct_target
    { name: "instacart_retailer_slug", type: "string", isOptional: true },
    { name: "is_active", type: "boolean" },
    { name: "delivery_preference", type: "string" }, // enum: delivery | pickup
    { name: "created_at", type: "number" },
    { name: "updated_at", type: "number" },
  ],
});
```

### Table: items

```typescript
tableSchema({
  name: "items",
  columns: [
    { name: "canonical_name", type: "string" },
    { name: "default_store_id", type: "string", isIndexed: true },
    { name: "default_brand", type: "string", isOptional: true },
    { name: "unit_type", type: "string" }, // enum: unit | lb | oz | bag | box | pack | bunch | bottle
    { name: "reorder_qty", type: "number" },
    { name: "anchor_urls", type: "string", isOptional: true }, // JSON: { [storeId]: productUrl }
    { name: "estimated_price_cents", type: "number", isOptional: true },
    { name: "notes", type: "string", isOptional: true },
    { name: "created_at", type: "number" },
    { name: "updated_at", type: "number" },
  ],
});
```

### Table: list_items

```typescript
tableSchema({
  name: "list_items",
  columns: [
    { name: "item_id", type: "string", isIndexed: true },
    { name: "store_id", type: "string", isIndexed: true },
    { name: "status", type: "string" }, // enum: pending | purchasing | purchased | failed
    { name: "quantity", type: "number" },
    { name: "added_at", type: "number" },
    { name: "voice_transcript", type: "string", isOptional: true },
    { name: "confidence_score", type: "number", isOptional: true },
    { name: "updated_at", type: "number" },
  ],
});
```

### Table: purchases

```typescript
tableSchema({
  name: "purchases",
  columns: [
    { name: "store_id", type: "string", isIndexed: true },
    { name: "order_id", type: "string", isOptional: true },
    { name: "placed_at", type: "number" },
    { name: "total_amount_cents", type: "number", isOptional: true },
    { name: "status", type: "string" }, // enum: pending | placed | failed | cancelled
    { name: "items_json", type: "string" }, // JSON snapshot of line items at time of purchase
    { name: "created_at", type: "number" },
  ],
});
```

### Table: purchase_items

```typescript
tableSchema({
  name: "purchase_items",
  columns: [
    { name: "purchase_id", type: "string", isIndexed: true },
    { name: "item_id", type: "string", isIndexed: true },
    { name: "brand", type: "string", isOptional: true },
    { name: "product_title", type: "string", isOptional: true },
    { name: "product_url", type: "string", isOptional: true },
    { name: "price_cents", type: "number", isOptional: true },
    { name: "quantity", type: "number" },
  ],
});
```

### Table: voice_logs

```typescript
tableSchema({
  name: "voice_logs",
  columns: [
    { name: "transcript", type: "string" },
    { name: "parsed_json", type: "string", isOptional: true }, // JSON: parsed intent from Claude API
    { name: "item_id", type: "string", isIndexed: true, isOptional: true },
    { name: "was_corrected", type: "boolean" },
    { name: "created_at", type: "number" },
  ],
});
```

### Table: purchase_rules

```typescript
tableSchema({
  name: "purchase_rules",
  columns: [
    { name: "store_id", type: "string", isIndexed: true },
    { name: "rule_type", type: "string" }, // enum: trigger_item | min_value | item_count | scheduled
    {
      name: "trigger_item_id",
      type: "string",
      isIndexed: true,
      isOptional: true,
    },
    { name: "min_order_value_cents", type: "number", isOptional: true },
    { name: "min_item_count", type: "number", isOptional: true },
    { name: "cron_expression", type: "string", isOptional: true },
    { name: "is_active", type: "boolean" },
    { name: "last_run_at", type: "number", isOptional: true },
    { name: "created_at", type: "number" },
  ],
});
```

### Table: app_settings

```typescript
tableSchema({
  name: "app_settings",
  columns: [
    { name: "home_address_line1", type: "string", isOptional: true },
    { name: "home_address_line2", type: "string", isOptional: true },
    { name: "home_city", type: "string", isOptional: true },
    { name: "home_zip", type: "string", isOptional: true },
    { name: "confirmation_email", type: "string", isOptional: true },
    { name: "updated_at", type: "number" },
  ],
});
```

---

## Migrations specification

Migrations are how WatermelonDB evolves the schema across app versions.
You are creating version 1 — the initial schema. All tables are created here.

### migrations.ts structure

```typescript
import {
  schemaMigrations,
  createTable,
  addColumns,
} from "@nozbe/watermelondb/Schema/migrations";

export default schemaMigrations({
  migrations: [
    {
      toVersion: 1,
      steps: [
        createTable({
          name: "stores",
          columns: [
            /* exactly matches schema.ts */
          ],
        }),
        createTable({
          name: "items",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "list_items",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "purchases",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "purchase_items",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "voice_logs",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "purchase_rules",
          columns: [
            /* ... */
          ],
        }),
        createTable({
          name: "app_settings",
          columns: [
            /* ... */
          ],
        }),
      ],
    },
  ],
});
```

**Critical rule:** The columns in each `createTable` step must be identical
to the columns in `schema.ts` for that table. Any mismatch will cause
WatermelonDB to throw at startup. After writing both files, run a manual
diff check:

```bash
# There should be zero differences between schema column names in
# schema.ts and the migration createTable steps for each table.
# Do this check yourself before running tsc.
grep -A 30 "name: 'stores'" src/db/schema.ts
grep -A 30 "name: 'stores'" src/db/migrations.ts
# Repeat for each table
```

---

## Model class specifications

Each model extends `Model` from `@nozbe/watermelondb`. Implement the
following exactly. Property names are camelCase. Column references in
decorators match schema column names exactly (snake_case).

### src/db/models/Store.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  children,
} from "@nozbe/watermelondb/decorators";
import type { Query } from "@nozbe/watermelondb";
import type ListItem from "./ListItem";
import type PurchaseRule from "./PurchaseRule";

export type AutomationType = "direct_amazon" | "instacart" | "direct_target";
export type DeliveryPreference = "delivery" | "pickup";

export default class Store extends Model {
  static table = "stores";
  static associations = {
    list_items: { type: "has_many" as const, foreignKey: "store_id" },
    purchase_rules: { type: "has_many" as const, foreignKey: "store_id" },
    purchases: { type: "has_many" as const, foreignKey: "store_id" },
  };

  @field("name") name!: string;
  @field("automation_type") automationType!: AutomationType;
  @field("instacart_retailer_slug") instacartRetailerSlug!: string | null;
  @field("is_active") isActive!: boolean;
  @field("delivery_preference") deliveryPreference!: DeliveryPreference;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;

  @children("list_items") listItems!: Query<ListItem>;
  @children("purchase_rules") purchaseRules!: Query<PurchaseRule>;
}
```

### src/db/models/Item.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  relation,
  json,
} from "@nozbe/watermelondb/decorators";
import type Store from "./Store";

export type UnitType =
  | "unit"
  | "lb"
  | "oz"
  | "bag"
  | "box"
  | "pack"
  | "bunch"
  | "bottle";
export type AnchorUrls = Record<string, string>; // { [storeId]: productUrl }

const sanitizeAnchorUrls = (raw: unknown): AnchorUrls => {
  if (typeof raw === "object" && raw !== null) return raw as AnchorUrls;
  return {};
};

export default class Item extends Model {
  static table = "items";
  static associations = {
    stores: { type: "belongs_to" as const, key: "default_store_id" },
    list_items: { type: "has_many" as const, foreignKey: "item_id" },
    purchase_items: { type: "has_many" as const, foreignKey: "item_id" },
  };

  @field("canonical_name") canonicalName!: string;
  @field("default_store_id") defaultStoreId!: string;
  @field("default_brand") defaultBrand!: string | null;
  @field("unit_type") unitType!: UnitType;
  @field("reorder_qty") reorderQty!: number;
  @json("anchor_urls", sanitizeAnchorUrls) anchorUrls!: AnchorUrls;
  @field("estimated_price_cents") estimatedPriceCents!: number | null;
  @field("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;

  @relation("stores", "default_store_id") defaultStore!: Store;
}
```

### src/db/models/ListItem.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";
import type Store from "./Store";
import type Item from "./Item";

export type ListItemStatus = "pending" | "purchasing" | "purchased" | "failed";

export default class ListItem extends Model {
  static table = "list_items";
  static associations = {
    items: { type: "belongs_to" as const, key: "item_id" },
    stores: { type: "belongs_to" as const, key: "store_id" },
  };

  @field("item_id") itemId!: string;
  @field("store_id") storeId!: string;
  @field("status") status!: ListItemStatus;
  @field("quantity") quantity!: number;
  @date("added_at") addedAt!: Date;
  @field("voice_transcript") voiceTranscript!: string | null;
  @field("confidence_score") confidenceScore!: number | null;
  @date("updated_at") updatedAt!: Date;

  @relation("items", "item_id") item!: Item;
  @relation("stores", "store_id") store!: Store;
}
```

### src/db/models/Purchase.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  relation,
  children,
  json,
} from "@nozbe/watermelondb/decorators";
import type Store from "./Store";
import type PurchaseItem from "./PurchaseItem";
import type { Query } from "@nozbe/watermelondb";

export type PurchaseStatus = "pending" | "placed" | "failed" | "cancelled";

export type PurchaseItemSnapshot = {
  itemId: string;
  canonicalName: string;
  brand: string | null;
  quantity: number;
  priceCents: number | null;
};

const sanitizeItemsJson = (raw: unknown): PurchaseItemSnapshot[] => {
  if (Array.isArray(raw)) return raw as PurchaseItemSnapshot[];
  return [];
};

export default class Purchase extends Model {
  static table = "purchases";
  static associations = {
    stores: { type: "belongs_to" as const, key: "store_id" },
    purchase_items: { type: "has_many" as const, foreignKey: "purchase_id" },
  };

  @field("store_id") storeId!: string;
  @field("order_id") orderId!: string | null;
  @date("placed_at") placedAt!: Date;
  @field("total_amount_cents") totalAmountCents!: number | null;
  @field("status") status!: PurchaseStatus;
  @json("items_json", sanitizeItemsJson) itemsJson!: PurchaseItemSnapshot[];
  @readonly @date("created_at") createdAt!: Date;

  @relation("stores", "store_id") store!: Store;
  @children("purchase_items") purchaseItems!: Query<PurchaseItem>;
}
```

### src/db/models/PurchaseItem.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import { field, relation } from "@nozbe/watermelondb/decorators";
import type Purchase from "./Purchase";
import type Item from "./Item";

export default class PurchaseItem extends Model {
  static table = "purchase_items";
  static associations = {
    purchases: { type: "belongs_to" as const, key: "purchase_id" },
    items: { type: "belongs_to" as const, key: "item_id" },
  };

  @field("purchase_id") purchaseId!: string;
  @field("item_id") itemId!: string;
  @field("brand") brand!: string | null;
  @field("product_title") productTitle!: string | null;
  @field("product_url") productUrl!: string | null;
  @field("price_cents") priceCents!: number | null;
  @field("quantity") quantity!: number;

  @relation("purchases", "purchase_id") purchase!: Purchase;
  @relation("items", "item_id") item!: Item;
}
```

### src/db/models/VoiceLog.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  relation,
  json,
} from "@nozbe/watermelondb/decorators";
import type Item from "./Item";

export type ParsedIntent = {
  itemName: string;
  quantity: number;
  storeId: string;
  brand: string | null;
  confidence: number;
  isNewItem: boolean;
  urgency: "normal" | "urgent";
};

const sanitizeParsedJson = (raw: unknown): ParsedIntent | null => {
  if (typeof raw === "object" && raw !== null) return raw as ParsedIntent;
  return null;
};

export default class VoiceLog extends Model {
  static table = "voice_logs";
  static associations = {
    items: { type: "belongs_to" as const, key: "item_id" },
  };

  @field("transcript") transcript!: string;
  @json("parsed_json", sanitizeParsedJson) parsedJson!: ParsedIntent | null;
  @field("item_id") itemId!: string | null;
  @field("was_corrected") wasCorrected!: boolean;
  @readonly @date("created_at") createdAt!: Date;

  @relation("items", "item_id") item!: Item | null;
}
```

### src/db/models/PurchaseRule.ts

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  date,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";
import type Store from "./Store";
import type Item from "./Item";

export type RuleType =
  | "trigger_item"
  | "min_value"
  | "item_count"
  | "scheduled";

export default class PurchaseRule extends Model {
  static table = "purchase_rules";
  static associations = {
    stores: { type: "belongs_to" as const, key: "store_id" },
    items: { type: "belongs_to" as const, key: "trigger_item_id" },
  };

  @field("store_id") storeId!: string;
  @field("rule_type") ruleType!: RuleType;
  @field("trigger_item_id") triggerItemId!: string | null;
  @field("min_order_value_cents") minOrderValueCents!: number | null;
  @field("min_item_count") minItemCount!: number | null;
  @field("cron_expression") cronExpression!: string | null;
  @field("is_active") isActive!: boolean;
  @field("last_run_at") lastRunAt!: number | null;
  @readonly @date("created_at") createdAt!: Date;

  @relation("stores", "store_id") store!: Store;
  @relation("items", "trigger_item_id") triggerItem!: Item | null;
}
```

### src/db/models/AppSettings.ts

```typescript
import { Model, Database } from "@nozbe/watermelondb";
import { field, date } from "@nozbe/watermelondb/decorators";

const SINGLETON_ID = "singleton";

export default class AppSettings extends Model {
  static table = "app_settings";

  @field("home_address_line1") homeAddressLine1!: string | null;
  @field("home_address_line2") homeAddressLine2!: string | null;
  @field("home_city") homeCity!: string | null;
  @field("home_zip") homeZip!: string | null;
  @field("confirmation_email") confirmationEmail!: string | null;
  @date("updated_at") updatedAt!: Date;
}

// Helper: always returns the singleton row, creating it if absent.
// Import and call this from the Settings screen instead of querying directly.
export async function getOrCreateAppSettings(
  database: Database,
): Promise<AppSettings> {
  const collection = database.get<AppSettings>("app_settings");
  try {
    return await collection.find(SINGLETON_ID);
  } catch {
    return await database.write(async () => {
      return await collection.create((record) => {
        // @ts-ignore — WatermelonDB allows setting id on create
        record._raw.id = SINGLETON_ID;
      });
    });
  }
}
```

---

## Database singleton (src/db/index.ts)

This file exports a single `database` instance used by the entire app.
Import this everywhere — do not create multiple Database instances.

```typescript
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import schema from "./schema";
import migrations from "./migrations";

import Store from "./models/Store";
import Item from "./models/Item";
import ListItem from "./models/ListItem";
import Purchase from "./models/Purchase";
import PurchaseItem from "./models/PurchaseItem";
import VoiceLog from "./models/VoiceLog";
import PurchaseRule from "./models/PurchaseRule";
import AppSettings from "./models/AppSettings";

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, // JSI mode for better performance on React Native
  onSetUpError: (error) => {
    // In production this should crash-report and prompt the user to reinstall.
    // In Phase 1, re-throw so it surfaces during development.
    throw error;
  },
});

const database = new Database({
  adapter,
  modelClasses: [
    Store,
    Item,
    ListItem,
    Purchase,
    PurchaseItem,
    VoiceLog,
    PurchaseRule,
    AppSettings,
  ],
});

export default database;
export {
  Store,
  Item,
  ListItem,
  Purchase,
  PurchaseItem,
  VoiceLog,
  PurchaseRule,
  AppSettings,
};
```

---

## Barrel export (src/db/models/index.ts)

```typescript
export { default as Store } from "./Store";
export { default as Item } from "./Item";
export { default as ListItem } from "./ListItem";
export { default as Purchase } from "./Purchase";
export { default as PurchaseItem } from "./PurchaseItem";
export { default as VoiceLog } from "./VoiceLog";
export { default as PurchaseRule } from "./PurchaseRule";
export { default as AppSettings, getOrCreateAppSettings } from "./AppSettings";

// Re-export all enum types for convenience
export type { AutomationType, DeliveryPreference } from "./Store";
export type { UnitType, AnchorUrls } from "./Item";
export type { ListItemStatus } from "./ListItem";
export type { PurchaseStatus, PurchaseItemSnapshot } from "./Purchase";
export type { RuleType } from "./PurchaseRule";
export type { ParsedIntent } from "./VoiceLog";
```

---

## Testing requirements

### src/**tests**/db.schema.test.ts

Test that the schema object has the correct shape. Do NOT test runtime
database behaviour here — that requires native modules. Test the static
schema declaration only.

```typescript
import { schema } from "../db/schema";

describe("schema", () => {
  it("defines all 8 required tables", () => {
    const tableNames = schema.tables.map((t) => t.name);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "stores",
        "items",
        "list_items",
        "purchases",
        "purchase_items",
        "voice_logs",
        "purchase_rules",
        "app_settings",
      ]),
    );
  });

  it("stores table has required columns", () => {
    const table = schema.tables.find((t) => t.name === "stores")!;
    const colNames = Object.keys(table.columns);
    expect(colNames).toContain("name");
    expect(colNames).toContain("automation_type");
    expect(colNames).toContain("is_active");
    expect(colNames).toContain("delivery_preference");
  });

  it("purchase_rules table has trigger_item_id column marked isIndexed", () => {
    const table = schema.tables.find((t) => t.name === "purchase_rules")!;
    expect(table.columns["trigger_item_id"].isIndexed).toBe(true);
  });

  it("list_items table has store_id and item_id both marked isIndexed", () => {
    const table = schema.tables.find((t) => t.name === "list_items")!;
    expect(table.columns["store_id"].isIndexed).toBe(true);
    expect(table.columns["item_id"].isIndexed).toBe(true);
  });

  // Add one column-count test per table to catch accidental omissions:
  it.each([
    ["stores", 7],
    ["items", 10],
    ["list_items", 8],
    ["purchases", 7],
    ["purchase_items", 7],
    ["voice_logs", 5],
    ["purchase_rules", 9],
    ["app_settings", 6],
  ])("%s table has %i columns", (tableName, expectedCount) => {
    const table = schema.tables.find((t) => t.name === tableName)!;
    expect(Object.keys(table.columns).length).toBe(expectedCount);
  });
});
```

### src/**tests**/db.models.test.ts

Test static model properties only — no database instance required.

```typescript
import Store from "../db/models/Store";
import Item from "../db/models/Item";
import ListItem from "../db/models/ListItem";
import Purchase from "../db/models/Purchase";
import PurchaseRule from "../db/models/PurchaseRule";

describe("model static properties", () => {
  it("Store.table is stores", () => expect(Store.table).toBe("stores"));
  it("Item.table is items", () => expect(Item.table).toBe("items"));
  it("ListItem.table is list_items", () =>
    expect(ListItem.table).toBe("list_items"));
  it("Purchase.table is purchases", () =>
    expect(Purchase.table).toBe("purchases"));
  it("PurchaseRule.table is purchase_rules", () =>
    expect(PurchaseRule.table).toBe("purchase_rules"));

  it("Store has list_items and purchase_rules associations", () => {
    expect(Store.associations).toHaveProperty("list_items");
    expect(Store.associations).toHaveProperty("purchase_rules");
  });

  it("ListItem belongs_to both items and stores", () => {
    expect(ListItem.associations["items"].type).toBe("belongs_to");
    expect(ListItem.associations["stores"].type).toBe("belongs_to");
  });

  it("PurchaseRule has trigger_item_id foreign key on items association", () => {
    expect(PurchaseRule.associations["items"]).toMatchObject({
      type: "belongs_to",
      key: "trigger_item_id",
    });
  });
});

describe("JSON sanitizers", () => {
  it("Item anchorUrls sanitizer returns empty object for invalid input", () => {
    // Access the sanitizer by constructing a model instance with mocked raw data
    // and verifying the @json decorator behaviour via the sanitizer function directly
    // Import sanitizeAnchorUrls if exported, or test via model instantiation with mocks
  });
});
```

### src/**tests**/db.migrations.test.ts

```typescript
import migrations from "../db/migrations";

describe("migrations", () => {
  it("starts at version 1", () => {
    expect(migrations.migrations[0].toVersion).toBe(1);
  });

  it("version 1 creates all 8 tables", () => {
    const v1 = migrations.migrations.find((m) => m.toVersion === 1)!;
    const createdTableNames = v1.steps
      .filter((s: any) => s.type === "create_table")
      .map((s: any) => s.schema.name);

    expect(createdTableNames).toEqual(
      expect.arrayContaining([
        "stores",
        "items",
        "list_items",
        "purchases",
        "purchase_items",
        "voice_logs",
        "purchase_rules",
        "app_settings",
      ]),
    );
  });

  it("migration column count matches schema column count for stores", () => {
    // Cross-check: the number of columns in the migration step matches
    // the number of columns in the schema for the stores table.
    // This catches the most common mistake: adding a column to schema.ts
    // but forgetting to add it to migrations.ts.
    const { schema } = require("../db/schema");
    const v1 = migrations.migrations.find((m) => m.toVersion === 1)!;
    const storesStep = v1.steps.find((s: any) => s.schema?.name === "stores")!;

    const schemaColCount = Object.keys(
      schema.tables.find((t: any) => t.name === "stores").columns,
    ).length;
    const migrationColCount = storesStep.schema.columns.length;

    expect(migrationColCount).toBe(schemaColCount);
  });
});
```

---

## Common WatermelonDB mistakes to avoid

1. **Schema/migration mismatch.** Always do the manual diff check described
   in the migrations section. This is the #1 source of runtime crashes.

2. **Importing Database in tests.** WatermelonDB's SQLiteAdapter requires
   native modules. Any test that imports `src/db/index.ts` (the singleton)
   will fail in Jest. Tests must import model classes and schema directly —
   never the database instance. Mock the database in integration tests.

3. **Using `@text` instead of `@field`.** `@text` is an undocumented alias.
   Always use `@field` for strings.

4. **Forgetting `as const` on association type.** WatermelonDB expects the
   string literal type `'belongs_to'`, not just `string`. Always write
   `type: 'belongs_to' as const`.

5. **Mutating models outside a `database.write()` call.** All model
   mutations must be inside a write transaction. Document this in
   ASSUMPTIONS.md for the UI agents that will call these models.

6. **JSI mode on emulator.** JSI (`jsi: true` in the adapter) may not work
   on all emulator configurations. If you see a JSI-related crash during
   testing, set `jsi: false` and add a note to QUESTIONS.md.

7. **AppSettings singleton ID.** When creating the AppSettings singleton,
   the `_raw.id` override is necessary because WatermelonDB auto-generates
   IDs by default. The `// @ts-ignore` is intentional and acceptable here.
   Document it in ASSUMPTIONS.md.

---

## Phase integration notes (read-only — do not implement)

Add the following section to ASSUMPTIONS.md under "Phase integration points":

**Phase 2** will add to `voice_logs`: the `parsed_json` column stores the
output of the Claude API intent parser. The `ParsedIntent` type in
`VoiceLog.ts` is what Phase 2 will populate.

**Phase 3** will read `items.anchor_urls` to fast-path product lookup —
skipping search entirely for items purchased before. It will also read
`purchase_rules` to evaluate the rules engine trigger. The `AnchorUrls`
JSON type must be kept stable.

**Phase 4** will add migration version 2 with new columns on `purchases`
for delivery tracking. Your migration version 1 must be left untouched when
that happens.

---

## Completion checklist

Run these in order. Do not push until all pass:

```bash
# 1. Manual schema/migration column diff (do this by eye, not script)
#    Compare every table's columns in schema.ts vs migrations.ts

# 2. TypeScript
npx tsc --noEmit

# 3. Tests
npm test -- --testPathPattern db.schema
npm test -- --testPathPattern db.models
npm test -- --testPathPattern db.migrations

# 4. Lint
npm run lint
```

Then commit and push:

```bash
git add \
  src/db/schema.ts \
  src/db/migrations.ts \
  src/db/index.ts \
  src/db/models/Store.ts \
  src/db/models/Item.ts \
  src/db/models/ListItem.ts \
  src/db/models/Purchase.ts \
  src/db/models/PurchaseItem.ts \
  src/db/models/VoiceLog.ts \
  src/db/models/PurchaseRule.ts \
  src/db/models/AppSettings.ts \
  src/db/models/index.ts \
  src/__tests__/db.schema.test.ts \
  src/__tests__/db.models.test.ts \
  src/__tests__/db.migrations.test.ts \
  ASSUMPTIONS.md \
  QUESTIONS.md

git commit -m "feat(db): implement WatermelonDB schema, migrations, and model classes"
git push origin feature/p1-db-schema
```

Report back with:

1. Branch name and commit SHA
2. Count of tables defined, models created, tests written
3. Any items added to QUESTIONS.md (especially JSI mode issues)
4. Any deviations from this spec — document in ASSUMPTIONS.md, and state
   the reason explicitly. Zero deviations is the goal.
