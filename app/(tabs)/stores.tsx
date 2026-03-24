import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import {
  useStores,
  useCreateStore,
  useUpdateStore,
  useDeleteStore,
  useToggleStoreActive,
} from '@/hooks/useStores';
import { useRulesForStore } from '@/hooks/usePurchaseRules';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { BottomSheet } from '@/components/BottomSheet';
import { FormField } from '@/components/FormField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatusChip, automationTypeToVariant } from '@/components/StatusChip';
import { setStoreCredentials, deleteStoreCredentials } from '@/services/credentialVault';
import { StoreFormSchema, StoreFormValues, StoreCredentialsSchema, StoreCredentialsValues } from '@/types/schemas';
import { AutomationType, DeliveryPreference } from '@/types/enums';
import Store from '@/db/models/Store';

// ─── Rule count badge ──────────────────────────────────────────────────────────

function RuleSummary({ storeId }: { storeId: string }) {
  const { data: rules } = useRulesForStore(storeId);
  const activeCount = rules?.filter((r) => r.isActive).length ?? 0;
  if (activeCount === 0) return null;
  return (
    <Text className="text-xs text-slate-500 mt-1">
      {activeCount} active rule{activeCount !== 1 ? 's' : ''}
    </Text>
  );
}

// ─── Store Card ────────────────────────────────────────────────────────────────

interface StoreCardProps {
  store: Store;
  onEdit: () => void;
  onToggleActive: (isActive: boolean) => void;
}

