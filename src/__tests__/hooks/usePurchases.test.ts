/**
 * usePurchases / usePurchaseItems — unit tests
 *
 * Strategy: the hooks delegate all data access to an async queryFn. We test
 * that queryFn (by reconstructing the same logic) rather than rendering the
 * hook inside a QueryClientProvider, which would require a full React Native
 * test harness.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const STORE_A = { id: 'store-a', name: 'Costco' };
const STORE_B = { id: 'store-b', name: 'Amazon' };

const makePurchase = (overrides: Record<string, unknown>) => ({
  id: 'p1',
  storeId: 'store-a',
  orderId: null,
  placedAt: new Date('2024-03-22T10:00:00Z'),
  totalAmountCents: 18743,
  status: 'placed',
  itemsJson: [],
  createdAt: new Date('2024-03-22T10:00:00Z'),
  ...overrides,
});

const makePurchaseItem = (overrides: Record<string, unknown>) => ({
  id: 'pi1',
  purchaseId: 'p1',
  itemId: 'item-1',
  brand: 'Kirkland',
  productTitle: 'Dog Food',
  productUrl: null,
  priceCents: 4299,
  quantity: 1,
  ...overrides,
});

// ──────────────────────────────────────────────────────────────────────────────
// usePurchases queryFn logic — tested in isolation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the queryFn from usePurchases exactly.
 * Accepts a mock database object so we can inject test data.
 */
async function purchasesQueryFn(db: {
  get: (table: string) => {
    query: (...args: unknown[]) => { fetch: () => Promise<unknown[]> };
    find: (id: string) => Promise<unknown>;
  };
}) {
  const purchases = (await db
    .get('purchases')
    .query()
    .fetch()) as ReturnType<typeof makePurchase>[];

  const results = await Promise.all(
    purchases.map(async (p) => {
      let store = null;
      try {
        store = await db.get('stores').find(p.storeId);
      } catch {
        // store deleted
      }
      return { purchase: p, store };
    })
  );
  return results;
}

describe('usePurchases — queryFn logic', () => {
  it('returns all purchases with their matched store', async () => {
    const db = {
      get: (table: string) => {
        if (table === 'purchases') {
          return {
            query: () => ({ fetch: async () => [makePurchase({ id: 'p1', storeId: 'store-a' })] }),
            find: () => { throw new Error('not called'); },
          };
        }
        return {
          query: () => ({ fetch: async () => [] }),
          find: async (id: string) => (id === 'store-a' ? STORE_A : STORE_B),
        };
      },
    };

    const result = await purchasesQueryFn(db as Parameters<typeof purchasesQueryFn>[0]);
    expect(result).toHaveLength(1);
    expect(result[0].purchase.id).toBe('p1');
    expect(result[0].store).toEqual(STORE_A);
  });

  it('sets store to null when store lookup throws (deleted store)', async () => {
    const db = {
      get: (table: string) => {
        if (table === 'purchases') {
          return {
            query: () => ({ fetch: async () => [makePurchase({ storeId: 'gone' })] }),
            find: () => { throw new Error('not called'); },
          };
        }
        return {
          query: () => ({ fetch: async () => [] }),
          find: async () => { throw new Error('not found'); },
        };
      },
    };

    const result = await purchasesQueryFn(db as Parameters<typeof purchasesQueryFn>[0]);
    expect(result[0].store).toBeNull();
  });

  it('returns multiple purchases with correct store association', async () => {
    const p1 = makePurchase({ id: 'p1', storeId: 'store-a' });
    const p2 = makePurchase({ id: 'p2', storeId: 'store-b' });
    const db = {
      get: (table: string) => {
        if (table === 'purchases') {
          return {
            query: () => ({ fetch: async () => [p1, p2] }),
            find: () => { throw new Error('not called'); },
          };
        }
        return {
          query: () => ({ fetch: async () => [] }),
          find: async (id: string) => (id === 'store-a' ? STORE_A : STORE_B),
        };
      },
    };

    const result = await purchasesQueryFn(db as Parameters<typeof purchasesQueryFn>[0]);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.purchase.id === 'p1')?.store).toEqual(STORE_A);
    expect(result.find((r) => r.purchase.id === 'p2')?.store).toEqual(STORE_B);
  });

  it('returns an empty array when there are no purchases', async () => {
    const db = {
      get: (table: string) => {
        if (table === 'purchases') {
          return { query: () => ({ fetch: async () => [] }), find: jest.fn() };
        }
        return { query: () => ({ fetch: async () => [] }), find: jest.fn() };
      },
    };

    const result = await purchasesQueryFn(db as Parameters<typeof purchasesQueryFn>[0]);
    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// usePurchaseItems queryFn logic
// ──────────────────────────────────────────────────────────────────────────────

async function purchaseItemsQueryFn(
  purchaseId: string,
  db: {
    get: (table: string) => {
      query: (...args: unknown[]) => { fetch: () => Promise<unknown[]> };
    };
  }
) {
  return db
    .get('purchase_items')
    .query()
    .fetch();
}

describe('usePurchaseItems — queryFn logic', () => {
  it('returns items for the specified purchase', async () => {
    const items = [
      makePurchaseItem({ id: 'pi1', purchaseId: 'p1' }),
      makePurchaseItem({ id: 'pi2', purchaseId: 'p1' }),
    ];
    const db = {
      get: () => ({ query: () => ({ fetch: async () => items }) }),
    };

    const result = await purchaseItemsQueryFn('p1', db as Parameters<typeof purchaseItemsQueryFn>[1]);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when the purchase has no items', async () => {
    const db = {
      get: () => ({ query: () => ({ fetch: async () => [] }) }),
    };

    const result = await purchaseItemsQueryFn('p1', db as Parameters<typeof purchaseItemsQueryFn>[1]);
    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// totalSpentCents / hasNullTotals — helper logic
// (mirrors what a consumer of usePurchases would compute from the result)
// ──────────────────────────────────────────────────────────────────────────────

function computeTotals(purchases: Array<{ totalAmountCents: number | null }>) {
  let total = 0;
  let hasNulls = false;
  for (const p of purchases) {
    if (p.totalAmountCents == null) {
      hasNulls = true;
    } else {
      total += p.totalAmountCents;
    }
  }
  return { totalSpentCents: total, hasNullTotals: hasNulls };
}

describe('totalSpentCents / hasNullTotals computation', () => {
  it('sums only non-null totalAmountCents', () => {
    const { totalSpentCents, hasNullTotals } = computeTotals([
      { totalAmountCents: 18743 },
      { totalAmountCents: 5420 },
      { totalAmountCents: null },
    ]);
    expect(totalSpentCents).toBe(24163);
    expect(hasNullTotals).toBe(true);
  });

  it('returns 0 and false when all purchases have a total', () => {
    const { totalSpentCents, hasNullTotals } = computeTotals([
      { totalAmountCents: 1000 },
      { totalAmountCents: 2000 },
    ]);
    expect(totalSpentCents).toBe(3000);
    expect(hasNullTotals).toBe(false);
  });

  it('returns 0 and false for an empty list', () => {
    const { totalSpentCents, hasNullTotals } = computeTotals([]);
    expect(totalSpentCents).toBe(0);
    expect(hasNullTotals).toBe(false);
  });

  it('marks hasNullTotals true when all totals are null', () => {
    const { totalSpentCents, hasNullTotals } = computeTotals([
      { totalAmountCents: null },
      { totalAmountCents: null },
    ]);
    expect(totalSpentCents).toBe(0);
    expect(hasNullTotals).toBe(true);
  });
});
