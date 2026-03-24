import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import Purchase from '@/db/models/Purchase';
import PurchaseItem from '@/db/models/PurchaseItem';
import Store from '@/db/models/Store';

export const PURCHASES_QUERY_KEY = 'purchases';

export interface PurchaseWithStore {
  purchase: Purchase;
  store: Store | null;
}

export function usePurchases() {
  return useQuery({
    queryKey: [PURCHASES_QUERY_KEY],
    queryFn: async () => {
      const purchases = await database
        .get<Purchase>('purchases')
        .query(Q.sortBy('placed_at', Q.desc))
        .fetch();

      const results: PurchaseWithStore[] = await Promise.all(
        purchases.map(async (p) => {
          let store: Store | null = null;
          try {
            store = await database.get<Store>('stores').find(p.storeId);
          } catch {
            // store deleted
          }
          return { purchase: p, store };
        })
      );
      return results;
    },
  });
}

export function usePurchaseItems(purchaseId: string) {
  return useQuery({
    queryKey: [PURCHASES_QUERY_KEY, purchaseId, 'items'],
    queryFn: () =>
      database
        .get<PurchaseItem>('purchase_items')
        .query(Q.where('purchase_id', purchaseId))
        .fetch(),
    enabled: !!purchaseId,
  });
}
