import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import { ToastProvider } from '../ui/Toast'
import { DraftsModal } from './DraftsModal'

function renderDrafts() {
  const onClose = vi.fn()

  render(
    <ToastProvider>
      <DraftsModal open onClose={onClose} />
    </ToastProvider>,
  )

  return { onClose }
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
  })
}

const seedDraft = () => {
  usePOSStore.getState().addItem('ga-nuong')
  usePOSStore.getState().addItem('ca-phe-nong')
  usePOSStore.getState().addItem('ca-phe-nong')
  usePOSStore.getState().setTable('ban-5')
  usePOSStore.getState().setNote('Không hành')
  usePOSStore.getState().saveDraft()
}

describe('DraftsModal', () => {
  beforeEach(resetStore)

  it('shows an empty state when no drafts exist', () => {
    renderDrafts()

    expect(screen.getByText('Chưa có đơn nháp')).toBeInTheDocument()
    expect(
      screen.getByText(/Lưu tạm một đơn đang làm/),
    ).toBeInTheDocument()
  })

  it('lists saved drafts with table, item count, and total', () => {
    seedDraft()
    renderDrafts()

    expect(screen.getByText('Bàn 05')).toBeInTheDocument()
    expect(screen.getByText(/3 món/)).toBeInTheDocument()
    expect(screen.getByText(/171\.720/)).toBeInTheDocument()
  })

  it('loads a draft into an empty working order and closes', async () => {
    const user = userEvent.setup()
    seedDraft()
    const { onClose } = renderDrafts()

    await user.click(screen.getByRole('button', { name: 'Mở đơn nháp' }))

    expect(usePOSStore.getState().cart).toHaveLength(2)
    expect(usePOSStore.getState().tableId).toBe('ban-5')
    expect(usePOSStore.getState().note).toBe('Không hành')
    expect(usePOSStore.getState().drafts).toEqual([])
    expect(screen.getByText('Đã mở đơn nháp')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before replacing a non-empty working order', async () => {
    const user = userEvent.setup()
    seedDraft()
    usePOSStore.getState().addItem('burger-bo')
    renderDrafts()

    await user.click(screen.getByRole('button', { name: 'Mở đơn nháp' }))
    expect(screen.getByText('Thay thế đơn hiện tại?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thay thế' }))

    const state = usePOSStore.getState()
    expect(state.cart).toHaveLength(2)
    expect(state.cart.some((line) => line.menuItemId === 'burger-bo')).toBe(
      false,
    )
    expect(state.drafts).toEqual([])
  })

  it('keeps the working order when replacement is cancelled', async () => {
    const user = userEvent.setup()
    seedDraft()
    usePOSStore.getState().addItem('burger-bo')
    renderDrafts()

    await user.click(screen.getByRole('button', { name: 'Mở đơn nháp' }))
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))

    const state = usePOSStore.getState()
    expect(state.cart[0].menuItemId).toBe('burger-bo')
    expect(state.drafts).toHaveLength(1)
  })

  it('deletes a draft after confirmation', async () => {
    const user = userEvent.setup()
    seedDraft()
    renderDrafts()

    await user.click(
      screen.getByRole('button', { name: /Xoá đơn nháp lưu lúc/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Xoá đơn nháp' }))

    expect(usePOSStore.getState().drafts).toEqual([])
    expect(screen.getByText('Chưa có đơn nháp')).toBeInTheDocument()
  })
})
