import type { Role } from '../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  restaurantId: string;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  authMethod: 'password' | 'pin';
  expiresAt: string;
}

/** Minimal staff card shown on the PIN login screen. */
export interface StaffMember {
  id: string;
  name: string;
  role: Role;
}
