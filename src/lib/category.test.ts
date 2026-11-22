import { describe, expect, it } from 'vitest'
import { isVirtualCategory } from './category'

describe('isVirtualCategory', () => {
  it('recognises the seeded filter-only categories', () => {
    expect(isVirtualCategory('all')).toBe(true)
    expect(isVirtualCategory('popular')).toBe(true)
  })

  it('keeps real menu categories visible', () => {
    expect(isVirtualCategory('drinks')).toBe(false)
    expect(isVirtualCategory('starters')).toBe(false)
    expect(isVirtualCategory('mains')).toBe(false)
    expect(isVirtualCategory('desserts')).toBe(false)
    expect(isVirtualCategory('Món chính')).toBe(false)
  })
})
