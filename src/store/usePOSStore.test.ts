import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MENU_ITEMS } from '../data/menu'
import { usePOSStore } from './usePOSStore'

const STORAGE_KEY = 'restodash-pos-v1'

const chicken = MENU_ITEMS.find((item) => item.id === 'ga-nuong')!
const coffee = MENU_ITEMS.find((item) => item.id === 'ca-phe-nong')!

function resetStore() {
  localStorage.clear()
  usePOSStore.setState({
    cart: [],
    tableId: null,
    discount: { type: 'amount', value: 0 },
    note: '',
    drafts: [],
    history: [],
    queue: [],
    openOrders: {},
    storageError: false,
  })
}

describe('cart actions', () => {
  beforeEach(resetStore)

  it('adds a new line and increments an existing one', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().addItem(chicken.id)

    const cart = usePOSStore.getState().cart
    expect(cart).toHaveLength(1)
    expect(cart[0].menuItemId).toBe(chicken.id)
    expect(cart[0].qty).toBe(2)
  })

  it('ignores menu ids that do not exist', () => {
    usePOSStore.getState().addItem('khong-ton-tai')
    expect(usePOSStore.getState().cart).toEqual([])
  })

  it('decrements and removes a line at quantity one', () => {
    usePOSStore.getState().addItem(chicken.id)
    const lineId = usePOSStore.getState().cart[0].lineId

    usePOSStore.getState().increment(lineId)
    expect(usePOSStore.getState().cart[0].qty).toBe(2)

    usePOSStore.getState().decrement(lineId)
    expect(usePOSStore.getState().cart[0].qty).toBe(1)

    usePOSStore.getState().decrement(lineId)
    expect(usePOSStore.getState().cart).toEqual([])
  })

  it('removes lines from the cart', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().addItem(coffee.id)
    const [first] = usePOSStore.getState().cart

    usePOSStore.getState().removeItem(first.lineId)
    expect(usePOSStore.getState().cart).toHaveLength(1)
  })

  it('resets cart, table, discount and note', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().setDiscount({ type: 'percent', value: 10 })
    usePOSStore.getState().setNote('Ít đá')

    usePOSStore.getState().resetOrder()

    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().discount).toEqual({ type: 'amount', value: 0 })
    expect(usePOSStore.getState().note).toBe('')
  })

  it('stores table, discount, and note', () => {
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().setDiscount({ type: 'percent', value: 10 })
    usePOSStore.getState().setNote('Ít đá')

    expect(usePOSStore.getState().tableId).toBe('ban-5')
    expect(usePOSStore.getState().discount).toEqual({ type: 'percent', value: 10 })
    expect(usePOSStore.getState().note).toBe('Ít đá')
  })
})

describe('drafts', () => {
  beforeEach(resetStore)

  it('saves the current order as a draft and resets the working order', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().setNote('Không hành')
    usePOSStore.getState().setDiscount({ type: 'amount', value: 10000 })

    usePOSStore.getState().saveDraft()

    const state = usePOSStore.getState()
    expect(state.drafts).toHaveLength(1)
    expect(state.drafts[0].items[0].menuItemId).toBe(chicken.id)
    expect(state.drafts[0].tableId).toBe('ban-5')
    expect(state.drafts[0].note).toBe('Không hành')
    expect(state.cart).toEqual([])
    expect(state.tableId).toBeNull()
    expect(state.note).toBe('')
    expect(state.discount).toEqual({ type: 'amount', value: 0 })
  })

  it('does not save an empty cart', () => {
    usePOSStore.getState().saveDraft()
    expect(usePOSStore.getState().drafts).toEqual([])
  })

  it('loads a draft back into the working order and removes it from the list', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().setTable('ban-2')
    usePOSStore.getState().saveDraft()
    const draftId = usePOSStore.getState().drafts[0].id

    usePOSStore.getState().loadDraft(draftId)

    const state = usePOSStore.getState()
    expect(state.cart[0].menuItemId).toBe(chicken.id)
    expect(state.tableId).toBe('ban-2')
    expect(state.drafts).toEqual([])
  })

  it('deletes a draft', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().saveDraft()
    const draftId = usePOSStore.getState().drafts[0].id

    usePOSStore.getState().deleteDraft(draftId)
    expect(usePOSStore.getState().drafts).toEqual([])
  })
})

