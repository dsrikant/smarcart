import { View, Text } from 'react-native';
import Store from '@/db/models/Store';

export type StoreListSectionProps = {
  store: Store;
  itemCount: number;
};

export function StoreListSection({ store, itemCount }: StoreListSectionProps) {
  return (
    <View className="flex-row items-center bg-gray-50 px-4 py-2 border-b border-gray-200">
      <Text
        className="flex-1 text-xs font-medium text-gray-500 tracking-widest uppercase"
        numberOfLines={1}
      >
        {store.name.toUpperCase()}
      </Text>
      {itemCount > 0 && (
        <View className="bg-teal-600 rounded-full px-2 py-0.5 min-w-[22px] items-center ml-2">
          <Text className="text-white text-xs font-semibold">{itemCount}</Text>
        </View>
      )}
    </View>
  );
}
