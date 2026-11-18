import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type IconButtonTone = 'neutral' | 'primary' | 'danger'

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  tone?: IconButtonTone
  size?: 'sm' | 'md'
}

const tones: Record<IconButtonTone, string> = {
  neutral: 'text-muted hover:bg-bg hover:text-ink',
  primary: 'text-primary hover:bg-primary-soft',
  danger: 'text-negative hover:bg-negative-soft',
}

export function IconButton({
  label,
  tone = 'neutral',
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'grid shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'size-8' : 'size-10',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
