import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, SessionResponse } from '../api/types'
import App from '../App'
import { useAuthStore } from '../store/useAuthStore'
import { usePOSStore } from '../store/usePOSStore'

vi.mock('../api/auth', () => ({
  login: vi.fn(), me: vi.fn(), logout: vi.fn(),
  staff: vi.fn(), loginWithPin: vi.fn(), registerDevice: vi.fn(),
}))
vi.mock('../api/menu', () => ({
  getMenu: vi.fn().mockResolvedValue([]),
  getCategories: vi.fn().mockResolvedValue([]),
  deleteMenuItem: vi.fn(),
}))
import * as authApi from '../api/auth'
import { router } from './router'
const meMock = vi.mocked(authApi.me)

const USER: AuthUser = {
  id: 'u1', name: 'Ngọc Anh', email: 'manager@restodash.local',
  role: 'MANAGER', restaurantId: 'r1',
}
const session = (): SessionResponse => ({
  user: USER, authMethod: 'password', expiresAt: '2026-11-21T00:00:00.000Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = ''
  useAuthStore.setState({ status: 'checking', user: null, authMethod: null, expiresAt: null, lastUser: null, lastOnlineAt: null, error: null })
  usePOSStore.getState().resetOrder()
})

describe('hash router', () => {
  it('mở POS và đổi hash khi điều hướng', async () => {
    meMock.mockResolvedValue(session())
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await user.click(screen.getByRole('button', { name: 'Đơn hàng' }))
    expect(window.location.hash).toBe('#/orders')
  })

  it('đưa hash lạ về #/pos', async () => {
    meMock.mockResolvedValue(session())
    window.location.hash = '#/khong-co'
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await waitFor(() => expect(window.location.hash).toBe('#/pos'))
  })

  it('đưa hash rỗng về #/pos', async () => {
    meMock.mockResolvedValue(session())
    window.location.hash = ''
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await waitFor(() => expect(window.location.hash).toBe('#/pos'))
  })

  it('giữ nguyên đơn đang làm khi rời trang rồi quay lại', async () => {
    meMock.mockResolvedValue(session())
    usePOSStore.getState().setTable('ban-5')
    usePOSStore.getState().addItem('ga-nuong')
    usePOSStore.getState().setNote('Ít đá')

    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await user.click(screen.getByRole('button', { name: 'Đơn hàng' }))
    await screen.findByRole('button', { name: 'POS' })
    await user.click(screen.getByRole('button', { name: 'POS' }))

    expect(usePOSStore.getState().cart).toHaveLength(1)
    expect(usePOSStore.getState().tableId).toBe('ban-5')
    expect(usePOSStore.getState().note).toBe('Ít đá')
  })

  it('mở popup đơn hàng từ nút Tạo đơn', async () => {
    meMock.mockResolvedValue(session())
    window.location.hash = '#/pos'
    usePOSStore.getState().addItem('ga-nuong')

    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await user.click(await screen.findByRole('button', { name: /Tạo đơn/ }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Lưu chờ thanh toán')
    expect(
      within(dialog).getByRole('button', { name: 'Chọn bàn' }),
    ).toBeInTheDocument()
  })

  it('giữ luồng hoá đơn sau khi thanh toán trong popup', async () => {
    meMock.mockResolvedValue(session())
    window.location.hash = '#/pos'
    usePOSStore.getState().addItem('ga-nuong')

    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'POS' })
    await user.click(await screen.findByRole('button', { name: /Tạo đơn/ }))
    await user.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await user.click(screen.getByRole('button', { name: /Xem hoá đơn/ }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Hoá đơn')
    expect(
      screen.queryByRole('button', { name: 'Lưu chờ thanh toán' }),
    ).not.toBeInTheDocument()
  })

  it('renders the real tables page at #/tables', async () => {
    meMock.mockResolvedValue(session())
    window.location.hash = '#/tables'
    render(<App />)
    await screen.findByText('Theo dõi trạng thái phục vụ và mở bàn để gọi món.')
    expect(screen.queryByText('Đang hoàn thiện')).not.toBeInTheDocument()
  })

  it('giữ deep-link #/menu qua màn đăng nhập', async () => {
    meMock.mockRejectedValue(new Error('401'))
    vi.mocked(authApi.staff).mockResolvedValue([{ id: 'u1', name: 'Ngọc Anh', role: 'MANAGER' }])
    window.location.hash = '#/menu'
    render(<App />)
    await screen.findByRole('button', { name: '1' }) // màn PIN/login
    expect(window.location.hash).toBe('#/menu')

    act(() => {
      useAuthStore.setState({ status: 'authenticated', user: USER, authMethod: 'password', expiresAt: '2026-11-21T00:00:00.000Z' })
    })
    // MenuPage thật sự render, KHÔNG phải PlaceholderPage của route ':pageId'
    // (PlaceholderPage cũng có heading 'Thực đơn' nhưng mô tả khác + badge 'Đang hoàn thiện'):
    await screen.findByText('Quản lý món, giá bán và trạng thái phục vụ.')
    expect(screen.queryByText('Đang hoàn thiện')).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/menu'))
    expect(window.location.hash).toBe('#/menu')
  })
})
