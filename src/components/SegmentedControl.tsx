import { View, Text, Pressable } from 'react-native';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: Props<T>) {
  return (
    <View className="mb-4">
      {label ? (
        <Text className="text-sm font-medium text-slate-700 mb-1.5">{label}</Text>
      ) : null}
      <View className="flex-row rounded-lg border border-border overflow-hidden bg-surface">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`flex-1 py-2.5 items-center ${active ? 'bg-primary' : 'bg-transparent'}`}
            >
              <Text
                className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-500'}`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
