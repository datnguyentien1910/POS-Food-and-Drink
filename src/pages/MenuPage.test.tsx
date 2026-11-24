import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '../api/types'
import type { ServerMenuCategory } from '../api/types'
import {
  createMenuItem,
  deleteMenuItem,
  getCategories,
  getMenu,
} from '../api/menu'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAuthStore } from '../store/useAuthStore'
import { ToastProvider } from '../components/ui/Toast'
import { MenuPage } from './MenuPage'

vi.mock('../api/menu', () => ({
  getMenu: vi.fn(),
  getCategories: vi.fn(),
  deleteMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  uploadMenuItemImage: vi.fn(),
}))

const MENU: ServerMenuCategory[] = [
  { id: 'virtual-all', name: 'all', sortOrder: 0, items: [] },
  { id: 'virtual-popular', name: 'popular', sortOrder: 1, items: [] },
  {
    id: 'c1',
    name: 'Món chính',
    sortOrder: 2,
    items: [
      {
        id: 'm1',
        categoryId: 'c1',
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
        categoryId: 'c1',
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

const CATEGORIES = [
  { id: 'virtual-all', name: 'all', sortOrder: 0 },
  { id: 'virtual-popular', name: 'popular', sortOrder: 1 },
  { id: 'c1', name: 'Món chính', sortOrder: 2 },
]

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

function renderPage() {
  return render(
    <ToastProvider>
      <MenuPage />
    </ToastProvider>,
  )
}

describe('MenuPage', () => {
  beforeEach(() => {
    vi.mocked(getMenu).mockResolvedValue(MENU)
    vi.mocked(getCategories).mockResolvedValue(CATEGORIES)
    vi.mocked(deleteMenuItem).mockResolvedValue(undefined)
  })

  it('shows items and management actions for an owner', async () => {
    setRole('OWNER')

    renderPage()

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    expect(screen.getByText('109.000 ₫')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm món' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sửa' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Xoá' })).toHaveLength(2)
  })

  it('hides virtual all/popular categories from the management groups', async () => {
    setRole('OWNER')

    renderPage()

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'all' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'popular' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Nhóm này chưa có món.')).not.toBeInTheDocument()
    expect(screen.getByText('1 nhóm')).toBeInTheDocument()
  })

  it('hides management actions from a cashier', async () => {
    setRole('CASHIER')

    renderPage()

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

    renderPage()

    expect(await screen.findByText('Phở bò')).toBeInTheDocument()
    expect(screen.getByText('Tạm hết món')).toBeInTheDocument()
  })

  it('prefers the uploaded image URL over the bundled asset', async () => {
    setRole('OWNER')

    renderPage()

    const image = await screen.findByAltText('Phở bò')
    expect(image).toHaveAttribute('src', '/uploads/menu/pho.webp')
  })

  it('deletes an item after confirmation and refreshes the catalog', async () => {
    const user = userEvent.setup()
    setRole('OWNER')
    const refresh = vi
      .spyOn(useCatalogStore.getState(), 'refresh')
      .mockResolvedValue(undefined)

    renderPage()

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Xoá' })[0])

    expect(screen.getByText('Xoá món?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xoá món' }))

    await waitFor(() => expect(deleteMenuItem).toHaveBeenCalledWith('m1'))
    expect(refresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
  })

  it('refreshes the POS catalog after saving a new item', async () => {
    const user = userEvent.setup()
    setRole('OWNER')
    vi.mocked(createMenuItem).mockResolvedValue({
      id: 'new-1',
      categoryId: 'c1',
      legacyId: null,
      name: 'Cơm gà',
      description: null,
      price: 45000,
      imageKey: null,
      imageUrl: null,
      available: true,
      popular: false,
      sortOrder: 0,
    })
    const refresh = vi
      .spyOn(useCatalogStore.getState(), 'refresh')
      .mockResolvedValue(undefined)

    renderPage()

    expect(await screen.findByText('Gà nướng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thêm món' }))
    await user.type(screen.getByLabelText('Tên món'), 'Cơm gà')
    await user.type(screen.getByLabelText('Giá bán'), '45000')
    await user.click(screen.getByRole('button', { name: 'Lưu món' }))

    await waitFor(() => expect(createMenuItem).toHaveBeenCalled())
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })
})
