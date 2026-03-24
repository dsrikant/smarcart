import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings, useUpdateAppSettings } from '@/hooks/useAppSettings';
import { FormField } from '@/components/FormField';
import { AppSettingsFormSchema, AppSettingsFormValues } from '@/types/schemas';
import {
  setResendApiKey,
  hasResendApiKey,
  clearNonStoreSecrets,
} from '@/services/credentialVault';
import { isBiometricsAvailable } from '@/services/biometrics';
import database from "@/db";

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mb-5">
      <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {title}
      </Text>
      <View className="bg-white rounded-xl border border-border overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  icon,
  onPress,
  right,
  destructive,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 border-b border-slate-100 last:border-b-0 active:bg-slate-50"
      disabled={!onPress && !right}
    >
      <Ionicons
        name={icon}
        size={18}
        color={destructive ? '#EF4444' : '#64748B'}
        style={{ marginRight: 12 }}
      />
      <Text
        className={`flex-1 text-sm ${destructive ? 'text-danger' : 'text-slate-800'}`}
      >
        {label}
      </Text>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color="#CBD5E1" /> : null)}
    </Pressable>
  );
}

// ─── Address & Email Form ──────────────────────────────────────────────────────

function AddressEmailForm() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSettings = useUpdateAppSettings();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AppSettingsFormValues>({
    resolver: zodResolver(AppSettingsFormSchema),
    defaultValues: {
      homeAddressLine1: settings?.homeAddressLine1 ?? '',
      homeAddressLine2: settings?.homeAddressLine2 ?? '',
      homeCity: settings?.homeCity ?? '',
      homeZip: settings?.homeZip ?? '',
      confirmationEmail: settings?.confirmationEmail ?? '',
    },
  });

  if (isLoading) return null;

  async function onSubmit(values: AppSettingsFormValues) {
    try {
      await updateSettings.mutateAsync({
        homeAddressLine1: values.homeAddressLine1 ?? null,
        homeAddressLine2: values.homeAddressLine2 ?? null,
        homeCity: values.homeCity ?? null,
        homeZip: values.homeZip ?? null,
        confirmationEmail: values.confirmationEmail ?? null,
      });
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch {
      Alert.alert('Error', 'Could not save settings.');
    }
  }

  return (
    <View>
      <Controller
        control={control}
        name="homeAddressLine1"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Address line 1"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="123 Main St"
            error={errors.homeAddressLine1?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="homeAddressLine2"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Address line 2 (optional)"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Apt 4B"
          />
        )}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Controller
            control={control}
            name="homeCity"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="City"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="San Francisco"
              />
            )}
          />
        </View>
        <View className="w-28">
          <Controller
            control={control}
            name="homeZip"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="ZIP"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="94102"
                keyboardType="number-pad"
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="confirmationEmail"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Confirmation email"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.confirmationEmail?.message}
          />
        )}
      />
      {isDirty && (
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={updateSettings.isPending}
          className="bg-primary rounded-xl py-3 items-center mb-2 active:bg-primary-dark"
        >
          {updateSettings.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Save Address & Email</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ─── Resend API Key ────────────────────────────────────────────────────────────

function ResendApiKeyRow() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    hasResendApiKey().then(setHasKey).catch(() => setHasKey(false));
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      Alert.alert('Required', 'Enter the Resend API key.');
      return;
    }
    setIsSaving(true);
    try {
      await setResendApiKey(apiKey.trim());
      setApiKey('');
      setHasKey(true);
      Alert.alert('Saved', 'Resend API key stored securely.');
    } catch {
      Alert.alert('Error', 'Could not save API key.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="px-4 py-3 border-b border-slate-100">
      <View className="flex-row items-center mb-1.5">
        <Ionicons name="mail-outline" size={18} color="#64748B" style={{ marginRight: 12 }} />
        <Text className="text-sm text-slate-800 flex-1">Resend API key</Text>
        {hasKey && (
          <View className="bg-green-100 px-2 py-0.5 rounded-full">
            <Text className="text-green-700 text-xs">Saved</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-slate-500 mb-2 ml-8">
        Used to send purchase confirmation emails. Stored in Android Keystore only.
      </Text>
      <View className="flex-row items-center ml-8 border border-border rounded-lg overflow-hidden bg-white">
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={hasKey ? '••••••••••••••••' : 'sk_live_…'}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showKey}
          autoCapitalize="none"
          className="flex-1 px-3 py-2.5 text-sm text-slate-800"
        />
        <Pressable
          onPress={() => setShowKey((v) => !v)}
          className="px-3 py-2.5"
          accessibilityLabel={showKey ? 'Hide key' : 'Show key'}
        >
          <Ionicons
            name={showKey ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="#94A3B8"
          />
        </Pressable>
      </View>
      {apiKey.trim().length > 0 && (
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-lg py-2 items-center mt-2 ml-8 active:bg-primary-dark"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-sm font-medium">Save Key</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ─── Biometric Toggle ──────────────────────────────────────────────────────────

function BiometricToggleRow() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleToggle(enabled: boolean) {
    if (enabled) {
      setChecking(true);
      const available = await isBiometricsAvailable();
      setChecking(false);
      if (!available) {
        Alert.alert(
          'Biometrics unavailable',
          'No biometric credentials are enrolled on this device. Please set up fingerprint or face unlock in Android Settings first.'
        );
        return;
      }
    }
    // Phase 2: persist to SecureStore rather than SQLite (security-sensitive setting)
    setIsEnabled(enabled);
  }

  return (
    <SettingsRow
      label="Require biometrics before purchase"
      icon="finger-print-outline"
      right={
        checking ? (
          <ActivityIndicator size="small" color="#94A3B8" />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
            thumbColor={isEnabled ? '#2563EB' : '#94A3B8'}
          />
        )
      }
    />
  );
}

// ─── Data section ──────────────────────────────────────────────────────────────

async function exportAllData(): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Export not available', 'Sharing is not supported on this device.');
    return;
  }

  try {
    const [stores, items, listItems, purchases, purchaseRules] = await Promise.all([
      database.get('stores').query().fetch(),
      database.get('items').query().fetch(),
      database.get('list_items').query().fetch(),
      database.get('purchases').query().fetch(),
      database.get('purchase_rules').query().fetch(),
    ]);

    type WithRaw = { _raw: unknown };
    const exportData = {
      exportedAt: new Date().toISOString(),
      stores: stores.map((r) => (r as unknown as WithRaw)._raw),
      items: items.map((r) => (r as unknown as WithRaw)._raw),
      listItems: listItems.map((r) => (r as unknown as WithRaw)._raw),
      purchases: purchases.map((r) => (r as unknown as WithRaw)._raw),
      purchaseRules: purchaseRules.map((r) => (r as unknown as WithRaw)._raw),
    };

    const json = JSON.stringify(exportData, null, 2);

    // expo-file-system is a peer dep of expo-sharing — share as text/JSON
    // If expo-file-system is not installed, alert the user to add it (see QUESTIONS.md Q12)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let FileSystem: any;
    try {
      FileSystem = await import('expo-file-system' as string);
    } catch {
      Alert.alert(
        'Export unavailable',
        'expo-file-system is not installed. Add it with: npx expo install expo-file-system'
      );
      return;
    }

    const path = `${FileSystem.cacheDirectory}smartcart-export.json`;
    await FileSystem.writeAsStringAsync(path, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(path, { mimeType: 'application/json' });
  } catch {
    Alert.alert('Export failed', 'Could not export data.');
  }
}

function clearAllData() {
  Alert.alert(
    'Clear all data',
    'This will permanently delete all stores, items, lists, purchases, and rules. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear everything',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await database.unsafeResetDatabase();
            });
            await clearNonStoreSecrets();
            Alert.alert('Done', 'All data has been cleared. Restart the app.');
          } catch {
            Alert.alert('Error', 'Could not clear data.');
          }
        },
      },
    ]
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingTop: 16, paddingBottom: 60 }}>
      {/* Delivery address + confirmation email */}
      <Section title="Delivery & Notifications">
        <View className="px-4 pt-4 pb-2">
          <AddressEmailForm />
        </View>
      </Section>

      {/* Resend API key */}
      <Section title="Email Service">
        <ResendApiKeyRow />
      </Section>

      {/* Security */}
      <Section title="Security">
        <BiometricToggleRow />
      </Section>

      {/* Data management */}
      <Section title="Data">
        <SettingsRow
          label="Export all data as JSON"
          icon="download-outline"
          onPress={exportAllData}
        />
        <SettingsRow
          label="Clear all data"
          icon="trash-outline"
          onPress={clearAllData}
          destructive
        />
      </Section>

      {/* App info */}
      <View className="items-center mt-2">
        <Text className="text-xs text-slate-400">SmartCart v1.0.0 · Phase 1</Text>
      </View>
    </ScrollView>
  );
}
