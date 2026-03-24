import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import ListItem from '@/db/models/ListItem';
import Item from '@/db/models/Item';
import Store from '@/db/models/Store';
import { ListItemStatus } from '@/types/enums';
import type { ListItemSection, CreateListItemInput } from '@/types/listItems';

export { ListItemStatus };
export type { ListItemSection, CreateListItemInput };

export const LIST_ITEMS_QUERY_KEY = 'listItems';

// ─── Legacy exports (backward compat) ─────────────────────────────────────────

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

/** @deprecated Use useListItems() instead. */
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

// ─── Pure helpers (exported for testing) ───────────────────────────────────────

export function groupAndSortSections(
  enriched: Array<{ listItem: ListItem; item: Item | null; store: Store | null }>
): ListItemSection[] {
  const storeMap = new Map<string, { store: Store; rows: Array<{ listItem: ListItem; item: Item }> }>();

  for (const e of enriched) {
    if (!e.store || !e.item) continue;
    if (!storeMap.has(e.store.id)) {
      storeMap.set(e.store.id, { store: e.store, rows: [] });
    }
    storeMap.get(e.store.id)!.rows.push({ listItem: e.listItem, item: e.item });
  }

  const sections: ListItemSection[] = [];
  for (const { store, rows } of storeMap.values()) {
    rows.sort((a, b) => {
      const aTime = a.listItem.addedAt instanceof Date
        ? a.listItem.addedAt.getTime()
        : Number(a.listItem.addedAt);
      const bTime = b.listItem.addedAt instanceof Date
        ? b.listItem.addedAt.getTime()
        : Number(b.listItem.addedAt);
      return bTime - aTime;
    });
    sections.push({ store, data: rows });
  }

  sections.sort((a, b) => {
    const aHasPending = a.data.some((r) => r.listItem.status === ListItemStatus.Pending);
    const bHasPending = b.data.some((r) => r.listItem.status === ListItemStatus.Pending);
    if (aHasPending !== bHasPending) return aHasPending ? -1 : 1;
    return a.store.name.localeCompare(b.store.name);
  });

  return sections;
}

// ─── Spec-compliant hooks ──────────────────────────────────────────────────────

export function useListItems(): {
  sections: ListItemSection[];
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: [LIST_ITEMS_QUERY_KEY, 'sections'],
    queryFn: async (): Promise<ListItemSection[]> => {
      const listItems = await database
        .get<ListItem>('list_items')
        .query(Q.where('status', Q.notEq(ListItemStatus.Purchased)))
        .fetch();

      const enriched = await Promise.all(
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

      return groupAndSortSections(enriched);
    },
  });

  const sections = data ?? [];
  const totalCount = sections.reduce(
    (sum, s) => sum + s.data.filter((r) => r.listItem.status === ListItemStatus.Pending).length,
    0
  );

  return { sections, totalCount, isLoading, error: (error as Error | null) ?? null };
}

export function useStoreListItems(storeId: string): {
  listItems: ListItem[];
  pendingCount: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: [LIST_ITEMS_QUERY_KEY, 'store', storeId],
    queryFn: () =>
      database
        .get<ListItem>('list_items')
        .query(Q.where('store_id', storeId))
        .fetch(),
    enabled: !!storeId,
  });

  const listItems = data ?? [];
  const pendingCount = listItems.filter((li) => li.status === ListItemStatus.Pending).length;

  return { listItems, pendingCount, isLoading };
}

// ─── Spec-compliant standalone mutations ───────────────────────────────────────

export async function createListItem(input: CreateListItemInput): Promise<void> {
  await database.write(async () => {
    await database.get<ListItem>('list_items').create((record) => {
      record.itemId = input.itemId;
      record.storeId = input.storeId;
      record.status = ListItemStatus.Pending;
      record.quantity = input.quantity;
      record.addedAt = new Date();
      record.voiceTranscript = input.voiceTranscript ?? null;
      record.confidenceScore = input.confidenceScore ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.updated_at = Date.now();
    });
  });
}

export async function updateListItemQuantity(id: string, quantity: number): Promise<void> {
  const li = await database.get<ListItem>('list_items').find(id);
  await database.write(async () => {
    await li.update((record) => {
      record.quantity = quantity;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.updated_at = Date.now();
    });
  });
}

export async function deleteListItem(id: string): Promise<void> {
  const li = await database.get<ListItem>('list_items').find(id);
  await database.write(async () => {
    await li.destroyPermanently();
  });
}

export async function updateListItemStatus(id: string, status: ListItemStatus): Promise<void> {
  const li = await database.get<ListItem>('list_items').find(id);
  await database.write(async () => {
    await li.update((record) => {
      record.status = status;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record as any)._raw.updated_at = Date.now();
    });
  });
}
