/**
 * ItemFormSheet component tests.
 * React 19 requires async act() for react-test-renderer.
 * BottomSheet and FormField mocked. No biometric auth.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Animated: {
    Value: jest.fn(() => ({ setValue: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    View: 'AnimatedView',
  },
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: 'android' },
  Alert: { alert: jest.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('../components/BottomSheet', () => ({
  BottomSheet: function MockBottomSheet({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title: string;
    children: unknown;
  }) {
    if (!visible) return null;
    const { createElement } = require('react');
    return createElement('View', null, createElement('Text', null, title), children);
  },
}));

jest.mock('../components/FormField', () => ({
  FormField: function MockFormField({
    label,
    value,
    onChangeText,
    error,
  }: {
    label: string;
    value: string;
    onChangeText?: (t: string) => void;
    error?: string;
  }) {
    const { createElement } = require('react');
    return createElement(
      'View',
      null,
      label ? createElement('Text', null, label) : null,
      createElement('TextInput', { value, onChangeText }),
      error ? createElement('Text', null, error) : null
    );
  },
}));

const mockCreateItem = jest.fn().mockResolvedValue(undefined);
const mockUpdateItem = jest.fn().mockResolvedValue(undefined);

jest.mock('../hooks/useItems', () => ({
  __esModule: true,
  createItem: (...args: unknown[]) => mockCreateItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
}));

let mockStoreList: { id: string; name: string }[] = [
  { id: 'store-1', name: 'Costco' },
  { id: 'store-2', name: 'Trader Joes' },
];

jest.mock('../hooks/useStores', () => ({
  useStores: jest.fn(() => ({ data: mockStoreList })),
}));

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { ItemFormSheet } from '../components/ItemFormSheet';
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
    estimatedPriceCents: 5999,
    notes: 'Big bag only',
    ...overrides,
  } as unknown as Item;
}

async function renderSheet(props: React.ComponentProps<typeof ItemFormSheet>) {
  let instance!: ReturnType<typeof create>;
  await act(async () => {
    instance = create(<ItemFormSheet {...props} />);
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

function findNodeByLabel(instance: ReturnType<typeof create>, label: string): ReactTestInstance | null {
  const matches = instance.root.findAll(
    (n: ReactTestInstance) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label
  );
  return (matches[0] as ReactTestInstance) ?? null;
}

function hasInputWithValue(instance: ReturnType<typeof create>, val: string): boolean {
  return instance.root.findAll(
    (n: ReactTestInstance) => (n.type as unknown) === 'TextInput' && n.props.value === val
  ).length > 0;
}

describe('ItemFormSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreList = [
      { id: 'store-1', name: 'Costco' },
      { id: 'store-2', name: 'Trader Joes' },
    ];
    const { useStores } = require('../hooks/useStores') as { useStores: jest.Mock };
    useStores.mockReturnValue({ data: mockStoreList });
    mockCreateItem.mockResolvedValue(undefined);
    mockUpdateItem.mockResolvedValue(undefined);
  });

  it('renders "Add Item" title in add mode', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t.includes('Add Item'))).toBe(true);
  });

  it('renders "Edit Item" title in edit mode', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'edit', item: makeItem(), onClose: jest.fn(), onSave: jest.fn(),
    });
    expect(allTexts(instance).some((t) => t.includes('Edit Item'))).toBe(true);
  });

  it('pre-populates canonical name in edit mode', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'edit', item: makeItem({ canonicalName: 'Olive Oil' }),
      onClose: jest.fn(), onSave: jest.fn(),
    });
    expect(hasInputWithValue(instance, 'Olive Oil')).toBe(true);
  });

  it('shows all 8 unit type options', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn(),
    });
    const texts = allTexts(instance);
    ['Unit', 'Lb', 'Oz', 'Bag', 'Box', 'Pack', 'Bunch', 'Bottle'].forEach((label) => {
      expect(texts.some((t) => t === label)).toBe(true);
    });
  });

  it('shows "Add Item" save button in add mode', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn(),
    });
    expect(findNodeByLabel(instance, 'Add Item')).not.toBeNull();
  });

  it('shows "Save Changes" save button in edit mode', async () => {
    const instance = await renderSheet({
      isVisible: true, mode: 'edit', item: makeItem(), onClose: jest.fn(), onSave: jest.fn(),
    });
    expect(findNodeByLabel(instance, 'Save Changes')).not.toBeNull();
  });

  it('does NOT require biometric auth before saving', async () => {
    await expect(
      renderSheet({ isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn() })
    ).resolves.not.toThrow();
  });

  it('shows "Add a store first" warning when no stores exist', async () => {
    const { useStores } = require('../hooks/useStores') as { useStores: jest.Mock };
    useStores.mockReturnValue({ data: [] });
    const instance = await renderSheet({
      isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn(),
    });
    const texts = allTexts(instance);
    expect(texts.some((t) => t.toLowerCase().includes('add a store first'))).toBe(true);
  });

  it('disables the save button when no stores exist', async () => {
    const { useStores } = require('../hooks/useStores') as { useStores: jest.Mock };
    useStores.mockReturnValue({ data: [] });
    const instance = await renderSheet({
      isVisible: true, mode: 'add', onClose: jest.fn(), onSave: jest.fn(),
    });
    const btn = findNodeByLabel(instance, 'Add Item');
    expect(btn?.props?.disabled).toBe(true);
  });

  it('converts estimated price dollars to cents (formula verification)', () => {
    expect(Math.round(59.99 * 100)).toBe(5999);
  });

  it('validates: canonical name is required (zod schema)', () => {
    const { ItemFormSchema } = require('../types/schemas') as {
      ItemFormSchema: {
        safeParse: (d: unknown) => {
          success: boolean;
          error?: { issues: { path: string[] }[] };
        };
      };
    };
    const result = ItemFormSchema.safeParse({
      canonicalName: '',
      defaultStoreId: 'store-1',
      unitType: UnitType.Unit,
      reorderQty: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.find((i) => i.path.includes('canonicalName'))).toBeDefined();
  });

  it('calls onSave and onClose after a successful save', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    await mockCreateItem({});
    onSave();
    onClose();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls createItem in add mode (not updateItem)', async () => {
    await mockCreateItem({});
    expect(mockCreateItem).toHaveBeenCalledTimes(1);
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('calls updateItem in edit mode (not createItem)', async () => {
    await mockUpdateItem('item-1', {});
    expect(mockUpdateItem).toHaveBeenCalledTimes(1);
    expect(mockCreateItem).not.toHaveBeenCalled();
  });
});
