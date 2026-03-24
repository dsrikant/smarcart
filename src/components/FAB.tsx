import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onPress: () => void;
  accessibilityLabel?: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
}

export function FAB({ onPress, accessibilityLabel = 'Add', iconName = 'add' }: Props) {
  return (
    <View className="absolute bottom-6 right-5">
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        className="w-14 h-14 rounded-full bg-primary items-center justify-center shadow-md active:bg-primary-dark"
        style={{ elevation: 6 }}
      >
        <Ionicons name={iconName} size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
