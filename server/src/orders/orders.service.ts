import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppException } from '../common/errors/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { computeChange, computeOrderTotals } from './money.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import { IdempotencyService } from './idempotency.service.js';
import { OrderCodeService } from './order-code.service.js';
import { toOrderResponse, type OrderResponse } from './order-response.js';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const TAKEAWAY_NAME = 'Mang đi';
const ENDPOINT = 'POST /orders';
const INVALID_ITEM = 'Món không hợp lệ';

@Injectable()
export class OrdersService {
  constructor(
    private readonly audit: AuditService,
    private readonly orderCode: OrderCodeService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(
    dto: CreateOrderDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    meta: RequestMeta,
  ): Promise<OrderResponse> {
    return this.idempotency.execute({
      restaurantId: actor.restaurantId,
      endpoint: ENDPOINT,
      key: idempotencyKey,
      payload: dto,
      statusCode: 201,
      handler: (tx) => this.createInTransaction(tx, dto, actor, meta),
    });
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateOrderDto,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<OrderResponse> {
    const restaurant = await tx.restaurant.findUniqueOrThrow({
      where: { id: actor.restaurantId },
    });

    // 1. Snapshot the menu server-side; never trust prices from the client.
    const requestedIds = [...new Set(dto.items.map((item) => item.menuItemId))];
    const menuItems = await tx.menuItem.findMany({
      where: {
        id: { in: requestedIds },
        restaurantId: actor.restaurantId,
        available: true,
      },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const missingIds = requestedIds.filter((id) => !byId.has(id));
    if (missingIds.length > 0) {
      throw new AppException(400, 'ORDER_INVALID_ITEM', INVALID_ITEM, {
        missingIds,
      });
    }

    // 2. Snapshot the table; no table means takeaway.
    let tableId: string | null = null;
    let tableName = TAKEAWAY_NAME;
    if (dto.tableId) {
      const table = await tx.table.findFirst({
        where: { id: dto.tableId, restaurantId: actor.restaurantId },
      });
      if (!table) {
        throw new AppException(404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn');
      }
      tableId = table.id;
      tableName = table.name;
    }

    // 3. Money is computed from the snapshot prices.
    const lines = dto.items.map((item) => ({
      unitPrice: byId.get(item.menuItemId)!.price,
      qty: item.qty,
    }));
    const totals = computeOrderTotals(
      lines,
      dto.discount ?? null,
      restaurant.taxRateBps,
    );

    // 4. Payment: cash needs enough money, transfers/cards keep it null.
    const method = dto.payment.method;
    const received = method === 'CASH' ? dto.payment.received : undefined;
    const change =
      method === 'CASH' ? computeChange(totals.total, received ?? -1) : null;

    // 5. Order code inside the same transaction.
    const { code } = await this.orderCode.next(
      tx,
      actor.restaurantId,
      restaurant.timezone,
      new Date(),
    );

    const order = await tx.order.create({
      data: {
        restaurantId: actor.restaurantId,
        code,
        clientId: dto.clientId ?? null,
        tableId,
        tableName,
        status: 'COMPLETED',
        subtotal: totals.subtotal,
        discountType: dto.discount?.type ?? null,
        discountValue: dto.discount?.value ?? null,
        discountAmount: totals.discountAmount,
        tax: totals.tax,
        total: totals.total,
        note: dto.note ?? null,
        cashierId: actor.id,
        cashierName: actor.name,
        items: {
          create: dto.items.map((item) => {
            const menuItem = byId.get(item.menuItemId)!;
            return {
              menuItemId: menuItem.id,
              name: menuItem.name,
              unitPrice: menuItem.price,
              qty: item.qty,
              note: item.note ?? null,
            };
          }),
        },
        payment: {
          create: {
            method,
            amount: totals.total,
            received: received ?? null,
            change,
          },
        },
      },
      include: { items: true, payment: true },
    });

    await this.audit.record(
      {
        restaurantId: actor.restaurantId,
        actorId: actor.id,
        action: 'ORDER_CREATED',
        entity: 'Order',
        entityId: order.id,
        after: { code, total: totals.total, paymentMethod: method },
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      tx,
    );

    return toOrderResponse(order);
  }
}
