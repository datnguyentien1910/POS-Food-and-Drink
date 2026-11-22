import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/ui/Toast'
import { formatVND } from '../lib/format'
import { useAuthStore } from '../store/useAuthStore'
import { usePOSStore } from '../store/usePOSStore'
import type { LocalOrder } from '../types'
import { OrdersPage } from './OrdersPage'

const at = (daysAgo: number, hour = 12) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date.getTime()
}

const makeOrder = (
  code: string,
  createdAt: number,
  tableName = 'Bàn 05',
): LocalOrder => ({
  id: code,
  clientId: code,
  code,
  tableId: null,
  tableName,
  items: [
    {
      menuItemId: 'ga-nuong',
      name: 'Gà nướng',
      unitPrice: 109000,
      qty: 1,
    },
  ],
  subtotal: 109000,
  discountAmount: 0,
  tax: 8720,
  total: 117720,
  method: 'cash',
  received: 120000,
  change: 2280,
  note: '',
  createdAt,
  cashier: 'Thu ngân',
  status: 'completed',
  syncState: 'synced',
  provisionalCode: false,
  cashierId: 'u1',
})

const makePendingOrder = (
  code: string,
  tableName = 'Bàn 07',
  total = 235000,
): LocalOrder => ({
  ...makeOrder(code, at(0), tableName),
  status: 'pending_payment',
  total,
  received: undefined,
  change: undefined,
})

const resetStore = () => {
  localStorage.clear()
  usePOSStore.setState({
    cart: [],
    tableId: null,
    discount: { type: 'amount', value: 0 },
    note: '',
    drafts: [],
    history: [],
    queue: [],
    openOrders: {},
    editingPendingOrderId: null,
  })
}

