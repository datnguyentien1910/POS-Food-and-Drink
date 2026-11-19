import { describe, expect, it } from 'vitest'
import { calcDiscount, calcTotals } from './calc'

describe('calcDiscount', () => {
  it('computes a fixed amount', () => {
    expect(calcDiscount(179000, { type: 'amount', value: 20000 })).toBe(20000)
  })

  it('computes a percentage', () => {
    expect(calcDiscount(179000, { type: 'percent', value: 10 })).toBe(17900)
  })

  it('never discounts more than the subtotal', () => {
    expect(calcDiscount(50000, { type: 'amount', value: 90000 })).toBe(50000)
    expect(calcDiscount(50000, { type: 'percent', value: 150 })).toBe(50000)
  })

  it('ignores negative or invalid values', () => {
    expect(calcDiscount(50000, { type: 'amount', value: -1000 })).toBe(0)
    expect(calcDiscount(50000, { type: 'percent', value: Number.NaN })).toBe(0)
  })
})

describe('calcTotals', () => {
  it('returns zeros for an empty order', () => {
    expect(calcTotals([], { type: 'amount', value: 0 }, 0.08)).toEqual({
      subtotal: 0,
      discountAmount: 0,
      tax: 0,
      total: 0,
    })
  })

  it('adds 8% VAT after a fixed discount', () => {
    const items = [
      { unitPrice: 129000, qty: 1 },
      { unitPrice: 25000, qty: 2 },
    ]

    expect(calcTotals(items, { type: 'amount', value: 20000 }, 0.08)).toEqual({
      subtotal: 179000,
      discountAmount: 20000,
      tax: 12720,
      total: 171720,
    })
  })

  it('adds VAT after a percentage discount', () => {
    const items = [{ unitPrice: 179000, qty: 1 }]

    expect(calcTotals(items, { type: 'percent', value: 10 }, 0.08)).toEqual({
      subtotal: 179000,
      discountAmount: 17900,
      tax: 12888,
      total: 173988,
    })
  })

  it('never lets the total go negative when the discount exceeds the subtotal', () => {
    const items = [{ unitPrice: 30000, qty: 1 }]

    expect(calcTotals(items, { type: 'amount', value: 99000 }, 0.08)).toEqual({
      subtotal: 30000,
      discountAmount: 30000,
      tax: 0,
      total: 0,
    })
  })

  it('ignores non-positive quantities', () => {
    const items = [
      { unitPrice: 50000, qty: 0 },
      { unitPrice: 20000, qty: -2 },
      { unitPrice: 30000, qty: 1 },
    ]

    expect(calcTotals(items, { type: 'amount', value: 0 }, 0.08).subtotal).toBe(
      30000,
    )
  })
})
