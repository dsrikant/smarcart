import {
  AutomationType,
  DeliveryPreference,
  ListItemStatus,
  PurchaseStatus,
  RuleType,
  UnitType,
} from './enums';

export interface StoreRecord {
  id: string;
  name: string;
  automationType: AutomationType;
  instacartRetailerSlug: string | null;
  isActive: boolean;
  deliveryPreference: DeliveryPreference;
  createdAt: number;
  updatedAt: number;
}

export interface ItemRecord {
  id: string;
  canonicalName: string;
  defaultStoreId: string;
  defaultBrand: string | null;
  unitType: UnitType;
  reorderQty: number;
  anchorUrls: Record<string, string>; // { store_id: product_url }
  estimatedPriceCents: number | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ListItemRecord {
  id: string;
  itemId: string;
  storeId: string;
  status: ListItemStatus;
  quantity: number;
  addedAt: number;
  voiceTranscript: string | null;
  confidenceScore: number | null;
  updatedAt: number;
}

export interface PurchaseRecord {
  id: string;
  storeId: string;
  orderId: string | null;
  placedAt: number;
  totalAmountCents: number | null;
  status: PurchaseStatus;
  itemsJson: string; // JSON snapshot
  createdAt: number;
}

export interface PurchaseItemRecord {
  id: string;
  purchaseId: string;
  itemId: string;
  brand: string | null;
  productTitle: string | null;
  productUrl: string | null;
  priceCents: number | null;
  quantity: number;
}

export interface VoiceLogRecord {
  id: string;
  transcript: string;
  parsedJson: string | null;
  itemId: string | null;
  wasCorrected: boolean;
  createdAt: number;
}

export interface PurchaseRuleRecord {
  id: string;
  storeId: string;
  ruleType: RuleType;
  triggerItemId: string | null;
  minOrderValueCents: number | null;
  minItemCount: number | null;
  cronExpression: string | null;
  isActive: boolean;
  lastRunAt: number | null;
  createdAt: number;
}

export interface AppSettingsRecord {
  id: 'singleton';
  homeAddressLine1: string | null;
  homeAddressLine2: string | null;
  homeCity: string | null;
  homeZip: string | null;
  confirmationEmail: string | null;
  biometricLockEnabled: boolean;
  updatedAt: number;
}

export interface HomeAddress {
  line1: string;
  line2: string | null;
  city: string;
  zip: string;
}
