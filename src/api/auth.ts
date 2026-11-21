import { request } from './http'
import type { DeviceResponse, SessionResponse, StaffUser } from './types'

export function login(email: string, password: string): Promise<SessionResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function me(): Promise<SessionResponse> {
  return request('/auth/me')
}

export function logout(): Promise<{ success: boolean }> {
  return request('/auth/logout', { method: 'POST' })
}

export function staff(): Promise<StaffUser[]> {
  return request('/auth/staff')
}

export function loginWithPin(
  userId: string,
  pin: string,
): Promise<SessionResponse> {
  return request('/auth/pin', { method: 'POST', body: { userId, pin } })
}

export function registerDevice(name: string): Promise<DeviceResponse> {
  return request('/devices', { method: 'POST', body: { name } })
}
