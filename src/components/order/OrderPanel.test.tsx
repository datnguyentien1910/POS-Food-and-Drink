import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import { ToastProvider } from '../ui/Toast'
import { OrderPanel } from './OrderPanel'

function renderPanel() {
  const onCharge = vi.fn()
  const onOpenDrafts = vi.fn()

  render(
    <ToastProvider>
      <OrderPanel onCharge={onCharge} onOpenDrafts={onOpenDrafts} />
    </ToastProvider>,
  )

  return { onCharge, onOpenDrafts }
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
  })
}

describe('OrderPanel', () => {
  beforeEach(resetStore)

  it('shows an empty state with disabled actions', () => {
    renderPanel()

    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thanh toán/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu tạm' })).toBeDisabled()
  })

  it('renders cart lines and updates the quantity', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    expect(screen.getByText('Gà nướng')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đơn hiện tại' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))

    expect(usePOSStore.getState().cart[0].qty).toBe(2)
    const summary = screen.getByRole('region', { name: 'Tổng kết đơn' })
    expect(within(summary).getByText('218.000 ₫')).toBeInTheDocument()
    expect(within(summary).getByText('235.440 ₫')).toBeInTheDocument()
  })

  it('removes a line from the cart', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Xoá Gà nướng' }))

    expect(usePOSStore.getState().cart).toEqual([])
    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument()
  })

  it('chooses a table and shows it on the panel', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Chọn bàn' }))
    await user.click(screen.getByRole('button', { name: /Bàn 05/ }))

    expect(usePOSStore.getState().tableId).toBe('ban-5')
    expect(
      screen.getByRole('button', { name: 'Chọn bàn: Bàn 05' }),
    ).toBeInTheDocument()
  })

  it('applies a discount and recalculates the summary', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Sửa giảm giá' }))
    await user.click(screen.getByRole('button', { name: 'Số tiền' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Giá trị giảm' }), '20000')
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(usePOSStore.getState().discount).toEqual({
      type: 'amount',
      value: 20000,
    })

    const summary = screen.getByRole('region', { name: 'Tổng kết đơn' })
    expect(within(summary).getByText('-20.000 ₫')).toBeInTheDocument()
    expect(within(summary).getByText('96.120 ₫')).toBeInTheDocument()
  })

  it('saves a note on the order', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Thêm ghi chú/ }))
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú đơn' }), 'Ít đá')

    expect(usePOSStore.getState().note).toBe('Ít đá')
  })

  it('saves the current order as a draft', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Lưu tạm' }))

    expect(usePOSStore.getState().drafts).toHaveLength(1)
    expect(usePOSStore.getState().cart).toEqual([])
    expect(screen.getByText('Đã lưu đơn nháp')).toBeInTheDocument()
  })

  it('starts payment with the current total', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onCharge } = renderPanel()

    await user.click(
      screen.getByRole('button', { name: 'Thanh toán 117.720 ₫' }),
    )

    expect(onCharge).toHaveBeenCalledTimes(1)
  })
})
