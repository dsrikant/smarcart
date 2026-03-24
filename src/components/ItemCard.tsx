import { View, Text, Pressable } from 'react-native';
import { SwipeableRow } from '@/components/SwipeableRow';
import Item from '@/db/models/Item';

export type ItemCardProps = {
  item: Item;
  storeName: string;
  onPress: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export function ItemCard({ item, storeName, onPress, onDelete }: ItemCardProps) {
  return (
    <SwipeableRow onDelete={() => onDelete(item)}>
      <Pressable
        onPress={() => onPress(item)}
        className="bg-white px-4 py-3 flex-row items-center justify-between border-b border-gray-200"
        accessibilityRole="button"
        accessibilityLabel={item.canonicalName}
      >
        <View className="flex-1 mr-3">
          <Text className="text-[15px] font-medium text-slate-800">{item.canonicalName}</Text>
          <Text className="text-[13px] text-gray-400 mt-0.5">
            {item.defaultBrand ?? '—'}
          </Text>
        </View>
        <View className="bg-teal-100 px-2 py-0.5 rounded-full">
          <Text className="text-teal-800 text-xs font-medium">{storeName}</Text>
        </View>
      </Pressable>
    </SwipeableRow>
  );
}
