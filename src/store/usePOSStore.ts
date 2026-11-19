import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { RESTAURANT } from '../config'
import { getMenuItem } from '../data/menu'
import { tableName } from '../data/tables'
import { calcTotals } from '../lib/calc'
import { makeId, makeLineId, nextOrderCode } from '../lib/id'
import type {
  CartLine,
  Discount,
  Draft,
  OrderLineSnapshot,
  OrderRecord,
  PaymentMethod,
} from '../types'

const STORAGE_KEY = 'restodash-pos-v1'
const EMPTY_DISCOUNT: Discount = { type: 'amount', value: 0 }

interface PersistedPOS {
  cart: CartLine[]
  tableId: string | null
  discount: Discount
  note: string
  drafts: Draft[]
  history: OrderRecord[]
}

interface POSState extends PersistedPOS {
  storageError: boolean
  addItem: (menuItemId: string) => void
  increment: (lineId: string) => void
  decrement: (lineId: string) => void
  removeItem: (lineId: string) => void
  clearCart: () => void
  setTable: (tableId: string | null) => void
  setDiscount: (discount: Discount) => void
  setNote: (note: string) => void
  saveDraft: () => void
  loadDraft: (draftId: string) => void
  deleteDraft: (draftId: string) => void
  completeOrder: (input: {
    method: PaymentMethod
    received?: number
    change?: number
  }) => OrderRecord | null
}

const emptyOrder = (): Omit<PersistedPOS, 'drafts' | 'history'> => ({
  cart: [],
  tableId: null,
  discount: { ...EMPTY_DISCOUNT },
  note: '',
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isCartLine = (value: unknown): value is CartLine =>
  isRecord(value) &&
  typeof value.lineId === 'string' &&
  typeof value.menuItemId === 'string' &&
  isFiniteNumber(value.qty) &&
  value.qty > 0

const isDiscount = (value: unknown): value is Discount =>
  isRecord(value) &&
  (value.type === 'amount' || value.type === 'percent') &&
  isFiniteNumber(value.value) &&
  value.value >= 0

const isDraft = (value: unknown): value is Draft =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (value.tableId === null || typeof value.tableId === 'string') &&
  Array.isArray(value.items) &&
  value.items.every(isCartLine) &&
  isDiscount(value.discount) &&
  typeof value.note === 'string' &&
  isFiniteNumber(value.createdAt)

const isOrderLine = (value: unknown): value is OrderLineSnapshot =>
  isRecord(value) &&
  typeof value.menuItemId === 'string' &&
  typeof value.name === 'string' &&
  isFiniteNumber(value.unitPrice) &&
  isFiniteNumber(value.qty) &&
  value.qty > 0

const isOrder = (value: unknown): value is OrderRecord =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.code === 'string' &&
  (value.tableId === null || typeof value.tableId === 'string') &&
  typeof value.tableName === 'string' &&
  Array.isArray(value.items) &&
  value.items.every(isOrderLine) &&
  isFiniteNumber(value.subtotal) &&
  isFiniteNumber(value.discountAmount) &&
  isFiniteNumber(value.tax) &&
  isFiniteNumber(value.total) &&
  (value.method === 'cash' ||
    value.method === 'transfer' ||
    value.method === 'card') &&
  (value.received === undefined || isFiniteNumber(value.received)) &&
  (value.change === undefined || isFiniteNumber(value.change)) &&
  typeof value.note === 'string' &&
  isFiniteNumber(value.createdAt) &&
  typeof value.cashier === 'string'

const isPersistedPOS = (value: unknown): value is PersistedPOS =>
  isRecord(value) &&
  Array.isArray(value.cart) &&
  value.cart.every(isCartLine) &&
  (value.tableId === null || typeof value.tableId === 'string') &&
  isDiscount(value.discount) &&
  typeof value.note === 'string' &&
  Array.isArray(value.drafts) &&
  value.drafts.every(isDraft) &&
  Array.isArray(value.history) &&
  value.history.every(isOrder)

let reportStorageFailure: ((failed: boolean) => void) | null = null

const safeStorage: PersistStorage<PersistedPOS> = {
  getItem: (name) => {
    try {
      const raw = globalThis.localStorage?.getItem(name)
      if (!raw) return null

      const parsed = JSON.parse(raw) as unknown

      if (
        !isRecord(parsed) ||
        parsed.version !== 1 ||
        !isPersistedPOS(parsed.state)
      ) {
        return null
      }

      return {
        state: parsed.state,
        version: parsed.version,
      }
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, JSON.stringify(value))
      reportStorageFailure?.(false)
    } catch {
      // The app keeps working in memory, but the UI must warn that a reload loses data.
      reportStorageFailure?.(true)
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name)
    } catch {
      // Ignore storage failures.
    }
  },
}

