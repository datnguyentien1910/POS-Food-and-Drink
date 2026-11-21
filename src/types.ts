export type CategoryId = 'drinks' | 'starters' | 'mains' | 'desserts'

export type CategoryTabId = CategoryId | 'all' | 'popular'

export interface Category {
  id: CategoryTabId
  label: string
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  category: CategoryId
  image: string
  popular?: boolean
  /** Server UUID used when sending orders; falls back to `id` when unknown. */
  serverId?: string
  /** Asset key from the catalog response, used to resolve the image. */
  imageKey?: string | null
  /** `false` disables ordering the item. */
  available?: boolean
}

export interface TableOption {
  id: string
  name: string
  seats: number
  /** Server UUID used when sending orders. */
  serverId?: string
  zone?: string | null
}

export interface CartLine {
  lineId: string
  menuItemId: string
  qty: number
  /** Price snapshot captured when the line was added. */
  unitPrice?: number
  /** Display name snapshot captured when the line was added. */
  name?: string
}

export interface Discount {
  type: 'amount' | 'percent'
  value: number
}

export interface Draft {
  id: string
  tableId: string | null
  items: CartLine[]
  discount: Discount
  note: string
  createdAt: number
}

export type PaymentMethod = 'cash' | 'transfer' | 'card'

export interface OrderLineSnapshot {
  menuItemId: string
  name: string
  unitPrice: number
  qty: number
}

export interface OrderRecord {
  id: string
  code: string
  tableId: string | null
  tableName: string
  items: OrderLineSnapshot[]
  subtotal: number
  discountAmount: number
  tax: number
  total: number
  method: PaymentMethod
  received?: number
  change?: number
  note: string
  createdAt: number
  cashier: string
  /** Integration bookkeeping; absent on legacy orders created before sync. */
  clientId?: string
  serverId?: string
  syncState?: SyncState
  provisionalCode?: boolean
  cashierId?: string
  voided?: boolean
  voidReason?: string
}

export interface Totals {
  subtotal: number
  discountAmount: number
  tax: number
  total: number
}

export type SortOption = 'default' | 'price-asc' | 'price-desc'

/** Lifecycle of an order on the device, from local draft to server truth. */
export type SyncState =
  | 'pending'
  | 'inflight'
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'voided'
  | 'legacy'

export type SyncItemKind = 'CREATE_ORDER' | 'VOID_ORDER'

/** Server-facing value objects shared by the order service and sync worker. */
export type ServerPaymentMethod = 'CASH' | 'TRANSFER' | 'CARD'
export type ServerDiscountType = 'AMOUNT' | 'PERCENT'

export interface CreateOrderPayload {
  clientId: string
  tableId?: string
  items: { menuItemId: string; qty: number; note?: string }[]
  discount?: { type: ServerDiscountType; value: number }
  note?: string
  payment: { method: ServerPaymentMethod; received?: number }
  expectedTotal?: number
}

export interface SyncError {
  code: string
  message: string
  status?: number
}

export interface SyncItem {
  /** Equal to the order `clientId` for `CREATE_ORDER`, to the server id for voids. */
  id: string
  kind: SyncItemKind
  state: SyncState
  payload: CreateOrderPayload | { orderId: string; reason: string }
  /** Generated once and kept across retries. */
  idempotencyKey: string
  expectedTotal?: number
  attempts: number
  /** Epoch ms before which the item must not be retried. */
  nextAttemptAt: number
  lastError?: SyncError
  createdAt: number
}

/** Local order enriched with sync bookkeeping. */
export interface LocalOrder extends OrderRecord {
  clientId: string
  syncState: SyncState
  /** `true` while `code` is the temporary `OFF-…` code. */
  provisionalCode: boolean
  cashierId: string
  serverId?: string
}

/** Persisted store shape after the v2 migration. */
export interface OrderDraftInput {
  tableId: string | null
  lines: CartLine[]
  discount: Discount
  note: string
  method: PaymentMethod
  received?: number
  change?: number
}
