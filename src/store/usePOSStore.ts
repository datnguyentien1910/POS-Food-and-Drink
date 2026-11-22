import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { RESTAURANT } from '../config'
import { resolveMenuItem, resolveTable, resolveTableName } from '../lib/catalog-lookup'
import { calcTotals } from '../lib/calc'
import { makeId, makeLineId } from '../lib/id'
import { nextDelay } from '../sync/backoff'
import { useAuthStore } from './useAuthStore'
import type {
  CartLine,
  CreateOrderPayload,
  Discount,
  Draft,
  LocalOrder,
  OpenOrderSnapshot,
  OrderLineSnapshot,
  OrderRecord,
  PaymentMethod,
  ServerPaymentMethod,
  SyncError,
  SyncItem,
  SyncState as OrderSyncState,
} from '../types'

const STORAGE_KEY = 'restodash-pos-v1'
const EMPTY_DISCOUNT: Discount = { type: 'amount', value: 0 }

/** Local orders kept in history; only synced/legacy ones are pruned. */
const HISTORY_LIMIT = 500
/** Warn (in the UI) when the pending queue grows beyond this. */
export const QUEUE_WARN_THRESHOLD = 100

interface PersistedPOS {
  cart: CartLine[]
  tableId: string | null
  discount: Discount
  note: string
  drafts: Draft[]
  history: LocalOrder[]
  queue: SyncItem[]
  openOrders: Record<string, OpenOrderSnapshot>
}

type PersistedPOSv2 = Omit<PersistedPOS, 'openOrders'>

type PersistedPOSv1 = Omit<PersistedPOS, 'history' | 'queue' | 'openOrders'> & {
  history: OrderRecord[]
}

interface CompleteOrderInput {
  method: PaymentMethod
  received?: number
  change?: number
  expectedTotal?: number
}

interface POSState extends PersistedPOS {
  storageError: boolean
  addItem: (menuItemId: string) => void
  increment: (lineId: string) => void
  decrement: (lineId: string) => void
  removeItem: (lineId: string) => void
  resetOrder: () => void
  setTable: (tableId: string | null) => void
  setDiscount: (discount: Discount) => void
  setNote: (note: string) => void
  saveDraft: () => void
  loadDraft: (draftId: string) => void
  deleteDraft: (draftId: string) => void
  completeOrder: (input: CompleteOrderInput) => LocalOrder | null
  markItemInflight: (id: string) => void
  setItemBackoff: (id: string, attempts: number, error: SyncError) => void
  setItemState: (id: string, state: OrderSyncState, error?: SyncError) => void
  dropQueueItem: (id: string) => void
  retryItem: (id: string) => void
  dismissItem: (id: string) => void
  acceptServerPrice: (id: string) => void
  applyServerOrder: (clientId: string, order: OrderRecord) => void
  enqueueVoid: (serverId: string, reason: string) => void
  markVoided: (serverId: string) => void
  voidLocalOrder: (clientId: string, reason: string) => void
}

const emptyOrder = (): Omit<
  PersistedPOS,
  'drafts' | 'history' | 'queue' | 'openOrders'
