import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiError } from '../api/http'
import { getMenu } from '../api/menu'
import {
  createTable as createTableOnServer,
  deleteTable as deleteTableOnServer,
  getTables,
} from '../api/tables'
import { CATEGORIES, MENU_ITEMS, TABLES } from '../data/catalog-seed'
import { mapMenuItems, mapTables } from '../lib/catalog-map'
import { makeId } from '../lib/id'
import type {
  Category,
  CreateTablePayload,
  MenuItem,
  TableFormInput,
  TableOp,
  TableOption,
} from '../types'

export type CatalogSource = 'builtin' | 'cache' | 'api'

type CreateTableResult =
  | { ok: true; tableId: string }
  | { ok: false; reason: 'DUPLICATE_NAME' | 'INVALID' }

type DeleteTableResult = { ok: boolean; reason?: 'OPEN_ORDER' | 'NOT_FOUND' }

interface CatalogState {
  items: MenuItem[]
  tables: TableOption[]
  categories: Category[]
  fetchedAt: number | null
  source: CatalogSource
  loading: boolean
  error: string | null
  pendingTableOps: TableOp[]
  refresh: () => Promise<void>
  getItemByLegacyId: (id: string) => MenuItem | undefined
  getTableByLegacyId: (id: string) => TableOption | undefined
  createTable: (input: TableFormInput) => CreateTableResult
  deleteTable: (
    tableId: string,
    blockedByOpenOrder?: boolean,
  ) => DeleteTableResult
  flushTableOps: () => Promise<void>
}

const STORAGE_KEY = 'restodash-catalog-v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isServerId(value: string | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Offline transport failures keep their op for a later retry. */
function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.isOffline
}

function catalogErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Không tải được dữ liệu'
}

// Builtin tables have no server UUID until a successful sync assigns one.
const BUILTIN_TABLES: TableOption[] = TABLES.map((table) => ({ ...table }))

/** Shared by every caller so the queue is drained at most once at a time. */
let tableOpsInFlight: Promise<void> | null = null

/**
 * Catalogue of menu items and tables. Starts from the built-in seed mirror so
 * the POS works before the first fetch, then switches to the server response
 * (`source: 'api'`) or a previously cached copy (`source: 'cache'`).
 */
