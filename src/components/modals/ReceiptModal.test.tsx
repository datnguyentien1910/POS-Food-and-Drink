import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OrderRecord } from '../../types'
import { ReceiptModal } from './ReceiptModal'

const order: OrderRecord = {
  id: 'order-1',
  code: 'HD-20261118-001',
  tableId: 'ban-05',
  tableName: 'Bàn 05',
  items: [
    {
      menuItemId: 'ga-nuong',
      name: 'Gà nướng',
      unitPrice: 109_000,
      qty: 1,
    },
  ],
  subtotal: 109_000,
  discountAmount: 0,
  tax: 8_720,
  total: 117_720,
  method: 'cash',
  received: 120_000,
  change: 2_280,
  note: '',
  createdAt: new Date(2026, 10, 18, 12).getTime(),
  cashier: 'Thu ngân',
  status: 'completed',
}

describe('ReceiptModal', () => {
  it('renders the print copy as a direct child of body', () => {
    render(<ReceiptModal order={order} open onClose={vi.fn()} />)

    const printArea = document.querySelector('.print-area')

    expect(printArea).not.toBeNull()
    expect(printArea?.parentElement).toBe(document.body)
    expect(
      within(printArea as HTMLElement).getByText('Bàn 05'),
    ).toBeInTheDocument()
  })

  it('does not render the print copy when closed', () => {
    render(<ReceiptModal order={order} open={false} onClose={vi.fn()} />)

    expect(document.querySelector('.print-area')).toBeNull()
  })

  it('shows the receipt details in the dialog', () => {
    render(<ReceiptModal order={order} open onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByText('Gà nướng').length).toBeGreaterThan(0)
    expect(screen.getAllByText('117.720 ₫').length).toBeGreaterThan(0)
  })
})
