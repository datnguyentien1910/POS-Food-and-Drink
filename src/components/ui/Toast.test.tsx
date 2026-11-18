import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Trigger({ message = 'Đã thêm món' }: { message?: string }) {
  const { push } = useToast()

  return (
    <button type="button" onClick={() => push(message)}>
      Hiện toast
    </button>
  )
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast and dismisses it after the duration', () => {
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hiện toast' }))
    expect(screen.getByText('Đã thêm món')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3200)
    })

    expect(screen.queryByText('Đã thêm món')).not.toBeInTheDocument()
  })

  it('can be dismissed by the user', () => {
    render(
      <ToastProvider>
        <Trigger message="Đã lưu đơn" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hiện toast' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))

    expect(screen.queryByText('Đã lưu đơn')).not.toBeInTheDocument()
  })
})
