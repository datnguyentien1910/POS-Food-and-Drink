import { describe, expect, it } from 'vitest'
import { TAKEAWAY_KEY, orderKey } from './table-state'

describe('orderKey', () => {
  it('returns the table id or the takeaway slot', () => {
    expect(orderKey('ban-5')).toBe('ban-5')
    expect(orderKey(null)).toBe(TAKEAWAY_KEY)
    expect(TAKEAWAY_KEY).toBe('__takeaway__')
  })
})
