export enum AutomationType {
  DirectAmazon = 'direct_amazon',
  Instacart = 'instacart',
  DirectTarget = 'direct_target',
}

export enum DeliveryPreference {
  Delivery = 'delivery',
  Pickup = 'pickup',
}

export enum UnitType {
  Unit = 'unit',
  Lb = 'lb',
  Oz = 'oz',
  Bag = 'bag',
  Box = 'box',
  Pack = 'pack',
  Bunch = 'bunch',
  Bottle = 'bottle',
}

export enum ListItemStatus {
  Pending = 'pending',
  Purchasing = 'purchasing',
  Purchased = 'purchased',
  Failed = 'failed',
}

export enum PurchaseStatus {
  Pending = 'pending',
  Placed = 'placed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum RuleType {
  TriggerItem = 'trigger_item',
  MinValue = 'min_value',
  ItemCount = 'item_count',
  Scheduled = 'scheduled',
}
