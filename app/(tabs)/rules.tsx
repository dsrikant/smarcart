import { useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  usePurchaseRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRuleActive,
  RuleWithRelations,
} from '@/hooks/usePurchaseRules';
import { useActiveStores } from '@/hooks/useStores';
import { useItems } from '@/hooks/useItems';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { BottomSheet } from '@/components/BottomSheet';
import { FormField } from '@/components/FormField';
import { StatusChip, ruleTypeToVariant } from '@/components/StatusChip';
import { RuleFormSchema, RuleFormValues } from '@/types/schemas';
import { RuleType } from '@/types/enums';
import Store from '@/db/models/Store';
import Item from '@/db/models/Item';
import PurchaseRule from '@/db/models/PurchaseRule';

// ─── Rule description helper ───────────────────────────────────────────────────

function ruleDescription(rule: PurchaseRule, triggerItem: Item | null): string {
  switch (rule.ruleType) {
    case RuleType.TriggerItem:
      return triggerItem
        ? `Purchase when "${triggerItem.canonicalName}" is added`
        : 'Purchase when trigger item is added';
    case RuleType.MinValue:
      return rule.minOrderValueCents != null
        ? `Purchase when cart ≥ $${(rule.minOrderValueCents / 100).toFixed(2)}`
        : 'Purchase at minimum cart value';
    case RuleType.ItemCount:
      return rule.minItemCount != null
        ? `Purchase when ${rule.minItemCount}+ items pending`
        : 'Purchase at minimum item count';
    case RuleType.Scheduled:
      return rule.cronExpression
        ? `Scheduled: ${rule.cronExpression}`
        : 'Scheduled purchase';
    default:
      return 'Unknown rule';
  }
}

// ─── Rule Card ─────────────────────────────────────────────────────────────────

interface RuleCardProps {
  entry: RuleWithRelations;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
}

