import migrations from '../db/migrations';

describe('migrations', () => {
  it('starts at version 2', () => {
    expect(migrations.sortedMigrations[0].toVersion).toBe(2);
  });

  it('version 2 creates all 8 tables', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdTableNames = v2.steps
      .filter((s: any) => s.type === 'create_table')
      .map((s: any) => s.schema.name);

    expect(createdTableNames).toEqual(
      expect.arrayContaining([
        'stores',
        'items',
        'list_items',
        'purchases',
        'purchase_items',
        'voice_logs',
        'purchase_rules',
        'app_settings',
      ]),
    );
  });

  it('migration column count matches schema column count for stores', () => {
    // Cross-check: the number of columns in the migration step matches
    // the number of columns in the schema for the stores table.
    // This catches the most common mistake: adding a column to schema.ts
    // but forgetting to add it to migrations.ts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { schema } = require('../db/schema');
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storesStep = v2.steps.find((s: any) => s.schema?.name === 'stores')!;

    const schemaColCount = Object.keys(schema.tables['stores'].columns).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const migrationColCount = Object.keys((storesStep as any).schema.columns).length;

    expect(migrationColCount).toBe(schemaColCount);
  });
});
