import { useState } from 'react'
import { Delete } from 'lucide-react'
import { cx } from '../../lib/cx'

interface PinPadProps {
  onSubmit: (pin: string) => void
  disabled?: boolean
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 4-digit keypad; submits automatically on the fourth digit. */
export function PinPad({ onSubmit, disabled = false }: PinPadProps) {
  const [pin, setPin] = useState('')

  const press = (digit: string) => {
    if (disabled || pin.length >= 4) return
    const next = pin + digit
    if (next.length === 4) {
      setPin('')
      onSubmit(next)
      return
    }
    setPin(next)
  }

  const backspace = () => {
    if (disabled) return
    setPin((current) => current.slice(0, -1))
  }

  return (
    <div className="w-full max-w-[280px]">
      <div
        className="mb-4 flex justify-center gap-3"
        aria-label="Số PIN đã nhập"
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            data-filled={index < pin.length}
            className={cx(
              'size-3.5 rounded-full transition-colors',
              index < pin.length ? 'bg-primary' : 'bg-line-strong',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {DIGIT_KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            aria-label={digit}
            disabled={disabled}
            onClick={() => press(digit)}
            className="touch-target h-14 rounded-xl border border-line bg-surface text-lg font-semibold text-ink transition-colors hover:border-line-strong hover:bg-bg disabled:opacity-45"
          >
            {digit}
          </button>
        ))}
        <span aria-hidden="true" />
        <button
          type="button"
          aria-label="0"
          disabled={disabled}
          onClick={() => press('0')}
          className="touch-target h-14 rounded-xl border border-line bg-surface text-lg font-semibold text-ink transition-colors hover:border-line-strong hover:bg-bg disabled:opacity-45"
        >
          0
        </button>
        <button
          type="button"
          aria-label="Xoá"
          disabled={disabled}
          onClick={backspace}
          className="touch-target grid h-14 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:bg-bg disabled:opacity-45"
        >
          <Delete size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
