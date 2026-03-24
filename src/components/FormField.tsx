import { View, Text, TextInput, TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
}

export function FormField({ label, error, required, ...inputProps }: Props) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <Text className="text-danger"> *</Text>}
      </Text>
      <TextInput
        className={`border rounded-lg px-3 py-3 text-sm text-slate-800 bg-white ${
          error ? 'border-danger' : 'border-border'
        }`}
        placeholderTextColor="#94A3B8"
        {...inputProps}
      />
      {error ? (
        <Text className="mt-1 text-xs text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
