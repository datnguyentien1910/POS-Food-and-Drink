import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RESTAURANT } from '../../config'
import { calcTotals } from '../../lib/calc'
import { formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import { ToastProvider } from '../ui/Toast'
import { OrderModal, type OrderModalProps } from './OrderModal'

function renderOrderModal(
  open = true,
  extraProps: Partial<OrderModalProps> = {},
) {
  const onClose = vi.fn()
  const onOpenReceipt = vi.fn()
  const props = { open, onClose, onOpenReceipt, ...extraProps }

  const view = render(
    <ToastProvider>
      <OrderModal {...props} />
    </ToastProvider>,
  )

  const setOpen = (next: boolean) =>
    view.rerender(
      <ToastProvider>
        <OrderModal {...props} open={next} />
      </ToastProvider>,
    )

  return { ...view, onClose, onOpenReceipt, setOpen }
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
    editingPendingOrderId: null,
  })
}

describe('OrderModal — chế độ tạo', () => {
  beforeEach(resetStore)

  it('blocks confirmation when the cart is empty', () => {
    renderOrderModal()

    expect(
      screen.getByRole('button', { name: 'Thanh toán' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    ).toBeDisabled()
  })

  it('calculates change and blocks insufficient cash', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    const cashInput = screen.getByRole('spinbutton', {
      name: 'Tiền khách đưa',
    })
    await user.clear(cashInput)
    await user.type(cashInput, '100000')

    expect(screen.getByText(/Còn thiếu/)).toHaveTextContent('17.720 ₫')
    expect(
      screen.getByRole('button', { name: 'Thanh toán' }),
    ).toBeDisabled()

    await user.clear(cashInput)
    await user.type(cashInput, '150000')

    expect(screen.getByText('32.280 ₫')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Thanh toán' }),
    ).toBeEnabled()
  })

  it('records the cash order once and shows the success step', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    const history = usePOSStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ method: 'cash', total: 117720 })
    expect(usePOSStore.getState().cart).toEqual([])

    expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Thanh toán' }),
    ).not.toBeInTheDocument()
  })

  it('completes a transfer order without cash input', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Chuyển khoản' }))
    expect(
      screen.queryByRole('spinbutton', { name: 'Tiền khách đưa' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    expect(usePOSStore.getState().history[0].method).toBe('transfer')
    expect(usePOSStore.getState().history[0].received).toBeUndefined()
  })

  it('opens the completed order receipt', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onOpenReceipt } = renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: /Xem hoá đơn/ }))

    expect(onOpenReceipt).toHaveBeenCalledTimes(1)
    expect(onOpenReceipt.mock.calls[0][0].code).toMatch(/^OFF-/)
  })

  it('starts a new order from the success step', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onClose } = renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Đơn mới' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before paying a table with unserved items', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.setState({
      openOrders: {
        'ban-5': {
          cart: [],
          discount: { type: 'amount' as const, value: 0 },
          note: '',
          updatedAt: Date.now(),
        },
      },
    })
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    expect(usePOSStore.getState().history).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Còn 1 món chưa mang ra — vẫn thanh toán?',
    )
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().openOrders).toEqual({})
  })

  it('pays a fully served table immediately', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().setAllServed()
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pays a takeaway order immediately', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('resets the warning when the modal is closed and reopened', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    const { setOpen } = renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    setOpen(false)
    setOpen(true)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(usePOSStore.getState().history).toHaveLength(0)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('saves a pending order and clears the cart', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onClose } = renderOrderModal()

    await user.click(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    )

    const history = usePOSStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      status: 'pending_payment',
      tableId: null,
      total: 117720,
    })
    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().queue).toEqual([])
    expect(
      screen.getByText('Đã lưu đơn chờ thanh toán'),
    ).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the items when choosing a table and assigns it only when saving', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Chọn bàn' }))
    await user.click(screen.getByRole('button', { name: 'Bàn 05' }))

    expect(usePOSStore.getState().cart).toHaveLength(1)
    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().openOrders).toEqual({})

    await user.click(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    )

    expect(usePOSStore.getState().openOrders).toEqual({})
    expect(usePOSStore.getState().history[0]).toMatchObject({
      tableId: 'ban-5',
      tableName: 'Bàn 05',
    })
    expect(usePOSStore.getState().history[0].items).toHaveLength(1)
  })

  it('can switch a selected table back to takeaway', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Chọn bàn' }))
    await user.click(screen.getByRole('button', { name: 'Mang đi' }))
    await user.click(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    )

    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().history[0].tableId).toBeNull()
    expect(usePOSStore.getState().history[0].tableName).toBe('Mang đi')
  })

  it('initialises the table selection from the tableId prop', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal(true, { tableId: 'ban-7' })

    await user.click(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    )

    expect(usePOSStore.getState().history[0].tableId).toBe('ban-7')
    expect(usePOSStore.getState().history[0].tableName).toBe('Bàn 07')
  })

  it('lets an explicit null tableId prop override the store', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal(true, { tableId: null })

    await user.click(
      screen.getByRole('button', { name: 'Lưu chờ thanh toán' }),
    )

    expect(usePOSStore.getState().tableId).toBeNull()
    expect(usePOSStore.getState().history[0].tableId).toBeNull()
  })

  it('edits note and discount and keeps totals consistent with calcTotals', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ghi chú đơn' }),
      'Ít đá',
    )
    await user.click(screen.getByRole('button', { name: 'Xong' }))
    expect(usePOSStore.getState().note).toBe('Ít đá')

    await user.click(screen.getByRole('button', { name: 'Sửa giảm giá' }))
    await user.click(screen.getByRole('button', { name: 'Phần trăm' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Giá trị giảm' }), '10')
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(usePOSStore.getState().discount).toEqual({
      type: 'percent',
      value: 10,
    })
    const expected = calcTotals(
      usePOSStore.getState().cart.map((line) => ({
        unitPrice: line.unitPrice ?? 0,
        qty: line.qty,
      })),
      { type: 'percent', value: 10 },
      RESTAURANT.taxRate,
    )
    expect(
      screen.getAllByText(formatVND(expected.total)).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(usePOSStore.getState().history[0]).toMatchObject({
      total: expected.total,
      note: 'Ít đá',
    })
  })
})
