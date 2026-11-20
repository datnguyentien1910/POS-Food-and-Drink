export type Role = 'OWNER' | 'MANAGER' | 'CASHIER'

/** Authenticated session user, mirrors `AuthenticatedUser` on the server. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  restaurantId: string
}

/** Body of `POST /auth/login` and `GET /auth/me`. */
export interface SessionResponse {
  user: AuthUser
  authMethod: 'password' | 'pin'
  expiresAt: string
}

/** Minimal staff card from `GET /auth/staff`. */
export interface StaffUser {
  id: string
  name: string
  role: Role
}

/** Result of `POST /devices`. */
export interface DeviceResponse {
  id: string
  name: string
}
