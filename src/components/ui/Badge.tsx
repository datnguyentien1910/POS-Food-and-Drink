import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

type BadgeTone = 'neutral' | 'primary' | 'positive' | 'negative' | 'gold'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-bg text-muted border-line',
  primary: 'bg-primary-soft text-primary border-primary-soft',
  positive: 'bg-positive-soft text-positive border-positive-soft',
  negative: 'bg-negative-soft text-negative border-negative-soft',
  gold: 'bg-gold-soft text-brown border-gold-soft',
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-none font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
