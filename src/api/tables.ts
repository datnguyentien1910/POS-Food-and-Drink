import { request } from './http'
import type { ServerTable } from './types'
import type { CreateTablePayload } from '../types'

/** Loads the restaurant's tables. */
export function getTables(): Promise<ServerTable[]> {
  return request('/tables')
}

/** Creates a table, keyed by its local `legacyId` for idempotent retries. */
export function createTable(input: CreateTablePayload): Promise<ServerTable> {
  return request('/tables', { method: 'POST', body: input })
}

/** Soft-deletes a table by its server id. */
export function deleteTable(id: string): Promise<void> {
  return request(`/tables/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
