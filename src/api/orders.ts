import { request } from './http'
import type { CreateOrderPayload } from '../types'
import type { ServerOrder } from './types'

export interface ListOrdersQuery {
  clientId?: string
  from?: string
  to?: string
  status?: string
  tableId?: string
  q?: string
  page?: number
  limit?: number
}

function toQueryString(query: ListOrdersQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Creates an order. `Idempotency-Key` is the order's `clientId`, so retries of
 * the same sale never produce a duplicate.
 */
export function createOrder(
  payload: CreateOrderPayload,
  idempotencyKey: string,
): Promise<ServerOrder> {
  return request('/orders', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export function listOrders(query: ListOrdersQuery = {}): Promise<ServerOrder[]> {
  return request(`/orders${toQueryString(query)}`)
}

export function getOrder(id: string): Promise<ServerOrder> {
  return request(`/orders/${id}`)
}

export function voidOrder(id: string, reason: string): Promise<ServerOrder> {
  return request(`/orders/${id}/void`, {
    method: 'POST',
    body: { reason },
  })
}
