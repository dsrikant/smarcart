import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import database from '@/db';
import Item from '@/db/models/Item';
import queryClient from '@/lib/queryClient';
import { CreateItemInput, UpdateItemInput } from '@/types/items';

export const ITEMS_QUERY_KEY = 'items';

// ─── Reactive Hooks ───────────────────────────────────────────────────────────

export function useItems(): { items: Item[]; isLoading: boolean; error: Error | null } {
  const { data, isLoading, error } = useQuery({
    queryKey: [ITEMS_QUERY_KEY],
    queryFn: async () => {
      const all = await database.get<Item>('items').query().fetch();
      return [...all].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    },
  });
  return { items: data ?? [], isLoading, error: (error as Error | null) };
}

// Memoized in-memory filter — does NOT issue a new DB query per keystroke.
export function useItemSearch(query: string): { items: Item[]; isLoading: boolean } {
  const { items, isLoading } = useItems();
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.canonicalName.toLowerCase().includes(lower) ||
        (item.defaultBrand ?? '').toLowerCase().includes(lower)
    );
  }, [items, query]);
  return { items: filtered, isLoading };
}

export function useItem(id: string): { item: Item | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: [ITEMS_QUERY_KEY, id],
    queryFn: () => database.get<Item>('items').find(id),
    enabled: !!id,
  });
  return { item: data ?? null, isLoading };
}

// ─── Standalone Mutation Functions ────────────────────────────────────────────

export async function createItem(input: CreateItemInput): Promise<void> {
  await database.write(async () => {
    await database.get<Item>('items').create((record) => {
      record.canonicalName = input.canonicalName;
      record.defaultStoreId = input.defaultStoreId;
      record.defaultBrand = input.defaultBrand;
      record.unitType = input.unitType;
      record.reorderQty = input.reorderQty;
      record.anchorUrls = {};
      record.estimatedPriceCents = input.estimatedPriceCents;
      record.notes = input.notes;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.created_at = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.updated_at = Date.now();
    });
  });
  await queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<void> {
  const item = await database.get<Item>('items').find(id);
  await database.write(async () => {
    await item.update((record) => {
      if (input.canonicalName !== undefined) record.canonicalName = input.canonicalName;
      if (input.defaultStoreId !== undefined) record.defaultStoreId = input.defaultStoreId;
      if (Object.prototype.hasOwnProperty.call(input, 'defaultBrand')) {
        record.defaultBrand = input.defaultBrand ?? null;
      }
      if (input.unitType !== undefined) record.unitType = input.unitType;
      if (input.reorderQty !== undefined) record.reorderQty = input.reorderQty;
      if (Object.prototype.hasOwnProperty.call(input, 'estimatedPriceCents')) {
        record.estimatedPriceCents = input.estimatedPriceCents ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
        record.notes = input.notes ?? null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.updated_at = Date.now();
    });
  });
  await queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
  await queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, id] });
}

export async function deleteItem(id: string): Promise<void> {
  const item = await database.get<Item>('items').find(id);
  await database.write(async () => {
    await item.destroyPermanently();
  });
  await queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
}
