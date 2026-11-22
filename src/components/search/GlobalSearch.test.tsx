import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import type { LocalOrder } from '../../types'
import { ToastProvider } from '../ui/Toast'
import { GlobalSearch } from './GlobalSearch'

function renderSearch() {
  const onNavigate = vi.fn()
  const onOpenReceipt = vi.fn()

  render(
    <ToastProvider>
      <GlobalSearch onNavigate={onNavigate} onOpenReceipt={onOpenReceipt} />
    </ToastProvider>,
  )

  return {
    onNavigate,
    onOpenReceipt,
    input: screen.getByRole('combobox', { name: 'Tìm kiếm toàn cục' }),
  }
}

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
  })
}

const order: LocalOrder = {
  id: 'order-1',
  clientId: 'order-1',
  code: 'HD-20261118-001',
  tableId: null,
  tableName: 'Mang đi',
  items: [],
  subtotal: 117720,
  discountAmount: 0,
  tax: 0,
  total: 117720,
  method: 'cash',
  note: '',
  createdAt: new Date(2026, 10, 18, 12).getTime(),
  cashier: 'Thu ngân',
  syncState: 'synced',
  provisionalCode: false,
  cashierId: 'u1',
}

describe('GlobalSearch', () => {
  beforeEach(resetStore)

  it('focuses the input with Ctrl K', async () => {
    const user = userEvent.setup()
    const { input } = renderSearch()

    await user.keyboard('{Control>}k{/Control}')

    expect(input).toHaveFocus()
  })

  it('adds the first menu match when pressing Enter', async () => {
    const user = userEvent.setup()
    const { input } = renderSearch()

    await user.type(input, 'ga nuong')
    expect(
      screen.getByRole('option', { name: /Gà nướng/ }),
    ).toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(usePOSStore.getState().cart[0]?.menuItemId).toBe('ga-nuong')
    expect(input).toHaveValue('')
  })

  it('shows an empty result message for an unknown query', async () => {
    const user = userEvent.setup()
    const { input } = renderSearch()

    await user.type(input, 'sushi')

    expect(screen.getByText('Không tìm thấy kết quả')).toBeInTheDocument()
  })

  it('opens a paid order receipt from the results', async () => {
    const user = userEvent.setup()
    usePOSStore.setState({ history: [order] })
    const { input, onOpenReceipt } = renderSearch()

    await user.type(input, '20261118')
    await user.click(screen.getByRole('option', { name: /HD-20261118-001/ }))

    expect(onOpenReceipt).toHaveBeenCalledWith(order)
  })

  it('loads a draft and navigates to POS', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ca-phe-nong')
    usePOSStore.getState().saveDraft()
    const { input, onNavigate } = renderSearch()

    await user.type(input, 'ban 05')
    await user.click(screen.getByRole('option', { name: /Bàn 05/ }))

    expect(usePOSStore.getState().tableId).toBe('ban-5')
    expect(usePOSStore.getState().cart[0]?.menuItemId).toBe('ca-phe-nong')
    expect(onNavigate).toHaveBeenCalledWith('pos')
  })

  it('closes the results with Escape', async () => {
    const user = userEvent.setup()
    const { input } = renderSearch()

    await user.type(input, 'ga')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
