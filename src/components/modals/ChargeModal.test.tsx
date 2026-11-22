import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import { ToastProvider } from '../ui/Toast'
import { ChargeModal } from './ChargeModal'

function renderCharge(open = true) {
  const onClose = vi.fn()
  const onOpenReceipt = vi.fn()

  const view = render(
    <ToastProvider>
      <ChargeModal
        open={open}
        onClose={onClose}
        onOpenReceipt={onOpenReceipt}
      />
    </ToastProvider>,
  )

  const setOpen = (next: boolean) =>
    view.rerender(
      <ToastProvider>
        <ChargeModal
          open={next}
          onClose={onClose}
          onOpenReceipt={onOpenReceipt}
        />
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
  })
}

describe('ChargeModal', () => {
  beforeEach(resetStore)

  it('blocks confirmation when the cart is empty', () => {
    renderCharge()

    expect(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    ).toBeDisabled()
  })

  it('calculates change and blocks insufficient cash', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderCharge()

    const cashInput = screen.getByRole('spinbutton', {
      name: 'Tiền khách đưa',
    })
    await user.clear(cashInput)
    await user.type(cashInput, '100000')

    expect(screen.getByText(/Còn thiếu/)).toHaveTextContent('17.720 ₫')
    expect(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    ).toBeDisabled()

    await user.clear(cashInput)
    await user.type(cashInput, '150000')

    expect(screen.getByText('32.280 ₫')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    ).toBeEnabled()
  })

  it('records the cash order once and shows the success step', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )

    const history = usePOSStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      method: 'cash',
      total: 117720,
    })
    expect(usePOSStore.getState().cart).toEqual([])

    expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Xác nhận thanh toán' }),
    ).not.toBeInTheDocument()
  })

  it('completes a transfer order without cash input', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderCharge()

    await user.click(screen.getByRole('button', { name: 'Chuyển khoản' }))
    expect(
      screen.queryByRole('spinbutton', { name: 'Tiền khách đưa' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )

    expect(usePOSStore.getState().history[0].method).toBe('transfer')
    expect(usePOSStore.getState().history[0].received).toBeUndefined()
  })

  it('opens the completed order receipt', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onOpenReceipt } = renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )
    await user.click(screen.getByRole('button', { name: /Xem hoá đơn/ }))

    expect(onOpenReceipt).toHaveBeenCalledTimes(1)
    expect(onOpenReceipt.mock.calls[0][0].code).toMatch(/^OFF-/)
  })

  it('starts a new order from the success step', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    const { onClose } = renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )
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
    renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )

    expect(usePOSStore.getState().history).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Còn 1 món chưa mang ra — vẫn thanh toán?',
    )
    await user.click(
      screen.getByRole('button', { name: 'Vẫn thanh toán' }),
    )

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(usePOSStore.getState().cart).toEqual([])
    expect(usePOSStore.getState().openOrders).toEqual({})
  })

  it('pays a fully served table immediately', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().setAllServed()
    renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pays a takeaway order immediately', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().addItem('ga-nuong')
    renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )

    expect(usePOSStore.getState().history).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('resets the warning when the modal is closed and reopened', async () => {
    const user = userEvent.setup()
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    const { setOpen } = renderCharge()

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    setOpen(false)
    setOpen(true)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    )
    expect(usePOSStore.getState().history).toHaveLength(0)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
