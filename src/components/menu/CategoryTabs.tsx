import { CATEGORIES } from '../../data/menu'
import { cx } from '../../lib/cx'
import type { CategoryTabId } from '../../types'

interface CategoryTabsProps {
  active: CategoryTabId
  onChange: (category: CategoryTabId) => void
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div
      role="group"
      aria-label="Danh mục món"
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1"
    >
      {CATEGORIES.map((category) => {
        const isActive = category.id === active

        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(category.id)}
            className={cx(
              'touch-target shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-150 [@media(pointer:coarse)]:min-h-11',
              isActive
                ? 'bg-primary text-white shadow-[0_8px_18px_-12px_rgba(36,30,178,0.9)]'
                : 'text-muted hover:bg-bg hover:text-ink',
            )}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
