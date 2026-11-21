import { Plus } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { formatVND } from '../../lib/format'
import type { MenuItem } from '../../types'
import { Badge } from '../ui/Badge'

interface MenuCardProps {
  item: MenuItem
  onAdd: (id: string) => void
}

export function MenuCard({ item, onAdd }: MenuCardProps) {
  const [pulse, setPulse] = useState(false)
  const unavailable = item.available === false

  const handleAdd = () => {
    if (unavailable) return
    onAdd(item.id)
    setPulse(true)
    window.setTimeout(() => setPulse(false), 320)
  }

  return (
    <article className="group card flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <div className="relative aspect-[4/3] overflow-hidden bg-line/40">
        <img
          src={item.image}
          alt={item.name}
          decoding="async"
          className={`size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
            unavailable ? 'opacity-50 grayscale' : ''
          }`}
        />
        {item.popular ? (
          <Badge tone="gold" className="absolute top-2 left-2 shadow-sm">
            Phổ biến
          </Badge>
        ) : null}
        {unavailable ? (
          <Badge tone="neutral" className="absolute top-2 right-2 shadow-sm">
            Hết hàng
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="truncate text-[13px] leading-snug font-semibold text-ink">
          {item.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
          {item.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <p className="text-[13px] font-bold text-primary tabular-nums">
            {formatVND(item.price)}
          </p>
          <button
            type="button"
            aria-label={`Thêm ${item.name}`}
            disabled={unavailable}
            onClick={handleAdd}
            className={cx(
              'touch-target grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary transition-colors duration-150 hover:bg-primary hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:bg-line/60 disabled:text-faint disabled:hover:bg-line/60 [@media(pointer:coarse)]:size-11',
              pulse && 'animate-pop',
            )}
          >
            <Plus size={15} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </article>
  )
}
