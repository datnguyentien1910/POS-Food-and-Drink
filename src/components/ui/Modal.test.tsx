import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders an accessible dialog with its title and content', () => {
    render(
      <Modal open title="Thanh toán" onClose={vi.fn()}>
        <p>Nội dung thanh toán</p>
      </Modal>,
    )

    expect(
      screen.getByRole('dialog', { name: 'Thanh toán' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Nội dung thanh toán')).toBeInTheDocument()
  })

  it('calls onClose from the close button and Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <Modal open title="Chọn bàn" onClose={onClose}>
        <p>Nội dung</p>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders nothing while closed', () => {
    render(
      <Modal open={false} title="Đóng" onClose={vi.fn()}>
        <p>Không thấy</p>
      </Modal>,
    )

    expect(screen.queryByText('Không thấy')).not.toBeInTheDocument()
  })

  it('applies the max-w-5xl class for size xl', () => {
    render(
      <Modal open title="Đơn hàng" onClose={vi.fn()} size="xl">
        <p>Nội dung</p>
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Đơn hàng' })).toHaveClass(
      'max-w-5xl',
    )
  })
})
