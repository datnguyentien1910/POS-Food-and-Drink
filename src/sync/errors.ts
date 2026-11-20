import { ApiError } from '../api/http'

/** What the sync worker should do with a queue item after a failure. */
export type SyncAction = 'success' | 'retry' | 'pause' | 'dead' | 'conflict'

export function classifyError(error: unknown): SyncAction {
  if (!(error instanceof ApiError)) return 'retry'

  // Unreachable server or server-side fault: keep retrying with backoff.
  if (error.isOffline || error.status >= 500) return 'retry'

  if (error.status === 401) return 'pause'
  if (error.status === 403) return 'dead'

  if (error.status === 409) {
    if (error.code === 'PRICE_CHANGED') return 'conflict'
    if (error.code === 'ORDER_ALREADY_VOIDED') return 'success'
    return 'dead'
  }

  if (error.status >= 400) return 'dead'
  return 'retry'
}