> => ({
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
  value.qty > 0 &&
  (value.unitPrice === undefined || isFiniteNumber(value.unitPrice)) &&
  (value.name === undefined || typeof value.name === 'string') &&
  (value.served === undefined || typeof value.served === 'boolean')

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

const isOpenOrderSnapshot = (value: unknown): value is OpenOrderSnapshot =>
  isRecord(value) &&
  Array.isArray(value.cart) &&
  value.cart.every(isCartLine) &&
  isDiscount(value.discount) &&
  typeof value.note === 'string' &&
  isFiniteNumber(value.updatedAt)

const isOpenOrders = (
  value: unknown,
): value is Record<string, OpenOrderSnapshot> =>
  isRecord(value) &&
  !Array.isArray(value) &&
  Object.values(value).every(isOpenOrderSnapshot)

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

const isQueueItem = (value: unknown): value is SyncItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (value.kind === 'CREATE_ORDER' || value.kind === 'VOID_ORDER') &&
  typeof value.state === 'string' &&
  isRecord(value.payload) &&
  typeof value.idempotencyKey === 'string' &&
  isFiniteNumber(value.attempts) &&
  isFiniteNumber(value.nextAttemptAt) &&
  isFiniteNumber(value.createdAt)

const isPersistedPOSv2 = (value: unknown): value is PersistedPOSv2 =>
  isRecord(value) &&
  Array.isArray(value.cart) &&
  value.cart.every(isCartLine) &&
  (value.tableId === null || typeof value.tableId === 'string') &&
  isDiscount(value.discount) &&
  typeof value.note === 'string' &&
  Array.isArray(value.drafts) &&
  value.drafts.every(isDraft) &&
  Array.isArray(value.history) &&
  value.history.every(isOrder) &&
  Array.isArray(value.queue) &&
  value.queue.every(isQueueItem)

const hasValidOpenOrders = (value: unknown): boolean =>
  isRecord(value) && isOpenOrders(value.openOrders)

const isPersistedPOS = (value: unknown): value is PersistedPOS =>
  isPersistedPOSv2(value) && hasValidOpenOrders(value)

/** Upgrades a v1 snapshot: old orders become read-only `legacy` rows. */
function migrateV1(from: PersistedPOSv1): PersistedPOS {
  const history: LocalOrder[] = from.history.map((order) => ({
    ...order,
    clientId: order.id,
    syncState: 'legacy',
    provisionalCode: false,
    cashierId: '',
  }))

  const cart = from.cart.flatMap((line) => {
    const item = resolveMenuItem(line.menuItemId)
    if (!item) return []
    return [
      {
        ...line,
        unitPrice: line.unitPrice ?? item.price,
        name: line.name ?? item.name,
      },
    ]
  })

  return {
    cart,
    tableId: from.tableId,
    discount: from.discount,
    note: from.note,
    drafts: from.drafts,
    history,
    queue: [],
    openOrders: {},
  }
}

let reportStorageFailure: ((failed: boolean) => void) | null = null

const safeStorage: PersistStorage<PersistedPOS> = {
  getItem: (name) => {
    try {
      const raw = globalThis.localStorage?.getItem(name)
      if (!raw) return null

      const parsed = JSON.parse(raw) as unknown
      if (!isRecord(parsed) || !isRecord(parsed.state)) return null

      if (parsed.version === 3 && isPersistedPOS(parsed.state)) {
        return { state: parsed.state, version: 3 }
      }

      if (parsed.version === 2 && isPersistedPOSv2(parsed.state)) {
        return {
          state: { ...parsed.state, openOrders: {} },
          version: 3,
        }
      }

      if (parsed.version === 1 && isRecord(parsed.state)) {
        const legacy = parsed.state
        if (
          Array.isArray(legacy.cart) &&
          legacy.cart.every(isCartLine) &&
          (legacy.tableId === null || typeof legacy.tableId === 'string') &&
          isDiscount(legacy.discount) &&
          typeof legacy.note === 'string' &&
          Array.isArray(legacy.drafts) &&
          legacy.drafts.every(isDraft) &&
          Array.isArray(legacy.history) &&
          legacy.history.every(isOrder)
        ) {
          return {
            state: migrateV1(legacy as unknown as PersistedPOSv1),
            version: 3,
          }
        }
      }

      return null
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

const SERVER_METHOD: Record<PaymentMethod, ServerPaymentMethod> = {
  cash: 'CASH',
  transfer: 'TRANSFER',
  card: 'CARD',
}

/** Temporary offline code, never confused with the server's `HD-…` range. */
function provisionalCode(clientId: string): string {
  return `OFF-${clientId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

function pruneHistory(history: LocalOrder[]): LocalOrder[] {
  if (history.length <= HISTORY_LIMIT) return history
  const keep: LocalOrder[] = []
  let prunable = history.length - HISTORY_LIMIT
  for (const order of history) {
    const locked =
      order.syncState !== 'synced' && order.syncState !== 'legacy'
    if (!locked && prunable > 0) {
      prunable -= 1
      continue
    }
    keep.push(order)
  }
  return keep
}

/** Kicks off a background sync without creating an import cycle. */
function triggerSync(): void {
  void import('../sync/worker')
    .then((worker) => worker.flush())
    .catch(() => undefined)
}

export const usePOSStore = create<POSState>()(
  persist<POSState, [], [], PersistedPOS>(
    (set, get) => ({
      ...emptyOrder(),
      drafts: [],
      history: [],
      queue: [],
      openOrders: {},
      storageError: false,

      addItem: (menuItemId) => {
        const item = resolveMenuItem(menuItemId)
        if (!item) return

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
              {
                lineId: makeLineId(),
                menuItemId,
                qty: 1,
                unitPrice: item.price,
                name: item.name,
              },
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

      resetOrder: () =>
        set({ cart: [], tableId: null, discount: { ...EMPTY_DISCOUNT }, note: '' }),

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

      completeOrder: ({ method, received, change, expectedTotal }) => {
        const state = get()
        if (state.cart.length === 0) return null

        const items: OrderLineSnapshot[] = []
        const payloadItems: CreateOrderPayload['items'] = []

        for (const line of state.cart) {
          const item = resolveMenuItem(line.menuItemId)
          const unitPrice = line.unitPrice ?? item?.price ?? 0
          const name = line.name ?? item?.name ?? 'Món'
          items.push({ menuItemId: line.menuItemId, name, unitPrice, qty: line.qty })
          payloadItems.push({
            menuItemId: item?.serverId ?? line.menuItemId,
            qty: line.qty,
          })
        }

        if (items.length === 0) return null

        const totals = calcTotals(
          items.map((item) => ({ unitPrice: item.unitPrice, qty: item.qty })),
          state.discount,
          RESTAURANT.taxRate,
        )

        const authUser = useAuthStore.getState().user
        const clientId = makeId()
        const now = Date.now()
        const table = resolveTable(state.tableId)
        const expected = expectedTotal ?? totals.total

        const order: LocalOrder = {
          id: clientId,
          clientId,
          code: provisionalCode(clientId),
          provisionalCode: true,
          syncState: 'pending',
          tableId: state.tableId,
          tableName: resolveTableName(state.tableId),
          items,
          ...totals,
          method,
          note: state.note,
          createdAt: now,
          cashier: authUser?.name ?? RESTAURANT.cashier,
          cashierId: authUser?.id ?? '',
          ...(method === 'cash' && received !== undefined
            ? { received, change }
            : {}),
        }

        const payload: CreateOrderPayload = {
          clientId,
          items: payloadItems,
          payment: {
            method: SERVER_METHOD[method],
            ...(method === 'cash' && received !== undefined ? { received } : {}),
          },
          expectedTotal: expected,
          ...(table?.serverId ? { tableId: table.serverId } : {}),
          ...(state.note ? { note: state.note } : {}),
          ...(state.discount.value > 0
            ? {
                discount: {
                  type: state.discount.type === 'percent' ? 'PERCENT' : 'AMOUNT',
                  value: state.discount.value,
                },
              }
            : {}),
        }

        const syncItem: SyncItem = {
          id: clientId,
          kind: 'CREATE_ORDER',
          state: 'pending',
          payload,
          idempotencyKey: clientId,
          expectedTotal: expected,
          attempts: 0,
          nextAttemptAt: 0,
          createdAt: now,
        }

        set({
          history: pruneHistory([order, ...state.history]),
          queue: [...state.queue, syncItem],
          ...emptyOrder(),
        })

        triggerSync()
        return order
      },

      markItemInflight: (id) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, state: 'inflight' } : item,
          ),
        }))
      },

      setItemBackoff: (id, attempts, error) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  state: 'pending',
                  attempts,
                  nextAttemptAt: Date.now() + nextDelay(attempts),
                  lastError: error,
                }
              : item,
          ),
        }))
      },

      setItemState: (id, state, error) => {
        set((prev) => ({
          queue: prev.queue.map((item) =>
            item.id === id
              ? { ...item, state, ...(error ? { lastError: error } : {}) }
              : item,
          ),
        }))
      },

      dropQueueItem: (id) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }))
      },

      retryItem: (id) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  state: 'pending',
                  attempts: 0,
                  nextAttemptAt: 0,
                  lastError: undefined,
                }
              : item,
          ),
        }))
        triggerSync()
      },

      dismissItem: (id) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }))
      },

      acceptServerPrice: (id) => {
        set((state) => ({
          queue: state.queue.map((item) => {
            if (item.id !== id || item.kind !== 'CREATE_ORDER') return item
            const payload = {
              ...(item.payload as CreateOrderPayload),
            }
            delete payload.expectedTotal
            return {
              ...item,
              payload,
              expectedTotal: undefined,
              // The payload changed, so the idempotency key must change too.
              idempotencyKey: makeId(),
              state: 'pending' as const,
              attempts: 0,
              nextAttemptAt: 0,
              lastError: undefined,
            }
          }),
        }))
        triggerSync()
      },

      applyServerOrder: (clientId, order) => {
        set((state) => ({
          history: state.history.map((local) =>
            local.id === clientId
              ? {
                  ...order,
                  id: local.id,
                  clientId,
                  cashierId: local.cashierId,
                  // Keep the real sale time; the server time is the sync time.
                  createdAt: local.createdAt,
                  syncState: 'synced',
                  provisionalCode: false,
                }
              : local,
          ),
          queue: state.queue.filter((item) => item.id !== clientId),
        }))
      },

      enqueueVoid: (serverId, reason) => {
        set((state) => {
          if (state.queue.some((item) => item.id === serverId)) return state
          const item: SyncItem = {
            id: serverId,
            kind: 'VOID_ORDER',
            state: 'pending',
            payload: { orderId: serverId, reason },
            idempotencyKey: makeId(),
            attempts: 0,
            nextAttemptAt: 0,
            createdAt: Date.now(),
          }
          return {
            queue: [...state.queue, item],
            history: state.history.map((order) =>
              order.serverId === serverId
                ? { ...order, voided: true, voidReason: reason }
                : order,
            ),
          }
        })
        triggerSync()
      },

      markVoided: (serverId) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== serverId),
          history: state.history.map((order) =>
            order.serverId === serverId
              ? { ...order, voided: true }
              : order,
          ),
        }))
      },

      voidLocalOrder: (clientId, reason) => {
        set((state) => ({
          // Drop any unsent CREATE for this order; it never reaches the server.
          queue: state.queue.filter(
            (item) => !(item.id === clientId && item.kind === 'CREATE_ORDER'),
          ),
          history: state.history.map((order) =>
            order.id === clientId
              ? {
                  ...order,
                  voided: true,
                  voidReason: reason,
                  syncState: 'voided',
                }
              : order,
          ),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      storage: safeStorage,
      partialize: (state): PersistedPOS => ({
        cart: state.cart,
        tableId: state.tableId,
        discount: state.discount,
        note: state.note,
        drafts: state.drafts,
        history: state.history,
        queue: state.queue,
        openOrders: state.openOrders,
      }),
    },
  ),
)

reportStorageFailure = (failed) => {
  if (usePOSStore.getState().storageError === failed) return
  usePOSStore.setState({ storageError: failed })
}
