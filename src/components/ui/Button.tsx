import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-[0_10px_24px_-14px_rgba(36,30,178,0.9)] hover:bg-primary-hover',
  secondary:
    'border border-line bg-surface text-ink hover:border-line-strong hover:bg-bg',
  ghost: 'text-muted hover:bg-bg hover:text-ink',
  danger:
    'bg-negative-soft text-negative hover:bg-negative hover:text-white',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-lg px-3 text-xs',
  md: 'h-11 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'touch-target inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
