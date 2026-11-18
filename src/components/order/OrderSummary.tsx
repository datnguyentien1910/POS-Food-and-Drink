import { useState } from 'react'
import { RESTAURANT } from '../../config'
import { formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import type { Totals } from '../../types'
import { DiscountModal } from '../modals/DiscountModal'

interface OrderSummaryProps {
  totals: Totals
}

export function OrderSummary({ totals }: OrderSummaryProps) {
  const [discountOpen, setDiscountOpen] = useState(false)
  const discount = usePOSStore((state) => state.discount)
  const taxPercent = Math.round(RESTAURANT.taxRate * 100)

  return (
    <section aria-label="Tổng kết đơn" className="mt-3">
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium text-muted">Tạm tính</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {formatVND(totals.subtotal)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt>
            <button
              type="button"
              aria-label="Sửa giảm giá"
              onClick={() => setDiscountOpen(true)}
              className="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-primary"
            >
              Giảm giá
              {discount.value > 0
                ? ` (${discount.type === 'percent' ? `${discount.value}%` : 'số tiền'})`
                : ''}
            </button>
          </dt>
          <dd
            className={`font-semibold tabular-nums ${
              totals.discountAmount > 0 ? 'text-positive' : 'text-faint'
            }`}
          >
            {totals.discountAmount > 0
              ? `-${formatVND(totals.discountAmount)}`
              : '—'}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium text-muted">VAT ({taxPercent}%)</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {formatVND(totals.tax)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm font-bold text-ink">Tổng cộng</span>
        <span className="text-base font-bold text-ink tabular-nums">
          {formatVND(totals.total)}
        </span>
      </div>

      <DiscountModal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        subtotal={totals.subtotal}
      />
    </section>
  )
}
