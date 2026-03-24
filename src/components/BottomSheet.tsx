import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  snapHeight?: 'half' | 'full';
}

export function BottomSheet({ visible, onClose, title, children, snapHeight = 'half' }: Props) {
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const maxHeightPercent = snapHeight === 'full' ? '92%' : '75%';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/40 justify-end">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityLabel="Close sheet"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={[
              { transform: [{ translateY }], maxHeight: maxHeightPercent },
            ]}
            className="bg-white rounded-t-2xl overflow-hidden"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
              <Text className="text-base font-semibold text-slate-800">{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>
            {/* Body */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
