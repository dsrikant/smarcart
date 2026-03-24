import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'cart-outline', title, subtitle }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={56} color="#CBD5E1" />
      <Text className="mt-4 text-base font-semibold text-slate-500 text-center">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-sm text-slate-400 text-center">{subtitle}</Text>
      ) : null}
    </View>
  );
}
