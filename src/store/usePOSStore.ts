import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { RESTAURANT } from '../config'
import { resolveMenuItem, resolveTable, resolveTableName } from '../lib/catalog-lookup'
import { calcTotals } from '../lib/calc'
import { makeId, makeLineId } from '../lib/id'
import { orderKey } from '../lib/table-state'
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
  OrderStatus,
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
  editingPendingOrderId: string | null
}

type PersistedPOSv3 = Omit<PersistedPOS, 'editingPendingOrderId'>

type PersistedPOSv2 = Omit<PersistedPOSv3, 'openOrders'>

type PersistedPOSv1 = Omit<PersistedPOSv2, 'history' | 'queue'> & {
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
  switchTable: (tableId: string | null) => void
  assignTable: (tableId: string | null) => void
  savePendingOrder: () => LocalOrder | null
  resumePendingOrder: (orderId: string) => void
  payPendingOrder: (orderId: string, input: CompleteOrderInput) => LocalOrder | null
  cancelPendingOrder: (orderId: string) => void
  setPendingOrderTable: (orderId: string, tableId: string | null) => void
  setPendingLineServed: (
    orderId: string,
    lineId: string,
    served: boolean,
  ) => void
  setPendingLineQty: (orderId: string, lineId: string, qty: number) => void
  removePendingLine: (orderId: string, lineId: string) => void
  setAllPendingServed: (orderId: string) => void
  setLineServed: (lineId: string, served: boolean) => void
  setAllServed: () => void
  isTableBusy: (tableId: string) => boolean
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
  'drafts' | 'history' | 'queue' | 'openOrders' | 'editingPendingOrderId'
> => ({
  cart: [],
  tableId: null,
  discount: { ...EMPTY_DISCOUNT },
  note: '',
})

/** Saves the active order under its table key, or drops an empty snapshot. */
function stashSnapshot(
  openOrders: Record<string, OpenOrderSnapshot>,
  tableId: string | null,
  cart: CartLine[],
  discount: Discount,
  note: string,
): Record<string, OpenOrderSnapshot> {
  const key = orderKey(tableId)
  if (cart.length === 0) {
    const next = { ...openOrders }
    delete next[key]
    return next
  }
  return {
    ...openOrders,
    [key]: {
      cart: cart.map((line) => ({ ...line })),
      discount: { ...discount },
      note,
      updatedAt: Date.now(),
    },
  }
}

function withoutSnapshot(
  openOrders: Record<string, OpenOrderSnapshot>,
  tableId: string | null,
): Record<string, OpenOrderSnapshot> {
  const next = { ...openOrders }
  delete next[orderKey(tableId)]
  return next
}

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

const isOrderStatus = (value: unknown): value is OrderStatus =>
  value === 'pending_payment' || value === 'completed' || value === 'cancelled'

const isOrderLine = (value: unknown): value is OrderLineSnapshot =>
  isRecord(value) &&
  typeof value.menuItemId === 'string' &&
  typeof value.name === 'string' &&
  isFiniteNumber(value.unitPrice) &&
  isFiniteNumber(value.qty) &&
  value.qty > 0 &&
  (value.served === undefined || typeof value.served === 'boolean')

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
  typeof value.cashier === 'string' &&
  (value.status === undefined || isOrderStatus(value.status))

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

const isPersistedPOSv3 = (value: unknown): value is PersistedPOSv3 =>
  isPersistedPOSv2(value) && hasValidOpenOrders(value)

const isPersistedPOS = (value: unknown): value is PersistedPOS =>
  isRecord(value) &&
  (value.editingPendingOrderId === null ||
    typeof value.editingPendingOrderId === 'string') &&
  isPersistedPOSv3(value)

/** Adds the v4 fields to an older snapshot, deriving status from `voided`. */
function toV4(state: PersistedPOSv3): PersistedPOS {
  return {
    ...state,
    editingPendingOrderId: null,
    history: state.history.map((order) => ({
      ...order,
      status: order.voided ? 'cancelled' : 'completed',
    })),
  }
}

/** Upgrades a v1 snapshot: old orders become read-only `legacy` rows. */
function migrateV1(from: PersistedPOSv1): PersistedPOSv3 {
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

      if (parsed.version === 4 && isPersistedPOS(parsed.state)) {
        return { state: parsed.state, version: 4 }
      }

      if (parsed.version === 3 && isPersistedPOSv3(parsed.state)) {
        return { state: toV4(parsed.state), version: 4 }
      }

      if (parsed.version === 2 && isPersistedPOSv2(parsed.state)) {
        return {
          state: toV4({ ...parsed.state, openOrders: {} }),
          version: 4,
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
            state: toV4(migrateV1(legacy as unknown as PersistedPOSv1)),
            version: 4,
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

/** Snapshots cart lines, keeping `served` so pending orders can be resumed. */
function orderLinesFromCart(cart: CartLine[]): OrderLineSnapshot[] {
  return cart.map((line) => {
    const item = resolveMenuItem(line.menuItemId)
    return {
      menuItemId: line.menuItemId,
      name: line.name ?? item?.name ?? 'Món',
      unitPrice: line.unitPrice ?? item?.price ?? 0,
      qty: line.qty,
      served: line.served === true,
    }
  })
}

function payloadItemsFromLines(
  items: OrderLineSnapshot[],
): CreateOrderPayload['items'] {
  return items.map((item) => ({
    menuItemId: resolveMenuItem(item.menuItemId)?.serverId ?? item.menuItemId,
    qty: item.qty,
  }))
}

function payloadDiscount(
  discount: Discount | undefined,
): CreateOrderPayload['discount'] | undefined {
  if (!discount || discount.value <= 0) return undefined
  return {
    type: discount.type === 'percent' ? 'PERCENT' : 'AMOUNT',
    value: discount.value,
  }
}

function createOrderQueueItem(
  clientId: string,
  payload: CreateOrderPayload,
  expected: number,
  now: number,
): SyncItem {
  return {
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

/**
 * Shared patch for popup quantity edits. `qty <= 0` drops the line, otherwise
 * it is updated in place. Returns null when the target is not editable.
 * Lines are addressed as `${order.id}:${index}` by the modal.
 */
function patchPendingLine(
  state: POSState,
  orderId: string,
  lineId: string,
  qty: number,
): Partial<POSState> | null {
  const order = state.history.find(
    (item) => item.id === orderId && item.status === 'pending_payment',
  )
  if (!order) return null

  const index = order.items.findIndex(
    (_line, i) => `${order.id}:${i}` === lineId,
  )
  if (index < 0 || order.items[index].served === true) return null

  const remove = qty <= 0
  const items = remove
    ? order.items.filter((_line, i) => i !== index)
    : order.items.map((line, i) => (i === index ? { ...line, qty } : line))

  const discount: Discount = order.discount ?? {
    type: 'amount',
    value: order.discountAmount,
  }
  const totals = calcTotals(
    items.map((item) => ({ unitPrice: item.unitPrice, qty: item.qty })),
    discount,
    RESTAURANT.taxRate,
  )
  const updated: LocalOrder = {
    ...order,
    items,
    ...totals,
    updatedAt: Date.now(),
  }

  return {
    history: state.history.map((item) =>
      item.id === order.id ? updated : item,
    ),
    // A resumed order is saved back from the active cart; mirror the patch so
    // savePendingOrder() cannot restore the old qty or bring the line back.
    ...(state.editingPendingOrderId === orderId
      ? {
          cart: remove
            ? state.cart.filter((line) => line.lineId !== lineId)
            : state.cart.map((line) =>
                line.lineId === lineId ? { ...line, qty } : line,
              ),
        }
      : {}),
  }
}

export const usePOSStore = create<POSState>()(
  persist<POSState, [], [], PersistedPOS>(
    (set, get) => ({
      ...emptyOrder(),
      drafts: [],
      history: [],
      queue: [],
      openOrders: {},
      editingPendingOrderId: null,
      storageError: false,

      addItem: (menuItemId) => {
        const item = resolveMenuItem(menuItemId)
        if (!item) return

        set((state) => {
          const existing = state.cart.find(
            (line) => line.menuItemId === menuItemId && line.served !== true,
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
                served: false,
              },
            ],
          }
        })
      },

      increment: (lineId) => {
        set((state) => ({
          cart: state.cart.map((line) =>
            line.lineId === lineId && line.served !== true
              ? { ...line, qty: line.qty + 1 }
              : line,
          ),
        }))
      },

      decrement: (lineId) => {
        set((state) => ({
          cart: state.cart.flatMap((line) => {
            if (line.lineId !== lineId || line.served === true) return [line]
            if (line.qty <= 1) return []
            return [{ ...line, qty: line.qty - 1 }]
          }),
        }))
      },

      removeItem: (lineId) => {
        set((state) => ({
          cart: state.cart.filter(
            (line) => line.lineId !== lineId || line.served === true,
          ),
        }))
      },

      resetOrder: () =>
        set((state) => ({
          ...emptyOrder(),
          openOrders: withoutSnapshot(state.openOrders, state.tableId),
          editingPendingOrderId: null,
        })),

      setTable: (tableId) => get().switchTable(tableId),

      switchTable: (next) => {
        const state = get()
        const currentKey = orderKey(state.tableId)
        const nextKey = orderKey(next)

        if (currentKey === nextKey) {
          set({ tableId: next })
          return
        }

        const stashed = stashSnapshot(
          state.openOrders,
          state.tableId,
          state.cart,
          state.discount,
          state.note,
        )
        const resumed = stashed[nextKey]

        if (resumed) {
          set({
            tableId: next,
            cart: resumed.cart.map((line) => ({ ...line })),
            discount: { ...resumed.discount },
            note: resumed.note,
            openOrders: withoutSnapshot(stashed, next),
          })
          return
        }

        set({
          ...emptyOrder(),
          tableId: next,
          openOrders: stashed,
        })
      },

      assignTable: (tableId) => set({ tableId }),

      savePendingOrder: () => {
        const state = get()
        if (state.cart.length === 0) return null

        const items = orderLinesFromCart(state.cart)
        const totals = calcTotals(
          items.map((item) => ({ unitPrice: item.unitPrice, qty: item.qty })),
          state.discount,
          RESTAURANT.taxRate,
        )
        const now = Date.now()
        const editingId = state.editingPendingOrderId
        const editing =
          editingId === null
            ? undefined
            : state.history.find(
                (order) =>
                  order.id === editingId &&
                  order.status === 'pending_payment',
              )

        let order: LocalOrder
        if (editing) {
          order = {
            ...editing,
            tableId: state.tableId,
            tableName: resolveTableName(state.tableId),
            items,
            ...totals,
            discount: { ...state.discount },
            note: state.note,
            updatedAt: now,
          }
        } else {
          const clientId = makeId()
          const authUser = useAuthStore.getState().user
          order = {
            id: clientId,
            clientId,
            code: provisionalCode(clientId),
            provisionalCode: true,
            syncState: 'pending',
            tableId: state.tableId,
            tableName: resolveTableName(state.tableId),
            items,
            ...totals,
            method: 'cash',
            discount: { ...state.discount },
            note: state.note,
            createdAt: now,
            updatedAt: now,
            cashier: authUser?.name ?? RESTAURANT.cashier,
            status: 'pending_payment',
            cashierId: authUser?.id ?? '',
          }
        }

        set((prev) => ({
          history: editing
            ? prev.history.map((item) => (item.id === editing.id ? order : item))
            : pruneHistory([order, ...prev.history]),
          ...emptyOrder(),
          editingPendingOrderId: null,
          openOrders: withoutSnapshot(
            withoutSnapshot(prev.openOrders, prev.tableId),
            order.tableId,
          ),
        }))
        return order
      },

      resumePendingOrder: (orderId) => {
        const state = get()
        const order = state.history.find(
          (item) =>
            item.id === orderId && item.status === 'pending_payment',
        )
        if (!order) return

        // Drop the order's stale snapshot first: when the active cart is on
        // the same table, stashing afterwards must not be overwritten by it.
        let openOrders = withoutSnapshot(state.openOrders, order.tableId)
        openOrders = stashSnapshot(
          openOrders,
          state.tableId,
          state.cart,
          state.discount,
          state.note,
        )

        set({
          cart: order.items.map((line, index) => ({
            lineId: `${order.id}:${index}`,
            menuItemId: line.menuItemId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            name: line.name,
            served: line.served === true,
          })),
          discount: order.discount
            ? { ...order.discount }
            : { type: 'amount', value: order.discountAmount },
          note: order.note,
          tableId: order.tableId,
          openOrders,
          editingPendingOrderId: order.id,
        })
      },

      payPendingOrder: (orderId, input) => {
        const state = get()
        const order = state.history.find(
          (item) =>
            item.id === orderId && item.status === 'pending_payment',
        )
        if (!order) return null

        const table = resolveTable(order.tableId)
        const expected = input.expectedTotal ?? order.total
        const discount = payloadDiscount(order.discount)
        const payload: CreateOrderPayload = {
          clientId: order.clientId,
          items: payloadItemsFromLines(order.items),
          payment: {
            method: SERVER_METHOD[input.method],
            ...(input.method === 'cash' && input.received !== undefined
              ? { received: input.received }
              : {}),
          },
          expectedTotal: expected,
          ...(table?.serverId ? { tableId: table.serverId } : {}),
          ...(order.note ? { note: order.note } : {}),
          ...(discount ? { discount } : {}),
        }
        const now = Date.now()
        const paid: LocalOrder = {
          ...order,
          status: 'completed',
          method: input.method,
          ...(input.method === 'cash' && input.received !== undefined
            ? { received: input.received, change: input.change }
            : {}),
          updatedAt: now,
        }

        const isEditing = state.editingPendingOrderId === order.id
        set((prev) => ({
          history: prev.history.map((item) => (item.id === order.id ? paid : item)),
          queue: [
            ...prev.queue.filter((item) => item.id !== order.clientId),
            createOrderQueueItem(order.clientId, payload, expected, now),
          ],
          // "Thêm món" leaves the editing order in the active cart; paying it
          // finishes that order, so clear the working order as well.
          ...(isEditing ? emptyOrder() : {}),
          openOrders: withoutSnapshot(prev.openOrders, order.tableId),
          editingPendingOrderId:
            prev.editingPendingOrderId === order.id
              ? null
              : prev.editingPendingOrderId,
        }))

        triggerSync()
        return paid
      },

      cancelPendingOrder: (orderId) => {
        const state = get()
        const order = state.history.find(
          (item) =>
            item.id === orderId && item.status === 'pending_payment',
        )
        if (!order) return

        set((prev) => ({
          history: prev.history.map((item) =>
            item.id === orderId
              ? { ...item, status: 'cancelled', updatedAt: Date.now() }
              : item,
          ),
          queue: prev.queue.filter((item) => item.id !== order.clientId),
          openOrders: withoutSnapshot(prev.openOrders, order.tableId),
          editingPendingOrderId:
            prev.editingPendingOrderId === orderId
              ? null
              : prev.editingPendingOrderId,
        }))
      },

      // Popup edits patch the history row in place without resuming the order.
      // When the order is still being edited, the matching active state is
      // synced too, so savePendingOrder() cannot overwrite the patch later.
      setPendingOrderTable: (orderId, tableId) => {
        const isTarget = (order: LocalOrder) =>
          order.id === orderId && order.status === 'pending_payment'
        if (!get().history.some(isTarget)) return

        set((state) => ({
          history: state.history.map((order) =>
            isTarget(order)
              ? {
                  ...order,
                  tableId,
                  tableName: resolveTableName(tableId),
                  updatedAt: Date.now(),
                }
              : order,
          ),
          // A resumed order is saved back from the active cart, whose tableId
          // would otherwise overwrite this patch with the old table.
          ...(state.editingPendingOrderId === orderId ? { tableId } : {}),
        }))
      },

      setPendingLineServed: (orderId, lineId, served) => {
        const isTarget = (order: LocalOrder) =>
          order.id === orderId && order.status === 'pending_payment'
        if (!get().history.some(isTarget)) return

        set((state) => ({
          history: state.history.map((order) =>
            isTarget(order)
              ? {
                  ...order,
                  updatedAt: Date.now(),
                  // Pending lines are addressed as `${order.id}:${index}` by
                  // the modal; only `served` changes, never qty or prices.
                  items: order.items.map((line, index) =>
                    `${order.id}:${index}` === lineId
                      ? { ...line, served }
                      : line,
                  ),
                }
              : order,
          ),
          // A resumed order is saved back from the active cart; keep the
          // matching cart line in sync so its served flag survives that save.
          ...(state.editingPendingOrderId === orderId
            ? {
                cart: state.cart.map((line) =>
                  line.lineId === lineId ? { ...line, served } : line,
                ),
              }
            : {}),
        }))
      },

      setPendingLineQty: (orderId, lineId, qty) => {
        if (!Number.isFinite(qty)) return
        const patch = patchPendingLine(get(), orderId, lineId, qty)
        if (patch) set(patch)
      },

      removePendingLine: (orderId, lineId) => {
        const patch = patchPendingLine(get(), orderId, lineId, 0)
        if (patch) set(patch)
      },

      setAllPendingServed: (orderId) => {
        const isTarget = (order: LocalOrder) =>
          order.id === orderId && order.status === 'pending_payment'
        const target = get().history.find(isTarget)
        if (!target) return
        const cartLineIds = new Set(
          target.items.map((_line, index) => `${orderId}:${index}`),
        )

        set((state) => ({
          history: state.history.map((order) =>
            isTarget(order)
              ? {
                  ...order,
                  updatedAt: Date.now(),
                  items: order.items.map((line) => ({ ...line, served: true })),
                }
              : order,
          ),
          // Only the lines belonging to the edited order are synced; any
          // extra lines added through "Thêm món" keep their own served flags.
          ...(state.editingPendingOrderId === orderId
            ? {
                cart: state.cart.map((line) =>
                  cartLineIds.has(line.lineId)
                    ? { ...line, served: true }
                    : line,
                ),
              }
            : {}),
        }))
      },

      setLineServed: (lineId, served) =>
        set((state) => ({
          cart: state.cart.map((line) =>
            line.lineId === lineId ? { ...line, served } : line,
          ),
        })),

      setAllServed: () =>
        set((state) => ({
          cart: state.cart.map((line) => ({ ...line, served: true })),
        })),

      isTableBusy: (tableId) => {
        const state = get()
        const active = state.tableId === tableId && state.cart.length > 0
        const snapshot = state.openOrders[orderKey(tableId)]
        const pending = state.history.some(
          (order) =>
            order.status === 'pending_payment' &&
            order.tableId === tableId &&
            order.id !== state.editingPendingOrderId,
        )
        return (
          active || (snapshot !== undefined && snapshot.cart.length > 0) || pending
        )
      },

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
          openOrders: withoutSnapshot(state.openOrders, state.tableId),
          editingPendingOrderId: null,
        })
      },

      loadDraft: (draftId) => {
        const state = get()
        const draft = state.drafts.find((item) => item.id === draftId)
        if (!draft) return

        let openOrders = state.openOrders
        if (draft.tableId !== state.tableId && state.cart.length > 0) {
          openOrders = stashSnapshot(
            openOrders,
            state.tableId,
            state.cart,
            state.discount,
            state.note,
          )
        }
        openOrders = withoutSnapshot(openOrders, draft.tableId)

        set({
          cart: draft.items.map((line) => ({ ...line })),
          tableId: draft.tableId,
          discount: { ...draft.discount },
          note: draft.note,
          drafts: state.drafts.filter((item) => item.id !== draftId),
          openOrders,
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

        const items = orderLinesFromCart(state.cart)
        const payloadItems = payloadItemsFromLines(items)

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
        const discount = payloadDiscount(state.discount)

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
          status: 'completed',
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
          ...(discount ? { discount } : {}),
        }

        const syncItem = createOrderQueueItem(clientId, payload, expected, now)

        set({
          history: pruneHistory([order, ...state.history]),
          queue: [...state.queue, syncItem],
          ...emptyOrder(),
          openOrders: withoutSnapshot(state.openOrders, state.tableId),
          // A checkout finishes any pending order being edited, even when it
          // happens from create mode rather than payPendingOrder.
          editingPendingOrderId: null,
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
                ? {
                    ...order,
                    voided: true,
                    voidReason: reason,
                    status: 'cancelled',
                  }
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
              ? { ...order, voided: true, status: 'cancelled' }
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
                  status: 'cancelled',
                }
              : order,
          ),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 4,
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
        editingPendingOrderId: state.editingPendingOrderId,
      }),
    },
  ),
)

reportStorageFailure = (failed) => {
  if (usePOSStore.getState().storageError === failed) return
  usePOSStore.setState({ storageError: failed })
}
