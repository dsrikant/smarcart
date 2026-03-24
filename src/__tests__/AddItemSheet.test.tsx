import React from 'react';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Factories must be self-contained — no outer const refs due to jest.mock hoisting
jest.mock('react-native', () => {
  const React = require('react');
  const View = (props: any) => React.createElement('View', props);
  const Text = (props: any) => React.createElement('Text', props);
  const Pressable = ({ children, onPress, disabled, ...rest }: any) =>
    React.createElement('Pressable', { ...rest, onPress, 'data-disabled': disabled }, children);
  const TextInput = (props: any) => React.createElement('TextInput', props);
  const ScrollView = (props: any) => React.createElement('ScrollView', props);
  const ActivityIndicator = () => React.createElement('ActivityIndicator', null);
  const Alert = { alert: jest.fn() };
  return {
    View,
    Text,
    Pressable,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet: {
      create: (s: any) => s,
      flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s),
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

const mockCreateListItem = jest.fn().mockResolvedValue(undefined);
const mockUseItemSearch = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../components/BottomSheet', () => {
  const React = require('react');
  return {
    BottomSheet: ({ children, visible }: any) =>
      visible ? React.createElement('BottomSheet', null, children) : null,
  };
});

jest.mock('../hooks/useItems', () => ({
  useItemSearch: (...args: any[]) => mockUseItemSearch(...args),
}));

jest.mock('../hooks/useListItems', () => ({
  createListItem: (...args: any[]) => mockCreateListItem(...args),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────────

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AddItemSheet } from '../components/AddItemSheet';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ITEMS = [
  { id: 'i1', canonicalName: 'Dog Food', defaultBrand: 'Kirkland', defaultStoreId: 's1' },
  { id: 'i2', canonicalName: 'Coke', defaultBrand: 'Coca-Cola', defaultStoreId: 's1' },
];

function renderSheet(overrides: Partial<React.ComponentProps<typeof AddItemSheet>> = {}) {
  const onClose = jest.fn();
  const onAdd = jest.fn();
  const utils = render(
    <AddItemSheet
      isVisible={true}
      onClose={onClose}
      onAdd={onAdd}
      {...overrides}
    />
  );
  return { ...utils, onClose, onAdd };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('AddItemSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseItemSearch.mockReturnValue({ items: ITEMS });
  });

  it('renders item search input', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('Search items')).toBeTruthy();
  });

  it('useItemSearch called with current query string', () => {
    renderSheet();
    // Initial render with empty query
    expect(mockUseItemSearch).toHaveBeenCalledWith('');
  });

  it('item list renders search results', () => {
    const { getByText } = renderSheet();
    expect(getByText('Dog Food')).toBeTruthy();
    expect(getByText('Coke')).toBeTruthy();
  });

  it('tapping an item selects it and enables Add button', () => {
    const { getByLabelText } = renderSheet();

    fireEvent.press(getByLabelText('Select Dog Food'));

    const addBtn = getByLabelText('Add item to list');
    expect(addBtn.props['data-disabled']).toBeFalsy();
  });

  it('Add button disabled when no item selected', () => {
    const { getByLabelText } = renderSheet();

    const addBtn = getByLabelText('Add item to list');
    expect(addBtn.props['data-disabled']).toBe(true);
  });

  it('quantity stepper starts at 1', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('qty-value').props.children).toBe(1);
  });

  it('stepper − disabled at quantity 1', () => {
    const { getByLabelText } = renderSheet();
    const decreaseBtn = getByLabelText('Decrease quantity');
    expect(decreaseBtn.props['data-disabled']).toBe(true);
  });

  it('stepper + increases quantity', () => {
    const { getByLabelText, getByTestId } = renderSheet();

    fireEvent.press(getByLabelText('Increase quantity'));

    expect(getByTestId('qty-value').props.children).toBe(2);
  });

  it('calls createListItem with correct itemId, storeId, and quantity on add', async () => {
    const { getByLabelText, onAdd } = renderSheet();

    fireEvent.press(getByLabelText('Select Dog Food'));
    fireEvent.press(getByLabelText('Increase quantity'));
    fireEvent.press(getByLabelText('Increase quantity'));
    fireEvent.press(getByLabelText('Add item to list'));

    await waitFor(() => {
      expect(mockCreateListItem).toHaveBeenCalledWith({
        itemId: 'i1',
        storeId: 's1',
        quantity: 3,
      });
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });

  it('shows "No items found" when search returns empty', () => {
    // Mock: query has content but returns no results
    mockUseItemSearch.mockReturnValue({ items: [] });

    const { getByLabelText, queryByText } = renderSheet();

    // Simulate typing a search query → sets hasQuery=true
    fireEvent.changeText(getByLabelText('Search items'), 'xyz');

    expect(queryByText(/No items found/)).toBeTruthy();
  });
});
