/**
 * Device context attached to the request by `DeviceGuard`. Routes that need
 * the calling terminal read it via `@Req()`.
 */
export interface DeviceContext {
  id: string;
  restaurantId: string;
  name: string;
}

/** Public device shape; never includes the token or its hash. */
export interface DeviceResponse {
  id: string;
  name: string;
  registeredById: string;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  current: boolean;
}

declare global {
  namespace Express {
    interface Request {
      device?: DeviceContext;
    }
  }
}