describe('completeOrder', () => {
  beforeEach(resetStore)

  it('returns null and keeps state when the cart is empty', () => {
    const result = usePOSStore.getState().completeOrder({ method: 'cash' })

    expect(result).toBeNull()
    expect(usePOSStore.getState().history).toEqual([])
  })

  it('records an order once, computes totals, and resets the working order', () => {
    usePOSStore.getState().addItem(chicken.id)
    usePOSStore.getState().addItem(coffee.id)
    usePOSStore.getState().addItem(coffee.id)
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().setDiscount({ type: 'amount', value: 20000 })
    usePOSStore.getState().setNote('Mang ra sau')

    const order = usePOSStore.getState().completeOrder({
      method: 'cash',
      received: 200000,
      change: 49880,
    })

    expect(order).not.toBeNull()
    expect(order).toMatchObject({
      tableName: 'Bàn 05',
      subtotal: 159000,
      discountAmount: 20000,
      tax: 11120,
      total: 150120,
      method: 'cash',
      received: 200000,
      change: 49880,
      note: 'Mang ra sau',
      cashier: 'Thu ngân',
    })
    expect(order!.items).toEqual([
      {
        menuItemId: chicken.id,
        name: chicken.name,
        unitPrice: chicken.price,
        qty: 1,
      },
      {
        menuItemId: coffee.id,
        name: coffee.name,
        unitPrice: coffee.price,
        qty: 2,
      },
    ])
    expect(order!.code).toMatch(/^OFF-[0-9A-F]{8}$/)
    expect(order!.provisionalCode).toBe(true)
    expect(order!.syncState).toBe('pending')
    expect(order!.clientId).toBe(order!.id)

    const state = usePOSStore.getState()
    expect(state.history[0].id).toBe(order!.id)
    expect(state.queue).toHaveLength(1)
    expect(state.queue[0]).toMatchObject({
      id: order!.id,
      kind: 'CREATE_ORDER',
      state: 'pending',
    })
    expect(state.cart).toEqual([])
    expect(state.tableId).toBeNull()
    expect(state.note).toBe('')
    expect(state.discount).toEqual({ type: 'amount', value: 0 })

    const second = usePOSStore.getState().completeOrder({ method: 'cash' })
    expect(second).toBeNull()
    expect(usePOSStore.getState().history).toHaveLength(1)
  })
})