function StoreCard({ store, onEdit, onToggleActive }: StoreCardProps) {
  return (
    <View className="bg-white mx-4 my-2 rounded-xl border border-border p-4"
      style={{ elevation: 1 }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-800">{store.name}</Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <StatusChip variant={automationTypeToVariant(store.automationType)} />
            <StatusChip
              variant={store.isActive ? 'active' : 'inactive'}
              label={store.isActive ? 'Active' : 'Inactive'}
            />
          </View>
          <RuleSummary storeId={store.id} />
        </View>
        <View className="flex-row items-center gap-3 ml-3">
          <Switch
            value={store.isActive}
            onValueChange={onToggleActive}
            trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
            thumbColor={store.isActive ? '#2563EB' : '#94A3B8'}
          />
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Edit store">
            <Ionicons name="create-outline" size={20} color="#94A3B8" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Store Form Sheet ──────────────────────────────────────────────────────────

const AUTOMATION_OPTIONS = [
  { label: 'Amazon', value: AutomationType.DirectAmazon },
  { label: 'Instacart', value: AutomationType.Instacart },
  { label: 'Target', value: AutomationType.DirectTarget },
] as const;

const DELIVERY_OPTIONS = [
  { label: 'Delivery', value: DeliveryPreference.Delivery },
  { label: 'Pickup', value: DeliveryPreference.Pickup },
] as const;

interface StoreFormSheetProps {
  visible: boolean;
  onClose: () => void;
  editingStore?: Store;
}

function StoreFormSheet({ visible, onClose, editingStore }: StoreFormSheetProps) {
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(StoreFormSchema),
    defaultValues: {
      name: editingStore?.name ?? '',
      automationType: editingStore?.automationType ?? AutomationType.DirectAmazon,
      instacartRetailerSlug: editingStore?.instacartRetailerSlug ?? '',
      deliveryPreference: editingStore?.deliveryPreference ?? DeliveryPreference.Delivery,
      isActive: editingStore?.isActive ?? true,
    },
  });

  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const selectedType = watch('automationType');

  function handleClose() {
    reset();
    setCredUsername('');
    setCredPassword('');
    onClose();
  }

  async function onSubmit(values: StoreFormValues) {
    try {
      let storeId: string;

      if (editingStore) {
        await updateStore.mutateAsync({
          id: editingStore.id,
          name: values.name,
          automationType: values.automationType,
          instacartRetailerSlug: values.instacartRetailerSlug ?? null,
          deliveryPreference: values.deliveryPreference,
          isActive: values.isActive,
        });
        storeId = editingStore.id;
      } else {
        const created = await createStore.mutateAsync({
          name: values.name,
          automationType: values.automationType,
          instacartRetailerSlug: values.instacartRetailerSlug ?? null,
          deliveryPreference: values.deliveryPreference,
          isActive: values.isActive,
        });
        storeId = created.id;
      }

      // Save credentials if provided — goes to SecureStore, never SQLite
      if (credUsername.trim() && credPassword.trim()) {
        await setStoreCredentials(storeId, credUsername.trim(), credPassword.trim());
      } else if (editingStore && (credUsername || credPassword)) {
        // Partial credential entry — warn user
        Alert.alert(
          'Credentials incomplete',
          'Both username and password are required to save credentials.'
        );
        return;
      }

      handleClose();
    } catch (err) {
      Alert.alert('Error', 'Could not save store. Please try again.');
    }
  }

  const isPending = createStore.isPending || updateStore.isPending;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingStore ? 'Edit Store' : 'Add Store'}
      snapHeight="full"
    >
      <View className="px-5 pt-4">
        {/* Name */}
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Store name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Costco, Whole Foods"
              error={errors.name?.message}
              required
            />
          )}
        />

        {/* Automation type */}
        <Controller
          control={control}
          name="automationType"
          render={({ field: { value, onChange } }) => (
            <SegmentedControl
              label="Automation type"
              options={AUTOMATION_OPTIONS}
              value={value}
              onChange={onChange}
            />
          )}
        />

        {/* Instacart slug (conditional) */}
        {selectedType === AutomationType.Instacart && (
          <Controller
            control={control}
            name="instacartRetailerSlug"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Instacart retailer slug"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. costco, trader-joes"
                error={errors.instacartRetailerSlug?.message}
                autoCapitalize="none"
                required
              />
            )}
          />
        )}

        {/* Delivery preference */}
        <Controller
          control={control}
          name="deliveryPreference"
          render={({ field: { value, onChange } }) => (
            <SegmentedControl
              label="Delivery preference"
              options={DELIVERY_OPTIONS}
              value={value}
              onChange={onChange}
            />
          )}
        />

        {/* Credentials section */}
        <View className="mb-4 p-4 bg-slate-50 rounded-xl border border-border">
          <View className="flex-row items-center mb-3">
            <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" />
            <Text className="ml-2 text-sm font-semibold text-slate-700">
              Store Credentials
            </Text>
          </View>
          <Text className="text-xs text-slate-500 mb-3">
            Stored securely in Android Keystore. Never written to the database.
            {editingStore ? ' Leave blank to keep existing credentials.' : ''}
          </Text>
          <FormField
            label="Username / Email"
            value={credUsername}
            onChangeText={setCredUsername}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="your@email.com"
          />
          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Password</Text>
            <View className="flex-row border border-border rounded-lg overflow-hidden bg-white">
              <View className="flex-1">
                <FormField
                  label=""
                  value={credPassword}
                  onChangeText={setCredPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  autoCapitalize="none"
                />
              </View>
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                className="px-3 items-center justify-center"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Active toggle */}
        <Controller
          control={control}
          name="isActive"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-sm font-medium text-slate-700">Active</Text>
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={value ? '#2563EB' : '#94A3B8'}
              />
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isPending}
          className="bg-primary rounded-xl py-3.5 items-center active:bg-primary-dark"
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {editingStore ? 'Save Changes' : 'Add Store'}
            </Text>
          )}
        </Pressable>

        {editingStore && (
          <Pressable
            onPress={() => {
              Alert.alert('Delete Store', `Delete "${editingStore.name}"? This cannot be undone.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteStoreCredentials(editingStore.id);
                    } catch { /* already gone */ }
                    handleClose();
                  },
                },
              ]);
            }}
            className="mt-3 py-3 items-center"
          >
            <Text className="text-danger text-sm font-medium">Delete Store</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function StoresScreen() {
  const { data: stores, isLoading } = useStores();
  const toggleActive = useToggleStoreActive();
  const deleteStore = useDeleteStore();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | undefined>();

  function handleEdit(store: Store) {
    setEditingStore(store);
    setSheetVisible(true);
  }

  function handleToggle(store: Store, isActive: boolean) {
    toggleActive.mutate({ id: store.id, isActive });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {!stores || stores.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title="No stores yet"
          subtitle="Tap + to configure your first store."
        />
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => s.id}
          renderItem={({ item: store }) => (
            <StoreCard
              store={store}
              onEdit={() => handleEdit(store)}
              onToggleActive={(active) => handleToggle(store, active)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        />
      )}

      <FAB
        onPress={() => {
          setEditingStore(undefined);
          setSheetVisible(true);
        }}
        accessibilityLabel="Add store"
      />

      <StoreFormSheet
        visible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          setEditingStore(undefined);
        }}
        editingStore={editingStore}
      />
    </View>
  );
}
