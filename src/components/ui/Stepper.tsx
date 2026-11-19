import { Minus, Plus } from 'lucide-react'
import { IconButton } from './IconButton'

interface StepperProps {
  value: number
  onIncrement: () => void
  onDecrement: () => void
  min?: number
}

export function Stepper({
  value,
  onIncrement,
  onDecrement,
  min = 1,
}: StepperProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
      <IconButton
        label="Giảm số lượng"
        size="sm"
        onClick={onDecrement}
        disabled={value <= min}
        className="size-7 rounded-md [@media(pointer:coarse)]:size-11"
      >
        <Minus size={13} strokeWidth={2.4} />
      </IconButton>
      <span
        className="min-w-6 text-center text-xs font-semibold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <IconButton
        label="Tăng số lượng"
        size="sm"
        onClick={onIncrement}
        className="size-7 rounded-md [@media(pointer:coarse)]:size-11"
      >
        <Plus size={13} strokeWidth={2.4} />
      </IconButton>
    </div>
  )
}
