import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from '@/hooks/useItems';
import { useActiveStores } from '@/hooks/useStores';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { BottomSheet } from '@/components/BottomSheet';
import { FormField } from '@/components/FormField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatusChip } from '@/components/StatusChip';
import { ItemFormSchema, ItemFormValues } from '@/types/schemas';
import { UnitType, AutomationType } from '@/types/enums';
import Item from '@/db/models/Item';
import Store from '@/db/models/Store';

const UNIT_OPTIONS: { label: string; value: UnitType }[] = [
  { label: 'Unit', value: UnitType.Unit },
  { label: 'Lb', value: UnitType.Lb },
  { label: 'Oz', value: UnitType.Oz },
  { label: 'Bag', value: UnitType.Bag },
  { label: 'Box', value: UnitType.Box },
  { label: 'Pack', value: UnitType.Pack },
  { label: 'Bunch', value: UnitType.Bunch },
  { label: 'Bottle', value: UnitType.Bottle },
];

// ─── Item Form Sheet ───────────────────────────────────────────────────────────

interface ItemFormSheetProps {
  visible: boolean;
  onClose: () => void;
  editingItem?: Item;
  stores: Store[];
}

function ItemFormSheet({ visible, onClose, editingItem, stores }: ItemFormSheetProps) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(ItemFormSchema),
    defaultValues: {
      canonicalName: editingItem?.canonicalName ?? '',
      defaultStoreId: editingItem?.defaultStoreId ?? stores[0]?.id ?? '',
      defaultBrand: editingItem?.defaultBrand ?? '',
      unitType: editingItem?.unitType ?? UnitType.Unit,
      reorderQty: editingItem?.reorderQty ?? 1,
      notes: editingItem?.notes ?? '',
      estimatedPriceDollars:
        editingItem?.estimatedPriceCents != null
          ? editingItem.estimatedPriceCents / 100
          : undefined,
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: ItemFormValues) {
    const priceCents =
      values.estimatedPriceDollars != null
        ? Math.round(values.estimatedPriceDollars * 100)
        : null;

    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          canonicalName: values.canonicalName,
          defaultStoreId: values.defaultStoreId,
          defaultBrand: values.defaultBrand ?? null,
          unitType: values.unitType,
          reorderQty: values.reorderQty,
          estimatedPriceCents: priceCents,
          notes: values.notes ?? null,
        });
      } else {
        await createItem.mutateAsync({
          canonicalName: values.canonicalName,
          defaultStoreId: values.defaultStoreId,
          defaultBrand: values.defaultBrand ?? null,
          unitType: values.unitType,
          reorderQty: values.reorderQty,
          estimatedPriceCents: priceCents,
          notes: values.notes ?? null,
        });
      }
      handleClose();
    } catch {
      Alert.alert('Error', 'Could not save item. Please try again.');
    }
  }

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingItem ? 'Edit Item' : 'Add Item'}
      snapHeight="full"
    >
      <View className="px-5 pt-4">
        <Controller
          control={control}
          name="canonicalName"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Item name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Dog Food"
              error={errors.canonicalName?.message}
              required
            />
          )}
        />

        {/* Default store picker */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Default store <Text className="text-danger">*</Text>
        </Text>
        <Controller
          control={control}
          name="defaultStoreId"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {stores.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onChange(s.id)}
                  className={`px-3 py-2 rounded-lg border ${
                    value === s.id
                      ? 'bg-primary border-primary'
                      : 'bg-white border-border'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      value === s.id ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
              {stores.length === 0 && (
                <Text className="text-sm text-slate-400">
                  Add a store first in the Stores tab.
                </Text>
              )}
              {errors.defaultStoreId && (
                <Text className="text-xs text-danger w-full">
                  {errors.defaultStoreId.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="defaultBrand"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Default brand"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Kirkland"
            />
          )}
        />

        {/* Unit type */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Unit type</Text>
        <Controller
          control={control}
          name="unitType"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {UNIT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => onChange(opt.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    value === opt.value
                      ? 'bg-primary border-primary'
                      : 'bg-white border-border'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      value === opt.value ? 'text-white font-medium' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        <Controller
          control={control}
          name="reorderQty"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Reorder quantity"
              value={String(value)}
              onChangeText={(t) => onChange(parseInt(t, 10) || 1)}
              onBlur={onBlur}
              keyboardType="number-pad"
              error={errors.reorderQty?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="estimatedPriceDollars"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Estimated price (optional)"
              value={value != null ? String(value) : ''}
              onChangeText={(t) => {
                const n = parseFloat(t);
                onChange(isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Notes"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Any special notes…"
              multiline
              numberOfLines={3}
            />
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isPending}
          className="bg-primary rounded-xl py-3.5 items-center active:bg-primary-dark"
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function storeNameFromList(storeId: string, stores: Store[]): string {
  return stores.find((s) => s.id === storeId)?.name ?? '—';
}

function automationVariant(store?: Store) {
  if (!store) return 'inactive' as const;
  if (store.automationType === AutomationType.DirectAmazon) return 'amazon' as const;
  if (store.automationType === AutomationType.Instacart) return 'instacart' as const;
  return 'target' as const;
}

interface ItemRowProps {
  item: Item;
  stores: Store[];
  onEdit: () => void;
}

function ItemRow({ item, stores, onEdit }: ItemRowProps) {
  const store = stores.find((s) => s.id === item.defaultStoreId);
  return (
    <Pressable
      onPress={onEdit}
      className="bg-white mx-4 my-1.5 rounded-xl border border-border px-4 py-3.5 flex-row items-center active:bg-slate-50"
      style={{ elevation: 1 }}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-800">{item.canonicalName}</Text>
        {item.defaultBrand ? (
          <Text className="text-xs text-slate-500 mt-0.5">{item.defaultBrand}</Text>
        ) : null}
        <Text className="text-xs text-slate-400 mt-0.5">
          {item.unitType} · reorder: {item.reorderQty}
        </Text>
      </View>
      <View className="items-end gap-1.5">
        <StatusChip variant={automationVariant(store)} label={store?.name ?? '—'} />
        {item.estimatedPriceCents != null && (
          <Text className="text-xs text-slate-500">
            ~${(item.estimatedPriceCents / 100).toFixed(2)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ItemsScreen() {
  const [search, setSearch] = useState('');
  const { data: allItems, isLoading: itemsLoading } = useItems();
  const { data: stores = [] } = useActiveStores();
  const deleteItem = useDeleteItem();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();

  const filteredItems = useMemo(() => {
    if (!allItems) return [];
    const q = search.toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        i.canonicalName.toLowerCase().includes(q) ||
        (i.defaultBrand ?? '').toLowerCase().includes(q)
    );
  }, [allItems, search]);

  if (itemsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Search bar */}
      <View className="mx-4 mt-3 mb-2 flex-row items-center bg-white border border-border rounded-xl px-3">
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
          placeholderTextColor="#94A3B8"
          className="flex-1 px-2 py-3 text-sm text-slate-800"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </Pressable>
        )}
      </View>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={search ? 'No items match' : 'No items yet'}
          subtitle={search ? undefined : 'Tap + to add your first grocery item.'}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              stores={stores}
              onEdit={() => {
                setEditingItem(item);
                setSheetVisible(true);
              }}
            />
          )}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
        />
      )}

      <FAB
        onPress={() => {
          setEditingItem(undefined);
          setSheetVisible(true);
        }}
        accessibilityLabel="Add item"
      />

      <ItemFormSheet
        visible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          setEditingItem(undefined);
        }}
        editingItem={editingItem}
        stores={stores}
      />
    </View>
  );
}
