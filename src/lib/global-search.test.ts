import { describe, expect, it } from 'vitest'
import { MENU_ITEMS } from '../data/menu'
import type { Draft, OrderRecord } from '../types'
import { searchEverything } from './global-search'

const draft: Draft = {
  id: 'draft-1',
  tableId: 'ban-5',
  items: [{ lineId: 'line-1', menuItemId: 'ca-phe-nong', qty: 2 }],
  discount: { type: 'amount', value: 0 },
  note: 'Ít đá',
  createdAt: new Date(2026, 10, 18, 9, 30).getTime(),
}

const order: OrderRecord = {
  id: 'order-1',
  code: 'HD-20261118-001',
  tableId: 'ban-2',
  tableName: 'Bàn 02',
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
  note: '',
  createdAt: new Date(2026, 10, 18, 12, 0).getTime(),
  cashier: 'Thu ngân',
  status: 'completed',
}

const sources = {
  menu: MENU_ITEMS,
  drafts: [draft],
  history: [order],
}

describe('searchEverything', () => {
  it('returns empty groups for an empty query', () => {
    const result = searchEverything('   ', sources)

    expect(result.menu).toEqual([])
    expect(result.drafts).toEqual([])
    expect(result.history).toEqual([])
    expect(result.total).toBe(0)
  })

  it('finds menu items without Vietnamese accents', () => {
    const result = searchEverything('ca phe', sources)

    expect(result.menu.map((item) => item.name)).toContain('Cà phê nóng')
    expect(result.total).toBeGreaterThan(0)
  })

  it('finds drafts by table, note, and dish name', () => {
    expect(searchEverything('ban 05', sources).drafts).toHaveLength(1)
    expect(searchEverything('it da', sources).drafts).toHaveLength(1)
    expect(searchEverything('ca phe', sources).drafts).toHaveLength(1)
  })

  it('finds paid orders by code, table, and dish name', () => {
    expect(searchEverything('20261118', sources).history).toHaveLength(1)
    expect(searchEverything('ban 02', sources).history).toHaveLength(1)
    expect(searchEverything('ga nuong', sources).history).toHaveLength(1)
  })

  it('groups results by type and counts the total', () => {
    const result = searchEverything('ban 0', sources)

    expect(result.menu).toEqual([])
    expect(result.drafts).toHaveLength(1)
    expect(result.history).toHaveLength(1)
    expect(result.total).toBe(2)
  })

  it('returns nothing when no source matches', () => {
    const result = searchEverything('sushi', sources)

    expect(result.total).toBe(0)
  })
})
