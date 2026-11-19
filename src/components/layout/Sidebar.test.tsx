import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('shows the brand and marks the active page', () => {
    render(<Sidebar activePage="pos" onNavigate={vi.fn()} />)

    expect(screen.getByText('RestoDash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'POS' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('button', { name: 'Đơn hàng' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('navigates when another section is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(<Sidebar activePage="pos" onNavigate={onNavigate} />)
    await user.click(screen.getByRole('button', { name: 'Đơn hàng' }))

    expect(onNavigate).toHaveBeenCalledWith('orders')
  })
})
