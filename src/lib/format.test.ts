import { describe, expect, it } from 'vitest'
import { formatClock, formatDate, formatDateTime, formatVND } from './format'

describe('formatVND', () => {
  it('formats whole đồng with a dot separator', () => {
    expect(formatVND(129000)).toBe('129.000 ₫')
    expect(formatVND(0)).toBe('0 ₫')
  })

  it('rounds fractions before formatting', () => {
    expect(formatVND(1250.6)).toBe('1.251 ₫')
  })
})

describe('date and clock formatting', () => {
  const timestamp = new Date(2026, 10, 18, 9, 5).getTime()

  it('formats the clock as 24-hour time with leading zeros', () => {
    expect(formatClock(timestamp)).toBe('09:05')
  })

  it('formats the local date as dd/mm/yyyy', () => {
    expect(formatDate(timestamp)).toBe('18/11/2026')
  })

  it('combines date and clock', () => {
    expect(formatDateTime(timestamp)).toBe('18/11/2026 09:05')
  })
})
