export type Role = 'OWNER' | 'MANAGER' | 'CASHIER'

/** Authenticated session user, mirrors `AuthenticatedUser` on the server. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  restaurantId: string
}

/** Body of `POST /auth/login` and `GET /auth/me`. */
export interface SessionResponse {
  user: AuthUser
  authMethod: 'password' | 'pin'
  expiresAt: string
}

/** Minimal staff card from `GET /auth/staff`. */
export interface StaffUser {
  id: string
  name: string
  role: Role
}

/** Result of `POST /devices`. */
export interface DeviceResponse {
  id: string
  name: string
}

/** `GET /menu` category with its items. */
export interface ServerMenuCategory {
  id: string
  name: string
  sortOrder: number
  items: ServerMenuItem[]
}

export interface ServerMenuItem {
  id: string
  legacyId: string | null
  name: string
  description: string | null
  price: number
  imageKey: string | null
  imageUrl: string | null
  available: boolean
  popular: boolean
  sortOrder: number
}

/** `GET /menu/categories` row without items. */
export interface ServerMenuCategorySummary {
  id: string
  name: string
  sortOrder: number
}

/** `GET /tables` row. */
export interface ServerTable {
  id: string
  legacyId: string | null
  name: string
  seats: number
  zone: string | null
  sortOrder: number
}

export interface ServerOrderItem {
  menuItemId: string | null
  name: string
  unitPrice: number
  qty: number
  note: string | null
}

export interface ServerPayment {
  method: 'CASH' | 'TRANSFER' | 'CARD'
  amount: number
  received: number | null
  change: number | null
  status: string
}

/** `OrderResponse` returned by the orders endpoints. */
export interface ServerOrder {
  id: string
  code: string
  status: string
  clientId: string | null
  tableId: string | null
  tableName: string
  items: ServerOrderItem[]
  subtotal: number
  discountType: 'AMOUNT' | 'PERCENT' | null
  discountValue: number | null
  discountAmount: number
  tax: number
  total: number
  payment: ServerPayment | null
  note: string | null
  cashierName: string
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
}
