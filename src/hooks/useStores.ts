import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import Store from '@/db/models/Store';
import { AutomationType, DeliveryPreference } from '@/types/enums';

export const STORES_QUERY_KEY = 'stores';

export function useStores() {
  return useQuery({
    queryKey: [STORES_QUERY_KEY],
    queryFn: () => database.get<Store>('stores').query().fetch(),
  });
}

export function useActiveStores() {
  return useQuery({
    queryKey: [STORES_QUERY_KEY, 'active'],
    queryFn: () =>
      database
        .get<Store>('stores')
        .query(Q.where('is_active', true))
        .fetch(),
  });
}

export interface CreateStorePayload {
  name: string;
  automationType: AutomationType;
  instacartRetailerSlug: string | null;
  deliveryPreference: DeliveryPreference;
  isActive: boolean;
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateStorePayload): Promise<Store> => {
      let created!: Store;
      await database.write(async () => {
        created = await database.get<Store>('stores').create((record) => {
          record.name = payload.name;
          record.automationType = payload.automationType;
          record.instacartRetailerSlug = payload.instacartRetailerSlug;
          record.deliveryPreference = payload.deliveryPreference;
          record.isActive = payload.isActive;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.created_at = Date.now();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STORES_QUERY_KEY] });
    },
  });
}

export interface UpdateStorePayload {
  id: string;
  name: string;
  automationType: AutomationType;
  instacartRetailerSlug: string | null;
  deliveryPreference: DeliveryPreference;
  isActive: boolean;
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateStorePayload): Promise<void> => {
      const store = await database.get<Store>('stores').find(payload.id);
      await database.write(async () => {
        await store.update((record) => {
          record.name = payload.name;
          record.automationType = payload.automationType;
          record.instacartRetailerSlug = payload.instacartRetailerSlug;
          record.deliveryPreference = payload.deliveryPreference;
          record.isActive = payload.isActive;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STORES_QUERY_KEY] });
    },
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storeId: string): Promise<void> => {
      const store = await database.get<Store>('stores').find(storeId);
      await database.write(async () => {
        await store.destroyPermanently();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STORES_QUERY_KEY] });
    },
  });
}

export function useToggleStoreActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }): Promise<void> => {
      const store = await database.get<Store>('stores').find(id);
      await database.write(async () => {
        await store.update((record) => {
          record.isActive = isActive;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STORES_QUERY_KEY] });
    },
  });
}
