import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import Item from '@/db/models/Item';
import { UnitType } from '@/types/enums';

export const ITEMS_QUERY_KEY = 'items';

export function useItems(search?: string) {
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, search ?? ''],
    queryFn: async () => {
      const all = await database.get<Item>('items').query().fetch();
      if (!search || search.trim() === '') return all;
      const lower = search.toLowerCase();
      return all.filter(
        (item) =>
          item.canonicalName.toLowerCase().includes(lower) ||
          (item.defaultBrand ?? '').toLowerCase().includes(lower)
      );
    },
  });
}

export function useItem(itemId: string) {
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, itemId],
    queryFn: () => database.get<Item>('items').find(itemId),
    enabled: !!itemId,
  });
}

export interface CreateItemPayload {
  canonicalName: string;
  defaultStoreId: string;
  defaultBrand: string | null;
  unitType: UnitType;
  reorderQty: number;
  estimatedPriceCents: number | null;
  notes: string | null;
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateItemPayload): Promise<Item> => {
      let created!: Item;
      await database.write(async () => {
        created = await database.get<Item>('items').create((record) => {
          record.canonicalName = payload.canonicalName;
          record.defaultStoreId = payload.defaultStoreId;
          record.defaultBrand = payload.defaultBrand;
          record.unitType = payload.unitType;
          record.reorderQty = payload.reorderQty;
          record.anchorUrls = {};
          record.estimatedPriceCents = payload.estimatedPriceCents;
          record.notes = payload.notes;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.created_at = Date.now();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
    },
  });
}

export interface UpdateItemPayload {
  id: string;
  canonicalName: string;
  defaultStoreId: string;
  defaultBrand: string | null;
  unitType: UnitType;
  reorderQty: number;
  estimatedPriceCents: number | null;
  notes: string | null;
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateItemPayload): Promise<void> => {
      const item = await database.get<Item>('items').find(payload.id);
      await database.write(async () => {
        await item.update((record) => {
          record.canonicalName = payload.canonicalName;
          record.defaultStoreId = payload.defaultStoreId;
          record.defaultBrand = payload.defaultBrand;
          record.unitType = payload.unitType;
          record.reorderQty = payload.reorderQty;
          record.estimatedPriceCents = payload.estimatedPriceCents;
          record.notes = payload.notes;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, vars.id] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const item = await database.get<Item>('items').find(itemId);
      await database.write(async () => {
        await item.destroyPermanently();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
    },
  });
}

export function useItemsByStore(storeId: string) {
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, 'byStore', storeId],
    queryFn: () =>
      database
        .get<Item>('items')
        .query(Q.where('default_store_id', storeId))
        .fetch(),
    enabled: !!storeId,
  });
}
