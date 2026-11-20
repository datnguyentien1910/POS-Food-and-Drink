export { TABLES } from './catalog-seed'

import { resolveTable, resolveTableName } from '../lib/catalog-lookup'
import type { TableOption } from '../types'

/** Resolves a table from the live catalog with a built-in seed fallback. */
export function getTable(id: string | null): TableOption | undefined {
  return resolveTable(id)
}

export function tableName(id: string | null): string {
  return resolveTableName(id)
}
