import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../api/types'
import { ToastProvider } from '../components/ui/Toast'
import { useAuthStore } from '../store/useAuthStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { usePOSStore } from '../store/usePOSStore'
import type { CartLine, Discount, LocalOrder, TableOption } from '../types'
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

function pendingOrder(
  id: string,
  tableId: string | null,
  createdAt: number,
  items: Array<{ name: string; qty?: number; served?: boolean }> = [
    { name: 'Gà nướng' },
  ],
): LocalOrder {
  return {
    id,
    clientId: `client-${id}`,
    code: `ORD-${id}`,
    tableId,
    tableName: tableId === null ? 'Mang đi' : `Bàn ${tableId}`,
    items: items.map((item) => ({
      menuItemId: 'ga-nuong',
      name: item.name,
      unitPrice: 100000,
      qty: item.qty ?? 1,
      served: item.served ?? false,
    })),
    subtotal: 0,
    discountAmount: 0,
    tax: 0,
    total: 0,
    method: 'cash',
    note: '',
    createdAt,
    cashier: 'Thu ngân',
    status: 'pending_payment',
    syncState: 'synced',
    provisionalCode: false,
    cashierId: 'u1',
  }
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
    editingPendingOrderId: null,
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

  it('derives the serving label and item count from a pending order', () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({
      history: [
        pendingOrder('o-1', 'ban-1', 100, [
          { name: 'Gà nướng', qty: 2 },
          { name: 'Bò nướng', qty: 1, served: true },
        ]),
      ],
    })

    const { container } = renderPage()

    expect(screen.getByText('Chưa phục vụ')).toHaveClass('bg-gold-soft')
    expect(screen.getByText('3 món')).toBeInTheDocument()
    expect(container.querySelector('[data-state="pending"]')).toBeInTheDocument()
  })

  it('opens the shared order modal for a pending table without resuming it', async () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({
      history: [pendingOrder('o-1', 'ban-1', 100, [{ name: 'Bún chả' }])],
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 1 — Chưa phục vụ' }))

    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết đơn chờ' })
    expect(dialog).toHaveTextContent('Bún chả')
    expect(screen.queryByText('POS probe')).not.toBeInTheDocument()
    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().editingPendingOrderId).toBeNull()
  })

  it('opens the newest pending order for that table', async () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({
      history: [
        pendingOrder('new', 'ban-1', 300, [{ name: 'Bò nướng' }]),
        pendingOrder('old', 'ban-1', 100, [{ name: 'Gà nướng' }]),
      ],
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 1 — Chưa phục vụ' }))

    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết đơn chờ' })
    expect(dialog).toHaveTextContent('Bò nướng')
    expect(dialog).not.toHaveTextContent('Gà nướng')
  })

  it('returns to POS with the items when adding to a pending order', async () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({
      history: [pendingOrder('o-1', 'ban-1', 100, [{ name: 'Bún chả', qty: 2 }])],
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 1 — Chưa phục vụ' }))
    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết đơn chờ' })
    await user.click(within(dialog).getByRole('button', { name: 'Thêm món' }))

    expect(await screen.findByText('POS probe')).toBeInTheDocument()
    expect(usePOSStore.getState().editingPendingOrderId).toBe('o-1')
    expect(usePOSStore.getState().cart).toEqual([
      expect.objectContaining({ name: 'Bún chả', qty: 2 }),
    ])
  })

  it('keeps the existing switch flow for a table with a suspended cart', async () => {
    useCatalogStore.setState({
      tables: [table({ id: 'ban-1' }), table({ id: 'ban-2', name: 'Bàn 2' })],
    })
    usePOSStore.setState({
      tableId: 'ban-1',
      cart: [line('active', 1)],
      openOrders: { 'ban-2': snapshot([line('suspended', 2)]) },
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 2 — Chưa phục vụ' }))

    expect(await screen.findByText('POS probe')).toBeInTheDocument()
    expect(usePOSStore.getState().tableId).toBe('ban-2')
    expect(usePOSStore.getState().cart).toEqual([line('suspended', 2)])
    expect(usePOSStore.getState().openOrders['ban-1'].cart).toEqual([
      line('active', 1),
    ])
  })

  it('assigns an empty table without stashing the cart', async () => {
    useCatalogStore.setState({
      tables: [table({ id: 'ban-1' }), table({ id: 'ban-2', name: 'Bàn 2' })],
    })
    usePOSStore.setState({ tableId: 'ban-2', cart: [line('l1', 2)] })
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bàn 1 — Trống' }))

    expect(await screen.findByText('POS probe')).toBeInTheDocument()
    expect(usePOSStore.getState().tableId).toBe('ban-1')
    expect(usePOSStore.getState().cart).toEqual([line('l1', 2)])
    expect(usePOSStore.getState().openOrders).toEqual({})
  })

  it('treats the pending order being edited as an empty table', async () => {
    useCatalogStore.setState({ tables: [table()] })
    usePOSStore.setState({
      history: [pendingOrder('o-1', 'ban-1', 100)],
      editingPendingOrderId: 'o-1',
    })
    const user = userEvent.setup()

    renderPage()
    expect(screen.getByText('Trống')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bàn 1 — Trống' }))

    expect(await screen.findByText('POS probe')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Chi tiết đơn chờ' })).not.toBeInTheDocument()
    expect(usePOSStore.getState().tableId).toBe('ban-1')
  })
})
