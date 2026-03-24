import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Pressable,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SWIPE_THRESHOLD = -72;
const BUTTON_WIDTH = 80;

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: Props) {
  const pan = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(Math.min(g.dx + (isOpen.current ? -BUTTON_WIDTH : 0), 0), -BUTTON_WIDTH);
        pan.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD && !isOpen.current) {
          Animated.spring(pan, {
            toValue: -BUTTON_WIDTH,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start(() => {
            isOpen.current = true;
          });
        } else if (g.dx > 20 && isOpen.current) {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start(() => {
            isOpen.current = false;
          });
        } else {
          Animated.spring(pan, {
            toValue: isOpen.current ? -BUTTON_WIDTH : 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  function handleDelete() {
    Animated.timing(pan, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      isOpen.current = false;
      onDelete();
    });
  }

  return (
    <View className="overflow-hidden">
      {/* Delete button revealed behind row */}
      <View
        className="absolute right-0 top-0 bottom-0 bg-danger items-center justify-center"
        style={{ width: BUTTON_WIDTH }}
      >
        <Pressable
          onPress={handleDelete}
          className="flex-1 w-full items-center justify-center"
          accessibilityLabel="Delete item"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          <Text className="text-white text-xs mt-1">Delete</Text>
        </Pressable>
      </View>

      {/* Main row content */}
      <Animated.View
        style={{ transform: [{ translateX: pan }] }}
        {...panResponder.panHandlers}
        className="bg-white"
      >
        {children}
      </Animated.View>
    </View>
  );
}
