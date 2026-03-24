/**
 * HistoryScreen — render tests
 *
 * Uses React's built-in test renderer with the react-native mock.
 * Hooks are mocked to control the data layer independently.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

// ── Mocks must use `require` inside factories (jest hoisting constraint) ───────

jest.mock('@/hooks/usePurchases', () => ({
  usePurchases: jest.fn(),
  usePurchaseItems: jest.fn(),
}));

jest.mock('@/components/EmptyState', () => ({
  EmptyState: ({ title, subtitle }: { title: string; subtitle: string }) => {
    const mockReact = require('react');
    return mockReact.createElement('EmptyState', { title, subtitle });
  },
}));

jest.mock('@/components/StatusChip', () => ({
  StatusChip: ({ variant }: { variant: string }) => {
    const mockReact = require('react');
    return mockReact.createElement('StatusChip', { variant });
  },
  purchaseStatusToVariant: (s: string) => s,
}));

jest.mock('@/types/enums', () => ({
  PurchaseStatus: {
    Pending: 'pending',
    Placed: 'placed',
    Failed: 'failed',
    Cancelled: 'cancelled',
  },
}));

jest.mock('@/db/models/Purchase', () => ({
  PurchaseStatus: {
    Pending: 'pending',
    Placed: 'placed',
    Failed: 'failed',
    Cancelled: 'cancelled',
  },
  default: class Purchase {},
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: { name: string; size: number; color: string }) => {
    const mockReact = require('react');
    return mockReact.createElement('Ionicons', { name, size, color });
  },
}));

import { usePurchases, usePurchaseItems } from '@/hooks/usePurchases';

const mockedUsePurchases = usePurchases as jest.MockedFunction<typeof usePurchases>;
const mockedUsePurchaseItems = usePurchaseItems as jest.MockedFunction<typeof usePurchaseItems>;

// Import screen after all mocks are registered
import HistoryScreen from '../../../app/(tabs)/history';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STORE = { id: 'store-1', name: 'Costco' };

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    storeId: 'store-1',
    orderId: null,
    placedAt: new Date('2024-03-22T10:00:00Z'),
    totalAmountCents: 18743,
    status: 'placed',
    itemsJson: [{ itemId: 'i1' }, { itemId: 'i2' }],
    createdAt: new Date('2024-03-22T10:00:00Z'),
    ...overrides,
  };
}

function makePurchaseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi1',
    purchaseId: 'p1',
    itemId: 'item-1',
    brand: 'Kirkland',
    productTitle: 'Dog Food',
    productUrl: null,
    priceCents: 4299,
    quantity: 1,
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderScreen() {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(React.createElement(HistoryScreen)); });
  return renderer!;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePurchaseItems.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchaseItems>);
  });

  it('shows ActivityIndicator while loading', () => {
    mockedUsePurchases.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('ActivityIndicator');
  });

  it('shows EmptyState when there are no purchases', () => {
    mockedUsePurchases.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('EmptyState');
  });

  it('shows EmptyState when data is undefined and not loading', () => {
    mockedUsePurchases.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('EmptyState');
  });

  it('renders a list when purchases exist (no EmptyState)', () => {
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase: makePurchase(), store: STORE }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    const json = JSON.stringify(renderer.toJSON());
    expect(json).not.toContain('EmptyState');
    expect(json).not.toContain('ActivityIndicator');
  });

  it('renders store name for each purchase row', () => {
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase: makePurchase(), store: STORE }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('Costco');
  });

  it('falls back to "Unknown store" when store is null', () => {
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase: makePurchase(), store: null }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('Unknown store');
  });

  it('does not render a dollar amount when totalAmountCents is null', () => {
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase: makePurchase({ totalAmountCents: null, status: 'pending' }), store: STORE }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('$187.43');
  });

  it('renders line items after expanding a purchase row', () => {
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase: makePurchase(), store: STORE }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);
    mockedUsePurchaseItems.mockReturnValue({
      data: [makePurchaseItem()],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchaseItems>);

    const renderer = renderScreen();

    // Before expansion: no line items
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Dog Food');

    // Simulate tapping the Pressable row
    act(() => {
      const pressables = renderer.root.findAllByType('Pressable' as unknown as React.ElementType);
      if (pressables.length > 0 && pressables[0].props.onPress) {
        pressables[0].props.onPress();
      }
    });

    // After expansion: line item data is visible
    expect(JSON.stringify(renderer.toJSON())).toContain('Dog Food');
  });

  it('renders correct item count in purchase summary', () => {
    const purchase = makePurchase({
      itemsJson: [{ itemId: 'i1' }, { itemId: 'i2' }, { itemId: 'i3' }],
    });
    mockedUsePurchases.mockReturnValue({
      data: [{ purchase, store: STORE }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('3');
  });

  it('renders multiple purchase rows when multiple purchases exist', () => {
    const p1 = makePurchase({ id: 'p1' });
    const p2 = makePurchase({ id: 'p2', itemsJson: [{ itemId: 'i1' }] });
    mockedUsePurchases.mockReturnValue({
      data: [
        { purchase: p1, store: STORE },
        { purchase: p2, store: { id: 'store-2', name: 'Amazon' } },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePurchases>);

    const renderer = renderScreen();
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Costco');
    expect(json).toContain('Amazon');
  });
});
