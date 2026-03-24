/**
 * ItemCard component tests.
 * React 19 requires async act() for react-test-renderer to render synchronously.
 * IS_REACT_ACT_ENVIRONMENT is set to true in jest.setup.js.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: 'android' },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

let mockDeleteCapture: (() => void) | null = null;

jest.mock('@/components/SwipeableRow', () => ({
  SwipeableRow: function MockSwipeableRow({
    children,
    onDelete,
  }: {
    children: unknown;
    onDelete: () => void;
  }) {
    mockDeleteCapture = onDelete;
    return children;
  },
}));

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { ItemCard } from '../components/ItemCard';
import { UnitType } from '../types/enums';
import type Item from '../db/models/Item';



function makeItem(overrides: Record<string, unknown> = {}): Item {
  return {
    id: 'item-1',
    canonicalName: 'Dog Food',
    defaultBrand: 'Kirkland',
    defaultStoreId: 'store-1',
    unitType: UnitType.Bag,
    reorderQty: 2,
    estimatedPriceCents: null,
    notes: null,
    ...overrides,
  } as unknown as Item;
}

async function renderCard(props: React.ComponentProps<typeof ItemCard>) {
  let instance!: ReturnType<typeof create>;
  await act(async () => {
    instance = create(<ItemCard {...props} />);
  });
  return instance;
}

function allTexts(instance: ReturnType<typeof create>): string[] {
  const results: string[] = [];
  instance.root.findAll((node: ReactTestInstance) => {
    if ((node.type as unknown) === 'Text') {
      node.children.forEach((c: ReactTestInstance | string) => {
        if (typeof c === 'string') results.push(c);
      });
    }
    return false;
  });
  return results;
}

describe('ItemCard', () => {
  beforeEach(() => {
    mockDeleteCapture = null;
  });

  it('renders canonical name', async () => {
    const instance = await renderCard({
      item: makeItem(),
      storeName: 'Costco',
      onPress: jest.fn(),
      onDelete: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t.includes('Dog Food'))).toBe(true);
  });

  it('renders defaultBrand when present', async () => {
    const instance = await renderCard({
      item: makeItem({ defaultBrand: 'Kirkland' }),
      storeName: 'Costco',
      onPress: jest.fn(),
      onDelete: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t.includes('Kirkland'))).toBe(true);
  });

  it('renders "—" when defaultBrand is null', async () => {
    const instance = await renderCard({
      item: makeItem({ defaultBrand: null }),
      storeName: 'Costco',
      onPress: jest.fn(),
      onDelete: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t === '—')).toBe(true);
  });

  it('renders store badge with correct store name', async () => {
    const instance = await renderCard({
      item: makeItem(),
      storeName: 'Trader Joes',
      onPress: jest.fn(),
      onDelete: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t.includes('Trader Joes'))).toBe(true);
  });

  it('calls onPress with the item when the Pressable is tapped', async () => {
    const onPress = jest.fn();
    const item = makeItem();
    const instance = await renderCard({
      item,
      storeName: 'Costco',
      onPress,
      onDelete: jest.fn(),
    });
    const pressables = instance.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Pressable');
    expect(pressables.length).toBeGreaterThan(0);
    await act(async () => {
      (pressables[0].props.onPress as () => void)();
    });
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('calls onDelete with the item when swipe delete is triggered', async () => {
    const onDelete = jest.fn();
    const item = makeItem();
    await renderCard({
      item,
      storeName: 'Costco',
      onPress: jest.fn(),
      onDelete,
    });
    expect(mockDeleteCapture).not.toBeNull();
    await act(async () => {
      mockDeleteCapture?.();
    });
    expect(onDelete).toHaveBeenCalledWith(item);
  });
});
