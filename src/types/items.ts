import { UnitType } from './enums';

export type CreateItemInput = {
  canonicalName: string;
  defaultStoreId: string;
  defaultBrand: string | null;
  unitType: UnitType;
  reorderQty: number;
  estimatedPriceCents: number | null;
  notes: string | null;
};

export type UpdateItemInput = Partial<CreateItemInput>;
