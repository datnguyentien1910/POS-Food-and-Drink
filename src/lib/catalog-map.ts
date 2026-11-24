import { isVirtualCategory } from './category'
import { resolveMenuImage } from './menu-image'
import type { ServerMenuCategory, ServerTable } from '../api/types'
import type { CategoryId, MenuItem, TableOption } from '../types'

const CATEGORY_IDS: CategoryId[] = ['drinks', 'starters', 'mains', 'desserts']

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value)
}

/** Flattens the grouped menu into UI items, inheriting the parent category. */
export function mapMenuItems(categories: ServerMenuCategory[]): MenuItem[] {
  const items: MenuItem[] = []

  for (const category of categories) {
    if (isVirtualCategory(category.name)) continue
    const categoryId: CategoryId = isCategoryId(category.name)
      ? category.name
      : 'mains'

    for (const item of category.items) {
      items.push({
        id: item.legacyId ?? item.id,
        serverId: item.id,
        name: item.name,
        description: item.description ?? undefined,
        price: item.price,
        category: categoryId,
        imageKey: item.imageKey,
        imageUrl: item.imageUrl,
        image: resolveMenuImage(item.imageUrl, item.imageKey),
        available: item.available,
        popular: item.popular,
      })
    }
  }

  return items
}

export function mapTables(tables: ServerTable[]): TableOption[] {
  return tables.map((table) => ({
    id: table.legacyId ?? table.id,
    serverId: table.id,
    name: table.name,
    seats: table.seats,
    zone: table.zone,
    syncState: 'synced',
  }))
}
