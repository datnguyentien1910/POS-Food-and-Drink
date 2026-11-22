import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import { ToastProvider } from '../ui/Toast'
import { OrderPanel } from './OrderPanel'

function renderPanel() {
  const onCharge = vi.fn()
  const onOpenDrafts = vi.fn()

  const view = render(
    <ToastProvider>
      <OrderPanel onCharge={onCharge} onOpenDrafts={onOpenDrafts} />
    </ToastProvider>,
  )

  return { onCharge, onOpenDrafts, unmount: view.unmount }
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

describe('OrderPanel', () => {
  beforeEach(resetStore)

  it('shows an empty state with disabled actions', () => {
    renderPanel()

    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thanh toán/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu tạm' })).toBeDisabled()
  })

  it('opens the drafts list from the panel header', async () => {
    const user = userEvent.setup()
    const { onOpenDrafts } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Đơn nháp' }))

    expect(onOpenDrafts).toHaveBeenCalledTimes(1)
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

  it('asks before clearing the order and keeps it when cancelled', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Tùy chọn đơn' }))
    await user.click(screen.getByRole('button', { name: 'Xoá đơn' }))

    expect(await screen.findByText(/Xoá đơn hiện tại/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))

    expect(usePOSStore.getState().cart).not.toEqual([])
    expect(usePOSStore.getState().tableId).toBe('ban-5')
  })

  it('resets cart, table, discount and note when clearing is confirmed', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().setDiscount({ type: 'percent', value: 10 })
    usePOSStore.getState().setNote('Ít đá')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Tùy chọn đơn' }))
    await user.click(screen.getByRole('button', { name: 'Xoá đơn' }))
    await screen.findByText(/Xoá đơn hiện tại/)
    await user.click(screen.getByRole('button', { name: 'Xoá đơn' }))

    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().discount).toEqual({ type: 'amount', value: 0 })
    expect(usePOSStore.getState().note).toBe('')
  })

  it('shows served controls only for a table order', () => {
    usePOSStore.getState().addItem('ga-nuong')
    const { unmount } = renderPanel()

    expect(
      screen.queryByRole('button', { name: 'Mang ra' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Chọn tất cả' }),
    ).not.toBeInTheDocument()

    unmount()
    act(() => usePOSStore.getState().setTable('ban-5'))
    act(() => usePOSStore.getState().addItem('ga-nuong'))
    renderPanel()

    expect(screen.getByRole('button', { name: 'Mang ra' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Chọn tất cả' }),
    ).toBeInTheDocument()
  })

  it('marks a line as served and locks its quantity and delete actions', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    expect(usePOSStore.getState().cart[0].qty).toBe(2)

    const toggle = screen.getByRole('button', { name: 'Mang ra' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)

    expect(usePOSStore.getState().cart[0].served).toBe(true)
    expect(screen.getByRole('button', { name: 'Đã ra' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByText('Đã ra')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xoá Gà nướng' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    expect(usePOSStore.getState().cart[0].qty).toBe(2)
    await user.click(screen.getByRole('button', { name: 'Xoá Gà nướng' }))
    expect(usePOSStore.getState().cart).toHaveLength(1)
  })

  it('marks every line served from the select-all action', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().addItem('nuoc-chanh')
    renderPanel()

    expect(screen.getAllByRole('button', { name: 'Mang ra' })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))

    expect(usePOSStore.getState().cart.every((line) => line.served)).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Mang ra' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Đã ra' })).toHaveLength(2)
  })

  it('creates a separate line when adding a served item again', () => {
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    act(() => screen.getByRole('button', { name: 'Mang ra' }).click())
    expect(usePOSStore.getState().cart[0].served).toBe(true)

    act(() => usePOSStore.getState().addItem('ga-nuong'))

    const panel = screen.getByRole('region', { name: 'Đơn hiện tại' })
    expect(within(panel).getAllByRole('article')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Mang ra' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Đã ra' })).toBeInTheDocument()
  })

  it('hides the select-all action when every line is served', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))

    expect(
      screen.queryByRole('button', { name: 'Chọn tất cả' }),
    ).not.toBeInTheDocument()
  })
})
