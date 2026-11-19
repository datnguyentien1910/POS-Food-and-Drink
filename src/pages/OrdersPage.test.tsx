import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../store/usePOSStore'
import type { OrderRecord } from '../types'
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
): OrderRecord => ({
  id: code,
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
  })
}

describe('OrdersPage', () => {
  beforeEach(resetStore)

  it('shows an empty state when there is no history', () => {
    render(<OrdersPage onOpenReceipt={vi.fn()} />)

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

    render(<OrdersPage onOpenReceipt={vi.fn()} />)

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

    render(<OrdersPage onOpenReceipt={vi.fn()} />)

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

    render(<OrdersPage onOpenReceipt={vi.fn()} />)
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

    render(<OrdersPage onOpenReceipt={onOpenReceipt} />)
    await user.click(screen.getByRole('button', { name: /Xem hoá đơn/ }))

    expect(onOpenReceipt).toHaveBeenCalledWith(order)
  })

  it('shows a filtered empty state that can be reset', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({ history: [makeOrder('HD-20261118-001', at(0))] })

    render(<OrdersPage onOpenReceipt={vi.fn()} />)
    await user.type(
      screen.getByRole('searchbox', { name: 'Tìm đơn hàng' }),
      'khong-co',
    )

    expect(screen.getByText('Không tìm thấy đơn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xoá tìm kiếm' }))

    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(1)
  })
})
