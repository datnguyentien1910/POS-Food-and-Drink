import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppException } from '../common/errors/app.exception.js';
import { Paginated } from '../common/types/api.js';
import type { Prisma } from '../generated/prisma/client.js';
import { computeChange, computeOrderTotals } from './money.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { OrdersQueryDto } from './dto/orders-query.dto.js';
import {
  IdempotencyService,
  isUniqueViolation,
} from './idempotency.service.js';
import { OrderCodeService } from './order-code.service.js';
import { toOrderResponse, type OrderResponse } from './order-response.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const TAKEAWAY_NAME = 'Mang đi';
const ENDPOINT = 'POST /orders';
const INVALID_ITEM = 'Món không hợp lệ';
const ORDER_NOT_FOUND = 'Không tìm thấy đơn';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
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
    try {
      return await this.idempotency.execute({
        restaurantId: actor.restaurantId,
        endpoint: ENDPOINT,
        key: idempotencyKey,
        payload: dto,
        statusCode: 201,
        handler: (tx) => this.createInTransaction(tx, dto, actor, meta),
      });
    } catch (error) {
      // `clientId` is the client-generated order identity (Phase 2 offline
      // sync). A retry may arrive with a fresh Idempotency-Key, so the same
      // clientId must replay the existing order instead of surfacing the
      // unique-constraint violation as a 500. The early check inside
      // `createInTransaction` handles the sequential case; this covers the
      // race where two requests pass that check together.
      if (dto.clientId && isUniqueViolation(error)) {
        const existing = await this.findByClientId(
          actor.restaurantId,
          dto.clientId,
        );
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async list(
    restaurantId: string,
    query: OrdersQueryDto,
  ): Promise<Paginated<OrderResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = { restaurantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.tableId) {
      where.tableId = query.tableId;
    }
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }
    if (query.q) {
      where.OR = [
        { code: { contains: query.q, mode: 'insensitive' } },
        { tableName: { contains: query.q, mode: 'insensitive' } },
        { cashierName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return new Paginated(rows.map(toOrderResponse), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async detail(restaurantId: string, id: string): Promise<OrderResponse> {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurantId },
      include: { items: true, payment: true },
    });
    if (!order) {
      throw new AppException(404, 'NOT_FOUND', ORDER_NOT_FOUND);
    }
    return toOrderResponse(order);
  }

  private async findByClientId(
    restaurantId: string,
    clientId: string,
  ): Promise<OrderResponse | null> {
    const order = await this.prisma.order.findUnique({
      where: { restaurantId_clientId: { restaurantId, clientId } },
      include: { items: true, payment: true },
    });
    return order ? toOrderResponse(order) : null;
  }

  async voidOrder(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
    meta: RequestMeta,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      // Conditional update wins the race: only the first void flips the row.
      const updated = await tx.order.updateMany({
        where: { id, restaurantId: actor.restaurantId, status: 'COMPLETED' },
        data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason },
      });

      if (updated.count === 0) {
        const existing = await tx.order.findFirst({
          where: { id, restaurantId: actor.restaurantId },
        });
        if (!existing) {
          throw new AppException(404, 'NOT_FOUND', ORDER_NOT_FOUND);
        }
        throw new AppException(
          409,
          'ORDER_ALREADY_VOIDED',
          'Đơn đã được huỷ trước đó',
        );
      }

      await tx.payment.updateMany({
        where: { orderId: id, status: 'COMPLETED' },
        data: { status: 'VOIDED' },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, payment: true },
      });

      await this.audit.record(
        {
          restaurantId: actor.restaurantId,
          actorId: actor.id,
          action: 'ORDER_VOIDED',
          entity: 'Order',
          entityId: id,
          before: { status: 'COMPLETED' },
          after: { status: 'VOIDED' },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );

      return toOrderResponse(order);
    });
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateOrderDto,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<OrderResponse> {
    // Replay an order this client already created. Runs after the
    // idempotency-key check (in IdempotencyService), so reusing a key with a
    // different payload still returns IDEMPOTENCY_CONFLICT.
    if (dto.clientId) {
      const existing = await tx.order.findUnique({
        where: {
          restaurantId_clientId: {
            restaurantId: actor.restaurantId,
            clientId: dto.clientId,
          },
        },
        include: { items: true, payment: true },
      });
      if (existing) {
        return toOrderResponse(existing);
      }
    }

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

    // BE-3: an offline sale may have used a stale menu price. The client sends
    // the total it charged; if the server total differs, refuse to write the
    // order (before consuming a code or auditing) so a manager can reconcile.
    if (dto.expectedTotal != null && dto.expectedTotal !== totals.total) {
      throw new AppException(409, 'PRICE_CHANGED', 'Giá món đã thay đổi', {
        expectedTotal: dto.expectedTotal,
        actualTotal: totals.total,
      });
    }

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
