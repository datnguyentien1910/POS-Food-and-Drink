import { describe, expect, it } from 'vitest'
import { baseDelay, nextDelay } from './backoff'

describe('baseDelay', () => {
  it('follows the 2s → 5s → 15s → 30s → 60s ladder and clamps at 60s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(baseDelay)).toEqual([
      2000, 5000, 15000, 30000, 60000, 60000, 60000,
    ])
  })
})

describe('nextDelay', () => {
  it('applies ±20% jitter around the base delay', () => {
    expect(nextDelay(0, () => 0)).toBe(1600)
    expect(nextDelay(0, () => 0.5)).toBe(2000)
    expect(nextDelay(0, () => 1)).toBe(2400)
  })

  it('never returns a negative delay', () => {
    expect(nextDelay(4, () => 0)).toBeGreaterThan(0)
  })
})
