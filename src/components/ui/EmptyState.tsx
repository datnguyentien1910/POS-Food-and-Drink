import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg/50 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
