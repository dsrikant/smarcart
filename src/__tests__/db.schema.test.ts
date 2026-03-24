import { schema } from '../db/schema';

describe('schema', () => {
  it('defines all 8 required tables', () => {
    const tableNames = Object.values(schema.tables).map((t) => t.name);
    expect(tableNames).toEqual(
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

  it('stores table has required columns', () => {
    const table = schema.tables['stores']!;
    const colNames = Object.keys(table.columns);
    expect(colNames).toContain('name');
    expect(colNames).toContain('automation_type');
    expect(colNames).toContain('is_active');
    expect(colNames).toContain('delivery_preference');
  });

  it('purchase_rules table has trigger_item_id column marked isIndexed', () => {
    const table = schema.tables['purchase_rules']!;
    expect(table.columns['trigger_item_id'].isIndexed).toBe(true);
  });

  it('list_items table has store_id and item_id both marked isIndexed', () => {
    const table = schema.tables['list_items']!;
    expect(table.columns['store_id'].isIndexed).toBe(true);
    expect(table.columns['item_id'].isIndexed).toBe(true);
  });

  it.each([
    ['stores', 7],
    ['items', 10],
    ['list_items', 8],
    ['purchases', 7],
    ['purchase_items', 7],
    ['voice_logs', 5],
    ['purchase_rules', 9],
    ['app_settings', 6],
  ])('%s table has %i columns', (tableName, expectedCount) => {
    const table = schema.tables[tableName]!;
    expect(Object.keys(table.columns).length).toBe(expectedCount);
  });
});
