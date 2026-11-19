import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OrderRecord } from '../../types'
import { StatsCards } from './StatsCards'

function makeOrder(createdAt: number, total: number): OrderRecord {
  return {
    id: `order-${createdAt}-${total}`,
    code: `HD-${createdAt}-${total}`,
    tableId: null,
    tableName: 'Mang đi',
    items: [],
    subtotal: total,
    discountAmount: 0,
    tax: 0,
    total,
    method: 'cash',
    note: '',
    createdAt,
    cashier: 'Thu ngân',
  }
}

const at = (daysAgo: number, hour = 10) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date.getTime()
}

describe('StatsCards', () => {
  it('shows zeros and placeholders instead of inventing backend numbers', () => {
    render(<StatsCards history={[]} />)

    expect(screen.getByText('Doanh thu hôm nay')).toBeInTheDocument()
    expect(screen.getByText('0 ₫')).toBeInTheDocument()
    expect(screen.getByText('Đơn hôm nay')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getAllByText(/nối backend/i)).toHaveLength(2)
  })

  it('derives today revenue and order count from local history', () => {
    render(
      <StatsCards
        history={[
          makeOrder(at(0, 9), 129000),
          makeOrder(at(0, 11), 71000),
          makeOrder(at(1), 500000),
        ]}
      />,
    )

    expect(screen.getByText('200.000 ₫')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows a delta with yesterday when comparable data exists', () => {
    render(
      <StatsCards
        history={[makeOrder(at(0), 200000), makeOrder(at(1), 100000)]}
      />,
    )

    expect(screen.getByText('+100%')).toBeInTheDocument()
    expect(screen.getByText('so với hôm qua')).toBeInTheDocument()
  })

  it('does not fabricate a delta without yesterday data', () => {
    render(<StatsCards history={[makeOrder(at(0), 200000)]} />)

    expect(screen.queryByText('so với hôm qua')).not.toBeInTheDocument()
  })
})
