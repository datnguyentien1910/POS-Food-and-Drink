import { describe, expect, it } from 'vitest';
import { AppException } from '../common/errors/app.exception.js';
import { businessDate, formatOrderCode } from './order-code.service.js';

describe('businessDate', () => {
  it('keeps 16:59:59Z on the old Vietnamese day', () => {
    expect(businessDate(new Date('2026-11-19T16:59:59Z'), 'Asia/Ho_Chi_Minh')).toBe(
      '20261119',
    );
  });

  it('rolls over to the new day at 17:00:00Z', () => {
    expect(businessDate(new Date('2026-11-19T17:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe(
      '20261120',
    );
  });

  it('rejects an invalid timezone', () => {
    expect(() => businessDate(new Date(), 'Not/AZone')).toThrow(AppException);
  });
});

describe('formatOrderCode', () => {
  it('pads the sequence to three digits', () => {
    expect(formatOrderCode('20261120', 7)).toBe('HD-20261120-007');
    expect(formatOrderCode('20261120', 1000)).toBe('HD-20261120-1000');
  });

  it('rejects malformed input', () => {
    expect(() => formatOrderCode('2026-11-20', 1)).toThrow(AppException);
    expect(() => formatOrderCode('20261120', 0)).toThrow(AppException);
  });
});
