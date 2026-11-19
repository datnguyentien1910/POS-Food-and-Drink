import type {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/enums.js';
import type { Order, OrderItem, Payment } from '../generated/prisma/client.js';

export interface OrderItemResponse {
  menuItemId: string | null;
  name: string;
  unitPrice: number;
  qty: number;
  note: string | null;
}

export interface PaymentResponse {
  method: PaymentMethod;
  amount: number;
  received: number | null;
  change: number | null;
  status: PaymentStatus;
}

export interface OrderResponse {
  id: string;
  code: string;
  status: OrderStatus;
  tableId: string | null;
  tableName: string;
  items: OrderItemResponse[];
  subtotal: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmount: number;
  tax: number;
  total: number;
  payment: PaymentResponse | null;
  note: string | null;
  cashierName: string;
  createdAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
}

export type OrderWithRelations = Order & {
  items: OrderItem[];
  payment: Payment | null;
};

export function toOrderResponse(order: OrderWithRelations): OrderResponse {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    tableId: order.tableId,
    tableName: order.tableName,
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      unitPrice: item.unitPrice,
      qty: item.qty,
      note: item.note,
    })),
    subtotal: order.subtotal,
    discountType: order.discountType,
    discountValue: order.discountValue,
    discountAmount: order.discountAmount,
    tax: order.tax,
    total: order.total,
    payment: order.payment
      ? {
          method: order.payment.method,
          amount: order.payment.amount,
          received: order.payment.received,
          change: order.payment.change,
          status: order.payment.status,
        }
      : null,
    note: order.note,
    cashierName: order.cashierName,
    createdAt: order.createdAt,
    voidedAt: order.voidedAt,
    voidReason: order.voidReason,
  };
}
