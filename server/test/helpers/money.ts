export interface OrderLineInput {
  legacyId: string;
  qty: number;
  note?: string;
}

export interface OrderPayloadInput {
  menuIds: Record<string, string>;
  items: OrderLineInput[];
  tableId?: string | null;
  discount?: { type: 'AMOUNT' | 'PERCENT'; value: number } | null;
  note?: string | null;
  payment: { method: 'CASH' | 'TRANSFER' | 'CARD'; received?: number };
  clientId?: string | null;
}

/**
 * Builds a `POST /orders` body from seed `legacyId`s so the e2e specs never
 * hardcode database ids. Returns a loose record so tests can inject invalid
 * fields (for example a client-supplied `unitPrice`).
 */
export function orderPayload(input: OrderPayloadInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    items: input.items.map((item) => ({
      menuItemId: input.menuIds[item.legacyId],
      qty: item.qty,
      ...(item.note === undefined ? {} : { note: item.note }),
    })),
    payment: input.payment,
  };

  if (input.tableId !== undefined) payload.tableId = input.tableId;
  if (input.discount) payload.discount = input.discount;
  if (input.note !== undefined) payload.note = input.note;
  if (input.clientId !== undefined) payload.clientId = input.clientId;

  return payload;
}
