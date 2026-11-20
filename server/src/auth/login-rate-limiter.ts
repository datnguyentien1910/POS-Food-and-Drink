import { AppException } from '../common/errors/app.exception.js';

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;

/**
 * In-memory sliding-window limiter for the password login route only.
 * PIN login is intentionally not rate limited (spec decision D-12).
 * A single process is enough for Phase 1; move to a shared store when the
 * API scales horizontally.
 */
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly clock: () => number = Date.now) {}

  assertAllowed(ip: string): void {
    if (this.recentFailures(ip).length >= MAX_FAILURES) {
      throw new AppException(
        429,
        'RATE_LIMITED',
        'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau',
      );
    }
  }

  recordFailure(ip: string): void {
    const recent = this.recentFailures(ip);
    recent.push(this.clock());
    this.failures.set(ip, recent.slice(-MAX_FAILURES));
  }

  reset(ip: string): void {
    this.failures.delete(ip);
  }

  resetAll(): void {
    this.failures.clear();
  }

  private recentFailures(ip: string): number[] {
    const now = this.clock();
    return (this.failures.get(ip) ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );
  }
}
