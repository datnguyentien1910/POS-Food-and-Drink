import type { CartLine, OpenOrderSnapshot, TableState } from '../types'

export const TAKEAWAY_KEY = '__takeaway__'

export function orderKey(tableId: string | null): string {
  return tableId ?? TAKEAWAY_KEY
}

export function tableState(cart: CartLine[]): TableState {
  if (cart.length === 0) return 'empty'
  return cart.some((line) => line.served !== true) ? 'pending' : 'served'
}

export function countUnserved(cart: CartLine[]): number {
  return cart.reduce(
    (total, line) => (line.served === true ? total : total + line.qty),
    0,
  )
}

export function tableLines(
  tableId: string,
  activeTableId: string | null,
  cart: CartLine[],
  openOrders: Record<string, OpenOrderSnapshot>,
): CartLine[] {
  return tableId === activeTableId ? cart : (openOrders[tableId]?.cart ?? [])
}
