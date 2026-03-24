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
    </BottomSheet>
  );
}

// ─── List Item Row ─────────────────────────────────────────────────────────────

interface ListItemRowProps {
  entry: ListItemWithRelations;
  onEdit: () => void;
  onDelete: () => void;
}

function ListItemRow({ entry, onEdit, onDelete }: ListItemRowProps) {
  const { listItem, item } = entry;

  return (
    <SwipeableRow onDelete={onDelete}>
      <Pressable
        onPress={onEdit}
        className="flex-row items-center px-4 py-3.5 border-b border-slate-100 active:bg-slate-50"
      >
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-800">
            {item?.canonicalName ?? 'Unknown item'}
          </Text>
          {item?.defaultBrand ? (
            <Text className="text-xs text-slate-500 mt-0.5">{item.defaultBrand}</Text>
          ) : null}
          <Text className="text-xs text-slate-400 mt-0.5">Qty: {listItem.quantity}</Text>
        </View>
        <StatusChip variant={listItemStatusToVariant(listItem.status)} />
      </Pressable>
    </SwipeableRow>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function StoreSectionHeader({ store, count }: { store: Store; count: number }) {
  return (
    <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border">
      <Text className="text-sm font-bold text-slate-700 flex-1">{store.name}</Text>
      {count > 0 && (
        <View className="bg-primary rounded-full px-2 py-0.5 min-w-[24px] items-center">
          <Text className="text-white text-xs font-bold">{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ListsScreen() {
  const { data: allItems, isLoading: listLoading } = useAllListItems();
  const { data: activeStores, isLoading: storesLoading } = useActiveStores();
  const { items: catalogItems } = useItems();
  const deleteListItem = useDeleteListItem();

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    qty: number;
    name: string;
  } | null>(null);

  const sections: Section[] = useMemo(() => {
    if (!activeStores || !allItems) return [];
    return activeStores
      .map((store) => {
        const entries = allItems.filter((e) => e.listItem.storeId === store.id);
        const pending = entries.filter(
          (e) => e.listItem.status === ListItemStatus.Pending
        ).length;
        return { store, data: entries, pendingCount: pending };
      })
      .filter((s) => s.data.length > 0);
  }, [activeStores, allItems]);

  function handleDeleteItem(listItemId: string) {
    Alert.alert('Remove item', 'Remove this item from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteListItem.mutate(listItemId),
      },
    ]);
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
