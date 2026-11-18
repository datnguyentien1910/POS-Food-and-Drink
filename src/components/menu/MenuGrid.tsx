import type { MenuItem } from '../../types'
import { MenuCard } from './MenuCard'

interface MenuGridProps {
  items: MenuItem[]
  onAdd: (id: string) => void
}

export function MenuGrid({ items, onAdd }: MenuGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <MenuCard key={item.id} item={item} onAdd={onAdd} />
      ))}
    </div>
  )
}
