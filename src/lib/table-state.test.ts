import { describe, expect, it } from 'vitest'
import type { CartLine, OpenOrderSnapshot } from '../types'
import {
  TAKEAWAY_KEY,
  countUnserved,
  orderKey,
  tableLines,
  tableState,
} from './table-state'

function line(id: string, qty: number, served?: boolean): CartLine {
  return { lineId: id, menuItemId: 'item-1', qty, served }
}

function snapshot(cart: CartLine[]): OpenOrderSnapshot {
  return { cart, discount: { type: 'amount', value: 0 }, note: '', updatedAt: 1 }
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
