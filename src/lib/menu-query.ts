import { getMenuItem } from '../data/menu'
import type { MenuItem } from '../types'

export interface MenuQueryOptions {
  category: 'all' | 'popular' | MenuItem['category']
  query: string
  sort: 'default' | 'price-asc' | 'price-desc'
  popularOnly: boolean
  visibleCount: number
}

export interface MenuQueryResult {
  items: MenuItem[]
  total: number
  hasMore: boolean
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function queryMenu(
  items: MenuItem[],
  options: MenuQueryOptions,
): MenuQueryResult {
  const normalizedQuery = normalize(options.query)

  const filtered = items.filter((item) => {
    const inCategory =
      options.category === 'all' ||
      (options.category === 'popular'
        ? Boolean(item.popular)
        : item.category === options.category)
    const inPopular = !options.popularOnly || Boolean(item.popular)
    const inSearch =
      normalizedQuery.length === 0 ||
      normalize(item.name).includes(normalizedQuery) ||
      normalize(item.description ?? '').includes(normalizedQuery)

    return inCategory && inPopular && inSearch
  })

  const sorted = [...filtered]
  if (options.sort === 'price-asc') {
    sorted.sort((a, b) => a.price - b.price)
  } else if (options.sort === 'price-desc') {
    sorted.sort((a, b) => b.price - a.price)
  } else {
    // Stable sort keeps the catalog order among dishes with the same flag.
    sorted.sort((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)))
  }

  const visibleCount = Math.max(0, options.visibleCount)

  return {
    items: sorted.slice(0, visibleCount),
    total: sorted.length,
    hasMore: sorted.length > visibleCount,
  }
}

export function menuItemById(id: string): MenuItem | undefined {
  return getMenuItem(id)
}
