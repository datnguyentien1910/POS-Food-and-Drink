import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  const onAddItems = vi.fn()
  const onOpenReceipt = vi.fn()
  const props = { open, onClose, onAddItems, onOpenReceipt, ...extraProps }

  const view = render(
    <ToastProvider>
      <OrderModal {...props} />
    </ToastProvider>,
  )

  const setProps = (next: Partial<OrderModalProps>) =>
    view.rerender(
      <ToastProvider>
        <OrderModal {...props} {...next} />
      </ToastProvider>,
    )

  const setOpen = (next: boolean) => setProps({ open: next })

  return {
    ...view,
    onClose,
    onAddItems,
    onOpenReceipt,
    setOpen,
    setProps,
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

  it('opens at xl width', () => {
    renderOrderModal()

    expect(screen.getByRole('dialog')).toHaveClass('max-w-5xl')
  })

  it('marks a line served and serves every line from the modal', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().addItem('nuoc-chanh')
    renderOrderModal()

    await user.click(screen.getAllByRole('button', { name: 'Mang ra' })[0])

    const afterOne = usePOSStore.getState().cart
    expect(afterOne.filter((line) => line.served === true)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Chọn tất cả' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xoá Gà nướng' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))

    expect(
      usePOSStore.getState().cart.every((line) => line.served === true),
    ).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Chọn tất cả' }),
    ).not.toBeInTheDocument()
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

  it('allows saving a pending order even when the cash received is short', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderOrderModal()

    const cashInput = screen.getByRole('spinbutton', {
      name: 'Tiền khách đưa',
    })
    await user.clear(cashInput)
    await user.type(cashInput, '1000')

    expect(screen.getByRole('button', { name: 'Thanh toán' })).toBeDisabled()
    const saveButton = screen.getByRole('button', {
      name: 'Lưu chờ thanh toán',
    })
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    expect(usePOSStore.getState().history[0]).toMatchObject({
      status: 'pending_payment',
      total: 117720,
    })
  })

  it('pays a resumed pending order in place instead of creating a duplicate', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    expect(usePOSStore.getState().isTableBusy('ban-5')).toBe(true)

    // Thêm món resumes the pending order into the POS cart; the cashier adds
    // another item and checks out from the create-mode modal.
    usePOSStore.getState().resumePendingOrder(order.id)
    usePOSStore.getState().addItem('khoai-tay-chien')
    renderOrderModal()

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(usePOSStore.getState().history.filter((item) => item.status === 'completed')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    const state = usePOSStore.getState()
    const saleOrders = state.history.filter(
      (item) => item.clientId === order.clientId,
    )
    expect(saleOrders).toHaveLength(1)
    expect(saleOrders[0]).toMatchObject({ id: order.id, status: 'completed' })
    expect(saleOrders[0].items.map((item) => item.menuItemId)).toEqual([
      'ga-nuong',
      'nuoc-chanh',
      'khoai-tay-chien',
    ])
    expect(saleOrders[0].total).toBeGreaterThan(order.total)
    expect(saleOrders[0].received).toBe(saleOrders[0].total)
    expect(saleOrders[0].change).toBe(0)
    expect(
      state.history.filter((item) => item.status === 'pending_payment'),
    ).toHaveLength(0)
    expect(state.editingPendingOrderId).toBeNull()
    expect(state.isTableBusy('ban-5')).toBe(false)
    expect(state.queue.filter((item) => item.id === order.clientId)).toHaveLength(1)
    expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument()
  })
})

function createPendingOrder({ serveFirst = false } = {}) {
  usePOSStore.getState().assignTable('ban-5')
  usePOSStore.getState().addItem('ga-nuong')
  if (serveFirst) {
    const lineId = usePOSStore.getState().cart[0].lineId
    usePOSStore.getState().setLineServed(lineId, true)
  }
  usePOSStore.getState().addItem('nuoc-chanh')
  usePOSStore.getState().setNote('Ít đá')
  usePOSStore.getState().setDiscount({ type: 'percent', value: 10 })
  return usePOSStore.getState().savePendingOrder()!
}

