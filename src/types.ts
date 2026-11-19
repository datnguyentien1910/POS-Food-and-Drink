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
}

export interface TableOption {
  id: string
  name: string
  seats: number
}

export interface CartLine {
  lineId: string
  menuItemId: string
  qty: number
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
}

export interface Totals {
  subtotal: number
  discountAmount: number
  tax: number
  total: number
}

export type SortOption = 'default' | 'price-asc' | 'price-desc'
