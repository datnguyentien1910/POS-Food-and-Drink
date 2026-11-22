import { Check, CheckCheck, Trash2 } from 'lucide-react'
import { getMenuItem } from '../../data/menu'
import { formatVND } from '../../lib/format'
import type { CartLine } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Stepper } from '../ui/Stepper'

interface CartRowProps {
  line: CartLine
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
  showServed?: boolean
  onToggleServed?: () => void
}

export function CartRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
  showServed = false,
  onToggleServed,
}: CartRowProps) {
  const item = getMenuItem(line.menuItemId)
  if (!item) return null

  const served = line.served === true
  const canToggle = showServed && onToggleServed !== undefined
  const stepper = (
    <Stepper
      value={line.qty}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
    />
  )

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
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-xs font-semibold text-ink">
                {item.name}
              </h3>
              {served && canToggle ? (
                <Badge tone="positive" className="shrink-0">
                  Đã ra
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-muted tabular-nums">
              {formatVND(item.price)}
            </p>
          </div>
          <IconButton
            label={`Xoá ${item.name}`}
            tone="danger"
            size="sm"
            onClick={onRemove}
            disabled={served}
            className="size-7 shrink-0 rounded-md [@media(pointer:coarse)]:size-11"
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <fieldset disabled={served} className="m-0 min-w-0 border-0 p-0">
              {stepper}
            </fieldset>
            {canToggle ? (
              <Button
                size="sm"
                variant={served ? 'ghost' : 'secondary'}
                aria-pressed={served}
                onClick={onToggleServed}
                className={
                  served
                    ? 'h-8 shrink-0 px-2.5 text-[11px] text-positive hover:bg-positive-soft hover:text-positive'
                    : 'h-8 shrink-0 px-2.5 text-[11px]'
                }
              >
                {served ? <CheckCheck size={13} /> : <Check size={13} />}
                {served ? 'Đã ra' : 'Mang ra'}
              </Button>
            ) : null}
          </div>
          <p className="text-xs font-bold text-ink tabular-nums">
            {formatVND(item.price * line.qty)}
          </p>
        </div>
      </div>
    </article>
  )
}
