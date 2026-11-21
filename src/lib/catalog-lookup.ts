import { MENU_ITEMS, TABLES } from '../data/catalog-seed'
import { useCatalogStore } from '../store/useCatalogStore'
import type { MenuItem, TableOption } from '../types'

/**
 * Reads a menu item from the live catalog (server data or cache), falling back
 * to the built-in seed when the catalog has not loaded yet.
 */
export function resolveMenuItem(id: string): MenuItem | undefined {
  return (
    useCatalogStore.getState().getItemByLegacyId(id) ??
    MENU_ITEMS.find((item) => item.id === id)
  )
}

export function resolveTable(id: string | null): TableOption | undefined {
  if (!id) return undefined
  return (
    useCatalogStore.getState().getTableByLegacyId(id) ??
    TABLES.find((table) => table.id === id)
  )
}

export function resolveTableName(id: string | null): string {
  return resolveTable(id)?.name ?? 'Mang đi'
}