function RuleCard({ entry, onEdit, onToggle }: RuleCardProps) {
  const { rule, triggerItem } = entry;

  return (
    <View
      className="bg-white mx-4 my-1.5 rounded-xl border border-border px-4 py-3.5"
      style={{ elevation: 1 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2 mb-1.5">
            <StatusChip variant={ruleTypeToVariant(rule.ruleType)} />
          </View>
          <Text className="text-sm text-slate-700">
            {ruleDescription(rule, triggerItem)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Switch
            value={rule.isActive}
            onValueChange={onToggle}
            trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
            thumbColor={rule.isActive ? '#2563EB' : '#94A3B8'}
          />
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Edit rule">
            <Text className="text-xs text-primary">Edit</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Rule Form Sheet ───────────────────────────────────────────────────────────

const RULE_TYPE_OPTIONS = [
  { label: 'Trigger Item', value: RuleType.TriggerItem },
  { label: 'Min Value', value: RuleType.MinValue },
  { label: 'Item Count', value: RuleType.ItemCount },
  { label: 'Scheduled', value: RuleType.Scheduled },
] as const;

const RULE_TYPE_DESCRIPTIONS: Record<RuleType, string> = {
  [RuleType.TriggerItem]: 'Automatically purchase when a specific item is added to the list.',
  [RuleType.MinValue]: 'Purchase when the estimated cart value meets a minimum threshold.',
  [RuleType.ItemCount]: 'Purchase when a minimum number of items are pending.',
  [RuleType.Scheduled]: 'Purchase on a schedule (WorkManager integration in Phase 3).',
};

interface RuleFormSheetProps {
  visible: boolean;
  onClose: () => void;
  editingRule?: RuleWithRelations;
  stores: Store[];
  items: Item[];
}

function RuleFormSheet({
  visible,
  onClose,
  editingRule,
  stores,
  items,
}: RuleFormSheetProps) {
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(RuleFormSchema),
    defaultValues: {
      storeId: editingRule?.rule.storeId ?? stores[0]?.id ?? '',
      ruleType: editingRule?.rule.ruleType ?? RuleType.TriggerItem,
      triggerItemId: editingRule?.rule.triggerItemId ?? undefined,
      minOrderValueDollars:
        editingRule?.rule.minOrderValueCents != null
          ? editingRule.rule.minOrderValueCents / 100
          : undefined,
      minItemCount: editingRule?.rule.minItemCount ?? undefined,
      cronExpression: editingRule?.rule.cronExpression ?? undefined,
      isActive: editingRule?.rule.isActive ?? true,
    },
  });

  const selectedRuleType = watch('ruleType');
  const [itemSearch, setItemSearch] = useState('');

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.canonicalName.toLowerCase().includes(q));
  }, [items, itemSearch]);

  function handleClose() {
    reset();
    setItemSearch('');
    onClose();
  }

  async function onSubmit(values: RuleFormValues) {
    const minOrderValueCents =
      values.minOrderValueDollars != null
        ? Math.round(values.minOrderValueDollars * 100)
        : null;

    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          id: editingRule.rule.id,
          storeId: values.storeId,
          ruleType: values.ruleType,
          triggerItemId: values.triggerItemId ?? null,
          minOrderValueCents,
          minItemCount: values.minItemCount ?? null,
          cronExpression: values.cronExpression ?? null,
          isActive: values.isActive,
        });
      } else {
        await createRule.mutateAsync({
          storeId: values.storeId,
          ruleType: values.ruleType,
          triggerItemId: values.triggerItemId ?? null,
          minOrderValueCents,
          minItemCount: values.minItemCount ?? null,
          cronExpression: values.cronExpression ?? null,
          isActive: values.isActive,
        });
      }
      handleClose();
    } catch {
      Alert.alert('Error', 'Could not save rule. Please try again.');
    }
  }

  function handleDelete() {
    if (!editingRule) return;
    Alert.alert('Delete Rule', 'Delete this rule? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRule.mutateAsync(editingRule.rule.id);
          handleClose();
        },
      },
    ]);
  }

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingRule ? 'Edit Rule' : 'Add Rule'}
      snapHeight="full"
    >
      <View className="px-5 pt-4">
        {/* Store picker */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Store <Text className="text-danger">*</Text>
        </Text>
        <Controller
          control={control}
          name="storeId"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {stores.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onChange(s.id)}
                  className={`px-3 py-2 rounded-lg border ${
                    value === s.id ? 'bg-primary border-primary' : 'bg-white border-border'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      value === s.id ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        {/* Rule type picker */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Rule type</Text>
        <Controller
          control={control}
          name="ruleType"
          render={({ field: { value, onChange } }) => (
            <View className="mb-2">
              <View className="flex-row flex-wrap gap-2 mb-2">
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    className={`px-3 py-2 rounded-lg border ${
                      value === opt.value
                        ? 'bg-primary border-primary'
                        : 'bg-white border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        value === opt.value ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-xs text-slate-500 mb-4">
                {RULE_TYPE_DESCRIPTIONS[value]}
              </Text>
            </View>
          )}
        />

        {/* Conditional fields */}
        {selectedRuleType === RuleType.TriggerItem && (
          <Controller
            control={control}
            name="triggerItemId"
            render={({ field: { value, onChange } }) => (
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-1.5">
                  Trigger item <Text className="text-danger">*</Text>
                </Text>
                <View className="border border-border rounded-lg overflow-hidden bg-white max-h-40">
                  {filteredItems.length === 0 ? (
                    <Text className="p-4 text-sm text-slate-400 text-center">
                      No items in catalog
                    </Text>
                  ) : (
                    filteredItems.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => onChange(item.id)}
                        className={`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between ${
                          value === item.id ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        <Text className="text-sm text-slate-800">{item.canonicalName}</Text>
                        {value === item.id && (
                          <View className="w-4 h-4 rounded-full bg-primary items-center justify-center">
                            <Text className="text-white text-xs">✓</Text>
                          </View>
                        )}
                      </Pressable>
                    ))
                  )}
                </View>
                {errors.triggerItemId && (
                  <Text className="mt-1 text-xs text-danger">
                    {errors.triggerItemId.message}
                  </Text>
                )}
              </View>
            )}
          />
        )}

        {selectedRuleType === RuleType.MinValue && (
          <Controller
            control={control}
            name="minOrderValueDollars"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Minimum cart value ($)"
                value={value != null ? String(value) : ''}
                onChangeText={(t) => onChange(parseFloat(t) || undefined)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                placeholder="e.g. 35.00"
                error={errors.minOrderValueDollars?.message}
                required
              />
            )}
          />
        )}

        {selectedRuleType === RuleType.ItemCount && (
          <Controller
            control={control}
            name="minItemCount"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Minimum item count"
                value={value != null ? String(value) : ''}
                onChangeText={(t) => onChange(parseInt(t, 10) || undefined)}
                onBlur={onBlur}
                keyboardType="number-pad"
                placeholder="e.g. 5"
                error={errors.minItemCount?.message}
                required
              />
            )}
          />
        )}

        {selectedRuleType === RuleType.Scheduled && (
          <View className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Text className="text-xs text-amber-700 font-medium mb-1">Phase 3 feature</Text>
            <Text className="text-xs text-amber-600">
              Scheduled rules use Android WorkManager, which will be wired in Phase 3.
              You can save the schedule expression now and it will be activated then.
            </Text>
            <Controller
              control={control}
              name="cronExpression"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  label="Cron expression"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. 0 9 * * 1 (Mon 9am)"
                  error={errors.cronExpression?.message}
                  autoCapitalize="none"
                />
              )}
            />
          </View>
        )}

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
              {editingRule ? 'Save Changes' : 'Add Rule'}
            </Text>
          )}
        </Pressable>

        {editingRule && (
          <Pressable onPress={handleDelete} className="mt-3 py-3 items-center">
            <Text className="text-danger text-sm font-medium">Delete Rule</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

interface RuleSection {
  store: Store;
  data: RuleWithRelations[];
}

export default function RulesScreen() {
  const { data: rulesWithRelations, isLoading } = usePurchaseRules();
  const { data: stores = [] } = useActiveStores();
  const { items } = useItems();
  const toggleRule = useToggleRuleActive();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleWithRelations | undefined>();

  const sections: RuleSection[] = useMemo(() => {
    if (!rulesWithRelations) return [];
    return stores
      .map((store) => ({
        store,
        data: rulesWithRelations.filter((r) => r.rule.storeId === store.id),
      }))
      .filter((s) => s.data.length > 0);
  }, [rulesWithRelations, stores]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {sections.length === 0 ? (
        <EmptyState
          icon="git-branch-outline"
          title="No purchase rules yet"
          subtitle="Tap + to define when SmartCart should auto-purchase for each store."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(entry) => entry.rule.id}
          renderSectionHeader={({ section }) => (
            <View className="px-4 py-2 bg-surface border-b border-border">
              <Text className="text-sm font-bold text-slate-700">{section.store.name}</Text>
            </View>
          )}
          renderItem={({ item: entry }) => (
            <RuleCard
              entry={entry}
              onEdit={() => {
                setEditingRule(entry);
                setSheetVisible(true);
              }}
              onToggle={(isActive) =>
                toggleRule.mutate({ id: entry.rule.id, isActive })
              }
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled
        />
      )}

      <FAB
        onPress={() => {
          setEditingRule(undefined);
          setSheetVisible(true);
        }}
        accessibilityLabel="Add rule"
      />

      <RuleFormSheet
        visible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          setEditingRule(undefined);
        }}
        editingRule={editingRule}
        stores={stores}
        items={items}
      />
    </View>
  );
}
