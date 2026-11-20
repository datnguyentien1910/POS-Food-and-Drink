import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http'
import type { AuthUser, SessionResponse, StaffUser } from '../api/types'
import { useAuthStore } from '../store/useAuthStore'
import { LoginPage } from './LoginPage'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  staff: vi.fn(),
  loginWithPin: vi.fn(),
  registerDevice: vi.fn(),
}))

import * as authApi from '../api/auth'

const staffMock = vi.mocked(authApi.staff)
const pinMock = vi.mocked(authApi.loginWithPin)

const STAFF: StaffUser[] = [
  { id: 'u1', name: 'Ngọc Anh', role: 'MANAGER' },
  { id: 'u2', name: 'Thu Hà', role: 'CASHIER' },
]

const USER: AuthUser = {
  id: 'u1',
  name: 'Ngọc Anh',
  email: 'manager@restodash.local',
  role: 'MANAGER',
  restaurantId: 'r1',
}

function session(): SessionResponse {
  return {
    user: USER,
    authMethod: 'pin',
    expiresAt: '2026-11-21T00:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    status: 'anonymous',
    user: null,
    authMethod: null,
    expiresAt: null,
    lastUser: null,
    lastOnlineAt: null,
    error: null,
  })
})

describe('LoginPage', () => {
  it('shows the device staff list and a PIN pad', async () => {
    staffMock.mockResolvedValue(STAFF)

    render(<LoginPage />)

    expect(await screen.findByText('Ngọc Anh')).toBeInTheDocument()
    expect(screen.getByText('Thu Hà')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('asks to register the device when the server reports DEVICE_REQUIRED', async () => {
    staffMock.mockRejectedValue(
      new ApiError(401, 'DEVICE_REQUIRED', 'Thiết bị chưa đăng ký'),
    )

    render(<LoginPage />)

    expect(await screen.findByLabelText('Tên thiết bị')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
  })

  it('signs in with a PIN after picking a staff member', async () => {
    staffMock.mockResolvedValue(STAFF)
    pinMock.mockResolvedValue(session())

    render(<LoginPage />)

    await userEvent.click(await screen.findByText('Ngọc Anh'))
    for (const digit of ['1', '2', '3', '4']) {
      await userEvent.click(screen.getByRole('button', { name: digit }))
    }

    expect(pinMock).toHaveBeenCalledWith('u1', '1234')
  })

  it('reports a wrong PIN without signing in', async () => {
    staffMock.mockResolvedValue(STAFF)
    pinMock.mockRejectedValue(new ApiError(401, 'INVALID_PIN', 'PIN sai'))

    render(<LoginPage />)

    await userEvent.click(await screen.findByText('Ngọc Anh'))
    for (const digit of ['0', '0', '0', '0']) {
      await userEvent.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByText('PIN không đúng')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })
})
