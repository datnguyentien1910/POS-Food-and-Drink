import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http'
import type { ServerTable } from '../api/types'
import type { TableOp, TableOption } from '../types'
import { useCatalogStore } from './useCatalogStore'

vi.mock('../api/tables', () => ({
  getTables: vi.fn(),
  createTable: vi.fn(),
  deleteTable: vi.fn(),
}))
vi.mock('../api/menu', () => ({ getMenu: vi.fn() }))

import * as menuApi from '../api/menu'
import * as tablesApi from '../api/tables'

const getMenuMock = vi.mocked(menuApi.getMenu)
const getTablesMock = vi.mocked(tablesApi.getTables)
const createTableMock = vi.mocked(tablesApi.createTable)
const deleteTableMock = vi.mocked(tablesApi.deleteTable)

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_C = '33333333-3333-4333-8333-333333333333'
const STORAGE_KEY = 'restodash-catalog-v1'

function serverTable(overrides: Partial<ServerTable> = {}): ServerTable {
  return {
    id: UUID_A,
    legacyId: null,
    name: 'Bàn 01',
    seats: 2,
    zone: null,
    sortOrder: 0,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function deleteOp(serverId: string, tableId = `ban-${serverId}`): TableOp {
  return {
    id: `op-${serverId}`,
    kind: 'DELETE_TABLE',
    tableId,
    serverId,
    createdAt: 1,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  getMenuMock.mockResolvedValue([])
  getTablesMock.mockResolvedValue([])
  useCatalogStore.setState({
    tables: [],
    pendingTableOps: [],
    fetchedAt: null,
    source: 'builtin',
    loading: false,
    error: null,
  })
})

describe('useCatalogStore table operations', () => {
  it('adds a pending table locally and enqueues a create', () => {
    const result = useCatalogStore.getState().createTable({
      name: '  Bàn mới  ',
      seats: 4,
      zone: '  Tầng 2 ',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tableId).toMatch(/^ban-.+/)
    expect(result.tableId.length).toBeGreaterThan(4)

    const { tables, pendingTableOps } = useCatalogStore.getState()
    expect(tables).toHaveLength(1)
    expect(tables[0]).toEqual({
      id: result.tableId,
      name: 'Bàn mới',
      seats: 4,
      zone: 'Tầng 2',
      syncState: 'pending',
    })
    expect(tables[0].serverId).toBeUndefined()
    expect(pendingTableOps).toHaveLength(1)
    expect(pendingTableOps[0]).toMatchObject({
      kind: 'CREATE_TABLE',
      tableId: result.tableId,
      payload: {
        legacyId: result.tableId,
        name: 'Bàn mới',
        seats: 4,
        zone: 'Tầng 2',
      },
    })
    expect(pendingTableOps[0].createdAt).toBeGreaterThan(0)
    // Creating must not call the API directly; the caller flushes the queue.
    expect(createTableMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate names case-insensitively', () => {
    useCatalogStore.setState({
      tables: [{ id: 'ban-old', name: 'Bàn A', seats: 2 }],
    })

    expect(
      useCatalogStore.getState().createTable({ name: ' bàn a ', seats: 4 }),
    ).toEqual({ ok: false, reason: 'DUPLICATE_NAME' })
    expect(useCatalogStore.getState().createTable({ name: 'BÀN A', seats: 4 }))
      .toEqual({ ok: false, reason: 'DUPLICATE_NAME' })

    expect(useCatalogStore.getState().tables).toHaveLength(1)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })

  it('rejects invalid seats and blank names', () => {
    const invalid = [
      { name: '   ', seats: 2 },
      { name: '', seats: 2 },
      { name: 'x'.repeat(51), seats: 2 },
      { name: 'Bàn', seats: 0 },
      { name: 'Bàn', seats: 51 },
      { name: 'Bàn', seats: 2.5 },
      { name: 'Bàn', seats: Number.NaN },
      { name: 'Bàn', seats: 2, zone: 'z'.repeat(51) },
    ]

    for (const input of invalid) {
      expect(useCatalogStore.getState().createTable(input)).toEqual({
        ok: false,
        reason: 'INVALID',
      })
    }

    expect(useCatalogStore.getState().tables).toEqual([])
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })

  it('deleting a pending table removes it and the create op', () => {
    const created = useCatalogStore.getState().createTable({
      name: 'Bàn mới',
      seats: 2,
    })
    if (!created.ok) throw new Error('create failed')

    expect(useCatalogStore.getState().deleteTable(created.tableId)).toEqual({
      ok: true,
    })

    expect(useCatalogStore.getState().tables).toEqual([])
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
    expect(deleteTableMock).not.toHaveBeenCalled()
  })

  it('deleting a synced table enqueues a delete', () => {
    useCatalogStore.setState({
      tables: [
        {
          id: 'ban-5',
          name: 'Bàn 05',
          seats: 2,
          serverId: UUID_A,
          syncState: 'synced',
        },
      ],
    })

    expect(useCatalogStore.getState().deleteTable('ban-5')).toEqual({ ok: true })

    expect(useCatalogStore.getState().tables).toEqual([])
    expect(useCatalogStore.getState().pendingTableOps).toEqual([
      {
        id: expect.any(String),
        kind: 'DELETE_TABLE',
        tableId: 'ban-5',
        serverId: UUID_A,
        createdAt: expect.any(Number),
      },
    ])
    // Delete is queued, not sent immediately.
    expect(deleteTableMock).not.toHaveBeenCalled()
  })

  it('rejects deleting a table with an open order', () => {
    const table: TableOption = {
      id: 'ban-5',
      name: 'Bàn 05',
      seats: 2,
      serverId: UUID_A,
      syncState: 'synced',
    }
    useCatalogStore.setState({ tables: [table] })

    expect(useCatalogStore.getState().deleteTable('ban-5', true)).toEqual({
      ok: false,
      reason: 'OPEN_ORDER',
    })
    expect(useCatalogStore.getState().tables).toEqual([table])
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])

    // Unknown ids are reported separately and never queue anything.
    expect(useCatalogStore.getState().deleteTable('ban-missing')).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    })
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })

  it('flush creates the table on the server and stores its id', async () => {
    const created = useCatalogStore.getState().createTable({
      name: 'Bàn mới',
      seats: 4,
      zone: 'Tầng 2',
    })
    if (!created.ok) throw new Error('create failed')
    createTableMock.mockResolvedValue(
      serverTable({
        id: UUID_A,
        legacyId: created.tableId,
        name: 'Bàn mới',
        seats: 4,
        zone: 'Tầng 2',
      }),
    )

    await useCatalogStore.getState().flushTableOps()

    expect(createTableMock).toHaveBeenCalledTimes(1)
    expect(createTableMock).toHaveBeenCalledWith({
      legacyId: created.tableId,
      name: 'Bàn mới',
      seats: 4,
      zone: 'Tầng 2',
    })
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
    expect(useCatalogStore.getState().tables).toEqual([
      {
        id: created.tableId,
        name: 'Bàn mới',
        seats: 4,
        zone: 'Tầng 2',
        serverId: UUID_A,
        syncState: 'synced',
      },
    ])
  })

  it('flush stops on network errors and keeps the queue', async () => {
    useCatalogStore.getState().createTable({ name: 'Bàn A', seats: 2 })
    useCatalogStore.getState().createTable({ name: 'Bàn B', seats: 2 })
    createTableMock.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ'),
    )

    await useCatalogStore.getState().flushTableOps()

    expect(createTableMock).toHaveBeenCalledTimes(1)
    const { tables, pendingTableOps } = useCatalogStore.getState()
    expect(pendingTableOps.map((op) => op.kind)).toEqual([
      'CREATE_TABLE',
      'CREATE_TABLE',
    ])
    expect(tables).toHaveLength(2)
    expect(tables.every((t) => t.syncState === 'pending' && !t.serverId)).toBe(
      true,
    )
  })

  it('flush drops a terminal create error', async () => {
    useCatalogStore.getState().createTable({ name: 'Bàn A', seats: 2 })
    useCatalogStore.getState().createTable({ name: 'Bàn B', seats: 2 })
    const firstId = useCatalogStore.getState().tables[0].id
    const secondId = useCatalogStore.getState().tables[1].id
    createTableMock
      .mockRejectedValueOnce(
        new ApiError(409, 'TABLE_NAME_TAKEN', 'Tên bàn đã tồn tại'),
      )
      .mockResolvedValueOnce(
        serverTable({
          id: UUID_B,
          legacyId: secondId,
          name: 'Bàn B',
        }),
      )

    await useCatalogStore.getState().flushTableOps()

    expect(createTableMock).toHaveBeenCalledTimes(2)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
    const tables = useCatalogStore.getState().tables
    expect(tables[0]).toMatchObject({ id: firstId, syncState: 'pending' })
    expect(tables[0].serverId).toBeUndefined()
    expect(tables[1]).toMatchObject({
      id: secondId,
      serverId: UUID_B,
      syncState: 'synced',
    })
  })

  it('flush removes a delete op on success and on 404', async () => {
    useCatalogStore.setState({
      pendingTableOps: [deleteOp(UUID_A, 'ban-1'), deleteOp(UUID_B, 'ban-2')],
    })
    deleteTableMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiError(404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn'),
      )

    await useCatalogStore.getState().flushTableOps()

    expect(deleteTableMock).toHaveBeenCalledTimes(2)
    expect(deleteTableMock).toHaveBeenNthCalledWith(1, UUID_A)
    expect(deleteTableMock).toHaveBeenNthCalledWith(2, UUID_B)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })

  it('refresh keeps pending local tables and hides pending deletes', async () => {
    const create = useCatalogStore.getState().createTable({
      name: 'Bàn mới',
      seats: 4,
    })
    if (!create.ok) throw new Error('create failed')
    const pendingLocal: TableOption = {
      id: 'ban-pending',
      name: 'Bàn chờ',
      seats: 2,
      syncState: 'pending',
    }
    useCatalogStore.setState({
      tables: [...useCatalogStore.getState().tables, pendingLocal],
      pendingTableOps: [
        ...useCatalogStore.getState().pendingTableOps,
        deleteOp(UUID_B, 'ban-deleted'),
      ],
    })
    createTableMock.mockResolvedValue(
      serverTable({
        id: UUID_C,
        legacyId: create.tableId,
        name: 'Bàn mới',
        seats: 4,
      }),
    )
    deleteTableMock.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ'),
    )
    getTablesMock.mockResolvedValue([
      serverTable({
        id: UUID_C,
        legacyId: create.tableId,
        name: 'Bàn mới',
        seats: 4,
      }),
      serverTable({
        id: UUID_A,
        legacyId: 'ban-synced',
        name: 'Bàn đã sync',
        seats: 2,
      }),
      serverTable({
        id: UUID_B,
        legacyId: 'ban-deleted',
        name: 'Bàn đã xoá',
        seats: 6,
      }),
    ])

    await useCatalogStore.getState().refresh()

    expect(createTableMock).toHaveBeenCalledTimes(1)
    expect(deleteTableMock).toHaveBeenCalledTimes(1)
    // flushTableOps ran before GET — the create was already consumed.
    expect(createTableMock.mock.invocationCallOrder[0]).toBeLessThan(
      getTablesMock.mock.invocationCallOrder[0],
    )
    const { tables, source, error, pendingTableOps } = useCatalogStore.getState()
    expect(error).toBeNull()
    expect(source).toBe('api')
    // The delete is still queued (network error) so its server row stays hidden.
    expect(pendingTableOps.map((op) => op.kind)).toEqual(['DELETE_TABLE'])
    expect(tables.map((t) => t.id).sort()).toEqual(['ban-pending', 'ban-synced', create.tableId].sort())
    expect(tables.find((t) => t.id === 'ban-synced')).toMatchObject({
      serverId: UUID_A,
      syncState: 'synced',
    })
    expect(tables.find((t) => t.id === create.tableId)).toMatchObject({
      serverId: UUID_C,
      syncState: 'synced',
    })
    expect(tables.find((t) => t.id === 'ban-pending')).toMatchObject({
      syncState: 'pending',
    })
    expect(tables.find((t) => t.id === 'ban-pending')?.serverId).toBeUndefined()
  })

  it('refresh keeps newly loaded menu items when the tables request fails', async () => {
    getMenuMock.mockResolvedValue([
      {
        id: 'cat-drinks',
        name: 'drinks',
        sortOrder: 0,
        items: [
          {
            id: 'item-matcha',
            categoryId: 'cat-drinks',
            legacyId: null,
            name: 'Matcha latte',
            description: null,
            price: 32000,
            imageKey: null,
            imageUrl: null,
            available: true,
            popular: false,
            sortOrder: 0,
          },
        ],
      },
    ])
    getTablesMock.mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Đã xảy ra lỗi hệ thống'),
    )

    await useCatalogStore.getState().refresh()

    const { items, tables, source, error, loading } = useCatalogStore.getState()
    expect(items.map((item) => item.name)).toEqual(['Matcha latte'])
    expect(tables).toEqual([])
    expect(source).toBe('api')
    expect(loading).toBe(false)
    expect(error).toBeTruthy()
  })

  it('strips invalid legacy server ids when rehydrating', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          source: 'api',
          tables: [
            {
              id: 'ban-1',
              name: 'Bàn 01',
              seats: 2,
              serverId: 'ban-1',
              syncState: 'synced',
            },
            {
              id: 'ban-2',
              name: 'Bàn 02',
              seats: 2,
              serverId: UUID_A,
              syncState: 'synced',
            },
          ],
          pendingTableOps: [],
        },
        version: 0,
      }),
    )

    await useCatalogStore.persist.rehydrate()

    const { tables, source } = useCatalogStore.getState()
    expect(source).toBe('cache')
    expect(tables).toHaveLength(2)
    expect(tables[0].serverId).toBeUndefined()
    expect(tables[0].name).toBe('Bàn 01')
    expect(tables[1].serverId).toBe(UUID_A)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })

  it('never runs two flushes concurrently', async () => {
    const created = useCatalogStore.getState().createTable({
      name: 'Bàn A',
      seats: 2,
    })
    if (!created.ok) throw new Error('create failed')
    const gate = deferred<ServerTable>()
    createTableMock.mockReturnValue(gate.promise)

    const first = useCatalogStore.getState().flushTableOps()
    const second = useCatalogStore.getState().flushTableOps()
    expect(createTableMock).toHaveBeenCalledTimes(1)

    gate.resolve(
      serverTable({ id: UUID_A, legacyId: created.tableId, name: 'Bàn A' }),
    )
    await Promise.all([first, second])
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])

    // Once the first flush settles, a new op can be flushed again.
    const next = useCatalogStore.getState().createTable({
      name: 'Bàn B',
      seats: 2,
    })
    if (!next.ok) throw new Error('create failed')
    createTableMock.mockResolvedValue(
      serverTable({ id: UUID_B, legacyId: next.tableId, name: 'Bàn B' }),
    )
    await useCatalogStore.getState().flushTableOps()
    expect(createTableMock).toHaveBeenCalledTimes(2)
    expect(useCatalogStore.getState().tables.every((t) => t.syncState === 'synced')).toBe(true)
  })

  it('flush stops on delete network errors and drops other HTTP errors', async () => {
    useCatalogStore.setState({
      pendingTableOps: [
        deleteOp(UUID_A, 'ban-1'),
        deleteOp(UUID_B, 'ban-2'),
        deleteOp(UUID_C, 'ban-3'),
      ],
    })
    deleteTableMock.mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ'),
    )

    await useCatalogStore.getState().flushTableOps()

    expect(deleteTableMock).toHaveBeenCalledTimes(1)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([
      deleteOp(UUID_A, 'ban-1'),
      deleteOp(UUID_B, 'ban-2'),
      deleteOp(UUID_C, 'ban-3'),
    ])

    // A later flush retries the failed op, drops the terminal 500 and moves
    // on to the remaining op.
    deleteTableMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(500, 'HTTP_ERROR', 'Lỗi 500'))
      .mockResolvedValueOnce(undefined)

    await useCatalogStore.getState().flushTableOps()

    expect(deleteTableMock).toHaveBeenCalledTimes(4)
    expect(deleteTableMock).toHaveBeenNthCalledWith(2, UUID_A)
    expect(deleteTableMock).toHaveBeenNthCalledWith(3, UUID_B)
    expect(deleteTableMock).toHaveBeenNthCalledWith(4, UUID_C)
    expect(useCatalogStore.getState().pendingTableOps).toEqual([])
  })
})
