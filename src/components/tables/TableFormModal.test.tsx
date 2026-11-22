import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerTable } from '../../api/types'
import { useCatalogStore } from '../../store/useCatalogStore'
import { ToastProvider } from '../ui/Toast'
import { TableFormModal } from './TableFormModal'

vi.mock('../../api/tables', () => ({
  getTables: vi.fn(),
  createTable: vi.fn(),
  deleteTable: vi.fn(),
}))

import * as tablesApi from '../../api/tables'

const createTableMock = vi.mocked(tablesApi.createTable)

function serverTable(overrides: Partial<ServerTable> = {}): ServerTable {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    legacyId: null,
    name: 'Bàn mới',
    seats: 4,
    zone: null,
    sortOrder: 0,
    ...overrides,
  }
}

function renderModal() {
  const onClose = vi.fn()
  render(
    <ToastProvider>
      <TableFormModal open onClose={onClose} />
    </ToastProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  createTableMock.mockImplementation(async (payload) =>
    serverTable({
      name: payload.name,
      seats: payload.seats,
      zone: payload.zone ?? null,
    }),
  )
  useCatalogStore.setState({
    tables: [],
    pendingTableOps: [],
    fetchedAt: null,
    source: 'builtin',
    loading: false,
    error: null,
  })
})

describe('TableFormModal', () => {
  it('creates a table with trimmed values', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()

    expect(screen.getByLabelText('Số chỗ')).toHaveValue(4)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Thêm bàn')

    await user.type(screen.getByLabelText('Tên bàn'), '  Bàn mới  ')
    const seatsInput = screen.getByLabelText('Số chỗ')
    await user.clear(seatsInput)
    await user.type(seatsInput, '6')
    await user.type(screen.getByLabelText('Khu vực'), '  Tầng 2  ')
    await user.click(screen.getByRole('button', { name: 'Lưu bàn' }))

    expect(await screen.findByText('Đã thêm bàn')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
    // Only the queue flush sends the create to the server, with trimmed values.
    await waitFor(() =>
      expect(createTableMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bàn mới',
          seats: 6,
          zone: 'Tầng 2',
        }),
      ),
    )
    await waitFor(() =>
      expect(useCatalogStore.getState().tables).toEqual([
        expect.objectContaining({
          name: 'Bàn mới',
          seats: 6,
          zone: 'Tầng 2',
          serverId: '11111111-1111-4111-8111-111111111111',
          syncState: 'synced',
        }),
      ]),
    )
  })

  it('shows an error for a blank name', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'Lưu bàn' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vui lòng nhập tên bàn',
    )
    expect(useCatalogStore.getState().tables).toEqual([])
  })

  it('shows an error for seats outside 1..50', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Tên bàn'), 'Bàn hợp lệ')
    const seatsInput = screen.getByLabelText('Số chỗ')
    await user.clear(seatsInput)
    await user.type(seatsInput, '51')
    await user.click(screen.getByRole('button', { name: 'Lưu bàn' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Số chỗ phải từ 1 đến 50',
    )
    expect(useCatalogStore.getState().tables).toEqual([])
  })

  it('shows an error for a duplicate name', async () => {
    const user = userEvent.setup()
    useCatalogStore.setState({
      tables: [{ id: 'ban-existing', name: 'Bàn A', seats: 2 }],
    })
    renderModal()

    await user.type(screen.getByLabelText('Tên bàn'), 'Bàn A')
    await user.click(screen.getByRole('button', { name: 'Lưu bàn' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên bàn đã tồn tại',
    )
    expect(useCatalogStore.getState().tables).toHaveLength(1)
  })

  it('keeps the modal open when validation fails', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()

    await user.click(screen.getByRole('button', { name: 'Lưu bàn' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên bàn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu bàn' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
