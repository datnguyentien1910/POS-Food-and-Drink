import { describe, expect, it } from 'vitest';
import { AppException } from '../common/errors/app.exception.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

function createLimiter(startAt = 0) {
  let now = startAt;
  const limiter = new LoginRateLimiter(() => now);
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('LoginRateLimiter', () => {
  it('allows up to five failures within the window', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(() => clock.limiter.assertAllowed('1.1.1.1')).not.toThrow();
      clock.limiter.recordFailure('1.1.1.1');
    }

    expect(() => clock.limiter.assertAllowed('1.1.1.1')).toThrow(AppException);
  });

  it('reports RATE_LIMITED with status 429 on the sixth attempt', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock.limiter.recordFailure('1.1.1.1');
    }

    try {
      clock.limiter.assertAllowed('1.1.1.1');
      throw new Error('expected assertAllowed to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const appError = error as AppException;
      expect(appError.code).toBe('RATE_LIMITED');
      expect(appError.getStatus()).toBe(429);
    }
  });

  it('allows again once the window has passed', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock.limiter.recordFailure('1.1.1.1');
    }

    clock.advance(60_001);

    expect(() => clock.limiter.assertAllowed('1.1.1.1')).not.toThrow();
  });

  it('clears history for a single ip on reset', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock.limiter.recordFailure('1.1.1.1');
    }

    clock.limiter.reset('1.1.1.1');

    expect(() => clock.limiter.assertAllowed('1.1.1.1')).not.toThrow();
  });

  it('does not affect other ip addresses', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock.limiter.recordFailure('1.1.1.1');
    }

    expect(() => clock.limiter.assertAllowed('2.2.2.2')).not.toThrow();
  });

  it('clears everything on resetAll', () => {
    const clock = createLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock.limiter.recordFailure('1.1.1.1');
    }

    clock.limiter.resetAll();

    expect(() => clock.limiter.assertAllowed('1.1.1.1')).not.toThrow();
  });
});