export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => {
      async function drainTableOps(): Promise<void> {
        const ops = [...get().pendingTableOps]
        for (const op of ops) {
          // The op may have been removed locally (e.g. a pending table was
          // deleted) while an earlier op was awaiting the network.
          if (!get().pendingTableOps.some((pending) => pending.id === op.id)) {
            continue
          }

          if (op.kind === 'CREATE_TABLE') {
            try {
              const created = await createTableOnServer(op.payload)
              set((state) => ({
                tables: state.tables.map((table) =>
                  table.id === op.tableId
                    ? {
                        ...table,
                        serverId: created.id,
                        name: created.name,
                        seats: created.seats,
                        zone: created.zone ?? null,
                        syncState: 'synced',
                      }
                    : table,
                ),
                pendingTableOps: state.pendingTableOps.filter(
                  (pending) => pending.id !== op.id,
                ),
              }))
            } catch (error) {
              if (isRetryable(error)) return
              // Terminal HTTP error: drop the op but keep the local table,
              // still pending, so it is never lost on refresh.
              set((state) => ({
                pendingTableOps: state.pendingTableOps.filter(
                  (pending) => pending.id !== op.id,
                ),
              }))
            }
            continue
          }

          try {
            await deleteTableOnServer(op.serverId)
          } catch (error) {
            if (isRetryable(error)) return
            // 404 (already gone) and other terminal errors need no retry.
          }
          set((state) => ({
            pendingTableOps: state.pendingTableOps.filter(
              (pending) => pending.id !== op.id,
            ),
          }))
        }
      }

      return {
        items: MENU_ITEMS,
        tables: BUILTIN_TABLES,
        categories: CATEGORIES,
        fetchedAt: null,
        source: 'builtin',
        loading: false,
        error: null,
        pendingTableOps: [],

        async refresh() {
          set({ loading: true, error: null })

          // Menu and tables are independent resources. A failing tables
          // endpoint must not prevent freshly added dishes from reaching POS.
          const [menuResult, tablesResult] = await Promise.allSettled([
            getMenu(),
            (async () => {
              await get().flushTableOps()
              return getTables()
            })(),
          ])

          const patch: Partial<CatalogState> = { loading: false }
          const errors: string[] = []

          if (menuResult.status === 'fulfilled') {
            patch.items = mapMenuItems(menuResult.value)
          } else {
            errors.push(catalogErrorMessage(menuResult.reason))
          }

          if (tablesResult.status === 'fulfilled') {
            const serverTables = tablesResult.value
            const pendingDeletes = new Set(
              get()
                .pendingTableOps.filter(
                  (op): op is Extract<TableOp, { kind: 'DELETE_TABLE' }> =>
                    op.kind === 'DELETE_TABLE',
                )
                .map((op) => op.serverId),
            )
            const syncedTables = mapTables(serverTables).filter(
              (table) => !table.serverId || !pendingDeletes.has(table.serverId),
            )
            const syncedIds = new Set(syncedTables.map((table) => table.id))
            const pendingTables = get().tables.filter(
              (table) =>
                table.syncState === 'pending' &&
                !table.serverId &&
                !syncedIds.has(table.id),
            )
            patch.tables = [...syncedTables, ...pendingTables]
          } else {
            errors.push(catalogErrorMessage(tablesResult.reason))
          }

          if (menuResult.status === 'fulfilled' || tablesResult.status === 'fulfilled') {
            patch.source = 'api'
            patch.fetchedAt = Date.now()
          }
          patch.error = errors[0] ?? null
          set(patch)
        },

        getItemByLegacyId(id) {
          return get().items.find((item) => item.id === id)
        },

        getTableByLegacyId(id) {
          return get().tables.find((table) => table.id === id)
        },

        createTable(input) {
          const name = input.name?.trim() ?? ''
          const zone = input.zone?.trim() || null
          if (
            name.length < 1 ||
            name.length > 50 ||
            !Number.isInteger(input.seats) ||
            input.seats < 1 ||
            input.seats > 50 ||
            (zone !== null && zone.length > 50)
          ) {
            return { ok: false, reason: 'INVALID' }
          }
          if (
            get().tables.some(
              (table) =>
                table.name.trim().toLowerCase() === name.toLowerCase(),
            )
          ) {
            return { ok: false, reason: 'DUPLICATE_NAME' }
          }

          const id = `ban-${makeId()}`
          const payload: CreateTablePayload = {
            legacyId: id,
            name,
            seats: input.seats,
            zone,
          }
          set((state) => ({
            tables: [
              ...state.tables,
              { id, name, seats: input.seats, zone, syncState: 'pending' },
            ],
            pendingTableOps: [
              ...state.pendingTableOps,
              {
                id: makeId(),
                kind: 'CREATE_TABLE',
                tableId: id,
                payload,
                createdAt: Date.now(),
              },
            ],
          }))
          return { ok: true, tableId: id }
        },

        deleteTable(tableId, blockedByOpenOrder = false) {
          // Callers own the open-order check; importing usePOSStore here would
          // create a catalog ↔ POS module cycle.
          if (blockedByOpenOrder) {
            return { ok: false, reason: 'OPEN_ORDER' }
          }
          const table = get().tables.find((item) => item.id === tableId)
          if (!table) return { ok: false, reason: 'NOT_FOUND' }

          set((state) => {
            const createOp = state.pendingTableOps.find(
              (op) => op.kind === 'CREATE_TABLE' && op.tableId === tableId,
            )
            const pendingTableOps = state.pendingTableOps.filter(
              (op) => op.id !== createOp?.id,
            )
            // A table that was never synced has nothing to delete on the
            // server; dropping its create op is enough.
            if (!createOp && table.serverId) {
              pendingTableOps.push({
                id: makeId(),
                kind: 'DELETE_TABLE',
                tableId,
                serverId: table.serverId,
                createdAt: Date.now(),
              })
            }
            return {
              tables: state.tables.filter((item) => item.id !== tableId),
              pendingTableOps,
            }
          })
          return { ok: true }
        },

        flushTableOps() {
          if (tableOpsInFlight) return tableOpsInFlight
          const run = drainTableOps().finally(() => {
            tableOpsInFlight = null
          })
          tableOpsInFlight = run
          return run
        },
      }
    },
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        tables: state.tables,
        categories: state.categories,
        fetchedAt: state.fetchedAt,
        source: state.source === 'api' ? ('cache' as const) : state.source,
        pendingTableOps: state.pendingTableOps,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.source !== 'builtin') state.source = 'cache'
        if (!Array.isArray(state.pendingTableOps)) state.pendingTableOps = []
        if (Array.isArray(state.tables)) {
          // Old caches stored fake ids like `ban-1` as if they were server
          // UUIDs; sending those as `tableId` would be rejected by the API.
          state.tables = state.tables.map((table) =>
            table?.serverId && !isServerId(table.serverId)
              ? { ...table, serverId: undefined }
              : table,
          )
        }
      },
    },
  ),
)
