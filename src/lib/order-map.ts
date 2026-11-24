import type { ServerOrder } from '../api/types'
import type { OrderRecord, PaymentMethod, ServerPaymentMethod } from '../types'

const METHOD_FROM_SERVER: Record<ServerPaymentMethod, PaymentMethod> = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  CARD: 'card',
}

/** Converts a server order into the device's order record (already synced). */
export function orderFromServer(order: ServerOrder): OrderRecord {
  const method: PaymentMethod = order.payment
    ? METHOD_FROM_SERVER[order.payment.method]
    : 'cash'

  const record: OrderRecord = {
    id: order.clientId ?? order.id,
    code: order.code,
    tableId: order.tableId,
    tableName: order.tableName,
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId ?? '',
      name: item.name,
      unitPrice: item.unitPrice,
      qty: item.qty,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    tax: order.tax,
    total: order.total,
    method,
    note: order.note ?? '',
    createdAt: new Date(order.createdAt).getTime(),
    cashier: order.cashierName,
    clientId: order.clientId ?? undefined,
    serverId: order.id,
    syncState: 'synced',
    provisionalCode: false,
    status: order.status === 'VOIDED' ? 'cancelled' : 'completed',
    voided: order.status === 'VOIDED',
    ...(order.voidReason ? { voidReason: order.voidReason } : {}),
  }

  if (method === 'cash' && order.payment?.received != null) {
    record.received = order.payment.received
    record.change = order.payment.change ?? 0
  }

  return record
}
