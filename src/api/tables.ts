import { request } from './http'
import type { ServerTable } from './types'

/** Loads the restaurant's tables. */
export function getTables(): Promise<ServerTable[]> {
  return request('/tables')
}
