import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

describe('Stepper', () => {
  it('shows the value and calls increment/decrement handlers', async () => {
    const user = userEvent.setup()
    const onIncrement = vi.fn()
    const onDecrement = vi.fn()

    render(
      <Stepper
        value={2}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />,
    )

    expect(screen.getByText('2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    expect(onIncrement).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Giảm số lượng' }))
    expect(onDecrement).toHaveBeenCalledTimes(1)
  })

  it('disables decrement at the minimum', () => {
    render(
      <Stepper value={1} min={1} onIncrement={vi.fn()} onDecrement={vi.fn()} />,
    )

    expect(
      screen.getByRole('button', { name: 'Giảm số lượng' }),
    ).toBeDisabled()
  })
})
