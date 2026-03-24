import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useItems, useItemSearch, deleteItem } from '@/hooks/useItems';
import { useStores } from '@/hooks/useStores';
import { ItemCard } from '@/components/ItemCard';
import { ItemFormSheet } from '@/components/ItemFormSheet';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import Item from '@/db/models/Item';

export default function ItemsScreen() {
  const [search, setSearch] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();

  const { items: allItems, isLoading } = useItems();
  const { items: filteredItems } = useItemSearch(search);
  const { data: stores = [] } = useStores();

  function storeNameFor(storeId: string): string {
    return stores.find((s) => s.id === storeId)?.name ?? '—';
  }

  function handleEdit(item: Item) {
    setEditingItem(item);
    setSheetVisible(true);
  }

  function handleAdd() {
    setEditingItem(undefined);
    setSheetVisible(true);
  }

  function handleSheetClose() {
    setSheetVisible(false);
    setEditingItem(undefined);
  }

  async function handleDelete(item: Item) {
    Alert.alert(
      'Delete item?',
      `"${item.canonicalName}" will be removed from your catalog.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
            } catch {
              Alert.alert('Error', 'Could not delete item. Please try again.');
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  const displayItems = search ? filteredItems : allItems;
  const isEmpty = allItems.length === 0;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search bar */}
      <View className="bg-white border border-gray-200 rounded-xl mx-4 mt-3 mb-2 flex-row items-center px-4 py-3">
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items..."
          placeholderTextColor="#9CA3AF"
          className="flex-1 ml-2 text-sm text-slate-800"
          clearButtonMode="while-editing"
          accessibilityLabel="Search items"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <EmptyState
          icon="list-outline"
          title="No items in your catalog"
          subtitle="Tap + to add your first item"
        />
      ) : displayItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-semibold text-slate-500 text-center">
            No items matching &apos;{search}&apos;
          </Text>
          <Pressable onPress={() => setSearch('')} className="mt-3">
            <Text className="text-sm text-teal-600 font-medium">Clear search</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              storeName={storeNameFor(item.defaultStoreId)}
              onPress={handleEdit}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <FAB onPress={handleAdd} accessibilityLabel="Add item" />

      <ItemFormSheet
        isVisible={sheetVisible}
        mode={editingItem ? 'edit' : 'add'}
        item={editingItem}
        onClose={handleSheetClose}
        onSave={handleSheetClose}
      />
    </View>
  );
}
