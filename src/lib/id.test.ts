import { describe, expect, it } from 'vitest'
import type { OrderRecord } from '../types'
import { makeLineId, nextOrderCode } from './id'

function order(code: string): OrderRecord {
  return {
    id: code,
    code,
    tableId: null,
    tableName: 'Mang đi',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    tax: 0,
    total: 0,
    method: 'cash',
    note: '',
    createdAt: 0,
    cashier: 'Thu ngân',
  }
}

describe('nextOrderCode', () => {
  const now = new Date(2026, 10, 18, 16, 30)

  it('starts at 001 for the first order of the day', () => {
    expect(nextOrderCode([], now)).toBe('HD-20261118-001')
  })

  it('increments the highest sequence for the same day', () => {
    const history = [
      order('HD-20261118-001'),
      order('HD-20261118-003'),
      order('HD-20261117-009'),
      order('garbage'),
    ]

    expect(nextOrderCode(history, now)).toBe('HD-20261118-004')
  })
})

describe('makeLineId', () => {
  it('returns unique, non-empty ids', () => {
    const a = makeLineId()
    const b = makeLineId()

    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
