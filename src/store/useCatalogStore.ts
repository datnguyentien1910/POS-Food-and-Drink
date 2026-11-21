import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiError } from '../api/http'
import { getMenu } from '../api/menu'
import { getTables } from '../api/tables'
import { CATEGORIES, MENU_ITEMS, TABLES } from '../data/catalog-seed'
import { mapMenuItems, mapTables } from '../lib/catalog-map'
import type { Category, MenuItem, TableOption } from '../types'

export type CatalogSource = 'builtin' | 'cache' | 'api'

interface CatalogState {
  items: MenuItem[]
  tables: TableOption[]
  categories: Category[]
  fetchedAt: number | null
  source: CatalogSource
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getItemByLegacyId: (id: string) => MenuItem | undefined
  getTableByLegacyId: (id: string) => TableOption | undefined
}

const STORAGE_KEY = 'restodash-catalog-v1'

const BUILTIN_TABLES: TableOption[] = TABLES.map((table) => ({
  ...table,
  serverId: table.serverId ?? table.id,
}))

/**
 * Catalogue of menu items and tables. Starts from the built-in seed mirror so
 * the POS works before the first fetch, then switches to the server response
 * (`source: 'api'`) or a previously cached copy (`source: 'cache'`).
 */
export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      items: MENU_ITEMS,
      tables: BUILTIN_TABLES,
      categories: CATEGORIES,
      fetchedAt: null,
      source: 'builtin',
      loading: false,
      error: null,

      async refresh() {
        set({ loading: true, error: null })
        try {
          const [menu, tables] = await Promise.all([getMenu(), getTables()])
          set({
            items: mapMenuItems(menu),
            tables: mapTables(tables),
            categories: CATEGORIES,
            fetchedAt: Date.now(),
            source: 'api',
            loading: false,
          })
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : 'Không tải được thực đơn'
          set({ loading: false, error: message })
        }
      },

      getItemByLegacyId(id) {
        return get().items.find((item) => item.id === id)
      },

      getTableByLegacyId(id) {
        return get().tables.find((table) => table.id === id)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        tables: state.tables,
        categories: state.categories,
        fetchedAt: state.fetchedAt,
        source: state.source === 'api' ? ('cache' as const) : state.source,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.source !== 'builtin') {
          state.source = 'cache'
        }
      },
    },
  ),
)
