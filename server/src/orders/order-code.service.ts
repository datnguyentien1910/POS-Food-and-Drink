import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Builds the `YYYYMMDD` business date in the restaurant's timezone and the
 * daily order code `HD-YYYYMMDD-NNN`. Never uses `Date#getDate()` because the
 * server timezone is irrelevant here.
 */
export function businessDate(now: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    throw new AppException(
      400,
      'INVALID_TIMEZONE',
      'Múi giờ của quán không hợp lệ',
    );
  }

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}`;
}

export function formatOrderCode(date: string, sequence: number): string {
  if (!/^\d{8}$/.test(date)) {
    throw new AppException(400, 'ORDER_INVALID_DATE', 'Ngày đơn không hợp lệ');
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AppException(400, 'ORDER_INVALID_SEQUENCE', 'Số thứ tự đơn không hợp lệ');
  }
  return `HD-${date}-${String(sequence).padStart(3, '0')}`;
}

@Injectable()
export class OrderCodeService {
  async next(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    timeZone: string,
    now: Date,
  ): Promise<{ code: string; businessDate: string }> {
    const date = businessDate(now, timeZone);
    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "OrderCounter" ("restaurantId", "businessDate", "lastNumber")
      VALUES (${restaurantId}, ${date}, 1)
      ON CONFLICT ("restaurantId", "businessDate")
      DO UPDATE SET "lastNumber" = "OrderCounter"."lastNumber" + 1
      RETURNING "lastNumber"
    `;
    const lastNumber = rows[0]?.lastNumber ?? 1;
    return { code: formatOrderCode(date, lastNumber), businessDate: date };
  }
}
