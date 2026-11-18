import { useEffect, useState } from 'react'
import { formatVND } from '../../lib/format'
import { usePOSStore } from '../../store/usePOSStore'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface DiscountModalProps {
  open: boolean
  onClose: () => void
  subtotal: number
}

const QUICK_PERCENTS = [5, 10, 20]

export function DiscountModal({ open, onClose, subtotal }: DiscountModalProps) {
  const discount = usePOSStore((state) => state.discount)
  const setDiscount = usePOSStore((state) => state.setDiscount)
  const [type, setType] = useState<'amount' | 'percent'>(discount.type)
  const [value, setValue] = useState(
    discount.value > 0 ? String(discount.value) : '',
  )

  useEffect(() => {
    if (!open) return
    setType(discount.type)
    setValue(discount.value > 0 ? String(discount.value) : '')
  }, [open, discount])

  const numericValue = Math.max(0, Number(value) || 0)
  const preview =
    type === 'percent'
      ? Math.min(subtotal, Math.round((subtotal * Math.min(100, numericValue)) / 100))
      : Math.min(subtotal, Math.round(numericValue))

  const apply = () => {
    setDiscount({ type, value: numericValue })
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Giảm giá"
      description="Giảm theo số tiền hoặc phần trăm trên tạm tính."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button size="sm" onClick={apply}>
            Áp dụng
          </Button>
        </div>
      }
    >
      <div className="flex gap-2">
        {(
          [
            { id: 'amount', label: 'Số tiền' },
            { id: 'percent', label: 'Phần trăm' },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={type === option.id}
            onClick={() => setType(option.id)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
              type === option.id
                ? 'border-primary-ring bg-primary-soft text-primary'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold text-muted">
          {type === 'percent' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (₫)'}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={type === 'percent' ? 100 : subtotal}
          aria-label="Giá trị giảm"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-bg/40 px-3 text-sm font-semibold text-ink tabular-nums placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none"
        />
      </label>

      {type === 'percent' ? (
        <div className="mt-2 flex gap-2">
          {QUICK_PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setValue(String(percent))}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-primary-ring hover:text-primary"
            >
              {percent}%
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-xs">
        <span className="font-medium text-muted">Giảm thực tế</span>
        <span className="font-bold text-positive tabular-nums">
          -{formatVND(preview)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Giảm giá không vượt quá tạm tính {formatVND(subtotal)}.
      </p>
    </Modal>
  )
}
