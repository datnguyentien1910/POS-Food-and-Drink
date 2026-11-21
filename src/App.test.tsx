import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, SessionResponse } from './api/types'
import App from './App'
import { useAuthStore } from './store/useAuthStore'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  staff: vi.fn(),
  loginWithPin: vi.fn(),
  registerDevice: vi.fn(),
}))

import * as authApi from './api/auth'

const meMock = vi.mocked(authApi.me)

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
    authMethod: 'password',
    expiresAt: '2026-11-21T00:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    status: 'checking',
    user: null,
    authMethod: null,
    expiresAt: null,
    lastUser: null,
    lastOnlineAt: null,
    error: null,
  })
})

describe('App auth gate', () => {
  it('renders the app shell and the signed-in user after the session check', async () => {
    meMock.mockResolvedValue(session())

    render(<App />)

    expect(
      await screen.findByRole('button', { name: 'POS' }),
    ).toBeInTheDocument()
    expect(screen.getByText('RestoDash')).toBeInTheDocument()
    expect(screen.getByText('Ngọc Anh')).toBeInTheDocument()
  })

  it('shows the login page when there is no session', async () => {
    meMock.mockRejectedValue(new Error('401'))
    vi.mocked(authApi.staff).mockResolvedValue([
      { id: 'u1', name: 'Ngọc Anh', role: 'MANAGER' },
    ])

    render(<App />)

    expect(
      await screen.findByRole('button', { name: '1' }),
    ).toBeInTheDocument()
  })
})
