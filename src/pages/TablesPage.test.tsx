import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../api/types'
import { ToastProvider } from '../components/ui/Toast'
import { useAuthStore } from '../store/useAuthStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { usePOSStore } from '../store/usePOSStore'
import type { CartLine, Discount, TableOption } from '../types'
import { TablesPage } from './TablesPage'

vi.mock('../api/tables', () => ({
  getTables: vi.fn(),
  createTable: vi.fn(),
  deleteTable: vi.fn(),
}))

const MANAGER: AuthUser = {
  id: 'u1',
  name: 'Ngọc Anh',
  email: 'manager@restodash.local',
  role: 'MANAGER',
  restaurantId: 'r1',
}
const CASHIER: AuthUser = { ...MANAGER, role: 'CASHIER' }
const DISCOUNT: Discount = { type: 'amount', value: 0 }

function table(overrides: Partial<TableOption> = {}): TableOption {
  return { id: 'ban-1', name: 'Bàn 1', seats: 4, zone: null, ...overrides }
}

function line(lineId: string, qty: number, served = false): CartLine {
  return {
    lineId,
    menuItemId: 'ga-nuong',
    name: 'Gà nướng',
    qty,
    unitPrice: 100000,
    served,
  }
}

function snapshot(cart: CartLine[]) {
  return { cart, discount: DISCOUNT, note: '', updatedAt: Date.now() }
}

/** Reset catalog + POS (including openOrders) and sign in as a manager. */
function resetStores() {
  useCatalogStore.setState({
    tables: [],
    pendingTableOps: [],
    fetchedAt: null,
    source: 'builtin',
    loading: false,
    error: null,
  })
  usePOSStore.setState({
    cart: [],
    tableId: null,
    openOrders: {},
    discount: { ...DISCOUNT },
    note: '',
    drafts: [],
    history: [],
    queue: [],
    storageError: false,
  })
  useAuthStore.setState({
    status: 'authenticated',
    user: MANAGER,
    authMethod: 'password',
    expiresAt: null,
    lastUser: null,
    lastOnlineAt: null,
    error: null,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tables']}>
      <ToastProvider>
        <Routes>
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/pos" element={<p>POS probe</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  resetStores()
})

describe('TablesPage', () => {
  it('shows empty, pending and served tables with labels', () => {
    useCatalogStore.setState({
      tables: [
        table({ id: 'ban-1', name: 'Bàn 1' }),
        table({ id: 'ban-3', name: 'Bàn 3' }),
        table({ id: 'ban-2', name: 'Bàn 2' }),
      ],
    })
    usePOSStore.setState({
      tableId: 'ban-2',
      cart: [],
      openOrders: {
        'ban-1': snapshot([line('l1', 2, true)]),
        'ban-3': snapshot([line('l2', 1, false)]),
      },
    })

    const { container } = renderPage()

    expect(screen.getByText('Trống')).toHaveClass('bg-negative-soft')
    expect(screen.getByText('Chưa phục vụ')).toHaveClass('bg-gold-soft')
    expect(screen.getByText('Đã phục vụ')).toHaveClass('bg-positive-soft')
    expect(screen.getByText('2 món')).toBeInTheDocument()
    expect(screen.getByText('1 món')).toBeInTheDocument()
    expect(container.querySelector('[data-state="empty"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="pending"]')).toBeInTheDocument()
    expect(container.querySelector('[data-state="served"]')).toBeInTheDocument()
  })

  it('groups tables by zone', () => {
    useCatalogStore.setState({
      tables: [
        table({ id: 'ban-a', name: 'Bàn A', zone: 'Tầng 1' }),
        table({ id: 'ban-b', name: 'Bàn B', zone: 'Tầng 2' }),
        table({ id: 'ban-c', name: 'Bàn C' }),
        table({ id: 'ban-d', name: 'Bàn D', zone: 'Tầng 1' }),
      ],
    })

    renderPage()

    const zone1 = screen.getByRole('heading', { name: 'Tầng 1' }).closest('section')
    expect(zone1).toHaveTextContent('Bàn A')
    expect(zone1).toHaveTextContent('Bàn D')
    expect(screen.getByRole('heading', { name: 'Tầng 2' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Khác' })).toBeInTheDocument()
  })

  it('opens POS with the clicked table', async () => {
    useCatalogStore.setState({ tables: [table({ id: 'ban-2', name: 'Bàn 2' })] })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 2 — Trống' }))

    expect(usePOSStore.getState().tableId).toBe('ban-2')
    expect(await screen.findByText('POS probe')).toBeInTheDocument()
  })

  it('hides add and delete actions from a cashier', () => {
    useAuthStore.setState({ user: CASHIER })
    useCatalogStore.setState({ tables: [table()] })

    renderPage()

    expect(screen.queryByRole('button', { name: 'Thêm bàn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xoá bàn/ })).not.toBeInTheDocument()
  })

  it('disables delete for a table with an open order', () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({ openOrders: { 'ban-1': snapshot([line('l1', 1)]) } })

    renderPage()

    const deleteButton = screen.getByRole('button', { name: 'Xoá bàn Bàn 1' })
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveAttribute('title', 'Bàn đang có đơn mở')
  })

  it('deletes an empty table after confirmation', async () => {
    useCatalogStore.setState({ tables: [table()] })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Xoá bàn Bàn 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xoá bàn?' })
    expect(dialog).toHaveTextContent('Bàn 1')

    await user.click(within(dialog).getByRole('button', { name: 'Xoá bàn' }))

    expect(useCatalogStore.getState().tables).toHaveLength(0)
    expect(await screen.findByText('Đã xoá bàn')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error toast when the table is already gone', async () => {
    useCatalogStore.setState({ tables: [table()] })
    vi.spyOn(useCatalogStore.getState(), 'deleteTable').mockReturnValue({
      ok: false,
      reason: 'NOT_FOUND',
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Xoá bàn Bàn 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xoá bàn?' })
    await user.click(within(dialog).getByRole('button', { name: 'Xoá bàn' }))

    expect(await screen.findByText('Không tìm thấy bàn')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the add-table modal', async () => {
    useCatalogStore.setState({ tables: [table()] })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Thêm bàn' }))

    const dialog = await screen.findByRole('dialog', { name: 'Thêm bàn' })
    expect(within(dialog).getByLabelText('Tên bàn')).toBeInTheDocument()
  })
})
