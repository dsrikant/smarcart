import { z } from 'zod';
import { AutomationType, DeliveryPreference, RuleType, UnitType } from './enums';

// ─── Store ───────────────────────────────────────────────────────────────────

export const StoreFormSchema = z
  .object({
    name: z.string().min(1, 'Store name is required'),
    automationType: z.nativeEnum(AutomationType),
    instacartRetailerSlug: z.string().optional(),
    deliveryPreference: z.nativeEnum(DeliveryPreference),
    isActive: z.boolean(),
  })
  .refine(
    (data) =>
      data.automationType !== AutomationType.Instacart ||
      (data.instacartRetailerSlug !== undefined &&
        data.instacartRetailerSlug.length > 0),
    {
      message: 'Instacart retailer slug is required for Instacart stores',
      path: ['instacartRetailerSlug'],
    }
  );

export type StoreFormValues = z.infer<typeof StoreFormSchema>;

export const StoreCredentialsSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type StoreCredentialsValues = z.infer<typeof StoreCredentialsSchema>;

// ─── Item ─────────────────────────────────────────────────────────────────────

export const ItemFormSchema = z.object({
  canonicalName: z.string().min(1, 'Item name is required'),
  defaultStoreId: z.string().min(1, 'Default store is required'),
  defaultBrand: z.string().optional(),
  unitType: z.nativeEnum(UnitType),
  reorderQty: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
  estimatedPriceDollars: z.number().min(0).optional(),
});

export type ItemFormValues = z.infer<typeof ItemFormSchema>;

// ─── List Item ────────────────────────────────────────────────────────────────

export const ListItemFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  storeId: z.string().min(1, 'Store is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export type ListItemFormValues = z.infer<typeof ListItemFormSchema>;

// ─── Purchase Rule ────────────────────────────────────────────────────────────

export const RuleFormSchema = z
  .object({
    storeId: z.string().min(1, 'Store is required'),
    ruleType: z.nativeEnum(RuleType),
    triggerItemId: z.string().optional(),
    minOrderValueDollars: z.number().min(0).optional(),
    minItemCount: z.number().int().min(1).optional(),
    cronExpression: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.ruleType === RuleType.TriggerItem && !data.triggerItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Trigger item is required',
        path: ['triggerItemId'],
      });
    }
    if (
      data.ruleType === RuleType.MinValue &&
      data.minOrderValueDollars === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum order value is required',
        path: ['minOrderValueDollars'],
      });
    }
    if (
      data.ruleType === RuleType.ItemCount &&
      data.minItemCount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum item count is required',
        path: ['minItemCount'],
      });
    }
    if (data.ruleType === RuleType.Scheduled && !data.cronExpression) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Schedule expression is required',
        path: ['cronExpression'],
      });
    }
  });

export type RuleFormValues = z.infer<typeof RuleFormSchema>;

// ─── App Settings ─────────────────────────────────────────────────────────────

export const AppSettingsFormSchema = z.object({
  homeAddressLine1: z.string().optional(),
  homeAddressLine2: z.string().optional(),
  homeCity: z.string().optional(),
  homeZip: z.string().optional(),
  confirmationEmail: z
    .string()
    .email('Must be a valid email')
    .optional()
    .or(z.literal('')),
});

export type AppSettingsFormValues = z.infer<typeof AppSettingsFormSchema>;

export const HomeAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  zip: z.string().min(1),
});
