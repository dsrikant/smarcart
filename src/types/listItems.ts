import type Store from '../db/models/Store';
import type Item from '../db/models/Item';
import type ListItem from '../db/models/ListItem';
import type { ListItemStatus } from './enums';

export type { ListItemStatus };

export type ListItemSection = {
  store: Store;
  data: Array<{ listItem: ListItem; item: Item }>;
};

export type CreateListItemInput = {
  itemId: string;
  storeId: string;
  quantity: number;
  voiceTranscript?: string;
  confidenceScore?: number;
};
