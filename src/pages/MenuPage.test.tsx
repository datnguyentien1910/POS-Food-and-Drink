import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '../api/types'
import type { ServerMenuCategory } from '../api/types'
import { useAuthStore } from '../store/useAuthStore'
import { getCategories, getMenu } from '../api/menu'
import { MenuPage } from './MenuPage'

vi.mock('../api/menu', () => ({
  getMenu: vi.fn(),
  getCategories: vi.fn(),
}))

const MENU: ServerMenuCategory[] = [
  {
    id: 'c1',
    name: 'Món chính',
    sortOrder: 1,
    items: [
      {
        id: 'm1',
        legacyId: 'ga-nuong',
        name: 'Gà nướng',
        description: 'Gà nướng mật ong',
        price: 109000,
        imageKey: 'grilled-chicken.webp',
        imageUrl: null,
        available: true,
        popular: true,
        sortOrder: 0,
      },
      {
        id: 'm2',
        legacyId: 'pho-bo',
        name: 'Phở bò',
        description: null,
        price: 89000,
        imageKey: null,
        imageUrl: '/uploads/menu/pho.webp',
        available: false,
        popular: false,
        sortOrder: 1,
      },
    ],
  },
]

const CATEGORIES = [{ id: 'c1', name: 'Món chính', sortOrder: 1 }]

function setRole(role: Role) {
  useAuthStore.setState({
    status: 'authenticated',
    user: {
      id: 'u1',
      name: 'Người dùng',
      email: 'user@restodash.local',
      role,
      restaurantId: 'r1',
    },
  })
}

describe('MenuPage', () => {
  beforeEach(() => {
    vi.mocked(getMenu).mockResolvedValue(MENU)
    vi.mocked(getCategories).mockResolvedValue(CATEGORIES)
  })

  it('shows items and management actions for an owner', async () => {
    setRole('OWNER')

    render(<MenuPage />)

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    expect(screen.getByText('109.000 ₫')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm món' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sửa' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Xoá' })).toHaveLength(2)
  })

  it('hides management actions from a cashier', async () => {
    setRole('CASHIER')

    render(<MenuPage />)

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Thêm món' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Xoá' }),
    ).not.toBeInTheDocument()
  })

  it('marks an unavailable item as temporarily sold out', async () => {
    setRole('OWNER')

    render(<MenuPage />)

    expect(await screen.findByText('Phở bò')).toBeInTheDocument()
    expect(screen.getByText('Tạm hết món')).toBeInTheDocument()
  })

  it('prefers the uploaded image URL over the bundled asset', async () => {
    setRole('OWNER')

    render(<MenuPage />)

    const image = await screen.findByAltText('Phở bò')
    expect(image).toHaveAttribute('src', '/uploads/menu/pho.webp')
  })
})
