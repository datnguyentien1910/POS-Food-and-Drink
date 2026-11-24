import { describe, expect, it } from 'vitest'
import type {
  CartLine,
  LocalOrder,
  OpenOrderSnapshot,
  OrderLineSnapshot,
} from '../types'
import {
  TAKEAWAY_KEY,
  countUnserved,
  orderKey,
  pendingOrderForTable,
  tableLines,
  tableServingState,
  tableState,
} from './table-state'

function line(id: string, qty: number, served?: boolean): CartLine {
  return { lineId: id, menuItemId: 'item-1', qty, served }
}

function snapshot(cart: CartLine[]): OpenOrderSnapshot {
  return { cart, discount: { type: 'amount', value: 0 }, note: '', updatedAt: 1 }
}

function orderLine(
  menuItemId: string,
  qty: number,
  served?: boolean,
): OrderLineSnapshot {
  return { menuItemId, name: menuItemId, unitPrice: 10, qty, served }
}

function pendingOrder(
  id: string,
  tableId: string | null,
  createdAt: number,
  items: OrderLineSnapshot[] = [],
  overrides: Partial<LocalOrder> = {},
): LocalOrder {
  return {
    id,
    code: `ORD-${id}`,
    tableId,
    tableName: tableId === null ? 'Mang đi' : `Bàn ${tableId}`,
    items,
    subtotal: 0,
    discountAmount: 0,
    tax: 0,
    total: 0,
    method: 'cash',
    note: '',
    createdAt,
    cashier: 'cashier-1',
    status: 'pending_payment',
    clientId: `client-${id}`,
    syncState: 'synced',
    provisionalCode: false,
    cashierId: 'cashier-1',
    ...overrides,
  }
}

describe('orderKey', () => {
  it('returns the table id or the takeaway slot', () => {
    expect(orderKey('ban-5')).toBe('ban-5')
    expect(orderKey(null)).toBe(TAKEAWAY_KEY)
    expect(TAKEAWAY_KEY).toBe('__takeaway__')
  })
})

describe('tableState', () => {
  it('returns empty for no lines', () => {
    expect(tableState([])).toBe('empty')
  })

  it('returns pending when any line is not served', () => {
    expect(tableState([line('a', 1)])).toBe('pending')
    expect(tableState([line('a', 1, false)])).toBe('pending')
    expect(tableState([line('a', 1, true), line('b', 2)])).toBe('pending')
  })

  it('returns served when every line is served', () => {
    expect(tableState([line('a', 1, true), line('b', 2, true)])).toBe('served')
  })
})

describe('countUnserved', () => {
  it('counts quantities of unserved lines', () => {
    expect(countUnserved([])).toBe(0)
    expect(countUnserved([line('a', 2), line('b', 3), line('c', 4, true)])).toBe(5)
    expect(countUnserved([line('a', 1, false), line('b', 1, true)])).toBe(1)
  })
})

describe('tableLines', () => {
  it('reads the active cart for the active table', () => {
    const cart = [line('a', 1)]
    const openOrders = { 'ban-1': snapshot([line('x', 9)]) }

    expect(tableLines('ban-1', 'ban-1', cart, openOrders)).toBe(cart)
  })

  it('reads a suspended snapshot for another table', () => {
    const suspendedCart = [line('y', 2)]
    const openOrders = { 'ban-2': snapshot(suspendedCart) }

    expect(tableLines('ban-2', 'ban-1', [], openOrders)).toBe(suspendedCart)
    expect(tableLines('ban-3', 'ban-1', [], openOrders)).toEqual([])
  })
})

