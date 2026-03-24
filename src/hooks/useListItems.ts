import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import ListItem from '@/db/models/ListItem';
import Item from '@/db/models/Item';
import Store from '@/db/models/Store';
import { ListItemStatus } from '@/types/enums';

export const LIST_ITEMS_QUERY_KEY = 'listItems';

export interface ListItemWithRelations {
  listItem: ListItem;
  item: Item | null;
  store: Store | null;
}

export function useListItemsByStore(storeId: string) {
  return useQuery({
    queryKey: [LIST_ITEMS_QUERY_KEY, 'byStore', storeId],
    queryFn: () =>
      database
        .get<ListItem>('list_items')
        .query(Q.where('store_id', storeId))
        .fetch(),
    enabled: !!storeId,
  });
}

export function usePendingListItemsByStore(storeId: string) {
  return useQuery({
    queryKey: [LIST_ITEMS_QUERY_KEY, 'pending', storeId],
    queryFn: () =>
      database
        .get<ListItem>('list_items')
        .query(
          Q.where('store_id', storeId),
          Q.where('status', ListItemStatus.Pending)
        )
        .fetch(),
    enabled: !!storeId,
  });
}

/** Returns all pending list items grouped by store. */
export function useAllListItems() {
  return useQuery({
    queryKey: [LIST_ITEMS_QUERY_KEY, 'all'],
    queryFn: async () => {
      const listItems = await database
        .get<ListItem>('list_items')
        .query(Q.where('status', Q.oneOf([ListItemStatus.Pending, ListItemStatus.Purchasing])))
        .fetch();

      const results: ListItemWithRelations[] = await Promise.all(
        listItems.map(async (li) => {
          let item: Item | null = null;
          let store: Store | null = null;
          try {
            item = await database.get<Item>('items').find(li.itemId);
          } catch {
            // item deleted
          }
          try {
            store = await database.get<Store>('stores').find(li.storeId);
          } catch {
            // store deleted
          }
          return { listItem: li, item, store };
        })
      );
      return results;
    },
  });
}

export interface CreateListItemPayload {
  itemId: string;
  storeId: string;
  quantity: number;
}

export function useCreateListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateListItemPayload): Promise<ListItem> => {
      let created!: ListItem;
      await database.write(async () => {
        created = await database.get<ListItem>('list_items').create((record) => {
          record.itemId = payload.itemId;
          record.storeId = payload.storeId;
          record.status = ListItemStatus.Pending;
          record.quantity = payload.quantity;
          record.addedAt = new Date();
          record.voiceTranscript = null;
          record.confidenceScore = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
    },
  });
}

export interface UpdateListItemPayload {
  id: string;
  quantity?: number;
  status?: ListItemStatus;
}

export function useUpdateListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateListItemPayload): Promise<void> => {
      const li = await database.get<ListItem>('list_items').find(payload.id);
      await database.write(async () => {
        await li.update((record) => {
          if (payload.quantity !== undefined) record.quantity = payload.quantity;
          if (payload.status !== undefined) record.status = payload.status;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
    },
  });
}

export function useDeleteListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listItemId: string): Promise<void> => {
      const li = await database.get<ListItem>('list_items').find(listItemId);
      await database.write(async () => {
        await li.destroyPermanently();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST_ITEMS_QUERY_KEY] });
    },
  });
}