export const usePOSStore = create<POSState>()(
  persist<POSState, [], [], PersistedPOS>(
    (set, get) => ({
      ...emptyOrder(),
      drafts: [],
      history: [],
      storageError: false,

      addItem: (menuItemId) => {
        if (!getMenuItem(menuItemId)) return

        set((state) => {
          const existing = state.cart.find(
            (line) => line.menuItemId === menuItemId,
          )

          if (existing) {
            return {
              cart: state.cart.map((line) =>
                line.lineId === existing.lineId
                  ? { ...line, qty: line.qty + 1 }
                  : line,
              ),
            }
          }

          return {
            cart: [
              ...state.cart,
              { lineId: makeLineId(), menuItemId, qty: 1 },
            ],
          }
        })
      },

      increment: (lineId) => {
        set((state) => ({
          cart: state.cart.map((line) =>
            line.lineId === lineId ? { ...line, qty: line.qty + 1 } : line,
          ),
        }))
      },

      decrement: (lineId) => {
        set((state) => ({
          cart: state.cart.flatMap((line) => {
            if (line.lineId !== lineId) return [line]
            if (line.qty <= 1) return []
            return [{ ...line, qty: line.qty - 1 }]
          }),
        }))
      },

      removeItem: (lineId) => {
        set((state) => ({
          cart: state.cart.filter((line) => line.lineId !== lineId),
        }))
      },

      clearCart: () => set({ cart: [] }),

      setTable: (tableId) => set({ tableId }),

      setDiscount: (discount) => set({ discount }),

      setNote: (note) => set({ note }),

      saveDraft: () => {
        const state = get()
        if (state.cart.length === 0) return

        const draft: Draft = {
          id: makeId(),
          tableId: state.tableId,
          items: state.cart.map((line) => ({ ...line })),
          discount: { ...state.discount },
          note: state.note,
          createdAt: Date.now(),
        }

        set({
          drafts: [draft, ...state.drafts],
          ...emptyOrder(),
        })
      },

      loadDraft: (draftId) => {
        const state = get()
        const draft = state.drafts.find((item) => item.id === draftId)
        if (!draft) return

        set({
          cart: draft.items.map((line) => ({ ...line })),
          tableId: draft.tableId,
          discount: { ...draft.discount },
          note: draft.note,
          drafts: state.drafts.filter((item) => item.id !== draftId),
        })
      },

      deleteDraft: (draftId) => {
        set((state) => ({
          drafts: state.drafts.filter((draft) => draft.id !== draftId),
        }))
      },

      completeOrder: ({ method, received, change }) => {
        const state = get()
        if (state.cart.length === 0) return null

        const items: OrderLineSnapshot[] = state.cart.flatMap((line) => {
          const menuItem = getMenuItem(line.menuItemId)
          if (!menuItem) return []

          return [
            {
              menuItemId: menuItem.id,
              name: menuItem.name,
              unitPrice: menuItem.price,
              qty: line.qty,
            },
          ]
        })

        if (items.length === 0) return null

        const totals = calcTotals(
          items.map((item) => ({
            unitPrice: item.unitPrice,
            qty: item.qty,
          })),
          state.discount,
          RESTAURANT.taxRate,
        )

        const now = new Date()
        const order: OrderRecord = {
          id: makeId(),
          code: nextOrderCode(state.history, now),
          tableId: state.tableId,
          tableName: tableName(state.tableId),
          items,
          ...totals,
          method,
          note: state.note,
          createdAt: now.getTime(),
          cashier: RESTAURANT.cashier,
          ...(method === 'cash' && received !== undefined
            ? { received, change }
            : {}),
        }

        set({
          history: [order, ...state.history],
          ...emptyOrder(),
        })

        return order
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: safeStorage,
      partialize: (state): PersistedPOS => ({
        cart: state.cart,
        tableId: state.tableId,
        discount: state.discount,
        note: state.note,
        drafts: state.drafts,
        history: state.history,
      }),
    },
  ),
)

reportStorageFailure = (failed) => {
  if (usePOSStore.getState().storageError === failed) return
  usePOSStore.setState({ storageError: failed })
}
