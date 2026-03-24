import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Animated,
} from 'react-native';
import ListItem from '@/db/models/ListItem';
import Item from '@/db/models/Item';
import { ListItemStatus } from '@/types/enums';
import { SwipeableRow } from './SwipeableRow';

const STATUS_BORDER_COLORS: Record<ListItemStatus, string> = {
  [ListItemStatus.Pending]: '#14b8a6',    // teal-500
  [ListItemStatus.Purchasing]: '#f59e0b', // amber-500
  [ListItemStatus.Failed]: '#ef4444',     // red-500
  [ListItemStatus.Purchased]: '#22c55e',  // green-500 (not shown in list)
};

export type ListItemRowProps = {
  listItem: ListItem;
  item: Item;
  onRemove: (listItem: ListItem) => void;
  onQuantityChange: (listItem: ListItem, newQty: number) => void;
};

export function ListItemRow({ listItem, item, onRemove, onQuantityChange }: ListItemRowProps) {
  const [editingQty, setEditingQty] = useState(false);
  const [draftQty, setDraftQty] = useState(listItem.quantity);
  const slideAnim = useRef(new Animated.Value(40)).current;

  const isPurchasing = listItem.status === ListItemStatus.Purchasing;
  const isFailed = listItem.status === ListItemStatus.Failed;
  const borderColor = STATUS_BORDER_COLORS[listItem.status] ?? '#14b8a6';

  function enterEditMode() {
    if (isPurchasing) return;
    setDraftQty(listItem.quantity);
    setEditingQty(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }

  function confirmQty() {
    onQuantityChange(listItem, draftQty);
    setEditingQty(false);
    slideAnim.setValue(40);
  }

  function handleRemove() {
    Alert.alert(
      'Remove item',
      `Remove ${item.canonicalName} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(listItem),
        },
      ]
    );
  }

  function handleFailedTap() {
    Alert.alert(
      'Purchase failed',
      'Automatic purchase failed. Open the store app to complete this order.'
    );
  }

  const rowContent = (
    <View
      className={`flex-row items-stretch bg-white border-b border-gray-100 ${
        isPurchasing ? 'opacity-60' : ''
      }`}
    >
      {/* Status left-border: inline style required for dynamic color (NativeWind limitation) */}
      <View style={{ width: 3, backgroundColor: borderColor }} />

      <Pressable
        onPress={isFailed ? handleFailedTap : isPurchasing ? undefined : enterEditMode}
        disabled={isPurchasing}
        className="flex-1 flex-row items-center px-4 py-3.5"
        accessibilityRole="button"
        accessibilityLabel={`${item.canonicalName}, quantity ${listItem.quantity}`}
      >
        {/* Item info */}
        <View className="flex-1">
          <Text className="text-[15px] font-medium text-slate-800" numberOfLines={1}>
            {item.canonicalName}
          </Text>
          {item.defaultBrand ? (
            <Text className="text-[13px] text-gray-400 mt-0.5" numberOfLines={1}>
              {item.defaultBrand}
            </Text>
          ) : null}
          {isPurchasing ? (
            <Text className="text-[12px] text-amber-500 mt-0.5">Ordering…</Text>
          ) : isFailed ? (
            <Text className="text-[12px] text-red-500 mt-0.5">Failed — tap to retry</Text>
          ) : null}
        </View>

        {/* Right side: quantity or stepper */}
        {editingQty ? (
          <Animated.View
            className="flex-row items-center gap-1"
            style={{ transform: [{ translateX: slideAnim }] }}
          >
            <Pressable
              onPress={() => setDraftQty((q) => Math.max(1, q - 1))}
              disabled={draftQty <= 1}
              className="w-8 h-8 rounded-full border border-gray-200 items-center justify-center"
              accessibilityLabel="Decrease quantity"
            >
              <Text className="text-slate-600 text-base leading-none">−</Text>
            </Pressable>
            <Text className="text-sm text-slate-700 w-6 text-center">{draftQty}</Text>
            <Pressable
              onPress={() => setDraftQty((q) => Math.min(99, q + 1))}
              disabled={draftQty >= 99}
              className="w-8 h-8 rounded-full border border-gray-200 items-center justify-center"
              accessibilityLabel="Increase quantity"
            >
              <Text className="text-slate-600 text-base leading-none">+</Text>
            </Pressable>
            <Pressable
              onPress={confirmQty}
              className="w-8 h-8 rounded-full bg-teal-500 items-center justify-center ml-1"
              accessibilityLabel="Confirm quantity"
            >
              <Text className="text-white text-sm leading-none">✓</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Text className="text-[14px] text-gray-500">×{listItem.quantity}</Text>
        )}
      </Pressable>
    </View>
  );

  if (isPurchasing) {
    return rowContent;
  }

  return (
    <SwipeableRow onDelete={handleRemove}>
      {rowContent}
    </SwipeableRow>
  );
}
