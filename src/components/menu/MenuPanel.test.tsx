import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MenuPanel } from './MenuPanel'

describe('MenuPanel', () => {
  it('renders the first 12 dishes and loads more on demand', async () => {
    const user = userEvent.setup()
    render(<MenuPanel onAdd={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Thực đơn' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(12)
    expect(screen.getByText('Xem thêm 4 món')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xem thêm 4 món' }))

    expect(screen.getAllByRole('article')).toHaveLength(16)
    expect(
      screen.queryByRole('button', { name: /Xem thêm/ }),
    ).not.toBeInTheDocument()
  })

  it('filters by category tab', async () => {
    const user = userEvent.setup()
    render(<MenuPanel onAdd={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Đồ uống' }))

    expect(screen.getByText('Cà phê nóng')).toBeInTheDocument()
    expect(screen.queryByText('Gà nướng')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Đồ uống' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('searches without accents and shows an empty state', async () => {
    const user = userEvent.setup()
    render(<MenuPanel onAdd={vi.fn()} />)

    const search = screen.getByRole('searchbox', {
      name: 'Tìm món trong thực đơn',
    })
    await user.type(search, 'ca phe')

    expect(screen.getByText('Cà phê nóng')).toBeInTheDocument()
    expect(screen.queryByText('Gà nướng')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'sushi')

    expect(screen.getByText('Không tìm thấy món')).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('adds a dish when its plus button is clicked', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()

    render(<MenuPanel onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: 'Thêm Gà nướng' }))

    expect(onAdd).toHaveBeenCalledWith('ga-nuong')
  })

  it('limits the list to popular dishes through the filter popover', async () => {
    const user = userEvent.setup()
    render(<MenuPanel onAdd={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Chỉ món phổ biến' }))

    const cards = screen.getAllByRole('article')
    expect(cards.length).toBeGreaterThan(0)
    expect(screen.queryByText('Gỏi cuốn')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đặt lại bộ lọc' }))
    expect(screen.getAllByRole('article')).toHaveLength(12)
  })

  it('sorts by price', async () => {
    const user = userEvent.setup()
    render(<MenuPanel onAdd={vi.fn()} />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sắp xếp' }),
      'price-asc',
    )

    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Cà phê nóng')
  })
})
