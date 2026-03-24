import { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListItems,
  deleteListItem,
  updateListItemQuantity,
  LIST_ITEMS_QUERY_KEY,
} from '@/hooks/useListItems';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { ListItemRow } from '@/components/ListItemRow';
import { StoreListSection } from '@/components/StoreListSection';
import { AddItemSheet } from '@/components/AddItemSheet';
import ListItem from '@/db/models/ListItem';
import Item from '@/db/models/Item';
import type { ListItemSection } from '@/types/listItems';

export default function ListsScreen() {
  const queryClient = useQueryClient();
  const { sections, isLoading, error } = useListItems();
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  function handleRemove(listItem: ListItem) {
    Alert.alert(
      'Remove item',
      `Remove ${listItem.itemId} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListItem(listItem.id);
              queryClient.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
            } catch {
              Alert.alert('Error', 'Could not remove item.');
            }
          },
        },
      ]
    );
  }

  async function handleQuantityChange(listItem: ListItem, newQty: number) {
    try {
      await updateListItemQuantity(listItem.id, newQty);
      queryClient.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
    } catch {
      Alert.alert('Error', 'Could not update quantity.');
    }
  }

  function handleAdd() {
    queryClient.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="text-red-500 text-center">Failed to load list. Please try again.</Text>
      </View>
    );
  }

  const hasItems = sections.length > 0;

  return (
    <View className="flex-1 bg-gray-50">
      {hasItems ? (
        <SectionList<{ listItem: ListItem; item: Item }, ListItemSection>
          sections={sections}
          keyExtractor={(entry) => entry.listItem.id}
          renderSectionHeader={({ section }) => (
            <StoreListSection
              store={section.store}
              itemCount={section.data.length}
            />
          )}
          renderItem={({ item: entry }) => (
            <ListItemRow
              listItem={entry.listItem}
              item={entry.item}
              onRemove={handleRemove}
              onQuantityChange={handleQuantityChange}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled
        />
      ) : (
        <EmptyState
          icon="cart-outline"
          title="Your lists are empty"
          subtitle="Tap the mic widget on your home screen to add items, or use the + button below"
        />
      )}

      <FAB
        onPress={() => setAddSheetVisible(true)}
        accessibilityLabel="Add item to list"
      />

      <AddItemSheet
        isVisible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