describe('pendingOrderForTable', () => {
  it('returns the pending order for the requested table', () => {
    const target = pendingOrder('o-1', 'ban-5', 100)
    const history = [
      target,
      pendingOrder('o-2', 'ban-1', 200),
      pendingOrder('o-3', null, 300),
    ]

    expect(pendingOrderForTable(history, 'ban-5', null)).toBe(target)
  })

  it('returns the newest pending order for that table', () => {
    const oldest = pendingOrder('old', 'ban-5', 100)
    const newest = pendingOrder('new', 'ban-5', 300)
    const history = [newest, oldest, pendingOrder('mid', 'ban-5', 200)]

    expect(pendingOrderForTable(history, 'ban-5', null)).toBe(newest)
  })

  it('ignores orders that are not pending_payment', () => {
    const history = [
      pendingOrder('done', 'ban-5', 300, [], { status: 'completed' }),
      pendingOrder('void', 'ban-5', 200, [], { status: 'cancelled' }),
      pendingOrder('pending', 'ban-5', 100),
    ]

    expect(pendingOrderForTable(history, 'ban-5', null)?.id).toBe('pending')
  })

  it('skips the order currently being edited', () => {
    const editing = pendingOrder('editing', 'ban-5', 300)
    const other = pendingOrder('other', 'ban-5', 200)
    const history = [editing, other]

    expect(pendingOrderForTable(history, 'ban-5', 'editing')).toBe(other)
  })

  it('returns undefined when no matching pending order exists', () => {
    expect(pendingOrderForTable([], 'ban-5', null)).toBeUndefined()
    expect(
      pendingOrderForTable(
        [pendingOrder('o-1', 'ban-5', 100)],
        'ban-5',
        'o-1',
      ),
    ).toBeUndefined()
  })
})

describe('tableServingState', () => {
  it('returns empty with zero items when nothing is open', () => {
    expect(tableServingState('ban-5', 'ban-1', [], {}, [], null)).toEqual({
      state: 'empty',
      itemCount: 0,
    })
  })

  it('prefers the active cart over any pending order', () => {
    const cart = [line('a', 2), line('b', 3, true)]
    const history = [pendingOrder('o-1', 'ban-5', 100, [orderLine('x', 9)])]

    expect(
      tableServingState('ban-5', 'ban-5', cart, {}, history, null),
    ).toEqual({ state: 'pending', itemCount: 5 })
  })

  it('prefers a suspended snapshot over any pending order', () => {
    const openOrders = { 'ban-5': snapshot([line('a', 4, true)]) }
    const history = [pendingOrder('o-1', 'ban-5', 100, [orderLine('x', 9)])]

    expect(
      tableServingState('ban-5', 'ban-1', [], openOrders, history, null),
    ).toEqual({ state: 'served', itemCount: 4 })
  })

  it('derives state and itemCount from a pending order when no lines are open', () => {
    const history = [
      pendingOrder('o-1', 'ban-5', 100, [orderLine('a', 2), orderLine('b', 3)]),
    ]

    expect(
      tableServingState('ban-5', 'ban-1', [], {}, history, null),
    ).toEqual({ state: 'pending', itemCount: 5 })
  })

  it('treats a pending order item with no served flag as unserved', () => {
    const history = [
      pendingOrder('o-1', 'ban-5', 100, [
        { menuItemId: 'a', name: 'A', unitPrice: 10, qty: 2 },
        { menuItemId: 'b', name: 'B', unitPrice: 20, qty: 3, served: true },
      ]),
    ]

    const { state } = tableServingState(
      'ban-5',
      'ban-1',
      [],
      {},
      history,
      null,
    )
    expect(state).toBe('pending')
  })

  it('returns served when all pending order items are served', () => {
    const history = [
      pendingOrder('o-1', 'ban-5', 100, [
        orderLine('a', 2, true),
        orderLine('b', 3, true),
      ]),
    ]

    expect(
      tableServingState('ban-5', 'ban-1', [], {}, history, null),
    ).toEqual({ state: 'served', itemCount: 5 })
  })

  it('excludes the order being edited from table derivation', () => {
    const editing = pendingOrder('editing', 'ban-5', 300, [
      orderLine('x', 9),
    ])
    const other = pendingOrder('other', 'ban-5', 200, [orderLine('a', 2)])
    const history = [editing, other]

    expect(
      tableServingState('ban-5', 'ban-1', [], {}, history, 'editing'),
    ).toEqual({ state: 'pending', itemCount: 2 })
  })
})
