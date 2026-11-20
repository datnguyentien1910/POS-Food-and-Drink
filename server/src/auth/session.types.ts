import type { Session, SessionData } from 'express-session';
import type { Role } from '../generated/prisma/enums.js';

export type AuthMethod = 'password' | 'pin';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    restaurantId?: string;
    name?: string;
    email?: string;
    role?: Role;
    authMethod?: AuthMethod;
    deviceId?: string;
    absoluteExpiresAt?: string;
  }
}

export type SessionWithData = Session & Partial<SessionData>;
