import { Trash2 } from 'lucide-react'
import { getMenuItem } from '../../data/menu'
import { formatVND } from '../../lib/format'
import type { CartLine } from '../../types'
import { IconButton } from '../ui/IconButton'
import { Stepper } from '../ui/Stepper'

interface CartRowProps {
  line: CartLine
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
}

export function CartRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: CartRowProps) {
  const item = getMenuItem(line.menuItemId)
  if (!item) return null

  return (
    <article className="flex items-start gap-3 py-3">
      <img
        src={item.image}
        alt=""
        className="size-12 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-ink">
              {item.name}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-muted tabular-nums">
              {formatVND(item.price)}
            </p>
          </div>
          <IconButton
            label={`Xoá ${item.name}`}
            tone="danger"
            size="sm"
            onClick={onRemove}
            className="size-7 shrink-0 rounded-md [@media(pointer:coarse)]:size-11"
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Stepper
            value={line.qty}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
          <p className="text-xs font-bold text-ink tabular-nums">
            {formatVND(item.price * line.qty)}
          </p>
        </div>
      </div>
    </article>
  )
}
