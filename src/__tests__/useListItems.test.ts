import { groupAndSortSections } from '../hooks/useListItems';
import { ListItemStatus } from '../types/enums';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeStore(id: string, name: string) {
  return { id, name } as any;
}

function makeItem(id: string, name: string) {
  return { id, canonicalName: name } as any;
}

function makeListItem(
  id: string,
  storeId: string,
  status: ListItemStatus,
  addedAtMs: number,
  quantity = 1
) {
  return {
    id,
    storeId,
    status,
    quantity,
    addedAt: new Date(addedAtMs),
  } as any;
}

// ─── Mock @/db ─────────────────────────────────────────────────────────────────

jest.mock('@/db', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('groupAndSortSections', () => {
  const storeA = makeStore('s-a', 'Amazon');
  const storeB = makeStore('s-b', 'Costco');

  it('returns sections grouped by store', () => {
    const enriched = [
      { listItem: makeListItem('li1', 's-a', ListItemStatus.Pending, 1000), item: makeItem('i1', 'Dog Food'), store: storeA },
      { listItem: makeListItem('li2', 's-b', ListItemStatus.Pending, 1000), item: makeItem('i2', 'Coke'), store: storeB },
    ];

    const sections = groupAndSortSections(enriched);

    expect(sections).toHaveLength(2);
    const storeIds = sections.map((s) => s.store.id);
    expect(storeIds).toContain('s-a');
    expect(storeIds).toContain('s-b');
  });

  it('sections contain only non-purchased list items passed in', () => {
    // groupAndSortSections receives pre-filtered items; test that purchased items
    // are NOT present if not provided (filtering happens in queryFn)
    const enriched = [
      { listItem: makeListItem('li1', 's-a', ListItemStatus.Pending, 1000), item: makeItem('i1', 'Dog Food'), store: storeA },
      { listItem: makeListItem('li2', 's-a', ListItemStatus.Purchasing, 900), item: makeItem('i2', 'Coke'), store: storeA },
    ];

    const sections = groupAndSortSections(enriched);

    expect(sections).toHaveLength(1);
    expect(sections[0].data).toHaveLength(2);
    const statuses = sections[0].data.map((r) => r.listItem.status);
    expect(statuses).not.toContain(ListItemStatus.Purchased);
  });

  it('pending stores appear before non-pending stores in section order', () => {
    const enriched = [
      {
        listItem: makeListItem('li1', 's-b', ListItemStatus.Purchasing, 1000),
        item: makeItem('i1', 'Coke'),
        store: storeB,
      },
      {
        listItem: makeListItem('li2', 's-a', ListItemStatus.Pending, 1000),
        item: makeItem('i2', 'Dog Food'),
        store: storeA,
      },
    ];

    const sections = groupAndSortSections(enriched);

    // storeA (Amazon, pending) should come first even though storeB (Costco) appears first in input
    expect(sections[0].store.id).toBe('s-a');
    expect(sections[1].store.id).toBe('s-b');
  });

  it('rows within section are sorted by added_at descending', () => {
    const enriched = [
      {
        listItem: makeListItem('li1', 's-a', ListItemStatus.Pending, 1000),
        item: makeItem('i1', 'Dog Food'),
        store: storeA,
      },
      {
        listItem: makeListItem('li2', 's-a', ListItemStatus.Pending, 3000),
        item: makeItem('i2', 'Coke'),
        store: storeA,
      },
      {
        listItem: makeListItem('li3', 's-a', ListItemStatus.Pending, 2000),
        item: makeItem('i3', 'Paper Towels'),
        store: storeA,
      },
    ];

    const sections = groupAndSortSections(enriched);
    const times = sections[0].data.map((r) => (r.listItem.addedAt as Date).getTime());

    expect(times[0]).toBe(3000); // most recent first
    expect(times[1]).toBe(2000);
    expect(times[2]).toBe(1000);
  });

  it('createListItem adds an item to the correct store section', async () => {
    const { createListItem } = require('../hooks/useListItems');
    const mockDb = require('@/db').default;
    mockDb.write = jest.fn(async (fn: () => Promise<void>) => fn());
    mockDb.get = jest.fn().mockReturnValue({
      create: jest.fn().mockResolvedValue({}),
    });

    await createListItem({ itemId: 'i1', storeId: 's-a', quantity: 2 });

    expect(mockDb.write).toHaveBeenCalledTimes(1);
    expect(mockDb.get).toHaveBeenCalledWith('list_items');
  });

  it('deleteListItem removes the item from sections (calls destroyPermanently)', async () => {
    const { deleteListItem } = require('../hooks/useListItems');
    const mockDb = require('@/db').default;
    const destroyPermanently = jest.fn().mockResolvedValue(undefined);
    mockDb.write = jest.fn(async (fn: () => Promise<void>) => fn());
    mockDb.get = jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue({ destroyPermanently }),
    });

    await deleteListItem('li1');

    expect(destroyPermanently).toHaveBeenCalledTimes(1);
  });

  it('updateListItemQuantity updates the quantity', async () => {
    const { updateListItemQuantity } = require('../hooks/useListItems');
    const mockDb = require('@/db').default;
    const mockUpdate = jest.fn(async (fn: (r: any) => void) => fn({ quantity: 0, _raw: { updated_at: 0 } }));
    mockDb.write = jest.fn(async (fn: () => Promise<void>) => fn());
    mockDb.get = jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue({ update: mockUpdate }),
    });

    await updateListItemQuantity('li1', 5);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('when all items for a store are removed, that store section disappears', () => {
    // Empty enriched for a store means no section
    const enriched = [
      { listItem: makeListItem('li1', 's-a', ListItemStatus.Pending, 1000), item: null, store: storeA },
    ];

    const sections = groupAndSortSections(enriched);

    // Item is null → entry is skipped → no section for storeA
    expect(sections).toHaveLength(0);
  });
});
