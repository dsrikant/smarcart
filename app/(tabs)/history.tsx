import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePurchases, usePurchaseItems, PurchaseWithStore } from '@/hooks/usePurchases';
import { EmptyState } from '@/components/EmptyState';
import { StatusChip, purchaseStatusToVariant } from '@/components/StatusChip';
import { PurchaseStatus } from '@/types/enums';
import type { PurchaseItemSnapshot } from '@/db/models/Purchase';

// ─── Line items (expanded) ─────────────────────────────────────────────────────

function PurchaseLineItems({ purchaseId }: { purchaseId: string }) {
  const { data: lineItems, isLoading } = usePurchaseItems(purchaseId);

  if (isLoading) {
    return (
      <View className="px-4 pb-3">
        <ActivityIndicator size="small" color="#94A3B8" />
      </View>
    );
  }

  if (!lineItems || lineItems.length === 0) {
    return (
      <View className="px-4 pb-3">
        <Text className="text-xs text-slate-400 italic">No line items recorded.</Text>
      </View>
    );
  }

  return (
    <View className="px-4 pb-3 border-t border-slate-100 mt-2 pt-2">
      {lineItems.map((li, idx) => (
        <View
          key={li.id}
          className={`flex-row items-center justify-between py-1.5 ${
            idx < lineItems.length - 1 ? 'border-b border-slate-50' : ''
          }`}
        >
          <View className="flex-1">
            <Text className="text-xs font-medium text-slate-700">
              {li.productTitle ?? `Item ${idx + 1}`}
            </Text>
            {li.brand ? (
              <Text className="text-xs text-slate-400">{li.brand}</Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-xs text-slate-600">×{li.quantity}</Text>
            {li.priceCents != null && (
              <Text className="text-xs text-slate-500">
                ${(li.priceCents / 100).toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Purchase Row ──────────────────────────────────────────────────────────────

function formatDate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function itemCountFromJson(itemsJson: PurchaseItemSnapshot[]): number {
  return Array.isArray(itemsJson) ? itemsJson.length : 0;
}

interface PurchaseRowProps {
  entry: PurchaseWithStore;
}

function PurchaseRow({ entry }: PurchaseRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { purchase, store } = entry;

  const itemCount = itemCountFromJson(purchase.itemsJson);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className="bg-white mx-4 my-1.5 rounded-xl border border-border overflow-hidden active:bg-slate-50"
      style={{ elevation: 1 }}
    >
      {/* Summary row */}
      <View className="flex-row items-center px-4 py-3.5">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-800">
            {store?.name ?? 'Unknown store'}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {formatDate(purchase.placedAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>
          {purchase.orderId && (
            <Text className="text-xs text-slate-400 mt-0.5">
              Order #{purchase.orderId}
            </Text>
          )}
        </View>
        <View className="items-end gap-1.5">
          <StatusChip variant={purchaseStatusToVariant(purchase.status)} />
          {purchase.totalAmountCents != null && (
            <Text className="text-sm font-semibold text-slate-800">
              ${(purchase.totalAmountCents / 100).toFixed(2)}
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#CBD5E1"
          style={{ marginLeft: 8 }}
        />
      </View>

      {/* Expanded line items */}
      {expanded && <PurchaseLineItems purchaseId={purchase.id} />}
    </Pressable>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { data: purchases, isLoading } = usePurchases();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!purchases || purchases.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        <EmptyState
          icon="receipt-outline"
          title="No purchase history yet"
          subtitle="Completed purchases will appear here once automation is active."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={purchases}
        keyExtractor={(e) => e.purchase.id}
        renderItem={({ item: entry }) => <PurchaseRow entry={entry} />}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
      />
    </View>
  );
}
