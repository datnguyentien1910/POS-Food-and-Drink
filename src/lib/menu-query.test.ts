import { describe, expect, it } from 'vitest'
import { MENU_ITEMS } from '../data/menu'
import { queryMenu } from './menu-query'

const defaults = {
  category: 'all' as const,
  query: '',
  sort: 'default' as const,
  popularOnly: false,
  visibleCount: 12,
}

describe('queryMenu', () => {
  it('returns the first page of all items by default', () => {
    const result = queryMenu(MENU_ITEMS, defaults)

    expect(result.total).toBe(16)
    expect(result.items).toHaveLength(12)
    expect(result.hasMore).toBe(true)
    expect(result.items[0].name).toBe('Gà nướng')
  })

  it('filters by category tab', () => {
    const result = queryMenu(MENU_ITEMS, {
      ...defaults,
      category: 'drinks',
      visibleCount: 20,
    })

    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((item) => item.category === 'drinks')).toBe(true)
    expect(result.items.map((item) => item.name)).toContain('Cà phê nóng')
    expect(result.items.map((item) => item.name)).not.toContain('Gà nướng')
  })

  it('treats the popular tab and the popular filter as the same condition', () => {
    const tab = queryMenu(MENU_ITEMS, {
      ...defaults,
      category: 'popular',
      visibleCount: 20,
    })
    const filter = queryMenu(MENU_ITEMS, {
      ...defaults,
      popularOnly: true,
      visibleCount: 20,
    })

    expect(tab.items.length).toBeGreaterThan(0)
    expect(tab.items.every((item) => item.popular)).toBe(true)
    expect(filter.items.map((item) => item.id)).toEqual(
      tab.items.map((item) => item.id),
    )
  })

  it('searches without Vietnamese accents in names and descriptions', () => {
    const result = queryMenu(MENU_ITEMS, {
      ...defaults,
      query: 'ca phe',
      visibleCount: 20,
    })
    expect(result.items.map((item) => item.name)).toEqual(['Cà phê nóng'])

    const descriptionMatch = queryMenu(MENU_ITEMS, {
      ...defaults,
      query: 'pho mai',
      visibleCount: 20,
    })
    expect(descriptionMatch.items.length).toBeGreaterThan(0)
  })

  it('sorts by price without mutating the source list', () => {
    const source = [...MENU_ITEMS]
    const asc = queryMenu(source, {
      ...defaults,
      sort: 'price-asc',
      visibleCount: 20,
    })
    const desc = queryMenu(source, {
      ...defaults,
      sort: 'price-desc',
      visibleCount: 20,
    })

    expect(asc.items[0].price).toBe(25000)
    expect(desc.items[0].price).toBe(129000)
    expect(source[0].id).toBe(MENU_ITEMS[0].id)
  })

  it('combines category, search, and popularity filters', () => {
    const result = queryMenu(MENU_ITEMS, {
      ...defaults,
      category: 'drinks',
      query: 'tra',
      popularOnly: true,
      visibleCount: 20,
    })

    expect(result.items.map((item) => item.name)).toEqual(['Trà đào'])
  })

  it('reports no results for an unknown query', () => {
    const result = queryMenu(MENU_ITEMS, {
      ...defaults,
      query: 'sushi',
    })

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })
})