const renderPage = (onOpenReceipt = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={['/orders']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/orders"
            element={<OrdersPage onOpenReceipt={onOpenReceipt} />}
          />
          <Route path="/pos" element={<p>POS probe</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('OrdersPage', () => {
  beforeEach(resetStore)

  it('shows an empty state when there is no history', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Đơn hàng' })).toBeInTheDocument()
    expect(screen.getByText('Chưa có đơn nào')).toBeInTheDocument()
  })

  it('lists paid orders newest first', () => {
    usePOSStore.setState({
      history: [
        makeOrder('HD-20261118-001', at(0, 9)),
        makeOrder('HD-20261118-003', at(0, 15)),
        makeOrder('HD-20261118-002', at(0, 12)),
      ],
    })

    renderPage()

    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveTextContent('HD-20261118-003')
    expect(cards[1]).toHaveTextContent('HD-20261118-002')
    expect(cards[2]).toHaveTextContent('HD-20261118-001')
  })

  it('filters to today by default and can show all orders', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({
      history: [
        makeOrder('HD-20261118-010', at(0)),
        makeOrder('HD-20261117-005', at(1)),
      ],
    })

    renderPage()

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('HD-20261118-010')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tất cả' }))

    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('searches by code and table name', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({
      history: [
        makeOrder('HD-20261118-001', at(0), 'Bàn 05'),
        makeOrder('HD-20261118-002', at(0), 'Bàn 09'),
      ],
    })

    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Tìm đơn hàng' })

    await user.type(search, '002')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('HD-20261118-002')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'ban 09')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('HD-20261118-002')).toBeInTheDocument()
  })

  it('opens the receipt for an order', async () => {
    const user = userEvent.setup()
    const onOpenReceipt = vi.fn()
    const order = makeOrder('HD-20261118-001', at(0))
    usePOSStore.setState({ history: [order] })

    renderPage(onOpenReceipt)
    await user.click(screen.getByRole('button', { name: /Xem hoá đơn/ }))

    expect(onOpenReceipt).toHaveBeenCalledWith(order)
  })

  it('shows a filtered empty state that can be reset', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({ history: [makeOrder('HD-20261118-001', at(0))] })

    renderPage()
    await user.type(
      screen.getByRole('searchbox', { name: 'Tìm đơn hàng' }),
      'khong-co',
    )

    expect(screen.getByText('Không tìm thấy đơn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xoá tìm kiếm' }))

    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(1)
  })

  it('shows a sync badge for a pending order', () => {
    usePOSStore.setState({
      history: [
        {
          ...makeOrder('OFF-ABCD1234', at(0)),
          clientId: 'client-1',
          syncState: 'pending',
          provisionalCode: true,
        },
      ],
    })

    renderPage()

    expect(screen.getByText('Chờ đồng bộ')).toBeInTheDocument()
    expect(screen.getByText('OFF-ABCD1234')).toBeInTheDocument()
  })

  it('lets a manager cancel an unsynced order', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: {
        id: 'u1',
        name: 'Ngọc Anh',
        email: 'manager@restodash.local',
        role: 'MANAGER',
        restaurantId: 'r1',
      },
    })
    usePOSStore.setState({ history: [makeOrder('OFF-ABCD1234', at(0))] })

    renderPage()

    await user.click(screen.getByRole('button', { name: 'Huỷ đơn OFF-ABCD1234' }))
    await user.click(screen.getByRole('button', { name: 'Huỷ đơn' }))

    expect(usePOSStore.getState().history[0].voided).toBe(true)
    useAuthStore.setState({ user: null })
  })

  it('hides the cancel button from cashiers', () => {
    useAuthStore.setState({
      user: {
        id: 'u2',
        name: 'Thu Hà',
        email: 'cashier@restodash.local',
        role: 'CASHIER',
        restaurantId: 'r1',
      },
    })
    usePOSStore.setState({ history: [makeOrder('HD-20261118-001', at(0))] })

    renderPage()

    expect(
      screen.queryByRole('button', { name: /^Huỷ đơn/ }),
    ).not.toBeInTheDocument()
    useAuthStore.setState({ user: null })
  })

  it('badges a pending order with gold "Chờ thanh toán"', () => {
    usePOSStore.setState({ history: [makePendingOrder('HD-PEND-001')] })

    renderPage()

    expect(screen.getByText('Chờ thanh toán')).toHaveClass(
      'bg-gold-soft',
      'text-brown',
    )
  })

  it('badges a cancelled order with negative "Đã huỷ"', () => {
    usePOSStore.setState({
      history: [
        { ...makeOrder('HD-CANCEL-001', at(0)), status: 'cancelled' },
      ],
    })

    renderPage()

    expect(screen.getByText('Đã huỷ')).toHaveClass(
      'bg-negative-soft',
      'text-negative',
    )
  })

  it('badges a completed order with positive "Thành công"', () => {
    usePOSStore.setState({ history: [makeOrder('HD-DONE-001', at(0))] })

    renderPage()

    expect(screen.getByText('Thành công')).toHaveClass(
      'bg-positive-soft',
      'text-positive',
    )
  })

  it('keeps sync details as secondary text instead of the main badge', () => {
    usePOSStore.setState({
      history: [
        {
          ...makePendingOrder('OFF-PENDING-001'),
          syncState: 'pending',
        },
      ],
    })

    renderPage()

    expect(screen.getByText('Chờ thanh toán')).toBeInTheDocument()
    expect(screen.getByText('Chờ đồng bộ')).toBeInTheDocument()
  })

  it('falls back to a completed badge for a legacy order without status', () => {
    const legacy = {
      ...makeOrder('OFF-LEGACY-001', at(0)),
      status: undefined,
      syncState: 'legacy',
    } as unknown as LocalOrder
    usePOSStore.setState({ history: [legacy] })

    renderPage()

    expect(screen.getByText('Thành công')).toHaveClass('bg-positive-soft')
    expect(screen.getByText('Chỉ trên máy')).toBeInTheDocument()
  })

  it('hides the order currently being edited from the list', () => {
    const editing = makePendingOrder('HD-EDIT-001')
    const other = makeOrder('HD-OTHER-001', at(0))
    usePOSStore.setState({
      history: [editing, other],
      editingPendingOrderId: editing.id,
    })

    renderPage()

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('HD-OTHER-001')).toBeInTheDocument()
    expect(screen.queryByText('HD-EDIT-001')).not.toBeInTheDocument()
  })

  it('opens the order modal for the chosen pending order', async () => {
    const user = userEvent.setup()
    const onOpenReceipt = vi.fn()
    const target = makePendingOrder('HD-PEND-002', 'Bàn 09', 345000)
    const other = makePendingOrder('HD-PEND-001', 'Bàn 03', 123000)
    usePOSStore.setState({ history: [target, other] })

    renderPage(onOpenReceipt)

    const targetCard = screen
      .getAllByRole('article')
      .find((card) => card.textContent?.includes(target.code))
    expect(targetCard).toBeDefined()
    await user.click(
      within(targetCard!).getByRole('button', { name: 'Thanh toán' }),
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Chi tiết đơn chờ')
    expect(dialog).toHaveTextContent('Bàn 09')
    expect(dialog).toHaveTextContent(formatVND(345000))

    await user.click(within(dialog).getByRole('button', { name: 'Thanh toán' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /Xem hoá đơn/,
      }),
    )
    expect(onOpenReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ id: target.id, status: 'completed' }),
    )
  })

  it('navigates to POS after clicking Thêm món from Orders', async () => {
    const user = userEvent.setup()
    const target = makePendingOrder('HD-PEND-NAV')
    usePOSStore.setState({ history: [target] })

    renderPage()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Thêm món' }))

    expect(screen.getByText('POS probe')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const state = usePOSStore.getState()
    expect(state.editingPendingOrderId).toBe(target.id)
    expect(state.cart.map((line) => line.menuItemId)).toEqual(['ga-nuong'])
  })

  it('cancels a pending order directly and swaps its badge', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({ history: [makePendingOrder('HD-PEND-003')] })

    renderPage()

    await user.click(screen.getByRole('button', { name: 'Huỷ' }))

    expect(usePOSStore.getState().history[0].status).toBe('cancelled')
    expect(screen.getByText('Đã huỷ')).toHaveClass('bg-negative-soft')
    expect(
      screen.queryByRole('button', { name: 'Thanh toán' }),
    ).not.toBeInTheDocument()
  })

  it('offers a receipt only for paid orders and no payment action for cancelled ones', () => {
    const paid = makeOrder('HD-DONE-001', at(0))
    const cancelled: LocalOrder = {
      ...makeOrder('HD-CANCEL-001', at(0)),
      status: 'cancelled',
    }
    const pending = makePendingOrder('HD-PEND-001')
    usePOSStore.setState({ history: [paid, cancelled, pending] })

    renderPage()

    const cardFor = (code: string) =>
      screen
        .getAllByRole('article')
        .find((card) => card.textContent?.includes(code))!
    const paidCard = cardFor(paid.code)
    const cancelledCard = cardFor(cancelled.code)
    const pendingCard = cardFor(pending.code)

    expect(
      within(paidCard).getByRole('button', { name: /Xem hoá đơn/ }),
    ).toBeInTheDocument()
    expect(
      within(paidCard).queryByRole('button', { name: 'Thanh toán' }),
    ).not.toBeInTheDocument()
    expect(
      within(cancelledCard).queryByRole('button', {
        name: /Thanh toán|Xem hoá đơn|^Huỷ$/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(pendingCard).getByRole('button', { name: 'Thanh toán' }),
    ).toBeInTheDocument()
    expect(
      within(pendingCard).queryByRole('button', { name: /Xem hoá đơn/ }),
    ).not.toBeInTheDocument()
  })
})
