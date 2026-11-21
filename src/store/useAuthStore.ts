import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '../api/auth'
import { ApiError } from '../api/http'
import type { AuthUser, DeviceResponse, SessionResponse, StaffUser } from '../api/types'

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated' | 'offline'

export interface DeviceSetupInput {
  email: string
  password: string
  name: string
}

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  authMethod: 'password' | 'pin' | null
  expiresAt: string | null
  lastUser: AuthUser | null
  lastOnlineAt: number | null
  error: string | null
  refresh: () => Promise<void>
  loginPassword: (email: string, password: string) => Promise<void>
  loginPin: (userId: string, pin: string) => Promise<void>
  loadStaff: () => Promise<StaffUser[]>
  setupDevice: (input: DeviceSetupInput) => Promise<DeviceResponse>
  logout: () => Promise<void>
}

const STORAGE_KEY = 'restodash-auth-v1'

function applySession(session: SessionResponse) {
  return {
    status: 'authenticated' as const,
    user: session.user,
    authMethod: session.authMethod,
    expiresAt: session.expiresAt,
    lastUser: session.user,
    lastOnlineAt: Date.now(),
    error: null,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'checking',
      user: null,
      authMethod: null,
      expiresAt: null,
      lastUser: null,
      lastOnlineAt: null,
      error: null,

      async refresh() {
        set({ status: 'checking', error: null })
        try {
          const session = await authApi.me()
          set(applySession(session))
        } catch (error) {
          // Unreachable server with a remembered user: keep selling offline.
          if (error instanceof ApiError && error.isOffline && get().lastUser) {
            set({ status: 'offline', user: get().lastUser })
            return
          }
          set({
            status: 'anonymous',
            user: null,
            authMethod: null,
            expiresAt: null,
          })
        }
      },

      async loginPassword(email, password) {
        const session = await authApi.login(email, password)
        set(applySession(session))
      },

      async loginPin(userId, pin) {
        const session = await authApi.loginWithPin(userId, pin)
        set(applySession(session))
      },

      loadStaff() {
        return authApi.staff()
      },

      async setupDevice(input) {
        // Registering needs a password session, but the operator still signs
        // in with a PIN, so drop that session instead of authenticating.
        await authApi.login(input.email, input.password)
        try {
          return await authApi.registerDevice(input.name)
        } finally {
          await authApi.logout().catch(() => undefined)
        }
      },

      async logout() {
        try {
          await authApi.logout()
        } catch {
          // Offline logout: clear the local session anyway.
        }
        set({
          status: 'anonymous',
          user: null,
          authMethod: null,
          expiresAt: null,
          lastUser: null,
          lastOnlineAt: null,
          error: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        lastUser: state.lastUser,
        lastOnlineAt: state.lastOnlineAt,
      }),
    },
  ),
)
