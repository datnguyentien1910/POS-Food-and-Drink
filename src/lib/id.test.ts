import { describe, expect, it } from 'vitest'
import { makeLineId } from './id'

describe('makeLineId', () => {
  it('returns unique, non-empty ids', () => {
    const a = makeLineId()
    const b = makeLineId()

    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
