import type {
  CartLine,
  LocalOrder,
  OpenOrderSnapshot,
  TableState,
} from '../types'

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

/** Newest still-unpaid order for a table, ignoring the one being edited. */
export function pendingOrderForTable(
  history: LocalOrder[],
  tableId: string,
  editingPendingOrderId: string | null,
): LocalOrder | undefined {
  let newest: LocalOrder | undefined
  for (const order of history) {
    if (
      order.tableId !== tableId ||
      order.status !== 'pending_payment' ||
      order.id === editingPendingOrderId
    ) {
      continue
    }
    if (newest === undefined || order.createdAt > newest.createdAt) {
      newest = order
    }
  }
  return newest
}

/** Serving state for a table, falling back to its newest pending order. */
export function tableServingState(
  tableId: string,
  activeTableId: string | null,
  cart: CartLine[],
  openOrders: Record<string, OpenOrderSnapshot>,
  history: LocalOrder[],
  editingPendingOrderId: string | null,
): { state: TableState; itemCount: number } {
  let lines = tableLines(tableId, activeTableId, cart, openOrders)

  if (lines.length === 0) {
    const pending = pendingOrderForTable(
      history,
      tableId,
      editingPendingOrderId,
    )
    if (pending !== undefined) {
      lines = pending.items.map((item, index) => ({
        lineId: `${pending.id}:${index}`,
        menuItemId: item.menuItemId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        name: item.name,
        served: item.served ?? false,
      }))
    }
  }

  return {
    state: tableState(lines),
    itemCount: lines.reduce((total, line) => total + line.qty, 0),
  }
}
