import { describe, expect, it } from 'vitest'
import { resolveMenuImage } from './menu-image'

describe('resolveMenuImage', () => {
  it('prefers an uploaded image URL', () => {
    expect(resolveMenuImage('/uploads/menu/a.webp', 'grilled-chicken.webp')).toBe(
      '/uploads/menu/a.webp',
    )
  })

  it('falls back to the bundled asset key', () => {
    expect(resolveMenuImage(null, 'grilled-chicken.webp')).toMatch(
      /grilled-chicken/,
    )
  })

  it('returns the placeholder when neither is set', () => {
    expect(resolveMenuImage(null, null)).toMatch(/^data:image\/svg\+xml/)
  })
})
