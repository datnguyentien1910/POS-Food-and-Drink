import { cx } from '../../lib/cx'

interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-sm',
}

export function Avatar({ initials, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-linear-to-br from-[#2F28C9] to-[#7567F5] font-bold text-white ring-2 ring-primary-soft',
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  )
}
