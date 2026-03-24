import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import migrations from './migrations';

import Store from './models/Store';
import Item from './models/Item';
import ListItem from './models/ListItem';
import Purchase from './models/Purchase';
import PurchaseItem from './models/PurchaseItem';
import VoiceLog from './models/VoiceLog';
import PurchaseRule from './models/PurchaseRule';
import AppSettings from './models/AppSettings';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    // In production this should crash-report and prompt the user to reinstall.
    // In Phase 1, re-throw so it surfaces during development.
    throw error;
  },
});

const database = new Database({
  adapter,
  modelClasses: [
    Store,
    Item,
    ListItem,
    Purchase,
    PurchaseItem,
    VoiceLog,
    PurchaseRule,
    AppSettings,
  ],
});

export default database;
export {
  Store,
  Item,
  ListItem,
  Purchase,
  PurchaseItem,
  VoiceLog,
  PurchaseRule,
  AppSettings,
};