describe('OrderModal — chế độ đơn chờ', () => {
  beforeEach(resetStore)
  afterEach(() => vi.restoreAllMocks())

  it('reads the order from history without resuming it or touching the active cart', () => {
    const order = createPendingOrder({ serveFirst: true })
    const activeCart = [
      {
        lineId: 'active',
        menuItemId: 'banh-chocolate',
        qty: 2,
        unitPrice: 45000,
        name: 'Bánh chocolate',
      },
    ]
    usePOSStore.setState({
      cart: activeCart,
      editingPendingOrderId: 'another-order',
    })
    const resumeSpy = vi.spyOn(usePOSStore.getState(), 'resumePendingOrder')

    renderOrderModal(true, { orderId: order.id })

    expect(resumeSpy).not.toHaveBeenCalled()
    expect(usePOSStore.getState().cart).toEqual(activeCart)
    expect(usePOSStore.getState().editingPendingOrderId).toBe('another-order')
    expect(screen.getByText('Bàn 05')).toBeInTheDocument()
    expect(screen.getByText(/Gà nướng/)).toBeInTheDocument()
    expect(screen.getByText(/Nước chanh/)).toBeInTheDocument()
    expect(screen.getByText('Đã ra')).toBeInTheDocument()
    expect(screen.getByText('Ít đá')).toBeInTheDocument()
    expect(screen.getByText(/Giảm giá \(10%\)/)).toBeInTheDocument()
    expect(screen.queryByText('Bánh chocolate')).not.toBeInTheDocument()
  })

  it('resumes the order, calls onAddItems and closes on Thêm món', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    const resumeSpy = vi.spyOn(usePOSStore.getState(), 'resumePendingOrder')
    const { onAddItems, onClose } = renderOrderModal(true, {
      orderId: order.id,
    })

    await user.click(screen.getByRole('button', { name: 'Thêm món' }))

    expect(resumeSpy).toHaveBeenCalledWith(order.id)
    expect(usePOSStore.getState().editingPendingOrderId).toBe(order.id)
    expect(usePOSStore.getState().cart.map((line) => line.menuItemId)).toEqual([
      'ga-nuong',
      'nuoc-chanh',
    ])
    expect(onAddItems).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(resumeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      onAddItems.mock.invocationCallOrder[0],
    )
    expect(onAddItems.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    )
  })

  it('cancels the order and frees the table after confirmation', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    expect(usePOSStore.getState().isTableBusy('ban-5')).toBe(true)
    const { onClose } = renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Huỷ đơn' }))

    expect(screen.getByRole('dialog', { name: 'Huỷ đơn?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xác nhận huỷ' }))

    expect(usePOSStore.getState().history[0].status).toBe('cancelled')
    expect(usePOSStore.getState().isTableBusy('ban-5')).toBe(false)
    expect(screen.getByText('Đã huỷ đơn')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pays the pending order with the original clientId', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    const paySpy = vi.spyOn(usePOSStore.getState(), 'payPendingOrder')
    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    expect(paySpy).toHaveBeenCalledWith(
      order.id,
      expect.objectContaining({ method: 'cash' }),
    )
    const state = usePOSStore.getState()
    expect(state.history[0].status).toBe('completed')
    expect(state.queue).toHaveLength(1)
    expect(state.queue[0].id).toBe(order.clientId)
    expect(state.queue[0].payload).toMatchObject({ clientId: order.clientId })
    expect(state.isTableBusy('ban-5')).toBe(false)
    expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument()
  })

  it('warns before paying a pending order with unserved items', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))

    expect(usePOSStore.getState().history[0].status).toBe('pending_payment')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Còn 2 món chưa mang ra — vẫn thanh toán?',
    )

    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    expect(usePOSStore.getState().history[0].status).toBe('completed')
  })

  it('saves live unsaved items before paying the order being edited', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    usePOSStore.getState().resumePendingOrder(order.id)
    usePOSStore.getState().addItem('khoai-tay-chien')
    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    const state = usePOSStore.getState()
    const paid = state.history.find((item) => item.id === order.id)!
    expect(paid.status).toBe('completed')
    expect(paid.items.map((item) => item.menuItemId)).toEqual([
      'ga-nuong',
      'nuoc-chanh',
      'khoai-tay-chien',
    ])
    expect(state.editingPendingOrderId).toBeNull()
    expect(state.queue[0].id).toBe(order.clientId)
  })

  it('recomputes cash received from the saved total after adding items', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().assignTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    const order = usePOSStore.getState().savePendingOrder()!

    // Thêm món → POS adds another item → reopen the popup for that order.
    usePOSStore.getState().resumePendingOrder(order.id)
    usePOSStore.getState().addItem('nuoc-chanh')
    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    const state = usePOSStore.getState()
    const paid = state.history.find((item) => item.id === order.id)!
    expect(paid.total).toBeGreaterThan(order.total)
    expect(paid.received).toBe(paid.total)
    expect(paid.change).toBe(0)
    expect(state.queue[0]).toMatchObject({
      expectedTotal: paid.total,
      payload: {
        payment: { method: 'CASH', received: paid.total },
        expectedTotal: paid.total,
      },
    })
  })

  it('keeps the intended change when the saved total of an edited order rises', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().assignTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    const order = usePOSStore.getState().savePendingOrder()!

    usePOSStore.getState().resumePendingOrder(order.id)
    usePOSStore.getState().addItem('nuoc-chanh')
    renderOrderModal(true, { orderId: order.id })

    const cashInput = screen.getByRole('spinbutton', {
      name: 'Tiền khách đưa',
    })
    await user.clear(cashInput)
    await user.type(cashInput, String(order.total + 50_000))

    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Vẫn thanh toán' }))

    const paid = usePOSStore
      .getState()
      .history.find((item) => item.id === order.id)!
    expect(paid.received).toBe(paid.total + 50_000)
    expect(paid.change).toBe(50_000)
  })

  it('clears the cancel confirmation when the parent closes the modal', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    const { setOpen } = renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Huỷ đơn' }))
    expect(screen.getByRole('dialog', { name: 'Huỷ đơn?' })).toBeInTheDocument()

    setOpen(false)

    expect(
      screen.queryByRole('dialog', { name: 'Huỷ đơn?' }),
    ).not.toBeInTheDocument()
    expect(usePOSStore.getState().history[0].status).toBe('pending_payment')

    setOpen(true)

    expect(
      screen.queryByRole('dialog', { name: 'Huỷ đơn?' }),
    ).not.toBeInTheDocument()
  })

  it('resets local state when orderId changes', async () => {
    const user = userEvent.setup()
    const first = createPendingOrder()
    usePOSStore.getState().assignTable('ban-7')
    usePOSStore.getState().addItem('ga-nuong')
    const second = usePOSStore.getState().savePendingOrder()!

    const { setProps } = renderOrderModal(true, { orderId: first.id })
    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    setProps({ orderId: second.id })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Bàn 07')).toBeInTheDocument()
  })

  it('changes a pending order table from the modal without resuming it', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    const activeCart = [
      {
        lineId: 'active',
        menuItemId: 'banh-chocolate',
        qty: 2,
        unitPrice: 45000,
        name: 'Bánh chocolate',
      },
    ]
    usePOSStore.setState({
      cart: activeCart,
      editingPendingOrderId: 'another-order',
    })
    const resumeSpy = vi.spyOn(usePOSStore.getState(), 'resumePendingOrder')

    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Chọn bàn' }))
    await user.click(screen.getByRole('button', { name: 'Bàn 07' }))

    const updated = usePOSStore
      .getState()
      .history.find((item) => item.id === order.id)!
    expect(updated.tableId).toBe('ban-7')
    expect(updated.tableName).toBe('Bàn 07')
    expect(usePOSStore.getState().isTableBusy('ban-5')).toBe(false)
    expect(usePOSStore.getState().isTableBusy('ban-7')).toBe(true)
    expect(usePOSStore.getState().cart).toEqual(activeCart)
    expect(usePOSStore.getState().editingPendingOrderId).toBe('another-order')
    expect(resumeSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Chọn bàn' })).toHaveTextContent(
      'Bàn 07',
    )
  })

  it('disables tables occupied by another open order in pending mode', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    usePOSStore.getState().assignTable('ban-2')
    usePOSStore.getState().addItem('khoai-tay-chien')
    usePOSStore.getState().savePendingOrder()

    renderOrderModal(true, { orderId: order.id })

    await user.click(screen.getByRole('button', { name: 'Chọn bàn' }))

    const busy = screen.getByRole('button', { name: 'Bàn 02' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('title', 'Bàn đang có đơn mở')
    expect(screen.getByRole('button', { name: 'Bàn 05' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mang đi' })).toBeEnabled()
  })

  it('marks served lines only on the pending order, never on the active cart', async () => {
    const user = userEvent.setup()
    const order = createPendingOrder()
    const activeCart = [
      {
        lineId: 'active',
        menuItemId: 'banh-chocolate',
        qty: 2,
        unitPrice: 45000,
        name: 'Bánh chocolate',
      },
    ]
    usePOSStore.setState({
      cart: activeCart,
      editingPendingOrderId: 'another-order',
    })

    renderOrderModal(true, { orderId: order.id })

    const toggles = screen.getAllByRole('button', { name: 'Mang ra' })
    expect(toggles).toHaveLength(2)
    await user.click(toggles[0])

    let current = usePOSStore
      .getState()
      .history.find((item) => item.id === order.id)!
    expect(current.items[0].served).toBe(true)
    expect(current.items[1].served).not.toBe(true)
    expect(usePOSStore.getState().cart).toEqual(activeCart)
    expect(usePOSStore.getState().editingPendingOrderId).toBe('another-order')

    await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))

    current = usePOSStore
      .getState()
      .history.find((item) => item.id === order.id)!
    expect(current.items.every((item) => item.served === true)).toBe(true)
    expect(usePOSStore.getState().cart).toEqual(activeCart)
    expect(usePOSStore.getState().editingPendingOrderId).toBe('another-order')
    expect(
      screen.queryByRole('button', { name: 'Chọn tất cả' }),
    ).not.toBeInTheDocument()
  })
})
