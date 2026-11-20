import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http'
import type { AuthUser, SessionResponse, StaffUser } from '../api/types'
import { useAuthStore } from './useAuthStore'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  staff: vi.fn(),
  loginWithPin: vi.fn(),
  registerDevice: vi.fn(),
}))

import * as authApi from '../api/auth'

const loginMock = vi.mocked(authApi.login)
const meMock = vi.mocked(authApi.me)
const logoutMock = vi.mocked(authApi.logout)
const staffMock = vi.mocked(authApi.staff)
const pinMock = vi.mocked(authApi.loginWithPin)
const registerMock = vi.mocked(authApi.registerDevice)

const USER: AuthUser = {
  id: 'u1',
  name: 'Ngọc Anh',
  email: 'manager@restodash.local',
  role: 'MANAGER',
  restaurantId: 'r1',
}

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    user: USER,
    authMethod: 'password',
    expiresAt: '2026-11-21T00:00:00.000Z',
    ...overrides,
  }
}

function resetStore() {
  useAuthStore.setState({
    status: 'anonymous',
    user: null,
    authMethod: null,
    expiresAt: null,
    lastUser: null,
    lastOnlineAt: null,
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

describe('useAuthStore.refresh', () => {
  it('authenticates and remembers the last user', async () => {
    meMock.mockResolvedValue(session())

    await useAuthStore.getState().refresh()

    const state = useAuthStore.getState()
    expect(state.status).toBe('authenticated')
    expect(state.user).toEqual(USER)
    expect(state.lastUser).toEqual(USER)
    expect(state.lastOnlineAt).toBeGreaterThan(0)
  })

  it('goes anonymous on a 401', async () => {
    meMock.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Hết phiên'))

    await useAuthStore.getState().refresh()

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('falls back to offline when the server is unreachable and a user was saved', async () => {
    useAuthStore.setState({ lastUser: USER })
    meMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Mất mạng'))

    await useAuthStore.getState().refresh()

    const state = useAuthStore.getState()
    expect(state.status).toBe('offline')
    expect(state.user).toEqual(USER)
  })

  it('stays anonymous offline when no user was ever saved', async () => {
    meMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Mất mạng'))

    await useAuthStore.getState().refresh()

    expect(useAuthStore.getState().status).toBe('anonymous')
  })
})

describe('useAuthStore login', () => {
  it('authenticates with a password and records the method', async () => {
    loginMock.mockResolvedValue(session())

    await useAuthStore.getState().loginPassword('a@b.c', 'secret')

    const state = useAuthStore.getState()
    expect(state.status).toBe('authenticated')
    expect(state.authMethod).toBe('password')
    expect(state.user).toEqual(USER)
  })

  it('authenticates with a PIN and records the method', async () => {
    pinMock.mockResolvedValue(session({ authMethod: 'pin' }))

    await useAuthStore.getState().loginPin('u1', '1234')

    expect(useAuthStore.getState().authMethod).toBe('pin')
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('propagates a rejected PIN without authenticating', async () => {
    pinMock.mockRejectedValue(new ApiError(401, 'INVALID_PIN', 'PIN sai'))

    await expect(
      useAuthStore.getState().loginPin('u1', '0000'),
    ).rejects.toBeInstanceOf(ApiError)

    expect(useAuthStore.getState().status).toBe('anonymous')
  })
})

describe('useAuthStore.loadStaff', () => {
  it('returns the device staff list', async () => {
    const staff: StaffUser[] = [{ id: 'u1', name: 'Ngọc Anh', role: 'MANAGER' }]
    staffMock.mockResolvedValue(staff)

    await expect(useAuthStore.getState().loadStaff()).resolves.toEqual(staff)
  })
})

describe('useAuthStore.setupDevice', () => {
  it('logs in with a password, registers the device and drops the password session', async () => {
    loginMock.mockResolvedValue(session())
    registerMock.mockResolvedValue({ id: 'd1', name: 'POS quầy 1' })
    logoutMock.mockResolvedValue({ success: true })

    await useAuthStore.getState().setupDevice({
      email: 'owner@restodash.local',
      password: 'Owner@12345',
      name: 'POS quầy 1',
    })

    expect(loginMock).toHaveBeenCalledWith(
      'owner@restodash.local',
      'Owner@12345',
    )
    expect(registerMock).toHaveBeenCalledWith('POS quầy 1')
    expect(logoutMock).toHaveBeenCalled()
    // Registering a device is not a sign-in: the operator still uses a PIN.
    expect(useAuthStore.getState().status).toBe('anonymous')
  })
})

describe('useAuthStore.logout', () => {
  it('calls the server and clears the local session', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: USER,
      lastUser: USER,
      authMethod: 'pin',
    })
    logoutMock.mockResolvedValue({ success: true })

    await useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(logoutMock).toHaveBeenCalled()
    expect(state.status).toBe('anonymous')
    expect(state.user).toBeNull()
    expect(state.lastUser).toBeNull()
  })

  it('still clears locally when the server is unreachable', async () => {
    useAuthStore.setState({ status: 'authenticated', user: USER, lastUser: USER })
    logoutMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Mất mạng'))

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().user).toBeNull()
  })
})
