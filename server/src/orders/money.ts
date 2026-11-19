import { AppException } from '../common/errors/app.exception.js';

export interface MoneyLine {
  unitPrice: number;
  qty: number;
}

export interface DiscountInput {
  type: 'AMOUNT' | 'PERCENT';
  value: number;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  tax: number;
  total: number;
}

const INVALID_ITEM = 'Món không hợp lệ';
const INVALID_DISCOUNT = 'Giảm giá không hợp lệ';
const INVALID_PAYMENT = 'Tiền khách đưa không đủ';

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Server-side pricing (spec §9.1). Pure function: never reads the database
 * and never mutates its inputs. VAT is applied after the discount and every
 * amount is rounded half-up with `Math.round`.
 */
export function computeOrderTotals(
  lines: MoneyLine[],
  discount: DiscountInput | null,
  taxRateBps: number,
): OrderTotals {
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0) {
    throw new AppException(400, 'ORDER_INVALID_TAX', 'Thuế suất không hợp lệ');
  }

  let subtotal = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new AppException(400, 'ORDER_INVALID_ITEM', INVALID_ITEM);
    }
    if (!isPositiveInteger(line.qty)) {
      throw new AppException(400, 'ORDER_INVALID_ITEM', INVALID_ITEM);
    }
    subtotal += line.unitPrice * line.qty;
  }

  let discountAmount = 0;
  if (discount) {
    if (!isPositiveInteger(discount.value)) {
      throw new AppException(400, 'ORDER_INVALID_DISCOUNT', INVALID_DISCOUNT);
    }
    if (discount.type === 'PERCENT') {
      if (discount.value > 100) {
        throw new AppException(400, 'ORDER_INVALID_DISCOUNT', INVALID_DISCOUNT);
      }
      discountAmount = Math.round((subtotal * discount.value) / 100);
    } else if (discount.type === 'AMOUNT') {
      discountAmount = discount.value;
    } else {
      throw new AppException(400, 'ORDER_INVALID_DISCOUNT', INVALID_DISCOUNT);
    }
    // A discount can never make the bill negative.
    discountAmount = Math.min(discountAmount, subtotal);
  }

  const afterDiscount = subtotal - discountAmount;
  const tax = Math.round((afterDiscount * taxRateBps) / 10_000);
  const total = afterDiscount + tax;

  return { subtotal, discountAmount, tax, total };
}

export function computeChange(total: number, received: number): number {
  if (!Number.isInteger(total) || total < 0) {
    throw new AppException(400, 'ORDER_INVALID_PAYMENT', INVALID_PAYMENT);
  }
  if (!Number.isInteger(received) || received < 0 || received < total) {
    throw new AppException(400, 'ORDER_INVALID_PAYMENT', INVALID_PAYMENT);
  }
  return received - total;
}
