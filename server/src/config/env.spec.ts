import { describe, expect, it } from 'vitest';
import { parseOrigins, validateEnv } from './env.js';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://restodash:secret@localhost:5432/restodash',
  TEST_DATABASE_URL: 'postgresql://restodash:secret@localhost:5432/restodash_test',
  SESSION_SECRET: 's'.repeat(32),
  PIN_PEPPER: 'p'.repeat(32),
  CORS_ORIGINS: '',
  SWAGGER_ENABLED: 'true',
};

describe('validateEnv', () => {
  it('parses a valid environment and coerces PORT', () => {
    const env = validateEnv(baseEnv);

    expect(env.PORT).toBe(3001);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
  });

  it('names a missing SESSION_SECRET', () => {
    const { SESSION_SECRET: _missing, ...withoutSecret } = baseEnv;

    expect(() => validateEnv(withoutSecret)).toThrow(/SESSION_SECRET/);
  });

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...baseEnv, SESSION_SECRET: 'too-short' }),
    ).toThrow(/SESSION_SECRET/);
  });
});

describe('parseOrigins', () => {
  it('trims entries and drops empty ones', () => {
    expect(
      parseOrigins('http://localhost:5173, https://a.vn, '),
    ).toEqual(['http://localhost:5173', 'https://a.vn']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseOrigins('')).toEqual([]);
  });
});
