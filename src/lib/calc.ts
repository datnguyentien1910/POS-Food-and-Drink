import type { Discount, Totals } from '../types'

interface PricedLine {
  unitPrice: number
  qty: number
}

export function calcDiscount(subtotal: number, discount: Discount): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0

  const raw =
    discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : discount.value

  if (!Number.isFinite(raw) || raw <= 0) return 0

  return Math.min(Math.round(raw), Math.round(subtotal))
}

export function calcTotals(
  lines: PricedLine[],
  discount: Discount,
  taxRate: number,
): Totals {
  const subtotal = lines.reduce((sum, line) => {
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) return sum
    if (!Number.isFinite(line.qty) || line.qty <= 0) return sum
    return sum + Math.round(line.unitPrice) * Math.floor(line.qty)
  }, 0)

  const discountAmount = calcDiscount(subtotal, discount)
  const taxable = Math.max(0, subtotal - discountAmount)
  const safeTaxRate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0
  const tax = Math.round(taxable * safeTaxRate)

  return {
    subtotal,
    discountAmount,
    tax,
    total: taxable + tax,
  }
}
