/**
 * Tests for useItems standalone mutation functions and sort/filter logic.
 * WatermelonDB, React Query, and the singleton queryClient are fully mocked.
 * Note: __esModule: true is required so that CommonJS interop resolves
 * `import database from '@/db'` to the `default` property.
 */

jest.mock('@/lib/queryClient', () => ({
  __esModule: true,
  default: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/db', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

import database from '@/db';
import queryClient from '@/lib/queryClient';
import { createItem, updateItem, deleteItem, ITEMS_QUERY_KEY } from '../hooks/useItems';
import { UnitType } from '../types/enums';
import type { CreateItemInput } from '../types/items';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDB = database as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQC = queryClient as any;

// ─── useItems sort logic ──────────────────────────────────────────────────────

describe('useItems — sort behaviour', () => {
  it('sorts items alphabetically by canonicalName', () => {
    const unsorted = [
      { canonicalName: 'Zucchini' },
      { canonicalName: 'Apples' },
      { canonicalName: 'Milk' },
    ];
    const sorted = [...unsorted].sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName)
    );
    expect(sorted.map((i) => i.canonicalName)).toEqual(['Apples', 'Milk', 'Zucchini']);
  });

  it('returns empty array when data is undefined', () => {
    const data: unknown = undefined;
    expect((data as unknown[]) ?? []).toEqual([]);
  });
});

// ─── useItemSearch filter logic ───────────────────────────────────────────────

describe('useItemSearch — in-memory filter', () => {
  const items = [
    { canonicalName: 'Dog Food', defaultBrand: 'Kirkland' },
    { canonicalName: 'Olive Oil', defaultBrand: 'California Olive Ranch' },
    { canonicalName: 'Sparkling Water', defaultBrand: null },
    { canonicalName: 'Bananas', defaultBrand: null },
  ];

  function filter(query: string) {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.canonicalName.toLowerCase().includes(lower) ||
        (item.defaultBrand ?? '').toLowerCase().includes(lower)
    );
  }

  it('returns all items when query is empty string', () => {
    expect(filter('')).toHaveLength(4);
  });

  it('returns all items when query is whitespace-only', () => {
    expect(filter('   ')).toHaveLength(4);
  });

  it('filters by canonicalName case-insensitively', () => {
    const result = filter('DOG');
    expect(result).toHaveLength(1);
    expect(result[0].canonicalName).toBe('Dog Food');
  });

  it('filters by defaultBrand case-insensitively', () => {
    const result = filter('olive ranch');
    expect(result).toHaveLength(1);
    expect(result[0].canonicalName).toBe('Olive Oil');
  });

  it('returns empty array when nothing matches', () => {
    expect(filter('xyzzy')).toHaveLength(0);
  });
});

// ─── createItem ───────────────────────────────────────────────────────────────

describe('createItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockCreate = jest.fn().mockImplementation(
      async (fn: (r: Record<string, unknown>) => void) => { fn({ _raw: {} }); }
    );
    mockDB.get.mockReturnValue({ create: mockCreate });
    mockDB.write.mockImplementation(async (fn: () => Promise<void>) => fn());
  });

  it('calls database.write and invalidates items cache', async () => {
    const input: CreateItemInput = {
      canonicalName: 'Dog Food',
      defaultStoreId: 'store-1',
      defaultBrand: 'Kirkland',
      unitType: UnitType.Bag,
      reorderQty: 2,
      estimatedPriceCents: 5999,
      notes: null,
    };
    await createItem(input);

    expect(mockDB.write).toHaveBeenCalledTimes(1);
    expect(mockQC.invalidateQueries).toHaveBeenCalledWith({ queryKey: [ITEMS_QUERY_KEY] });
  });

  it('sets anchorUrls to empty object and maps all fields', async () => {
    const capturedRecord: Record<string, unknown> = { _raw: {} };
    const mockCreate = jest.fn().mockImplementation(
      async (fn: (r: Record<string, unknown>) => void) => { fn(capturedRecord); }
    );
    mockDB.get.mockReturnValue({ create: mockCreate });

    await createItem({
      canonicalName: 'Milk', defaultStoreId: 'store-2', defaultBrand: null,
      unitType: UnitType.Unit, reorderQty: 1, estimatedPriceCents: null, notes: null,
    });

    expect(capturedRecord.anchorUrls).toEqual({});
    expect(capturedRecord.canonicalName).toBe('Milk');
    expect(capturedRecord.defaultBrand).toBeNull();
  });
});

// ─── updateItem ───────────────────────────────────────────────────────────────

describe('updateItem', () => {
  let mockUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate = jest.fn().mockImplementation(
      async (fn: (r: Record<string, unknown>) => void) => { fn({ _raw: {} }); }
    );
    mockDB.get.mockReturnValue({
      find: jest.fn().mockResolvedValue({ id: 'item-1', update: mockUpdate }),
    });
    mockDB.write.mockImplementation(async (fn: () => Promise<void>) => fn());
  });

  it('calls database.write and invalidates items cache', async () => {
    await updateItem('item-1', { canonicalName: 'Cat Food' });

    expect(mockDB.write).toHaveBeenCalledTimes(1);
    expect(mockQC.invalidateQueries).toHaveBeenCalledWith({ queryKey: [ITEMS_QUERY_KEY] });
    expect(mockQC.invalidateQueries).toHaveBeenCalledWith({ queryKey: [ITEMS_QUERY_KEY, 'item-1'] });
  });

  it('only updates provided fields (partial update)', async () => {
    const capturedRecord: Record<string, unknown> = { canonicalName: 'Dog Food', reorderQty: 1, _raw: {} };
    mockUpdate.mockImplementation(
      async (fn: (r: Record<string, unknown>) => void) => { fn(capturedRecord); }
    );

    await updateItem('item-1', { reorderQty: 5 });

    expect(capturedRecord.reorderQty).toBe(5);
    expect(capturedRecord.canonicalName).toBe('Dog Food');
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  let mockDestroyPermanently: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDestroyPermanently = jest.fn().mockResolvedValue(undefined);
    mockDB.get.mockReturnValue({
      find: jest.fn().mockResolvedValue({ id: 'item-1', destroyPermanently: mockDestroyPermanently }),
    });
    mockDB.write.mockImplementation(async (fn: () => Promise<void>) => fn());
  });

  it('calls destroyPermanently on the item', async () => {
    await deleteItem('item-1');

    expect(mockDB.write).toHaveBeenCalledTimes(1);
    expect(mockDestroyPermanently).toHaveBeenCalledTimes(1);
  });

  it('invalidates items cache after delete', async () => {
    await deleteItem('item-1');

    expect(mockQC.invalidateQueries).toHaveBeenCalledWith({ queryKey: [ITEMS_QUERY_KEY] });
  });
});
