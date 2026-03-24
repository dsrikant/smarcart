import { View, Text } from 'react-native';
import { ListItemStatus, PurchaseStatus, AutomationType, RuleType } from '@/types/enums';

type ChipVariant = 'pending' | 'placed' | 'purchasing' | 'purchased' | 'failed' | 'cancelled' |
  'amazon' | 'instacart' | 'target' |
  'trigger' | 'min_value' | 'item_count' | 'scheduled' |
  'active' | 'inactive';

const CHIP_STYLES: Record<ChipVariant, { bg: string; text: string; label: string }> = {
  pending:    { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Pending' },
  placed:     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Placed' },
  purchasing: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Purchasing' },
  purchased:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Purchased' },
  failed:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  cancelled:  { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelled' },
  amazon:     { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Amazon' },
  instacart:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Instacart' },
  target:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Target' },
  trigger:    { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Trigger Item' },
  min_value:  { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Min Value' },
  item_count: { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Item Count' },
  scheduled:  { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Scheduled' },
  active:     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Active' },
  inactive:   { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Inactive' },
};

function listItemStatusToVariant(s: ListItemStatus): ChipVariant {
  return s as ChipVariant;
}

function purchaseStatusToVariant(s: PurchaseStatus): ChipVariant {
  const map: Record<PurchaseStatus, ChipVariant> = {
    [PurchaseStatus.Pending]:   'pending',
    [PurchaseStatus.Placed]:    'placed',
    [PurchaseStatus.Failed]:    'failed',
    [PurchaseStatus.Cancelled]: 'cancelled',
  };
  return map[s] ?? 'pending';
}

function automationTypeToVariant(t: AutomationType): ChipVariant {
  if (t === AutomationType.DirectAmazon) return 'amazon';
  if (t === AutomationType.Instacart) return 'instacart';
  return 'target';
}

function ruleTypeToVariant(t: RuleType): ChipVariant {
  if (t === RuleType.TriggerItem) return 'trigger';
  if (t === RuleType.MinValue) return 'min_value';
  if (t === RuleType.ItemCount) return 'item_count';
  return 'scheduled';
}

interface Props {
  variant: ChipVariant;
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusChip({ variant, label, size = 'sm' }: Props) {
  const style = CHIP_STYLES[variant];
  const displayLabel = label ?? style.label;
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className={`rounded-full ${style.bg} ${padding} self-start`}>
      <Text className={`${style.text} ${fontSize} font-medium`}>{displayLabel}</Text>
    </View>
  );
}

export {
  listItemStatusToVariant,
  purchaseStatusToVariant,
  automationTypeToVariant,
  ruleTypeToVariant,
};
export type { ChipVariant };
