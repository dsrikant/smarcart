import { useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllListItems,
  useCreateListItem,
  useDeleteListItem,
  useUpdateListItem,
  LIST_ITEMS_QUERY_KEY,
  ListItemWithRelations,
} from '@/hooks/useListItems';
import { useActiveStores } from '@/hooks/useStores';
import { useItems } from '@/hooks/useItems';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { StatusChip, listItemStatusToVariant } from '@/components/StatusChip';
import { SwipeableRow } from '@/components/SwipeableRow';
import { BottomSheet } from '@/components/BottomSheet';
import { FormField } from '@/components/FormField';
import { ListItemStatus } from '@/types/enums';
import Store from '@/db/models/Store';
import Item from '@/db/models/Item';

interface Section {
  store: Store;
  data: ListItemWithRelations[];
  pendingCount: number;
}

// ─── Add Item Sheet ────────────────────────────────────────────────────────────

interface AddItemSheetProps {
  visible: boolean;
  onClose: () => void;
  stores: Store[];
  items: Item[];
}

function AddItemSheet({ visible, onClose, stores, items }: AddItemSheetProps) {
  const createListItem = useCreateListItem();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [itemSearch, setItemSearch] = useState('');

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.canonicalName.toLowerCase().includes(q) ||
        (i.defaultBrand ?? '').toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  function handleReset() {
    setSelectedStoreId('');
    setSelectedItemId('');
    setQuantity('1');
    setItemSearch('');
  }

  async function handleSave() {
    if (!selectedItemId || !selectedStoreId) {
      Alert.alert('Missing fields', 'Please select both a store and an item.');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Invalid quantity', 'Quantity must be at least 1.');
      return;
    }
    try {
      await createListItem.mutateAsync({
        itemId: selectedItemId,
        storeId: selectedStoreId,
        quantity: qty,
      });
      handleReset();
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Could not add item. Please try again.');
    }
  }

  return (
    <BottomSheet visible={visible} onClose={() => { handleReset(); onClose(); }} title="Add to List" snapHeight="full">
      <View className="px-5 pt-4">
        {/* Store picker */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Store <Text className="text-danger">*</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {stores.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSelectedStoreId(s.id)}
              className={`px-3 py-2 rounded-lg border ${
                selectedStoreId === s.id
                  ? 'bg-primary border-primary'
                  : 'bg-white border-border'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedStoreId === s.id ? 'text-white' : 'text-slate-700'
                }`}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Item search */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Item <Text className="text-danger">*</Text>
        </Text>
        <TextInput
          value={itemSearch}
          onChangeText={setItemSearch}
          placeholder="Search items…"
          placeholderTextColor="#94A3B8"
          className="border border-border rounded-lg px-3 py-3 text-sm text-slate-800 bg-white mb-2"
        />
        <View className="max-h-48 rounded-lg border border-border overflow-hidden mb-4">
          {filteredItems.length === 0 ? (
            <Text className="p-4 text-sm text-slate-400 text-center">
              {items.length === 0 ? 'No items in catalog yet' : 'No items match'}
            </Text>
          ) : (
            filteredItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedItemId(item.id)}
                className={`px-4 py-3 border-b border-border flex-row items-center justify-between ${
                  selectedItemId === item.id ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <View>
                  <Text className="text-sm font-medium text-slate-800">
                    {item.canonicalName}
                  </Text>
                  {item.defaultBrand ? (
                    <Text className="text-xs text-slate-500">{item.defaultBrand}</Text>
                  ) : null}
                </View>
                {selectedItemId === item.id && (
                  <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white text-xs">✓</Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>

        {/* Quantity */}
        <FormField
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          required
        />

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={createListItem.isPending}
          className="bg-primary rounded-xl py-3.5 items-center mt-2 active:bg-primary-dark"
        >
          {createListItem.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Add to List</Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ─── Edit Quantity Sheet ───────────────────────────────────────────────────────

interface EditQuantitySheetProps {
  visible: boolean;
  onClose: () => void;
  listItemId: string;
  initialQuantity: number;
  itemName: string;
}

function EditQuantitySheet({
  visible,
  onClose,
  listItemId,
  initialQuantity,
  itemName,
}: EditQuantitySheetProps) {
  const updateListItem = useUpdateListItem();
  const [quantity, setQuantity] = useState(String(initialQuantity));

  async function handleSave() {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Invalid quantity', 'Quantity must be at least 1.');
      return;
    }
    try {
      await updateListItem.mutateAsync({ id: listItemId, quantity: qty });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not update item.');
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Edit: ${itemName}`}>
      <View className="px-5 pt-4">
        <FormField
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          required
          autoFocus
        />
        <Pressable
          onPress={handleSave}
          disabled={updateListItem.isPending}
          className="bg-primary rounded-xl py-3.5 items-center mt-2 active:bg-primary-dark"
        >
          {updateListItem.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Save</Text>
          )}
        </Pressable>
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

  const isLoading = listLoading || storesLoading;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const hasAnyItems = sections.some((s) => s.data.length > 0);

  return (
    <View className="flex-1 bg-surface">
      {hasAnyItems ? (
        <SectionList
          sections={sections}
          keyExtractor={(entry) => entry.listItem.id}
          renderSectionHeader={({ section }) => (
            <StoreSectionHeader
              store={section.store}
              count={section.pendingCount}
            />
          )}
          renderItem={({ item: entry }) => (
            <ListItemRow
              entry={entry}
              onEdit={() =>
                setEditTarget({
                  id: entry.listItem.id,
                  qty: entry.listItem.quantity,
                  name: entry.item?.canonicalName ?? 'Item',
                })
              }
              onDelete={() => handleDeleteItem(entry.listItem.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled
        />
      ) : (
        <EmptyState
          icon="cart-outline"
          title="Your lists are empty"
          subtitle="Tap the mic widget on your home screen to add items, or tap + below to add manually."
        />
      )}

      <FAB
        onPress={() => setAddSheetVisible(true)}
        accessibilityLabel="Add item to list"
      />

      <AddItemSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        stores={activeStores ?? []}
        items={catalogItems}
      />

      {editTarget && (
        <EditQuantitySheet
          visible={!!editTarget}
          onClose={() => setEditTarget(null)}
          listItemId={editTarget.id}
          initialQuantity={editTarget.qty}
          itemName={editTarget.name}
        />
      )}
    </View>
  );
}
