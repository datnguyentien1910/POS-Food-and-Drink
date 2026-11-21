import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, SessionResponse } from '../api/types'
import App from '../App'
import { useAuthStore } from '../store/useAuthStore'

vi.mock('../api/auth', () => ({
  login: vi.fn(), me: vi.fn(), logout: vi.fn(),
  staff: vi.fn(), loginWithPin: vi.fn(), registerDevice: vi.fn(),
}))
import * as authApi from '../api/auth'
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
})
