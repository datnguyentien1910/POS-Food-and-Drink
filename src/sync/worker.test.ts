import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http'
import { useAuthStore } from '../store/useAuthStore'
import { usePOSStore } from '../store/usePOSStore'
import { useSyncStore } from '../store/useSyncStore'
import type { LocalOrder, OrderRecord, SyncItem } from '../types'
import { flush, recover } from './worker'

vi.mock('../api/orders', () => ({
  createOrder: vi.fn(),
  voidOrder: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
}))

import * as ordersApi from '../api/orders'

const createOrderMock = vi.mocked(ordersApi.createOrder)
const voidOrderMock = vi.mocked(ordersApi.voidOrder)
const listOrdersMock = vi.mocked(ordersApi.listOrders)

const USER = {
  id: 'u1',
  name: 'Ngọc Anh',
  email: 'manager@restodash.local',
  role: 'MANAGER' as const,
  restaurantId: 'r1',
}

const serverOrder = {
  id: 'srv-1',
  code: 'HD-20261120-001',
  status: 'PAID',
  clientId: 'client-1',
  tableId: null,
  tableName: 'Mang đi',
  items: [],
  subtotal: 109000,
  discountType: null,
  discountValue: null,
  discountAmount: 0,
  tax: 8720,
  total: 117720,
  payment: {
    method: 'CASH' as const,
    amount: 117720,
    received: null,
    change: null,
    status: 'PAID',
  },
  note: null,
  cashierName: 'Thu ngân',
  createdAt: '2026-11-20T03:00:00.000Z',
  voidedAt: null,
  voidReason: null,
}

function makeItem(overrides: Partial<SyncItem> = {}): SyncItem {
  return {
    id: 'client-1',
    kind: 'CREATE_ORDER',
    state: 'pending',
    payload: {
      clientId: 'client-1',
      items: [{ menuItemId: 'ga-nuong', qty: 1 }],
      payment: { method: 'CASH', received: 120000 },
      expectedTotal: 117720,
    },
    idempotencyKey: 'client-1',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: 1,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<LocalOrder> = {}): LocalOrder {
  const base: OrderRecord = {
    id: 'client-1',
    code: 'OFF-12345678',
    tableId: null,
    tableName: 'Mang đi',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    tax: 0,
    total: 0,
    method: 'cash',
    note: '',
    createdAt: 1,
    cashier: 'Thu ngân',
  }
  return {
    ...base,
    clientId: 'client-1',
    syncState: 'pending',
    provisionalCode: true,
    cashierId: 'u1',
    ...overrides,
  }
}

function seed(item: SyncItem, order: LocalOrder = makeOrder()) {
  usePOSStore.setState({
    cart: [],
    drafts: [],
    tableId: null,
    discount: { type: 'amount', value: 0 },
    note: '',
    history: [order],
    queue: [item],
    openOrders: {},
  })
}

/** The worker reads `navigator.onLine`, not the sync store, to detect offline. */
function stubNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  useAuthStore.setState({
    status: 'authenticated',
    user: USER,
    authMethod: 'pin',
    expiresAt: null,
    lastUser: USER,
    lastOnlineAt: 1,
    error: null,
  })
  useSyncStore.setState({
    online: true,
    syncing: false,
    paused: false,
    lastError: null,
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  delete (window.navigator as { onLine?: unknown }).onLine
})

describe('sync worker flush', () => {
  it('applies a created order and empties the queue', async () => {
    createOrderMock.mockResolvedValue(serverOrder)
    seed(makeItem())

    await flush()

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' }),
      'client-1',
    )
    const state = usePOSStore.getState()
    expect(state.queue).toEqual([])
    expect(state.history[0]).toMatchObject({
      code: 'HD-20261120-001',
      serverId: 'srv-1',
      syncState: 'synced',
      provisionalCode: false,
    })
  })

  it('retries with the same key on a network error', async () => {
    createOrderMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'))
    seed(makeItem())

    await flush()

    const item = usePOSStore.getState().queue[0]
    expect(item.state).toBe('pending')
    expect(item.attempts).toBe(1)
    expect(item.nextAttemptAt).toBeGreaterThan(0)
    expect(item.idempotencyKey).toBe('client-1')
  })

  it('marks an invalid order as failed without retrying', async () => {
    createOrderMock.mockRejectedValue(
      new ApiError(400, 'ORDER_INVALID_ITEM', 'Món không hợp lệ'),
    )
    seed(makeItem())

    await flush()

    expect(usePOSStore.getState().queue[0].state).toBe('failed')
  })

  it('flags a price change as a conflict', async () => {
    createOrderMock.mockRejectedValue(
      new ApiError(409, 'PRICE_CHANGED', 'Giá đã đổi'),
    )
    seed(makeItem())

    await flush()

    expect(usePOSStore.getState().queue[0].state).toBe('conflict')
  })

  it('pauses the queue when the session expires', async () => {
    createOrderMock.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', '401'))
    seed(makeItem())

    await flush()

    expect(useSyncStore.getState().paused).toBe(true)
    expect(usePOSStore.getState().queue[0].state).toBe('pending')
  })

  it('treats an already-voided order as success', async () => {
    voidOrderMock.mockRejectedValue(
      new ApiError(409, 'ORDER_ALREADY_VOIDED', 'Đã huỷ'),
    )
    seed(
      makeItem({
        id: 'srv-1',
        kind: 'VOID_ORDER',
        payload: { orderId: 'srv-1', reason: 'Nhầm' },
        idempotencyKey: 'void-key',
      }),
      makeOrder({ serverId: 'srv-1', syncState: 'synced', provisionalCode: false }),
    )

    await flush()

    const state = usePOSStore.getState()
    expect(state.queue).toEqual([])
    expect(state.history[0].voided).toBe(true)
  })

  it('does nothing while offline', async () => {
    stubNavigatorOnline(false)
    useSyncStore.setState({ online: false })
    seed(makeItem())

    await flush()

    expect(createOrderMock).not.toHaveBeenCalled()
    expect(usePOSStore.getState().queue[0].state).toBe('pending')
  })
})

describe('sync worker crash recovery', () => {
  it('reconciles an inflight order the server already stored', async () => {
    listOrdersMock.mockResolvedValue([serverOrder])
    seed(makeItem({ state: 'inflight' }))

    await recover()

    const state = usePOSStore.getState()
    expect(state.queue).toEqual([])
    expect(state.history[0].code).toBe('HD-20261120-001')
  })

  it('requeues an inflight order the server never received', async () => {
    listOrdersMock.mockResolvedValue([])
    seed(makeItem({ state: 'inflight' }))

    await recover()

    expect(usePOSStore.getState().queue[0].state).toBe('pending')
  })
})
