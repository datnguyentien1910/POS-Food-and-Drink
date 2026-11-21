import { ApiError } from '../api/http'
import { createOrder, getOrder, listOrders, voidOrder } from '../api/orders'
import { orderFromServer } from '../lib/order-map'
import { useAuthStore } from '../store/useAuthStore'
import { usePOSStore } from '../store/usePOSStore'
import { useSyncStore } from '../store/useSyncStore'
import type { CreateOrderPayload, SyncError, SyncItem } from '../types'
import { classifyError, type SyncAction } from './errors'

/** How often the queue is re-checked while items are still waiting. */
const RETRY_INTERVAL_MS = 20_000

let running = false
let timer: ReturnType<typeof setTimeout> | null = null
let listenersAttached = false

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function toSyncError(error: unknown): SyncError {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, status: error.status }
  }
  return { code: 'UNKNOWN', message: 'Không gửi được đơn' }
}

function scheduleFlush(delay: number, replace = false): void {
  if (timer !== null) {
    if (!replace) return
    clearTimeout(timer)
  }
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, Math.max(0, delay))
}

/** Schedules the next automatic pass when the queue still has pending items. */
function scheduleIfPending(): void {
  const { queue } = usePOSStore.getState()
  if (!queue.some((item) => item.state === 'pending')) return
  if (!isOnline()) return
  if (useSyncStore.getState().paused) return
  scheduleFlush(RETRY_INTERVAL_MS)
}

/**
 * Sends one queue item. Returns `'continue'` when the next item can be tried
 * immediately, `'stop'` when the whole queue should wait (network/5xx) and
 * `'pause'` when the session expired.
 */
async function send(item: SyncItem): Promise<'continue' | 'stop' | 'pause'> {
  const store = usePOSStore.getState()
  store.markItemInflight(item.id)

  try {
    if (item.kind === 'CREATE_ORDER') {
      const payload = item.payload as CreateOrderPayload
      const serverOrder = await createOrder(payload, item.idempotencyKey)
      usePOSStore
        .getState()
        .applyServerOrder(payload.clientId, orderFromServer(serverOrder))
    } else {
      const payload = item.payload as { orderId: string; reason: string }
      await voidOrder(payload.orderId, payload.reason)
      usePOSStore.getState().markVoided(payload.orderId)
    }
    return 'continue'
  } catch (error) {
    return handleFailure(item, error)
  }
}

function handleFailure(
  item: SyncItem,
  error: unknown,
): 'continue' | 'stop' | 'pause' {
  const action: SyncAction = classifyError(error)
  const info = toSyncError(error)
  const store = usePOSStore.getState()

  switch (action) {
    case 'success':
      if (item.kind === 'VOID_ORDER') {
        const payload = item.payload as { orderId: string }
        store.markVoided(payload.orderId)
      } else {
        store.dropQueueItem(item.id)
      }
      return 'continue'

    case 'pause':
      store.setItemState(item.id, 'pending')
      useSyncStore.getState().setPaused(true)
      useSyncStore.getState().setLastError('Phiên đăng nhập đã hết hạn')
      return 'pause'

    case 'dead':
      store.setItemState(item.id, 'failed', info)
      return 'continue'

    case 'conflict':
      store.setItemState(item.id, 'conflict', info)
      return 'continue'

    case 'retry':
    default: {
      store.setItemBackoff(item.id, item.attempts + 1, info)
      const updated = usePOSStore
        .getState()
        .queue.find((entry) => entry.id === item.id)
      const delay = updated
        ? Math.max(0, updated.nextAttemptAt - Date.now())
        : RETRY_INTERVAL_MS
      scheduleFlush(delay, true)
      return 'stop'
    }
  }
}

/** Drains the queue FIFO until it is empty, blocked, or paused. */
async function drain(): Promise<void> {
  for (;;) {
    const item = usePOSStore
      .getState()
      .queue.find((entry) => entry.state === 'pending')
    if (!item) return

    if (item.nextAttemptAt > Date.now()) {
      scheduleFlush(item.nextAttemptAt - Date.now())
      return
    }

    const outcome = await send(item)
    if (outcome !== 'continue') return
  }
}

/**
 * Pushes every due queue item to the server. Fire-and-forget from the UI; a
 * single-flight flag keeps concurrent triggers from double-sending.
 */
export async function flush(): Promise<void> {
  if (running) return
  if (!isOnline()) {
    useSyncStore.getState().setOnline(false)
    return
  }
  if (!useAuthStore.getState().user) return
  if (useSyncStore.getState().paused) return

  running = true
  useSyncStore.getState().setOnline(true)
  useSyncStore.getState().setSyncing(true)

  try {
    await drain()
  } finally {
    running = false
    useSyncStore.getState().setSyncing(false)
    scheduleIfPending()
  }
}

/**
 * Clears a session-expiry pause and retries. Called after the operator signs
 * back in, or from the "Đồng bộ ngay" button.
 */
export function resumeSync(): void {
  useSyncStore.getState().setPaused(false)
  useSyncStore.getState().setLastError(null)
  void flush()
}

/**
 * Reconciles items left `inflight` by a crash: any order the server already
 * accepted is applied locally; anything unknown is queued again. Retries reuse
 * the original `idempotencyKey`, so a resend never creates a duplicate.
 */
export async function recover(): Promise<void> {
  const inflight = usePOSStore
    .getState()
    .queue.filter((item) => item.state === 'inflight')
  if (inflight.length === 0) return

  if (!isOnline() || !useAuthStore.getState().user) {
    for (const item of inflight) {
      usePOSStore.getState().setItemState(item.id, 'pending')
    }
    return
  }

  for (const item of inflight) {
    try {
      if (item.kind === 'CREATE_ORDER') {
        const found = await listOrders({ clientId: item.id, limit: 1 })
        if (found.length > 0) {
          usePOSStore
            .getState()
            .applyServerOrder(item.id, orderFromServer(found[0]))
          continue
        }
      } else {
        const payload = item.payload as { orderId: string }
        try {
          const server = await getOrder(payload.orderId)
          if (server.status === 'VOIDED') {
            usePOSStore.getState().markVoided(payload.orderId)
            continue
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            usePOSStore.getState().markVoided(payload.orderId)
            continue
          }
          throw error
        }
      }
      usePOSStore.getState().setItemState(item.id, 'pending')
    } catch {
      // Cannot verify right now: resend later with the same key.
      usePOSStore.getState().setItemState(item.id, 'pending')
    }
  }
}

/**
 * Installs connectivity listeners, reconciles a possibly-interrupted send and
 * performs the first flush. Safe to call once per app mount.
 */
export function startSync(): void {
  if (typeof window !== 'undefined' && !listenersAttached) {
    listenersAttached = true
    window.addEventListener('online', () => {
      useSyncStore.getState().setOnline(true)
      resumeSync()
    })
    window.addEventListener('offline', () => {
      useSyncStore.getState().setOnline(false)
    })
  }

  void recover().finally(() => {
    void flush()
  })
}
