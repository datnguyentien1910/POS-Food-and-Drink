import { usePOSStore } from '../store/usePOSStore'
import { flush, resumeSync } from '../sync/worker'
import type { LocalOrder, PaymentMethod } from '../types'

export interface ChargeInput {
  method: PaymentMethod
  /** Cash tendered; only used for `cash`. */
  received?: number
  change?: number
  /** Local total handed to the server as a price guard (BE-3). */
  expectedTotal?: number
}

/**
 * Records a sale on the device and queues it for sync. Never waits for the
 * network: the caller shows the provisional receipt immediately.
 */
export function create(input: ChargeInput): LocalOrder | null {
  return usePOSStore.getState().completeOrder(input)
}

/**
 * Voids an order. Synced orders are sent to the server (permission checked
 * there too); unsynced ones are cancelled locally and never sent.
 */
export function cancel(order: LocalOrder, reason: string): void {
  if (order.serverId) {
    usePOSStore.getState().enqueueVoid(order.serverId, reason)
  } else {
    usePOSStore.getState().voidLocalOrder(order.id, reason)
  }
}

/** Manual "sync now" trigger used by the sync UI. */
export function requestSync(): void {
  resumeSync()
}

/** Fire-and-forget flush for callers that just completed a write. */
export function flushNow(): void {
  void flush()
}
