import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'stores',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'automation_type', type: 'string' },
        { name: 'instacart_retailer_slug', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'delivery_preference', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'items',
      columns: [
        { name: 'canonical_name', type: 'string' },
        { name: 'default_store_id', type: 'string', isIndexed: true },
        { name: 'default_brand', type: 'string', isOptional: true },
        { name: 'unit_type', type: 'string' },
        { name: 'reorder_qty', type: 'number' },
        { name: 'anchor_urls', type: 'string', isOptional: true },
        { name: 'estimated_price_cents', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'list_items',
      columns: [
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'store_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'added_at', type: 'number' },
        { name: 'voice_transcript', type: 'string', isOptional: true },
        { name: 'confidence_score', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'purchases',
      columns: [
        { name: 'store_id', type: 'string', isIndexed: true },
        { name: 'order_id', type: 'string', isOptional: true },
        { name: 'placed_at', type: 'number' },
        { name: 'total_amount_cents', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'items_json', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'purchase_items',
      columns: [
        { name: 'purchase_id', type: 'string', isIndexed: true },
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'product_title', type: 'string', isOptional: true },
        { name: 'product_url', type: 'string', isOptional: true },
        { name: 'price_cents', type: 'number', isOptional: true },
        { name: 'quantity', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'voice_logs',
      columns: [
        { name: 'transcript', type: 'string' },
        { name: 'parsed_json', type: 'string', isOptional: true },
        { name: 'item_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'was_corrected', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'purchase_rules',
      columns: [
        { name: 'store_id', type: 'string', isIndexed: true },
        { name: 'rule_type', type: 'string' },
        { name: 'trigger_item_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'min_order_value_cents', type: 'number', isOptional: true },
        { name: 'min_item_count', type: 'number', isOptional: true },
        { name: 'cron_expression', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'last_run_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'app_settings',
      columns: [
        { name: 'home_address_line1', type: 'string', isOptional: true },
        { name: 'home_address_line2', type: 'string', isOptional: true },
        { name: 'home_city', type: 'string', isOptional: true },
        { name: 'home_zip', type: 'string', isOptional: true },
        { name: 'confirmation_email', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});

export default schema;