describe('persistence', () => {
  beforeEach(resetStore)

  it('persists domain state without actions', () => {
    usePOSStore.getState().addItem(chicken.id)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw!)
    expect(parsed.state.cart[0].menuItemId).toBe(chicken.id)
    expect(parsed.state.cart[0].qty).toBe(1)
    expect(parsed.state.addItem).toBeUndefined()
  })

  it('hydrates defaults instead of crashing on corrupt JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{not-valid-json')

    await expect(usePOSStore.persist.rehydrate()).resolves.not.toThrow()
    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().history).toEqual([])
  })

  it('hydrates defaults when persisted state has the wrong shape', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: 'not-an-array',
          tableId: null,
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: {},
          history: 'not-an-array',
        },
        version: 1,
      }),
    )

    await usePOSStore.persist.rehydrate()

    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().drafts).toEqual([])
    expect(usePOSStore.getState().history).toEqual([])
  })

  it('hydrates defaults for unknown persisted versions', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: [],
          tableId: null,
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: [],
          history: [],
        },
        version: 99,
      }),
    )

    await usePOSStore.persist.rehydrate()

    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().history).toEqual([])
  })

  it('restores a valid persisted state', async () => {
    usePOSStore.getState().addItem(chicken.id)
    const saved = localStorage.getItem(STORAGE_KEY)!

    usePOSStore.setState({
      cart: [],
      tableId: null,
      discount: { type: 'amount', value: 0 },
      note: '',
      drafts: [],
      history: [],
    })
    localStorage.setItem(STORAGE_KEY, saved)

    await usePOSStore.persist.rehydrate()

    expect(usePOSStore.getState().cart).toHaveLength(1)
    expect(usePOSStore.getState().cart[0].menuItemId).toBe(chicken.id)
  })

  it('upgrades a v2 snapshot to v3 with empty open orders', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: [],
          tableId: null,
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: [],
          history: [],
          queue: [],
        },
        version: 2,
      }),
    )

    await usePOSStore.persist.rehydrate()

    expect(usePOSStore.getState().openOrders).toEqual({})

    usePOSStore.getState().addItem(chicken.id)
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed.version).toBe(3)
    expect(parsed.state.openOrders).toEqual({})
  })

  it('restores open orders from a v3 snapshot', async () => {
    const snapshot = {
      cart: [
        {
          lineId: 'l1',
          menuItemId: chicken.id,
          qty: 2,
          unitPrice: chicken.price,
          name: chicken.name,
          served: false,
        },
      ],
      discount: { type: 'percent', value: 10 },
      note: 'Ít đá',
      updatedAt: 1767225600000,
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: [],
          tableId: null,
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: [],
          history: [],
          queue: [],
          openOrders: { 'ban-5': snapshot },
        },
        version: 3,
      }),
    )

    await usePOSStore.persist.rehydrate()

    expect(usePOSStore.getState().openOrders).toEqual({ 'ban-5': snapshot })
  })

  it('drops a corrupt openOrders map', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: [],
          tableId: null,
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: [],
          history: [],
          queue: [],
          openOrders: 'bad',
        },
        version: 3,
      }),
    )

    await expect(usePOSStore.persist.rehydrate()).resolves.not.toThrow()
    expect(usePOSStore.getState().openOrders).toEqual({})
  })

  it('persists open orders', () => {
    usePOSStore.setState({
      openOrders: {
        'ban-5': {
          cart: [
            {
              lineId: 'l1',
              menuItemId: chicken.id,
              qty: 1,
              unitPrice: chicken.price,
              name: chicken.name,
              served: false,
            },
          ],
          discount: { type: 'amount', value: 0 },
          note: 'Mang ra sau',
          updatedAt: 1767225600000,
        },
      },
    })

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed.version).toBe(3)
    expect(parsed.state.openOrders['ban-5']).toMatchObject({
      note: 'Mang ra sau',
      cart: [{ menuItemId: chicken.id, qty: 1, served: false }],
    })
  })

  it('flags storage failures and clears the flag after a successful write', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    usePOSStore.getState().addItem(chicken.id)
    expect(usePOSStore.getState().storageError).toBe(true)

    setItem.mockRestore()
    usePOSStore.getState().addItem(coffee.id)
    expect(usePOSStore.getState().storageError).toBe(false)
  })
})

describe('offline queue', () => {
  beforeEach(resetStore)

  it('migrates v1 history to legacy local orders and keeps the cart', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          cart: [{ lineId: 'l1', menuItemId: 'ga-nuong', qty: 2 }],
          tableId: 'ban-3',
          discount: { type: 'amount', value: 0 },
          note: '',
          drafts: [],
          history: [
            {
              id: 'HD-20260101-001',
              code: 'HD-20260101-001',
              tableId: null,
              tableName: 'Mang đi',
              items: [
                {
                  menuItemId: 'ga-nuong',
                  name: 'Gà nướng',
                  unitPrice: 109000,
                  qty: 1,
                },
              ],
              subtotal: 109000,
              discountAmount: 0,
              tax: 8720,
              total: 117720,
              method: 'cash',
              received: 120000,
              change: 2280,
              note: '',
              createdAt: 1767225600000,
              cashier: 'Thu ngân',
            },
          ],
        },
        version: 1,
      }),
    )

    await usePOSStore.persist.rehydrate()

    const state = usePOSStore.getState()
    expect(state.queue).toEqual([])
    expect(state.history[0].syncState).toBe('legacy')
    expect(state.history[0].clientId).toBe('HD-20260101-001')
    expect(state.cart[0].unitPrice).toBe(109000)
    expect(state.cart[0].name).toBe('Gà nướng')
  })

  it('voids an unsynced order locally and drops its queue item', () => {
    usePOSStore.getState().addItem(chicken.id)
    const order = usePOSStore.getState().completeOrder({ method: 'cash' })!

    usePOSStore.getState().voidLocalOrder(order.id, 'Khách đổi ý')

    const state = usePOSStore.getState()
    expect(state.queue).toEqual([])
    expect(state.history[0].voided).toBe(true)
    expect(state.history[0].syncState).toBe('voided')
  })
})
