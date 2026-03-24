import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BottomSheet } from '@/components/BottomSheet';
import { FormField } from '@/components/FormField';
import { useStores } from '@/hooks/useStores';
import { createItem, updateItem } from '@/hooks/useItems';
import { ItemFormSchema, ItemFormValues } from '@/types/schemas';
import { UnitType } from '@/types/enums';
import Item from '@/db/models/Item';

export type ItemFormSheetProps = {
  isVisible: boolean;
  mode: 'add' | 'edit';
  item?: Item;
  onClose: () => void;
  onSave: () => void;
};

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

export function ItemFormSheet({ isVisible, mode, item, onClose, onSave }: ItemFormSheetProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { data: stores = [] } = useStores();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(ItemFormSchema),
    defaultValues: {
      canonicalName: item?.canonicalName ?? '',
      defaultStoreId: item?.defaultStoreId ?? stores[0]?.id ?? '',
      defaultBrand: item?.defaultBrand ?? '',
      unitType: item?.unitType ?? UnitType.Unit,
      reorderQty: item?.reorderQty ?? 1,
      notes: item?.notes ?? '',
      estimatedPriceDollars:
        item?.estimatedPriceCents != null ? item.estimatedPriceCents / 100 : undefined,
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

    const payload = {
      canonicalName: values.canonicalName,
      defaultStoreId: values.defaultStoreId,
      defaultBrand: values.defaultBrand?.trim() || null,
      unitType: values.unitType,
      reorderQty: values.reorderQty,
      estimatedPriceCents: priceCents,
      notes: values.notes?.trim() || null,
    };

    setIsSaving(true);
    try {
      if (mode === 'edit' && item) {
        await updateItem(item.id, payload);
      } else {
        await createItem(payload);
      }
      onSave();
      handleClose();
    } catch {
      Alert.alert('Error', 'Could not save item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const noStores = stores.length === 0;

  return (
    <BottomSheet
      visible={isVisible}
      onClose={handleClose}
      title={mode === 'edit' ? 'Edit Item' : 'Add Item'}
      snapHeight="full"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-4">
          {/* Canonical name */}
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
          <Text className="text-xs text-slate-400 -mt-3 mb-4">
            Use a generic name. Brand is tracked separately.
          </Text>

          {/* Default store */}
          <Text className="text-sm font-medium text-slate-700 mb-1.5">
            Default store <Text className="text-danger">*</Text>
          </Text>

          {noStores ? (
            <View className="mb-4 px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Text className="text-sm text-amber-700">
                Add a store first in the Stores tab.
              </Text>
            </View>
          ) : (
            <Controller
              control={control}
              name="defaultStoreId"
              render={({ field: { value, onChange } }) => (
                <View className="mb-4">
                  <View className="flex-row flex-wrap gap-2">
                    {stores.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => onChange(s.id)}
                        className={`px-3 py-2 rounded-lg border ${
                          value === s.id
                            ? 'bg-primary border-primary'
                            : 'bg-white border-border'
                        }`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: value === s.id }}
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
                  </View>
                  {errors.defaultStoreId && (
                    <Text className="mt-1 text-xs text-danger">
                      {errors.defaultStoreId.message}
                    </Text>
                  )}
                </View>
              )}
            />
          )}

          {/* Default brand */}
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
          <Text className="text-xs text-slate-400 -mt-3 mb-4">
            Leave blank if you buy any brand.
          </Text>

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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: value === opt.value }}
                    accessibilityLabel={opt.label}
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

          {/* Reorder quantity */}
          <Controller
            control={control}
            name="reorderQty"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Default quantity"
                value={String(value)}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  onChange(isNaN(n) ? 1 : n);
                }}
                onBlur={onBlur}
                keyboardType="numeric"
                error={errors.reorderQty?.message}
                required
              />
            )}
          />
          <Text className="text-xs text-slate-400 -mt-3 mb-4">
            How many do you usually buy at once?
          </Text>

          {/* Estimated price */}
          <Controller
            control={control}
            name="estimatedPriceDollars"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-1.5">
                  Estimated price (optional)
                </Text>
                <View className="flex-row items-center border rounded-lg bg-white border-border overflow-hidden">
                  <View className="px-3 py-3 bg-gray-50 border-r border-border">
                    <Text className="text-sm text-slate-500">$</Text>
                  </View>
                  <FormField
                    label=""
                    value={value != null ? String(value) : ''}
                    onChangeText={(t) => {
                      const n = parseFloat(t);
                      onChange(isNaN(n) ? undefined : n);
                    }}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    className="flex-1 px-3 py-3 text-sm text-slate-800 border-0"
                  />
                </View>
                <Text className="text-xs text-slate-400 mt-1">
                  Used to calculate if your cart meets order minimums.
                </Text>
              </View>
            )}
          />

          {/* Notes */}
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Notes"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. Get the big bag, not the small one"
                multiline
                numberOfLines={3}
              />
            )}
          />

          {/* Save button */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving || noStores}
            className={`rounded-xl py-3.5 items-center mt-2 ${
              isSaving || noStores ? 'bg-slate-300' : 'bg-primary active:bg-primary-dark'
            }`}
            accessibilityRole="button"
            accessibilityLabel={mode === 'edit' ? 'Save Changes' : 'Add Item'}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {mode === 'edit' ? 'Save Changes' : 'Add Item'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
