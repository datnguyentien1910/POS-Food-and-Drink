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
