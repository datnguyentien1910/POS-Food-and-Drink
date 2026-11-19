import { describe, expect, it } from 'vitest';
import { AppException } from '../common/errors/app.exception.js';
import { computeChange, computeOrderTotals } from './money.js';

describe('computeOrderTotals', () => {
  it('applies a percent discount then VAT', () => {
    expect(
      computeOrderTotals(
        [
          { unitPrice: 120000, qty: 2 },
          { unitPrice: 35000, qty: 1 },
        ],
        { type: 'PERCENT', value: 10 },
        800,
      ),
    ).toEqual({ subtotal: 275000, discountAmount: 27500, tax: 19800, total: 267300 });
  });

  it('caps an amount discount at the subtotal', () => {
    expect(
      computeOrderTotals(
        [
          { unitPrice: 120000, qty: 2 },
          { unitPrice: 35000, qty: 1 },
        ],
        { type: 'AMOUNT', value: 300000 },
        800,
      ),
    ).toEqual({ subtotal: 275000, discountAmount: 275000, tax: 0, total: 0 });
  });

  it('turns a 100% discount into a zero bill', () => {
    expect(
      computeOrderTotals([{ unitPrice: 120000, qty: 2 }], { type: 'PERCENT', value: 100 }, 800),
    ).toEqual({ subtotal: 240000, discountAmount: 240000, tax: 0, total: 0 });
  });

  it('rounds the VAT half-up', () => {
    expect(computeOrderTotals([{ unitPrice: 1007, qty: 1 }], null, 800)).toEqual({
      subtotal: 1007,
      discountAmount: 0,
      tax: 81,
      total: 1088,
    });
  });

  it('computes whole VAT for round subtotals', () => {
    expect(computeOrderTotals([{ unitPrice: 1000, qty: 1 }], null, 800).tax).toBe(80);
  });

  it('rejects a zero or negative discount', () => {
    for (const discount of [
      { type: 'PERCENT' as const, value: 0 },
      { type: 'AMOUNT' as const, value: 0 },
      { type: 'AMOUNT' as const, value: -100 },
    ]) {
      expect(() =>
        computeOrderTotals([{ unitPrice: 1000, qty: 1 }], discount, 800),
      ).toThrow(AppException);
    }
  });

  it('rejects a discount above 100 percent', () => {
    expect(() =>
      computeOrderTotals([{ unitPrice: 1000, qty: 1 }], { type: 'PERCENT', value: 101 }, 800),
    ).toThrow(AppException);
  });

  it('rejects invalid lines', () => {
    expect(() => computeOrderTotals([{ unitPrice: 1000, qty: 0 }], null, 800)).toThrow(AppException);
    expect(() => computeOrderTotals([{ unitPrice: 1000, qty: 1.5 }], null, 800)).toThrow(
      AppException,
    );
    expect(() => computeOrderTotals([{ unitPrice: -1, qty: 1 }], null, 800)).toThrow(AppException);
  });
});

describe('computeChange', () => {
  it('returns the change when the customer pays enough', () => {
    expect(computeChange(267300, 500000)).toBe(232700);
    expect(computeChange(1000, 1000)).toBe(0);
  });

  it('rejects short or invalid payments', () => {
    expect(() => computeChange(1000, 999)).toThrow(AppException);
    expect(() => computeChange(1000, -1)).toThrow(AppException);
    expect(() => computeChange(1000, 1000.5)).toThrow(AppException);
  });
});
