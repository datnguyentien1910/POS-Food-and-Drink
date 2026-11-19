import { RESTAURANT } from '../../config'
import { formatDateTime, formatVND } from '../../lib/format'
import type { OrderRecord, PaymentMethod } from '../../types'

interface ReceiptProps {
  order: OrderRecord
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ',
}

export function Receipt({ order }: ReceiptProps) {
  const taxPercent = Math.round(RESTAURANT.taxRate * 100)

  return (
    <article className="w-[80mm] max-w-full bg-white px-1 py-2 text-[#111]">
      <header className="text-center">
        <p className="text-[15px] leading-tight font-bold tracking-wide uppercase">
          {RESTAURANT.name}
        </p>
        <p className="mt-1 text-[9px] leading-snug">{RESTAURANT.address}</p>
        <p className="text-[9px] leading-snug">ĐT: {RESTAURANT.phone}</p>
      </header>

      <div className="my-2 border-t border-dashed border-black/40" />

      <p className="text-center text-[11px] font-bold tracking-[0.14em] uppercase">
        Hoá đơn thanh toán
      </p>
      <p className="mt-0.5 text-center text-[9px]">
        {order.code} · {formatDateTime(order.createdAt)}
      </p>

      <div className="mt-2 space-y-0.5 text-[9px]">
        <div className="flex justify-between gap-2">
          <span>Bàn</span>
          <span className="font-semibold">{order.tableName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Thu ngân</span>
          <span className="font-semibold">{order.cashier}</span>
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="text-left uppercase">
            <th className="pb-1 font-semibold">Món</th>
            <th className="pb-1 text-center font-semibold">SL</th>
            <th className="pb-1 text-right font-semibold">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.menuItemId}-${index}`} className="align-top">
              <td className="py-0.5 pr-1 break-words">{item.name}</td>
              <td className="py-0.5 text-center">{item.qty}</td>
              <td className="py-0.5 text-right whitespace-nowrap">
                {formatVND(item.unitPrice * item.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="space-y-1 text-[9px]">
        <div className="flex justify-between gap-2">
          <span>Tạm tính</span>
          <span className="tabular-nums">{formatVND(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 ? (
          <div className="flex justify-between gap-2">
            <span>Giảm giá</span>
            <span className="tabular-nums">
              -{formatVND(order.discountAmount)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span>VAT ({taxPercent}%)</span>
          <span className="tabular-nums">{formatVND(order.tax)}</span>
        </div>
        <div className="flex justify-between gap-2 border-t border-black/30 pt-1 text-[11px] font-bold">
          <span>Tổng cộng</span>
          <span className="tabular-nums">{formatVND(order.total)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Thanh toán</span>
          <span>{METHOD_LABELS[order.method]}</span>
        </div>
        {order.method === 'cash' && order.received !== undefined ? (
          <>
            <div className="flex justify-between gap-2">
              <span>Khách đưa</span>
              <span className="tabular-nums">
                {formatVND(order.received)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Tiền thối</span>
              <span className="tabular-nums">
                {formatVND(order.change ?? 0)}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {order.note ? (
        <>
          <div className="my-2 border-t border-dashed border-black/40" />
          <p className="text-[9px] break-words">
            <span className="font-semibold">Ghi chú: </span>
            {order.note}
          </p>
        </>
      ) : null}

      <div className="my-2 border-t border-dashed border-black/40" />

      <footer className="text-center text-[9px] leading-relaxed">
        <p className="font-semibold">Cảm ơn quý khách!</p>
        <p>Hẹn gặp lại tại {RESTAURANT.name}</p>
        <p className="mt-1 text-[8px]">
          {RESTAURANT.phone} · {RESTAURANT.supportEmail}
        </p>
      </footer>
    </article>
  )
}
