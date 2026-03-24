import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useItemSearch } from '@/hooks/useItems';
import { createListItem } from '@/hooks/useListItems';
import Item from '@/db/models/Item';
import { BottomSheet } from './BottomSheet';

export type AddItemSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onAdd: () => void;
};

export function AddItemSheet({ isVisible, onClose, onAdd }: AddItemSheetProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const { items: searchResults = [] } = useItemSearch(query);

  function handleReset() {
    setQuery('');
    setSelectedItem(null);
    setQuantity(1);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleAdd() {
    if (!selectedItem) return;

    setIsSaving(true);
    try {
      await createListItem({
        itemId: selectedItem.id,
        storeId: selectedItem.defaultStoreId,
        quantity,
      });
      handleReset();
      onAdd();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not add item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function navigateToItems() {
    handleClose();
    router.push('/(tabs)/items');
  }

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && searchResults.length === 0;

  return (
    <BottomSheet visible={isVisible} onClose={handleClose} title="Add to list" snapHeight="half">
      <View className="px-5 pt-4 pb-2">
        {/* Item search */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search items…"
          placeholderTextColor="#94A3B8"
          className="border border-gray-200 rounded-lg px-3 py-3 text-sm text-slate-800 bg-white mb-2"
          accessibilityLabel="Search items"
          testID="item-search-input"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Item list */}
        <View className="rounded-lg border border-gray-200 overflow-hidden mb-4 max-h-52">
          {noResults ? (
            <View className="p-4 items-center">
              <Text className="text-sm text-slate-400 text-center mb-2">
                No items found — add it in the Items tab
              </Text>
              <Pressable
                onPress={navigateToItems}
                className="px-4 py-2 bg-teal-600 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Go to Items tab"
              >
                <Text className="text-white text-sm font-medium">Go to Items tab</Text>
              </Pressable>
            </View>
          ) : searchResults.length === 0 ? (
            <Text className="p-4 text-sm text-slate-400 text-center">
              Start typing to search…
            </Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {searchResults.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedItem(item)}
                    className={`px-4 py-3 border-b border-gray-100 flex-row items-center justify-between ${
                      isSelected ? 'bg-teal-50' : 'bg-white'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.canonicalName}`}
                    testID={`item-row-${item.id}`}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-slate-800">{item.canonicalName}</Text>
                      {item.defaultBrand ? (
                        <Text className="text-xs text-slate-500 mt-0.5">{item.defaultBrand}</Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <View className="w-5 h-5 rounded-full bg-teal-600 items-center justify-center">
                        <Text className="text-white text-xs leading-none">✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Quantity stepper */}
        <View className="flex-row items-center mb-5">
          <Text className="text-sm font-medium text-slate-700 mr-4">Quantity</Text>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-full border border-gray-200 items-center justify-center"
              accessibilityLabel="Decrease quantity"
              testID="qty-decrease"
            >
              <Text className="text-slate-600 text-base leading-none">−</Text>
            </Pressable>
            <Text className="text-sm text-slate-800 w-6 text-center" testID="qty-value">
              {quantity}
            </Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(99, q + 1))}
              disabled={quantity >= 99}
              className="w-8 h-8 rounded-full border border-gray-200 items-center justify-center"
              accessibilityLabel="Increase quantity"
              testID="qty-increase"
            >
              <Text className="text-slate-600 text-base leading-none">+</Text>
            </Pressable>
          </View>
        </View>

        {/* Add button */}
        <Pressable
          onPress={handleAdd}
          disabled={!selectedItem || isSaving}
          className={`rounded-xl py-3.5 items-center ${
            selectedItem && !isSaving ? 'bg-teal-600 active:bg-teal-700' : 'bg-gray-200'
          }`}
          accessibilityRole="button"
          accessibilityLabel="Add item to list"
          testID="add-button"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`font-semibold text-base ${
                selectedItem ? 'text-white' : 'text-gray-400'
              }`}
            >
              Add
            </Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
